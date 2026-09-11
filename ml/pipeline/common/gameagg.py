"""Per-ply enrichment and per-(game, player) aggregation — shared by stage
05 (the reference population) and the inference service (one user).
"""

from __future__ import annotations

import polars as pl


def enrich_plies(lf: pl.LazyFrame) -> pl.LazyFrame:
    """``lf`` must already carry ``tc_base`` (from the time control) and be
    sorted by (game_id, ply). Adds the mover-relative eval, clock fraction,
    and the bucket flags ``quiet`` / ``tactic`` / ``high_cplx`` / ``low_cplx``
    / ``recent_bad`` that ``side_agg`` filters on."""
    lf = lf.with_columns(
        wp_white_before=pl.col("wp_white_after").shift(1).over("game_id"),
    ).with_columns(
        mover_wp_before=pl.when(pl.col("mover") == "w")
        .then(pl.col("wp_white_before"))
        .otherwise(100 - pl.col("wp_white_before")),
        mover_wp_after=pl.when(pl.col("mover") == "w")
        .then(pl.col("wp_white_after"))
        .otherwise(100 - pl.col("wp_white_after")),
        clock_frac=pl.when(pl.col("tc_base") > 0)
        .then(pl.col("clock_cs") / (pl.col("tc_base") * 100))
        .otherwise(None),
        quiet=(pl.col("has_tactic_pred") < 0.2) & (pl.col("complexity_pred") < 15),
        tactic=pl.col("has_tactic_pred") >= 0.5,
        high_cplx=pl.col("complexity_pred") >= 25,
        low_cplx=pl.col("complexity_pred") < 10,
        is_bad=pl.col("classification").is_in(["blunder", "mistake"]),
    )
    return lf.with_columns(
        recent_bad=pl.any_horizontal(
            pl.col("is_bad").shift(k).over("game_id").fill_null(False) for k in (2, 4, 6)
        )
    )


def moves_agg(lf: pl.LazyFrame) -> pl.LazyFrame:
    """One row per game from *one player's own moves* — ``lf`` must already
    be filtered to that player's moves in each game (``mover == their
    side``, whether that side is fixed across all games — the reference
    population, one call per side — or varies per game — the service,
    one user across many games where they played both colours). Since
    ``mover`` equals that side throughout the filtered frame either way,
    it doubles as the per-game "which side was I" signal.
    Requires ``enrich_plies`` to have already run."""
    return lf.group_by("game_id").agg(
        pl.col("mover").first().alias("player_side"),
        pl.len().alias("n_my_moves"),
        pl.col("wp_loss").mean().alias("mean_wp_loss"),
        pl.col("wp_loss").quantile(0.9).alias("wp_loss_p90"),
        (pl.col("classification") == "blunder").mean().alias("blunder_rate"),
        (pl.col("classification") == "mistake").mean().alias("mistake_rate"),
        pl.col("wp_loss").filter(pl.col("phase") == "opening").mean().alias("wp_loss_opening"),
        pl.col("wp_loss").filter(pl.col("phase") == "middlegame").mean().alias("wp_loss_middlegame"),
        pl.col("wp_loss").filter(pl.col("phase") == "endgame").mean().alias("wp_loss_endgame"),
        pl.col("wp_loss").filter(pl.col("phase") == "endgame").len().alias("n_my_endgame_moves"),
        pl.col("wp_loss").filter(pl.col("quiet")).mean().alias("acc_quiet"),
        pl.col("wp_loss").filter(pl.col("tactic")).mean().alias("acc_tactic"),
        pl.col("wp_loss").filter(pl.col("tactic")).len().alias("n_my_tactic_moves"),
        pl.col("wp_loss").filter(pl.col("high_cplx")).mean().alias("wp_loss_highcplx"),
        pl.col("wp_loss").filter(pl.col("low_cplx")).mean().alias("wp_loss_lowcplx"),
        pl.col("wp_loss").filter(pl.col("mover_wp_before") >= 60).mean().alias("acc_winning"),
        pl.col("wp_loss").filter(pl.col("mover_wp_before").is_between(40, 60)).mean().alias("acc_equal"),
        pl.col("wp_loss").filter(pl.col("mover_wp_before") <= 40).mean().alias("acc_losing"),
        pl.col("wp_loss").filter(pl.col("clock_frac") < 0.15).mean().alias("wp_loss_scramble"),
        pl.col("clock_frac").is_not_null().sum().alias("n_my_clocked_moves"),
        pl.col("wp_loss").filter(pl.col("recent_bad")).mean().alias("wp_loss_post_blunder"),
        (pl.col("st_loose_us") > 0).mean().alias("loose_rate"),
        pl.col("ply").filter(pl.col("is_castle")).min().alias("castled_ply"),
        pl.col("san").filter(pl.col("is_castle")).first().alias("castle_san"),
        pl.col("ply").filter(pl.col("piece_moved") == "q").min().alias("queen_dev_ply"),
        pl.col("ply").filter(pl.col("is_dev_move")).min().alias("first_dev_ply"),
        pl.col("is_check").mean().alias("check_rate"),
        pl.col("is_capture").mean().alias("capture_rate"),
        (pl.col("king_dist_delta").filter((pl.col("piece_moved") != "p") & (pl.col("phase") == "middlegame")) > 0)
        .mean().alias("toward_king_rate"),
        (pl.col("see") <= -1.0).mean().alias("sac_rate"),
        pl.col("released_tension").filter(pl.col("pawn_tension_before") > 0).mean().alias("tension_release_rate"),
        (pl.col("piece_moved") == "p").mean().alias("pawn_move_rate"),
        pl.col("think_time_s").mean().alias("mean_think_time"),
        pl.col("mover_wp_after").filter(pl.col("ply") > 40).max().alias("max_wp_after20"),
        pl.col("mover_wp_after").filter(pl.col("ply") > 40).min().alias("min_wp_after20"),
        pl.col("uci")
        .filter(((pl.col("mover") == "w") & (pl.col("ply") == 1)) | ((pl.col("mover") == "b") & (pl.col("ply") == 2)))
        .first()
        .alias("first_move"),
        pl.col("eco").first().alias("eco"),
    )


def side_agg(lf: pl.LazyFrame, side: str) -> pl.LazyFrame:
    """``moves_agg`` for a single fixed side across every game — the
    reference-population case (stage 05 calls this once per side)."""
    return moves_agg(lf.filter(pl.col("mover") == side))


def game_level_agg(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Whole-game columns joined onto both sides."""
    return lf.group_by("game_id").agg(
        pl.col("wp_white_after").std().alias("eval_volatility"),
        pl.col("material_swing").mean().alias("material_swing_mean"),
        pl.col("ply").max().alias("game_length"),
        pl.col("ply").filter(pl.col("in_book")).max().alias("book_exit_ply"),
    )
