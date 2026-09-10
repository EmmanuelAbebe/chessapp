"""Stage 05 — one row per (game, player).

Aggregates the per-ply features into ~35 columns describing how each player
handled each game: accuracy by phase / game-state / tactical-vs-quiet /
time-scramble, plus style rates (castling timing, checks, captures,
king-ward moves, sacrifices, tension release, think time). Game-level
context (eval volatility, length, book depth) is joined onto both sides.

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


def _side_agg(lf: pl.LazyFrame, side: str) -> pl.LazyFrame:
    s = lf.filter(pl.col("mover") == side)
    return s.group_by("game_id").agg(
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
        # style
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
        pl.col("uci").filter(pl.col("ply") == (1 if side == "w" else 2)).first().alias("first_move"),
        pl.col("eco").first().alias("eco"),
    ).with_columns(player_side=pl.lit(side))


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
    ).with_columns(
        recent_bad=pl.any_horizontal(
            pl.col("is_bad").shift(k).over("game_id").fill_null(False) for k in (2, 4, 6)
        )
    )

    game_lvl = lf.group_by("game_id").agg(
        pl.col("wp_white_after").std().alias("eval_volatility"),
        pl.col("material_swing").mean().alias("material_swing_mean"),
        pl.col("ply").max().alias("game_length"),
        pl.col("ply").filter(pl.col("in_book")).max().alias("book_exit_ply"),
    )

    rows = []
    for side in ("w", "b"):
        agg = _side_agg(lf, side).join(game_lvl, on="game_id").collect()
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
