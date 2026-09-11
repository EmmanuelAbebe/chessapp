"""Stage 06 — one vector per player.

Filters to players with enough games, caps to the most recent
``max_games_per_player``, aggregates ``game_agg`` to per-player means (via
``pipeline/common/playeragg.py`` — shared with the service), then
null-fills with the Elo-band median.

Writes ``data/<month>/player_vectors.parquet`` and, for stage 11's
stylometry check, ``player_vectors_split.parquet`` (two half-sample
vectors per player).

    python pipeline/06_player_vectors.py
"""

from __future__ import annotations

import pathlib
import sys

import polars as pl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import MODELLED  # noqa: E402
from pipeline.common.playeragg import aggregate_players  # noqa: E402


def _aggregate_and_fill(ga: pl.DataFrame, keys: list[str]) -> pl.DataFrame:
    agg = aggregate_players(ga, keys)
    agg = agg.with_columns(elo_band=(pl.col("player_elo") // 100 * 100).cast(pl.Int32))
    for feat in MODELLED:
        agg = agg.with_columns(
            pl.col(feat)
            .cast(pl.Float64)
            .fill_nan(None)
            .fill_null(pl.col(feat).median().over("elo_band"))
            .fill_null(pl.col(feat).median())
            .fill_null(0.0)  # last resort: a feature with no data anywhere in the population
        )
    return agg


def run() -> None:
    cfg = cfgmod.load()
    pv = cfg["player_vectors"]
    month_dir = cfgmod.month_dir(cfg)

    ga = pl.read_parquet(month_dir / "game_agg.parquet")

    counts = ga.group_by("player_hash").agg(
        pl.len().alias("n"),
        (pl.col("n_my_clocked_moves") > 5).sum().alias("n_clk"),
    )
    keep = counts.filter(
        (pl.col("n") >= pv["min_games"]) & (pl.col("n_clk") >= pv["min_games_with_clocks"])
    )["player_hash"]
    ga = ga.filter(pl.col("player_hash").is_in(keep))

    # most-recent cap
    ga = (
        ga.with_columns(
            _rn=pl.col("utc_date").rank("ordinal", descending=True).over("player_hash")
        )
        .filter(pl.col("_rn") <= pv["max_games_per_player"])
        .drop("_rn")
        .with_columns(
            _half=(pl.col("utc_date").rank("ordinal").over("player_hash") % 2).cast(pl.Int8)
        )
    )
    print(f"{ga['player_hash'].n_unique():,} players after filtering")

    _aggregate_and_fill(ga, ["player_hash"]).write_parquet(month_dir / "player_vectors.parquet")
    _aggregate_and_fill(ga, ["player_hash", "_half"]).write_parquet(
        month_dir / "player_vectors_split.parquet"
    )
    print("done -> player_vectors.parquet (+ _split for stylometry)")


if __name__ == "__main__":
    run()
