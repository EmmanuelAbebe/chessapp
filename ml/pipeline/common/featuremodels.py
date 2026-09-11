"""has_tactic / only_move / complexity / wp_loss scoring — the encoding and
feature lists stage 04 trains with, reused verbatim to score both the
reference set and a user's games in the service.
"""

from __future__ import annotations

import pathlib

import lightgbm as lgb
import polars as pl

from pipeline.common.chessext import STATIC_FEATURE_NAMES

PHASE_CODE = {"opening": 0, "middlegame": 1, "endgame": 2}
PIECE_CODE = {"p": 0, "n": 1, "b": 2, "r": 3, "q": 4, "k": 5}

POS_FEATURES = [*STATIC_FEATURE_NAMES, "phase_code", "ply"]
MOVE_EXTRA = ["is_capture", "is_check", "is_castle", "is_pawn_push", "see", "king_dist_delta", "piece_code"]
MOVE_FEATURES = [*POS_FEATURES, *MOVE_EXTRA]

MODEL_NAMES = ("has_tactic", "only_move", "complexity", "wp_loss")


def encode(df: pl.DataFrame) -> pl.DataFrame:
    return df.with_columns(
        phase_code=pl.col("phase").replace_strict(PHASE_CODE, default=1).cast(pl.Int8),
        piece_code=pl.col("piece_moved").replace_strict(PIECE_CODE, default=0).cast(pl.Int8),
        king_dist_delta=pl.col("king_dist_delta").fill_null(0),
    )


def load_models(art_dir: pathlib.Path) -> dict[str, lgb.Booster]:
    d = art_dir / "feature_models"
    return {name: lgb.Booster(model_file=str(d / f"{name}.txt")) for name in MODEL_NAMES}


def score(df: pl.DataFrame, models: dict[str, lgb.Booster]) -> pl.DataFrame:
    """Adds ``has_tactic_pred`` / ``only_move_pred`` / ``complexity_pred`` /
    ``wp_loss_model`` to a move_features-shaped frame, dropping the
    intermediate encoding columns."""
    df = encode(df)
    xpos = df.select(POS_FEATURES).to_numpy()
    xmove = df.select(MOVE_FEATURES).to_numpy()
    return df.with_columns(
        has_tactic_pred=pl.Series(models["has_tactic"].predict(xpos)).cast(pl.Float32),
        only_move_pred=pl.Series(models["only_move"].predict(xpos)).cast(pl.Float32),
        complexity_pred=pl.Series(models["complexity"].predict(xpos)).cast(pl.Float32),
        wp_loss_model=pl.Series(models["wp_loss"].predict(xmove)).cast(pl.Float32),
    ).drop("phase_code", "piece_code")
