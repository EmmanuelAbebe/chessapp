"""Stage 02 — per-ply derived features.

Replays every game once (python-chess), computing the signals the trait
layer needs: win-probability loss, move classification, phase, material
swing, king-distance, SEE, pawn tension, think-time, legal-move count, and
opening-book membership. Reads ``data/<month>/{games,moves}/``; writes
``data/<month>/move_features/``.

Two phases: (A) replay + per-ply features incl. ``epd_before`` for early
plies, (B) a global count of (position, move) pairs to mark ``in_book`` and
``plies_since_book_exit``.

    python pipeline/02_move_features.py
"""

from __future__ import annotations

import pathlib
import sys

import chess
import polars as pl
from tqdm import tqdm

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import chessext, config as cfgmod  # noqa: E402
from pipeline.common.evalscale import (  # noqa: E402
    classify,
    mover_percent,
    white_percent,
    white_score,
)
from pipeline.common.filters import parse_time_control  # noqa: E402

FEATURE_SCHEMA = {
    "game_id": pl.Utf8,
    "ply": pl.Int16,
    "mover": pl.Utf8,
    "san": pl.Utf8,
    "uci": pl.Utf8,
    "eval_cp": pl.Int32,
    "eval_mate": pl.Int8,
    "clock_cs": pl.Int32,
    "wp_white_after": pl.Float32,
    "wp_loss": pl.Float32,
    "classification": pl.Utf8,
    "phase": pl.Utf8,
    "material_white": pl.Float32,
    "material_swing": pl.Float32,
    "piece_moved": pl.Utf8,
    "is_capture": pl.Boolean,
    "is_check": pl.Boolean,
    "is_castle": pl.Boolean,
    "is_dev_move": pl.Boolean,
    "is_pawn_push": pl.Boolean,
    "king_dist_delta": pl.Int8,
    "see": pl.Float32,
    "pawn_tension_before": pl.Int8,
    "released_tension": pl.Boolean,
    "is_defending": pl.Boolean,
    "think_time_s": pl.Float32,
    "legal_moves_before": pl.Int16,
    "epd_before": pl.Utf8,
    **{name: pl.Float32 for name in chessext.STATIC_FEATURE_NAMES},
}

_PIECE_LETTER = {
    chess.PAWN: "p",
    chess.KNIGHT: "n",
    chess.BISHOP: "b",
    chess.ROOK: "r",
    chess.QUEEN: "q",
    chess.KING: "k",
}


def _features_for_game(moves: list[dict], inc: int, base: int, book_max_ply: int, thr: dict):
    board = chess.Board()
    rows: list[dict] = []
    prev_material = 0.0
    # White win% after each ply, for computing the next ply's "before"
    prev_white_pct: float | None = None
    clocks: list[int | None] = [None]  # index 0 unused; clocks[ply] is 1-indexed

    for m in moves:
        ply = m["ply"]
        mover = "w" if board.turn == chess.WHITE else "b"
        move = chess.Move.from_uci(m["uci"])
        if move not in board.legal_moves:
            return None  # corrupt row

        eval_cp, eval_mate = m["eval_cp"], m["eval_mate"]
        wp_white_after = white_percent(white_score(eval_cp, eval_mate))
        mover_pct_after = wp_white_after if mover == "w" else 100.0 - wp_white_after
        wp_loss = None
        classification = None
        if prev_white_pct is not None:
            mover_pct_before = prev_white_pct if mover == "w" else 100.0 - prev_white_pct
            wp_loss = max(0.0, mover_pct_before - mover_pct_after)
            classification = classify(wp_loss, thr)

        is_defending = False
        if prev_white_pct is not None:
            mover_cp_before = (prev_white_pct - 50.0) * (1 if mover == "w" else -1)
            is_defending = mover_cp_before <= -7.0  # ~ -0.5 pawn in win% terms

        see = chessext.static_exchange_eval(board, move)
        kdd = chessext.king_distance_delta(board, move)
        tension_before = chessext.pawn_tension(board)
        piece_moved = _PIECE_LETTER.get(board.piece_type_at(move.from_square))
        is_pawn = board.piece_type_at(move.from_square) == chess.PAWN
        is_cap = board.is_capture(move)
        is_castle = board.is_castling(move)
        released = bool(is_pawn and is_cap)
        legal_before = board.legal_moves.count()
        dev = chessext.is_developing_move(board, move)
        epd_before = board.epd() if ply <= book_max_ply else None
        static = chessext.static_features(board)

        board.push(move)
        material = chessext.material_balance(board)
        gives_check = board.is_check()
        phase = chessext.game_phase(board, ply)

        think = None
        clk = m["clock_cs"]
        clocks.append(clk)
        if ply >= 3 and clk is not None and clocks[ply - 2] is not None:
            raw = (clocks[ply - 2] - clk) / 100.0 + inc
            if 0.0 <= raw <= max(base, 1):
                think = raw

        rows.append(
            {
                "game_id": m["game_id"],
                "ply": ply,
                "mover": mover,
                "san": m["san"],
                "uci": m["uci"],
                "eval_cp": eval_cp,
                "eval_mate": eval_mate,
                "clock_cs": clk,
                "wp_white_after": wp_white_after,
                "wp_loss": wp_loss,
                "classification": classification,
                "phase": phase,
                "material_white": material,
                "material_swing": abs(material - prev_material),
                "piece_moved": piece_moved,
                "is_capture": is_cap,
                "is_check": gives_check,
                "is_castle": is_castle,
                "is_dev_move": dev,
                "is_pawn_push": bool(is_pawn and not is_cap),
                "king_dist_delta": kdd,
                "see": see,
                "pawn_tension_before": min(tension_before, 127),
                "released_tension": released,
                "is_defending": is_defending,
                "think_time_s": think,
                "legal_moves_before": legal_before,
                "epd_before": epd_before,
                **static,
            }
        )
        prev_material = material
        prev_white_pct = wp_white_after

    return rows


def _phase_a(cfg, month_dir, thr, book_max_ply):
    raw_dir = month_dir / "move_features_raw"
    raw_dir.mkdir(exist_ok=True)
    games = pl.read_parquet(month_dir / "games" / "*.parquet").select(
        "game_id", "time_control"
    )
    inc_by_game = {}
    base_by_game = {}
    for gid, tc in zip(games["game_id"], games["time_control"]):
        parsed = parse_time_control(tc) or (0, 0)
        base_by_game[gid], inc_by_game[gid] = parsed

    move_parts = sorted((month_dir / "moves").glob("*.parquet"))
    for part in tqdm(move_parts, desc="phase A (replay)"):
        moves = pl.read_parquet(part).sort("game_id", "ply")
        out: list[dict] = []
        for gid, grp in moves.group_by("game_id", maintain_order=True):
            gid = gid[0] if isinstance(gid, tuple) else gid
            rows = _features_for_game(
                grp.to_dicts(),
                inc_by_game.get(gid, 0),
                base_by_game.get(gid, 0),
                book_max_ply,
                thr,
            )
            if rows:
                out.extend(rows)
        if out:
            pl.DataFrame(out, schema=FEATURE_SCHEMA).write_parquet(
                raw_dir / part.name
            )
    return raw_dir


def _phase_b(month_dir, raw_dir, book_min_count):
    out_dir = month_dir / "move_features"
    out_dir.mkdir(exist_ok=True)

    book = (
        pl.scan_parquet(raw_dir / "*.parquet")
        .filter(pl.col("epd_before").is_not_null())
        .group_by("epd_before", "uci")
        .len()
        .filter(pl.col("len") >= book_min_count)
        .select("epd_before", "uci")
        .collect()
    )
    book_set = set(zip(book["epd_before"], book["uci"]))
    print(f"opening book: {len(book_set):,} (position, move) pairs")

    for part in tqdm(sorted(raw_dir.glob("*.parquet")), desc="phase B (book)"):
        df = pl.read_parquet(part)
        book_move = [
            (e is not None) and ((e, u) in book_set)
            for e, u in zip(df["epd_before"], df["uci"])
        ]
        df = df.with_columns(pl.Series("book_move", book_move))
        df = df.with_columns(
            in_book=(pl.col("book_move").cast(pl.Int8).cum_min().over("game_id") == 1)
        )
        last = (
            df.filter("in_book")
            .group_by("game_id")
            .agg(pl.col("ply").max().alias("last_in_book_ply"))
        )
        df = df.join(last, on="game_id", how="left").with_columns(
            pl.col("last_in_book_ply").fill_null(0)
        )
        df = df.with_columns(
            plies_since_book_exit=pl.when("in_book")
            .then(0)
            .otherwise(pl.col("ply") - pl.col("last_in_book_ply"))
            .cast(pl.Int16)
        ).drop("book_move", "last_in_book_ply", "epd_before")
        df.write_parquet(out_dir / part.name)


def run() -> None:
    cfg = cfgmod.load()
    mf = cfg["move_features"]
    month_dir = cfgmod.month_dir(cfg)
    raw_dir = _phase_a(cfg, month_dir, mf["classify"], mf["book_max_ply"])
    _phase_b(month_dir, raw_dir, mf["book_min_count"])
    print("done -> data/<month>/move_features/")


if __name__ == "__main__":
    run()
