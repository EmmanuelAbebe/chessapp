"""Stage 08 — the style embedding.

For each style feature, model its skill-driven component (OOF GBT on the
skill score) and subtract it — the residual is style net of strength.
Standardize the residuals, PCA to 10-D, UMAP to 2-D for the dashboard, and
build a nearest-neighbour index. Then check how much Elo still leaks into
the embedding (target R² < 0.15).

Reads ``player_vectors_skill.parquet``; writes
``player_vectors_full.parquet`` and ``artifacts/style/``.

    python pipeline/08_style_embedding.py
"""

from __future__ import annotations

import pathlib
import pickle
import sys

import lightgbm as lgb
import numpy as np
import polars as pl
from sklearn.decomposition import PCA
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold, cross_val_score
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import LOG_FEATURES, STYLE  # noqa: E402

N_PCA = 10
RESID_LGB = dict(
    n_estimators=250, learning_rate=0.04, num_leaves=31, min_child_samples=50,
    random_state=7, n_jobs=-1, verbosity=-1,
)


def _log_transform(mat: np.ndarray) -> np.ndarray:
    out = mat.copy()
    for i, name in enumerate(STYLE):
        if name in LOG_FEATURES:
            out[:, i] = np.log1p(np.clip(out[:, i], 0, None))
    return out


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)
    out = cfg["paths"]["artifacts_dir"] / "style"
    out.mkdir(parents=True, exist_ok=True)

    pv = pl.read_parquet(month_dir / "player_vectors_skill.parquet")
    skill = pv["skill_score"].to_numpy().astype(float).reshape(-1, 1)
    elo = pv["player_elo"].to_numpy().astype(float)
    S = _log_transform(pv.select(STYLE).to_numpy().astype(float))

    # residualize each style feature against the skill score (OOF)
    resid = np.zeros_like(S)
    resid_models = []
    for i in range(S.shape[1]):
        oof = np.zeros(len(elo))
        for tr, va in KFold(5, shuffle=True, random_state=7).split(S):
            oof[va] = lgb.LGBMRegressor(**RESID_LGB).fit(skill[tr], S[tr, i]).predict(skill[va])
        resid[:, i] = S[:, i] - oof
        resid_models.append(lgb.LGBMRegressor(**RESID_LGB).fit(skill, S[:, i]))

    scaler = StandardScaler().fit(resid)
    Z = scaler.transform(resid)
    pca = PCA(n_components=N_PCA, random_state=7).fit(Z)
    P = pca.transform(Z)

    xy, umap_model = _fit_umap(P)

    # disentanglement: how much Elo is still recoverable from the embedding?
    r2_lin = LinearRegression().fit(P, elo).score(P, elo)
    r2_gbt = float(
        np.mean(cross_val_score(lgb.LGBMRegressor(**RESID_LGB), P, elo, cv=3, scoring="r2"))
    )
    thr = cfg["validate"]["disentanglement_r2_max"]
    flag = "  ⚠️ ABOVE THRESHOLD" if max(r2_lin, r2_gbt) > thr else ""

    # neighbour index
    index_kind = _save_index(P, out)

    # PC loadings, for hand-labelling the axes
    loadings = ["# style PCs — top loadings (hand-label these in feature_spec.json)", ""]
    for pc in range(4):
        comp = pca.components_[pc]
        order = np.argsort(comp)
        pos = ", ".join(f"{STYLE[j]} {comp[j]:+.2f}" for j in order[::-1][:4])
        neg = ", ".join(f"{STYLE[j]} {comp[j]:+.2f}" for j in order[:4])
        loadings.append(f"**PC{pc}** ({pca.explained_variance_ratio_[pc]:.1%})  +[{pos}]  −[{neg}]")
    (out / "pc_loadings.md").write_text("\n".join(loadings) + "\n")

    for name, obj in {
        "scaler": scaler, "pca": pca, "resid_models": resid_models, "umap": umap_model,
    }.items():
        (out / f"{name}.pkl").write_bytes(pickle.dumps(obj))
    (out / "report.md").write_text(
        f"# style embedding — {cfg['lichess']['month']}\n\n"
        f"{pv.height:,} players · {N_PCA} PCs · explained var "
        f"{pca.explained_variance_ratio_.sum():.1%}\n\n"
        f"- disentanglement R² (linear): {r2_lin:.3f}\n"
        f"- disentanglement R² (GBT, 3-fold): {r2_gbt:.3f}  (target < {thr}){flag}\n"
        f"- neighbour index: {index_kind}\n"
    )
    print(f"disentanglement R²: lin {r2_lin:.3f} / gbt {r2_gbt:.3f} (target < {thr}){flag}")

    pv.with_columns(
        **{f"pca_{i}": pl.Series(P[:, i]) for i in range(N_PCA)},
        umap_x=pl.Series(xy[:, 0]),
        umap_y=pl.Series(xy[:, 1]),
    ).write_parquet(month_dir / "player_vectors_full.parquet")
    print("done -> player_vectors_full.parquet")


def _fit_umap(P: np.ndarray):
    try:
        import umap  # noqa: PLC0415
    except ImportError:
        print("umap-learn not installed — using PCA dims 0-1 as the 2-D map")
        return P[:, :2].copy(), None
    sub = P if len(P) <= 40000 else P[np.random.default_rng(7).choice(len(P), 40000, replace=False)]
    model = umap.UMAP(n_components=2, n_neighbors=25, min_dist=0.1, random_state=7).fit(sub)
    return model.transform(P), model


def _save_index(P: np.ndarray, out: pathlib.Path) -> str:
    try:
        import faiss  # noqa: PLC0415

        idx = faiss.IndexFlatL2(P.shape[1])
        idx.add(np.ascontiguousarray(P, dtype="float32"))
        faiss.write_index(idx, str(out / "neighbours.faiss"))
        return "faiss IndexFlatL2"
    except ImportError:
        from sklearn.neighbors import NearestNeighbors  # noqa: PLC0415

        nn = NearestNeighbors(n_neighbors=800, algorithm="ball_tree").fit(P)
        (out / "neighbours_sklearn.pkl").write_bytes(pickle.dumps(nn))
        return "sklearn NearestNeighbors (faiss not installed)"


if __name__ == "__main__":
    run()
