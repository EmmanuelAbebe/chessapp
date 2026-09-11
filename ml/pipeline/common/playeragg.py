"""Per-player aggregation from ``game_agg`` rows — shared by stage 06 (the
reference population, grouped by player) and the inference service (one
user, all their games as a single group). Returns raw values, possibly
null where a bucket had no data; null-filling is the caller's job since the
two callers fill from different sources (population Elo-band medians here,
the shipped ``feature_spec.json`` bands in the service).
"""

from __future__ import annotations

import math

import numpy as np
import polars as pl


def entropy(labels: list[str | None]) -> float:
    """Smoothed (add-0.5), 0..1 normalised Shannon entropy — so a 15-game
    sample doesn't read as artificially low diversity."""
    vals = [x for x in labels if x]
    if not vals:
        return 0.0
    uniq = set(vals)
    k, alpha = len(uniq), 0.5
    denom = len(vals) + alpha * k
    h = 0.0
    for u in uniq:
        p = (vals.count(u) + alpha) / denom
        h -= p * math.log(p)
    return h / math.log(k) if k > 1 else 0.0


def slope(dates: list[str], elos: list[int]) -> float:
    """Elo trend — least-squares slope of Elo against game order (dates
    sort lexicographically == chronologically for "YYYY.MM.DD")."""
    if len(elos) < 3:
        return 0.0
    order = np.argsort(dates)
    y = np.asarray(elos, dtype=float)[order]
    x = np.arange(len(y), dtype=float)
    x -= x.mean()
    denom = (x * x).sum()
    return float((x * (y - y.mean())).sum() / denom) if denom else 0.0


def aggregate_players(ga: pl.DataFrame, keys: list[str]) -> pl.DataFrame:
    """One row per group (usually per player_hash) from ``game_agg`` rows.
    Includes the derived cross-bucket traits (tactical_gap, choke, tilt,
    ...) and opening entropy / Elo trend. May leave some ``MODELLED``
    columns null — see the module docstring."""
    agg = ga.group_by(keys).agg(
        pl.len().alias("n_games"),
        (pl.col("player_side") == "w").sum().alias("n_games_white"),
        (pl.col("player_side") == "b").sum().alias("n_games_black"),
        pl.col("player_elo").median().alias("player_elo"),
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
        entropy([e or f for e, f in zip(ecos, fms)])
        for ecos, fms in zip(agg["_eco"].to_list(), agg["_fm"].to_list())
    ]
    trend = [
        slope(d, e) for d, e in zip(agg["_dates"].to_list(), agg["_elos"].to_list())
    ]
    return agg.with_columns(
        repertoire_entropy=pl.Series(rep, dtype=pl.Float64),
        elo_trend=pl.Series(trend, dtype=pl.Float64),
    ).drop("_acc_tactic", "_hi", "_lo", "_win", "_eq", "_los", "_scr", "_pb",
            "_eco", "_fm", "_dates", "_elos")
