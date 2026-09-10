"""Stage 07 — the skill model: predict Elo from the skill-block features.

LightGBM regressor with 5-fold out-of-fold predictions, isotonic-calibrated
to the Elo scale. The OOF prediction is each reference player's stored
``skill_score`` (unbiased); the fitted model + calibrator serve new players.
Four sub-scores (tactical / positional / endgame / clock) are the same
recipe on feature subsets.

Reads ``player_vectors.parquet``; writes ``player_vectors_skill.parquet``
and ``artifacts/skill/``.

    python pipeline/07_skill_model.py
"""

from __future__ import annotations

import pathlib
import pickle
import sys

import lightgbm as lgb
import numpy as np
import polars as pl
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import KFold

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import SKILL, SKILL_SUBSCORES  # noqa: E402

LGB = dict(
    n_estimators=600, learning_rate=0.03, num_leaves=63, subsample=0.8,
    colsample_bytree=0.8, min_child_samples=40, random_state=7, n_jobs=-1, verbosity=-1,
)


def _oof_calibrated(X: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, lgb.LGBMRegressor, IsotonicRegression]:
    oof = np.zeros(len(y))
    for tr, va in KFold(5, shuffle=True, random_state=7).split(X):
        oof[va] = lgb.LGBMRegressor(**LGB).fit(X[tr], y[tr]).predict(X[va])
    iso = IsotonicRegression(out_of_bounds="clip").fit(oof, y)
    final = lgb.LGBMRegressor(**LGB).fit(X, y)
    return iso.transform(oof), final, iso


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)
    out = cfg["paths"]["artifacts_dir"] / "skill"
    out.mkdir(parents=True, exist_ok=True)

    pv = pl.read_parquet(month_dir / "player_vectors.parquet")
    y = pv["player_elo"].to_numpy().astype(float)
    report = [f"# skill model — {cfg['lichess']['month']}", "", f"{pv.height:,} players", ""]

    score, final, iso = _oof_calibrated(pv.select(SKILL).to_numpy(), y)
    report.append(f"- **overall**: MAE {mean_absolute_error(y, score):.1f} Elo (5-fold OOF, calibrated)")
    final.booster_.save_model(str(out / "overall.txt"))
    (out / "overall_iso.pkl").write_bytes(pickle.dumps(iso))

    cols = {"skill_score": score}
    for name, feats in SKILL_SUBSCORES.items():
        sub, subm, subiso = _oof_calibrated(pv.select(feats).to_numpy(), y)
        cols[f"skill_{name}"] = sub
        report.append(f"- **{name}**: MAE {mean_absolute_error(y, sub):.1f} Elo  ({', '.join(feats)})")
        subm.booster_.save_model(str(out / f"{name}.txt"))
        (out / f"{name}_iso.pkl").write_bytes(pickle.dumps(subiso))

    (out / "features.pkl").write_bytes(
        pickle.dumps({"overall": SKILL, **SKILL_SUBSCORES})
    )
    (out / "report.md").write_text("\n".join(report) + "\n")
    print("\n".join(report[4:]))

    pv.with_columns(**{k: pl.Series(v) for k, v in cols.items()}).write_parquet(
        month_dir / "player_vectors_skill.parquet"
    )
    print("done -> player_vectors_skill.parquet")


if __name__ == "__main__":
    run()
