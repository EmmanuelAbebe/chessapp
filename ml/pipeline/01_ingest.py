"""Stage 01 — checkpointed streaming ingest of one Lichess monthly dump.

Streams ``lichess_db_standard_rated_<month>.pgn.zst`` over HTTP, decompresses
on the fly, keeps only rated blitz games with both Elos in range and dense
``%eval`` coverage, and writes compact parquet. Nothing large touches disk:
peak RAM is one text chunk plus one flush buffer.

Resumable: every ``checkpoint_every`` kept games it flushes a parquet
partition pair and rewrites ``checkpoint.json``. Re-running resumes by
re-streaming and skip-parsing (headers only) up to the recorded position.

    python pipeline/01_ingest.py
"""

from __future__ import annotations

import io
import json
import pathlib
import sys
import time

import chess
import chess.pgn
import polars as pl
from tqdm import tqdm

# Module names can't start with a digit, so these stages run as scripts, not
# `python -m`. Put the ml/ root on the path so `pipeline.common.*` imports work.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common import pgn as pgnmod  # noqa: E402
from pipeline.common.filters import header_ok  # noqa: E402

GAMES_SCHEMA = {
    "game_id": pl.Utf8,
    "white": pl.Utf8,
    "black": pl.Utf8,
    "white_elo": pl.Int32,
    "black_elo": pl.Int32,
    "time_control": pl.Utf8,
    "speed": pl.Utf8,
    "eco": pl.Utf8,
    "opening": pl.Utf8,
    "termination": pl.Utf8,
    "result": pl.Utf8,
    "utc_date": pl.Utf8,
    "utc_time": pl.Utf8,
    "ply_count": pl.Int32,
    "eval_coverage": pl.Float32,
    "has_clocks": pl.Boolean,
}
MOVES_SCHEMA = {
    "game_id": pl.Utf8,
    "ply": pl.Int16,
    "san": pl.Utf8,
    "uci": pl.Utf8,
    "eval_cp": pl.Int32,
    "eval_mate": pl.Int8,
    "clock_cs": pl.Int32,
}


class Checkpoint:
    def __init__(self, path):
        self.path = path
        self.games_seen = 0
        self.games_kept = 0
        self.games_failed = 0
        self.partitions = 0
        if path.exists():
            data = json.loads(path.read_text())
            self.__dict__.update({k: data[k] for k in data if k != "path"})

    def save(self):
        self.path.write_text(
            json.dumps(
                {
                    "games_seen": self.games_seen,
                    "games_kept": self.games_kept,
                    "games_failed": self.games_failed,
                    "partitions": self.partitions,
                },
                indent=2,
            )
        )


def parse_game(headers_text: str, movetext: str):
    """Full parse of a header-filtered game. Returns (game_row, move_rows)
    or None if it fails a content check or won't parse."""
    game = chess.pgn.read_game(io.StringIO(f"{headers_text}\n\n{movetext}\n"))
    if game is None or game.errors:
        return None

    h = game.headers
    game_id = h.get("Site", "").rstrip("/").rsplit("/", 1)[-1]
    if not game_id:
        return None

    board = game.board()
    move_rows: list[tuple] = []
    clocked = 0
    evaled = 0
    for ply, node in enumerate(game.mainline(), start=1):
        move = node.move
        try:
            san = board.san(move)
        except (AssertionError, ValueError):
            return None
        comment = node.comment or ""
        ev = pgnmod.EVAL_RE.search(comment)
        eval_cp, eval_mate = (
            pgnmod.parse_eval_token(ev.group(1)) if ev else (None, None)
        )
        clock_cs = pgnmod.clock_to_cs(pgnmod.CLK_RE.search(comment))
        if eval_cp is not None or eval_mate is not None:
            evaled += 1
        if clock_cs is not None:
            clocked += 1
        move_rows.append(
            (game_id, ply, san, move.uci(), eval_cp, eval_mate, clock_cs)
        )
        board.push(move)

    return game, game_id, move_rows, evaled, clocked


def run() -> None:
    cfg = cfgmod.load()
    ing = cfg["ingest"]
    out_dir = cfgmod.month_dir(cfg)
    (out_dir / "games").mkdir(exist_ok=True)
    (out_dir / "moves").mkdir(exist_ok=True)
    ckpt = Checkpoint(out_dir / "checkpoint.json")

    if ckpt.games_kept >= ing["target_games"]:
        print(f"already have {ckpt.games_kept} games (target {ing['target_games']}) — nothing to do")
        return

    url = cfgmod.dump_url(cfg)
    print(f"streaming {url}")
    if ckpt.games_seen:
        print(f"resuming: skip-parsing to game {ckpt.games_seen:,}")

    stream = pgnmod.open_stream(url, ing["request_timeout_s"])
    skip_to = ckpt.games_seen
    started = time.time()

    game_buf: list[dict] = []
    move_buf: list[tuple] = []

    def flush() -> None:
        if not game_buf:
            return
        idx = ckpt.partitions
        pl.DataFrame(game_buf, schema=GAMES_SCHEMA).write_parquet(
            out_dir / "games" / f"part_{idx:05d}.parquet"
        )
        pl.DataFrame(move_buf, schema=MOVES_SCHEMA, orient="row").write_parquet(
            out_dir / "moves" / f"part_{idx:05d}.parquet"
        )
        ckpt.partitions += 1
        ckpt.save()
        game_buf.clear()
        move_buf.clear()

    bar = tqdm(unit=" games", desc="seen")
    for headers_text, movetext in pgnmod.iter_raw_games(stream, ing["read_chunk_bytes"]):
        ckpt.games_seen += 1
        bar.update(1)
        if ckpt.games_seen <= skip_to:
            continue

        h = pgnmod.parse_headers(headers_text)
        if not header_ok(h, ing):
            continue

        parsed = None
        try:
            parsed = parse_game(headers_text, movetext)
        except Exception:  # noqa: BLE001 — a single bad game must not kill the run
            parsed = None
        if parsed is None:
            ckpt.games_failed += 1
            continue

        game, game_id, move_rows, evaled, clocked = parsed
        pc = len(move_rows)
        if pc < ing["min_plies"]:
            continue
        coverage = evaled / pc if pc else 0.0
        if coverage < ing["min_eval_coverage"]:
            continue

        gh = game.headers
        game_buf.append(
            {
                "game_id": game_id,
                "white": gh.get("White", ""),
                "black": gh.get("Black", ""),
                "white_elo": int(gh.get("WhiteElo", 0) or 0),
                "black_elo": int(gh.get("BlackElo", 0) or 0),
                "time_control": gh.get("TimeControl"),
                "speed": ing["speed"],
                "eco": gh.get("ECO"),
                "opening": gh.get("Opening"),
                "termination": gh.get("Termination"),
                "result": gh.get("Result"),
                "utc_date": gh.get("UTCDate"),
                "utc_time": gh.get("UTCTime"),
                "ply_count": pc,
                "eval_coverage": coverage,
                "has_clocks": clocked >= pc * 0.8,
            }
        )
        move_buf.extend(move_rows)
        ckpt.games_kept += 1

        if ckpt.games_kept % ing["checkpoint_every"] == 0:
            flush()
            rate = ckpt.games_seen / max(time.time() - started, 1)
            bar.set_postfix(kept=ckpt.games_kept, seen_per_s=f"{rate:,.0f}")

        if ckpt.games_kept >= ing["target_games"]:
            break

    flush()
    bar.close()
    print(
        f"done: {ckpt.games_kept:,} kept / {ckpt.games_seen:,} seen "
        f"/ {ckpt.games_failed:,} failed / {ckpt.partitions} partitions"
    )


if __name__ == "__main__":
    run()
