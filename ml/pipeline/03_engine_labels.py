"""Stage 03 — Stockfish labels on a stratified sample (run on a cloud spot VM).

For a sample of games spread across the Elo range, analyse ~10 sampled plies
each with native Stockfish (multipv, depth ~14) and emit the labels stage 04
learns to predict from static board features:

  wp_loss_engine, best_uci, matches_best, only_move, complexity, has_tactic

Reads ``data/<month>/{move_features,games}/``; writes
``data/<month>/engine_labels/``. Parallel across all vCPUs (one engine per
worker). Resumable at partition granularity.

    python pipeline/03_engine_labels.py
"""

from __future__ import annotations

import multiprocessing as mp
import pathlib
import random
import sys

import chess
import chess.engine
import polars as pl
from tqdm import tqdm

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.evalscale import white_percent, white_score  # noqa: E402

OUT_SCHEMA = {
    "game_id": pl.Utf8,
    "ply": pl.Int16,
    "mover": pl.Utf8,
    "fen_before": pl.Utf8,
    "played_uci": pl.Utf8,
    "best_uci": pl.Utf8,
    "matches_best": pl.Boolean,
    "wp_loss_engine": pl.Float32,
    "only_move": pl.Boolean,
    "complexity": pl.Float32,
    "has_tactic": pl.Boolean,
    "n_lines": pl.Int8,
    "cp1": pl.Int32,
    "mate1": pl.Int8,
}

_ENGINE: chess.engine.SimpleEngine | None = None
_CFG: dict = {}


def _init_worker(sf_path: str, threads: int, depth: int, multipv: int, plies: int, only_gap: float) -> None:
    global _ENGINE, _CFG
    _ENGINE = chess.engine.SimpleEngine.popen_uci(sf_path)
    _ENGINE.configure({"Threads": threads, "Hash": 64})
    _CFG = {
        "depth": depth, "multipv": multipv, "sf_path": sf_path, "threads": threads,
        "plies": plies, "only_gap": only_gap,
    }


def _restart_engine() -> None:
    global _ENGINE
    try:
        if _ENGINE is not None:
            _ENGINE.quit()
    except Exception:  # noqa: BLE001
        pass
    _ENGINE = chess.engine.SimpleEngine.popen_uci(_CFG["sf_path"])
    _ENGINE.configure({"Threads": _CFG["threads"], "Hash": 64})


def _pov(score: chess.engine.PovScore, color: chess.Color) -> tuple[int | None, int | None]:
    p = score.pov(color)
    return (None, p.mate()) if p.is_mate() else (p.score(), None)


def _mwp(cp: int | None, mate: int | None) -> float:
    return white_percent(white_score(cp, mate))


def _pick_plies(wp_after: list[float], want: int) -> list[int]:
    n = len(wp_after)
    if n <= want:
        return list(range(1, n + 1))
    fixed = {max(2, min(n, round(n * f))) for f in (0.15, 0.35, 0.55, 0.75, 0.9)}
    jumps = sorted(
        range(2, n + 1),
        key=lambda i: abs(wp_after[i - 1] - wp_after[i - 2]),
        reverse=True,
    )
    picks = set(fixed)
    for i in jumps:
        if len(picks) >= want:
            break
        picks.add(i)
    return sorted(picks)


def _analyse_game(args) -> list[tuple]:
    game_id, ucis, wp_after = args
    depth, multipv = _CFG["depth"], _CFG["multipv"]
    limit = chess.engine.Limit(depth=depth)
    targets = set(_pick_plies(wp_after, _CFG["plies"]))

    board = chess.Board()
    snapshots: list[tuple[int, str, str]] = []  # (ply, fen_before, played_uci)
    for i, uci in enumerate(ucis, start=1):
        if i in targets:
            snapshots.append((i, board.fen(), uci))
        try:
            board.push(chess.Move.from_uci(uci))
        except (ValueError, AssertionError):
            break

    rows: list[tuple] = []
    for ply, fen, played in snapshots:
        b = chess.Board(fen)
        mover = "w" if b.turn == chess.WHITE else "b"
        try:
            info = _ENGINE.analyse(b, limit, multipv=multipv)
        except chess.engine.EngineError:
            continue
        except chess.engine.EngineTerminatedError:
            _restart_engine()
            continue
        if not info:
            continue
        lines = info if isinstance(info, list) else [info]
        pv_cp_mate = [_pov(li["score"], b.turn) for li in lines]
        pv_first = [li["pv"][0] for li in lines if li.get("pv")]
        if not pv_first:
            continue

        cp1, mate1 = pv_cp_mate[0]
        best = pv_first[0]
        mwp_best = _mwp(cp1, mate1)

        only_move = None
        complexity = None
        if len(pv_cp_mate) >= 2:
            mwp2 = _mwp(*pv_cp_mate[1])
            mwp_last = _mwp(*pv_cp_mate[-1])
            only_move = (mwp_best - mwp2) >= _CFG["only_gap"]
            complexity = float(mwp_best - mwp_last)

        forcing = b.is_capture(best) or b.gives_check(best) or best.promotion is not None
        gap2 = 0.0 if len(pv_cp_mate) < 2 else (mwp_best - _mwp(*pv_cp_mate[1]))
        has_tactic = bool(forcing and gap2 >= 20.0)

        # played move's eval: search the position after it (opponent to move), negate
        mwp_played = mwp_best
        if played != best.uci():
            try:
                after = chess.Board(fen)
                after.push(chess.Move.from_uci(played))
                pinfo = _ENGINE.analyse(after, limit)
                pcp, pmate = _pov(pinfo["score"], after.turn)
                mwp_played = _mwp(
                    None if pcp is None else -pcp,
                    None if pmate is None else -pmate,
                )
            except (chess.engine.EngineError, ValueError, AssertionError, KeyError):
                mwp_played = mwp_best
            except chess.engine.EngineTerminatedError:
                _restart_engine()

        rows.append(
            (
                game_id, ply, mover, fen, played, best.uci(),
                played == best.uci(),
                float(max(0.0, mwp_best - mwp_played)),
                only_move, complexity, has_tactic,
                len(pv_cp_mate),
                cp1 if cp1 is not None else None,
                mate1 if mate1 is not None else None,
            )
        )
    return rows


def _stratified_game_ids(games: pl.DataFrame, sample: int, elo_lo: int, elo_hi: int) -> list[str]:
    df = games.with_columns(
        ((pl.col("white_elo") + pl.col("black_elo")) / 2).round().alias("game_elo")
    )
    bands = list(range(elo_lo, elo_hi, 100))
    per_band = max(1, sample // len(bands))
    rng = random.Random(17)
    picked: list[str] = []
    for lo in bands:
        ids = df.filter(
            (pl.col("game_elo") >= lo) & (pl.col("game_elo") < lo + 100)
        )["game_id"].to_list()
        rng.shuffle(ids)
        picked.extend(ids[:per_band])
    rng.shuffle(picked)
    return picked[:sample]


def run() -> None:
    cfg = cfgmod.load()
    el = cfg["engine_labels"]

    sf_path = cfg["paths"]["stockfish"]
    if not sf_path.exists():
        sys.exit(f"Stockfish binary not found at {sf_path} — see ml/README.md")

    month_dir = cfgmod.month_dir(cfg)
    out_dir = month_dir / "engine_labels"
    out_dir.mkdir(exist_ok=True)
    done = {p.stem for p in out_dir.glob("*.parquet")}

    games = pl.read_parquet(month_dir / "games" / "*.parquet")
    wanted = set(
        _stratified_game_ids(games, el["sample_games"], cfg["ingest"]["elo_min"], cfg["ingest"]["elo_max"])
    )
    print(f"sampled {len(wanted):,} games across the Elo range")

    # build (game_id, [uci by ply], [wp_white_after by ply]) for wanted games
    mf = (
        pl.scan_parquet(month_dir / "move_features" / "*.parquet")
        .select("game_id", "ply", "uci", "wp_white_after")
        .filter(pl.col("game_id").is_in(list(wanted)))
        .sort("game_id", "ply")
        .collect()
    )
    tasks = []
    for gid, grp in mf.group_by("game_id", maintain_order=True):
        gid = gid[0] if isinstance(gid, tuple) else gid
        tasks.append((gid, grp["uci"].to_list(), grp["wp_white_after"].to_list()))

    n_workers = mp.cpu_count()
    chunk_games = 2000
    buf: list[tuple] = []
    part = len(done)
    print(f"{len(tasks):,} games, {n_workers} workers, depth {el['depth']}")

    with mp.Pool(
        n_workers,
        initializer=_init_worker,
        initargs=(
            str(sf_path), el["threads_per_worker"], el["depth"], el["multipv"],
            el["plies_per_game"], float(el["only_move_wp_gap"]),
        ),
    ) as pool:
        for rows in tqdm(
            pool.imap_unordered(_analyse_game, tasks, chunksize=8),
            total=len(tasks),
            desc="analysing",
        ):
            buf.extend(rows)
            if len(buf) >= chunk_games * 6:
                pl.DataFrame(buf, schema=OUT_SCHEMA, orient="row").write_parquet(
                    out_dir / f"part_{part:05d}.parquet"
                )
                part += 1
                buf.clear()

    if buf:
        pl.DataFrame(buf, schema=OUT_SCHEMA, orient="row").write_parquet(
            out_dir / f"part_{part:05d}.parquet"
        )
    print(f"done -> {out_dir}")


if __name__ == "__main__":
    run()
