"""Stage 05 — one row per (game, player).

Aggregates the per-ply features into ~35 columns describing how each player
handled each game: accuracy by phase / game-state / tactical-vs-quiet /
time-scramble, plus style rates (castling timing, checks, captures,
king-ward moves, sacrifices, tension release, think time). Game-level
context (eval volatility, length, book depth) is joined onto both sides.

The enrichment + aggregation logic lives in ``pipeline/common/gameagg.py``
— shared with the inference service, which runs it on one user's games.

Reads ``data/<month>/move_features/`` + ``games/``; writes
``data/<month>/game_agg.parquet``.

    python pipeline/05_game_agg.py
"""

from __future__ import annotations

import pathlib
import sys

import polars as pl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.filters import parse_time_control  # noqa: E402
from pipeline.common.gameagg import enrich_plies, game_level_agg, side_agg  # noqa: E402


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)

    games = pl.read_parquet(month_dir / "games" / "*.parquet").select(
        "game_id", "white", "black", "white_elo", "black_elo", "result", "eco", "utc_date", "time_control"
    )
    tc = [parse_time_control(t) or (0, 0) for t in games["time_control"]]
    games = games.with_columns(tc_base=pl.Series([b for b, _ in tc], dtype=pl.Int32))

    lf = (
        pl.scan_parquet(month_dir / "move_features" / "*.parquet")
        .join(games.lazy().select("game_id", "tc_base", "eco"), on="game_id")
        .sort("game_id", "ply")
    )
    lf = enrich_plies(lf)
    game_lvl = game_level_agg(lf)

    rows = []
    for side in ("w", "b"):
        agg = side_agg(lf, side).join(game_lvl, on="game_id").collect()
        is_w = side == "w"
        meta = games.with_columns(
            player_hash=pl.col("white" if is_w else "black").str.to_lowercase().hash(seed=1).cast(pl.Utf8),
            player_elo=pl.col("white_elo" if is_w else "black_elo"),
            opp_elo=pl.col("black_elo" if is_w else "white_elo"),
            result_for_player=pl.when(pl.col("result") == "1-0")
            .then(pl.lit("win" if is_w else "loss"))
            .when(pl.col("result") == "0-1")
            .then(pl.lit("loss" if is_w else "win"))
            .otherwise(pl.lit("draw")),
        ).select("game_id", "player_hash", "player_elo", "opp_elo", "result_for_player", "utc_date")
        rows.append(agg.join(meta, on="game_id"))

    out = pl.concat(rows).with_columns(
        castle_side=pl.col("castle_san").replace_strict(
            {"O-O": "k", "O-O-O": "q"}, default="none"
        ),
        was_winning_after20=pl.col("max_wp_after20") >= 85,
        was_losing_after20=pl.col("min_wp_after20") <= 15,
    ).drop("castle_san")

    out.write_parquet(month_dir / "game_agg.parquet")
    print(f"game_agg: {out.height:,} rows ({out['player_hash'].n_unique():,} players), {len(out.columns)} cols")


if __name__ == "__main__":
    run()
