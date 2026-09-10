"""Stage 06 — one vector per player.

Filters to players with enough games, caps to the most recent
``max_games_per_player``, aggregates ``game_agg`` to per-player means, adds
the derived cross-bucket traits (tactical_gap, choke, tilt, ...) and
opening entropy / Elo trend, then null-fills with the Elo-band median.

Writes ``data/<month>/player_vectors.parquet`` and, for stage 11's
stylometry check, ``player_vectors_split.parquet`` (two half-sample
vectors per player).

    python pipeline/06_player_vectors.py
"""

from __future__ import annotations

import math
import pathlib
import sys

import numpy as np
import polars as pl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import MODELLED, STYLE  # noqa: E402


def _entropy(labels: list[str | None]) -> float:
    vals = [x for x in labels if x]
    if not vals:
        return 0.0
    uniq = set(vals)
    n, k, alpha = len(vals), len(uniq), 0.5
    denom = n + alpha * len(uniq)
    h = 0.0
    for u in uniq:
        p = (vals.count(u) + alpha) / denom
        h -= p * math.log(p)
    return h / math.log(k) if k > 1 else 0.0  # normalised 0..1


def _slope(dates: list[str], elos: list[int]) -> float:
    if len(elos) < 3:
        return 0.0
    order = np.argsort(dates)
    y = np.asarray(elos, dtype=float)[order]
    x = np.arange(len(y), dtype=float)
    x -= x.mean()
    denom = (x * x).sum()
    return float((x * (y - y.mean())).sum() / denom) if denom else 0.0


def _aggregate(ga: pl.DataFrame, keys: list[str]) -> pl.DataFrame:
    agg = ga.group_by(keys).agg(
        pl.len().alias("n_games"),
        (pl.col("player_side") == "w").sum().alias("n_games_white"),
        (pl.col("player_side") == "b").sum().alias("n_games_black"),
        pl.col("player_elo").median().alias("player_elo"),
        # skill means
        pl.col("mean_wp_loss").mean(),
        pl.col("wp_loss_opening").mean(),
        pl.col("wp_loss_middlegame").mean(),
        pl.col("wp_loss_endgame").mean(),
        pl.col("blunder_rate").mean(),
        pl.col("mistake_rate").mean(),
        pl.col("wp_loss_p90").mean(),
        pl.col("acc_quiet").mean(),
        pl.col("acc_tactic").mean().alias("_acc_tactic"),
        pl.col("wp_loss_highcplx").mean().alias("_hi"),
        pl.col("wp_loss_lowcplx").mean().alias("_lo"),
        pl.col("acc_winning").mean().alias("_win"),
        pl.col("acc_equal").mean().alias("_eq"),
        pl.col("acc_losing").mean().alias("_los"),
        pl.col("wp_loss_scramble").mean().alias("_scr"),
        pl.col("wp_loss_post_blunder").mean().alias("_pb"),
        pl.col("loose_rate").mean().alias("vigilance_loose_rate"),
        pl.col("wp_loss_endgame")
        .filter(pl.col("n_my_endgame_moves") >= 5)
        .mean()
        .alias("endgame_acpl"),
        (pl.col("result_for_player") == "win")
        .filter(pl.col("was_winning_after20"))
        .mean()
        .alias("conversion_rate"),
        (pl.col("result_for_player") != "loss")
        .filter(pl.col("was_losing_after20"))
        .mean()
        .alias("save_rate"),
        # style means
        pl.col("castled_ply").mean().alias("castled_ply_mean"),
        pl.col("castled_ply").is_null().mean().alias("never_castled_rate"),
        (pl.col("castle_side") == "q").mean().alias("castle_queenside_rate"),
        pl.col("queen_dev_ply").mean().alias("queen_dev_ply_mean"),
        pl.col("first_dev_ply").mean().alias("first_dev_ply_mean"),
        pl.col("check_rate").mean(),
        pl.col("capture_rate").mean(),
        pl.col("toward_king_rate").mean(),
        pl.col("sac_rate").mean(),
        pl.col("tension_release_rate").mean(),
        pl.col("pawn_move_rate").mean(),
        pl.col("mean_think_time").mean(),
        pl.col("eval_volatility").mean().alias("eval_volatility_mean"),
        pl.col("material_swing_mean").mean(),
        pl.col("book_exit_ply").mean().alias("book_exit_ply_mean"),
        # lists for python-side derived features
        pl.col("eco").alias("_eco"),
        pl.col("first_move").alias("_fm"),
        pl.col("utc_date").alias("_dates"),
        pl.col("player_elo").alias("_elos"),
    )

    agg = agg.with_columns(
        tactical_gap=pl.col("_acc_tactic") - pl.col("acc_quiet"),
        complexity_penalty=pl.col("_hi") - pl.col("_lo"),
        choke=pl.col("_win") - pl.col("_eq"),
        tilt=pl.col("_los") - pl.col("_eq"),
        time_scramble_penalty=pl.col("_scr") - pl.col("mean_wp_loss"),
        post_blunder_penalty=pl.col("_pb") - pl.col("mean_wp_loss"),
    )

    rep = [
        _entropy([e or f for e, f in zip(ecos, fms)])
        for ecos, fms in zip(agg["_eco"].to_list(), agg["_fm"].to_list())
    ]
    trend = [
        _slope(d, e) for d, e in zip(agg["_dates"].to_list(), agg["_elos"].to_list())
    ]
    agg = agg.with_columns(
        repertoire_entropy=pl.Series(rep, dtype=pl.Float64),
        elo_trend=pl.Series(trend, dtype=pl.Float64),
    ).drop("_acc_tactic", "_hi", "_lo", "_win", "_eq", "_los", "_scr", "_pb",
           "_eco", "_fm", "_dates", "_elos")

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

    _aggregate(ga, ["player_hash"]).write_parquet(month_dir / "player_vectors.parquet")
    _aggregate(ga, ["player_hash", "_half"]).write_parquet(
        month_dir / "player_vectors_split.parquet"
    )
    print("done -> player_vectors.parquet (+ _split for stylometry)")


if __name__ == "__main__":
    run()
