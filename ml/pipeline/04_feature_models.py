"""Stage 04 — train the feature models on the engine-labelled sample, then
score the whole reference set with no engine.

Models (LightGBM), all from static board features (``st_*`` + phase + ply):
  - has_tactic   : classifier
  - only_move    : classifier
  - complexity   : regressor
  - wp_loss      : regressor (adds the played move's descriptors) — a
                   de-noised move-quality signal / fallback when %eval is absent

Trained with a game-level train/valid split (no ply leakage). Held-out
metrics go to ``artifacts/feature_models/report.md``; the fitted models to
``artifacts/feature_models/``. Then every partition of
``data/<month>/move_features/`` gets four prediction columns added in place.

    python pipeline/04_feature_models.py
"""

from __future__ import annotations

import json
import pathlib
import shutil
import sys

import lightgbm as lgb
import numpy as np
import polars as pl
from sklearn.metrics import mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from tqdm import tqdm

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.chessext import STATIC_FEATURE_NAMES  # noqa: E402
from pipeline.common.featuremodels import (  # noqa: E402
    MOVE_EXTRA, PHASE_CODE, PIECE_CODE, POS_FEATURES, encode as _encode, score as _score,
)


def _fit_classifier(X, y, groups, name: str, report: list[str]):
    tr, va = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=7).split(X, y, groups))
    model = lgb.LGBMClassifier(
        n_estimators=400, learning_rate=0.05, num_leaves=63, subsample=0.8,
        colsample_bytree=0.8, random_state=7, n_jobs=-1, verbosity=-1,
    )
    model.fit(X[tr], y[tr])
    p = model.predict_proba(X[va])[:, 1]
    auc = roc_auc_score(y[va], p)
    brier = float(np.mean((p - y[va]) ** 2))
    report.append(f"- **{name}**: AUC {auc:.3f} · Brier {brier:.3f} · positive rate {y.mean():.3f}")
    return model


def _fit_regressor(X, y, groups, name: str, report: list[str]):
    tr, va = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=7).split(X, y, groups))
    model = lgb.LGBMRegressor(
        n_estimators=500, learning_rate=0.05, num_leaves=63, subsample=0.8,
        colsample_bytree=0.8, random_state=7, n_jobs=-1, verbosity=-1,
    )
    model.fit(X[tr], y[tr])
    pred = model.predict(X[va])
    report.append(
        f"- **{name}**: MAE {mean_absolute_error(y[va], pred):.2f} · "
        f"R² {r2_score(y[va], pred):.3f} · target mean {y.mean():.2f}"
    )
    return model


def _train(cfg, month_dir, out_dir) -> dict[str, object]:
    labels = pl.read_parquet(month_dir / "engine_labels" / "*.parquet")
    # Per-file column projection (not a whole-glob read + .select()): a
    # partially-rerun scoring pass can leave some move_features/ files with
    # the 4 prediction columns and others without, and reading the glob as
    # one table requires every file to share a schema - requesting only
    # these columns per file sidesteps that regardless of which files
    # happen to have the extra ones.
    feat_cols = [
        "game_id", "ply", "phase", "piece_moved", "is_capture", "is_check",
        "is_castle", "is_pawn_push", "see", "king_dist_delta", *STATIC_FEATURE_NAMES,
    ]
    feats = pl.concat(
        [
            pl.read_parquet(p, columns=feat_cols)
            for p in sorted((month_dir / "move_features").glob("*.parquet"))
        ]
    )
    train = _encode(labels.join(feats, on=["game_id", "ply"], how="inner"))
    print(f"training rows: {train.height:,}")

    groups = train["game_id"].to_numpy()
    report = [f"# feature_models — {cfg['lichess']['month']}", "", f"{train.height:,} labelled plies", ""]
    models: dict[str, object] = {}

    Xpos = train.select(POS_FEATURES).to_numpy()
    models["has_tactic"] = _fit_classifier(
        Xpos, train["has_tactic"].cast(pl.Int8).to_numpy(), groups, "has_tactic", report
    )

    om = train.filter(pl.col("only_move").is_not_null())
    models["only_move"] = _fit_classifier(
        om.select(POS_FEATURES).to_numpy(), om["only_move"].cast(pl.Int8).to_numpy(),
        om["game_id"].to_numpy(), "only_move", report,
    )

    cx = train.filter(pl.col("complexity").is_not_null())
    models["complexity"] = _fit_regressor(
        cx.select(POS_FEATURES).to_numpy(), cx["complexity"].to_numpy(),
        cx["game_id"].to_numpy(), "complexity", report,
    )

    models["wp_loss"] = _fit_regressor(
        train.select([*POS_FEATURES, *MOVE_EXTRA]).to_numpy(),
        train["wp_loss_engine"].to_numpy(), groups, "wp_loss", report,
    )

    for name, model in models.items():
        model.booster_.save_model(str(out_dir / f"{name}.txt"))
    (out_dir / "spec.json").write_text(
        json.dumps(
            {
                "pos_features": POS_FEATURES,
                "move_features": [*POS_FEATURES, *MOVE_EXTRA],
                "phase_code": PHASE_CODE,
                "piece_code": PIECE_CODE,
            },
            indent=2,
        )
    )
    (out_dir / "report.md").write_text("\n".join(report) + "\n")
    print("\n".join(report[4:]))
    return {name: m.booster_ for name, m in models.items()}


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)
    out_dir = cfg["paths"]["artifacts_dir"] / "feature_models"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Skip retraining on a retry once models are already on disk - a killed
    # attempt's real cost is always the scoring loop below, not training
    # (seconds, on this run's sample size), but repeating it before every
    # single retry still adds up and delays reaching resumable work.
    if all((out_dir / f"{n}.txt").exists() for n in ("has_tactic", "only_move", "complexity", "wp_loss")):
        print("feature models already trained - loading from disk")
        boosters = {
            n: lgb.Booster(model_file=str(out_dir / f"{n}.txt"))
            for n in ("has_tactic", "only_move", "complexity", "wp_loss")
        }
    else:
        boosters = _train(cfg, month_dir, out_dir)

    # --- apply to the full reference set, in place ------------------------
    # (via common.featuremodels.score, same code path the service uses)
    # Scored into a staging dir, resumable per-file there (skip a file
    # already staged), and only swapped in for the real move_features/ once
    # every single file is done. move_features/ itself - read as a whole
    # glob by this function's own training step above and later by stages
    # 05/09 - is never touched mid-way, so it can never end up with some
    # files scored and others not (a real bug hit while building this: a
    # partial in-place rescore left mixed schemas that broke the next
    # glob read entirely).
    move_features_dir = month_dir / "move_features"
    staging_dir = month_dir / "move_features_scored_staging"
    staging_dir.mkdir(exist_ok=True)
    parts = sorted(move_features_dir.glob("*.parquet"))
    for part in tqdm(parts, desc="scoring move_features"):
        staged = staging_dir / part.name
        if staged.exists():
            continue  # resumable: a prior (killed) attempt already scored this one
        _score(pl.read_parquet(part), boosters).write_parquet(staged)

    if len(list(staging_dir.glob("*.parquet"))) == len(parts):
        shutil.rmtree(move_features_dir)
        staging_dir.rename(move_features_dir)
        print("done -> move_features/ enriched with 4 prediction columns")
    else:
        print("scoring incomplete this attempt - re-run to finish (staged progress is kept)")


if __name__ == "__main__":
    run()
