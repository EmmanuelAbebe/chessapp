"""Load the fitted artifacts and project a single player's feature vector
into the style + skill space. Shared by stage 11 (validation) and the
inference service so the transform is defined exactly once.
"""

from __future__ import annotations

import json
import pathlib
import pickle

import lightgbm as lgb
import numpy as np
import polars as pl

from pipeline.common import featuremodels
from pipeline.common.features import LOG_FEATURES, SKILL, SKILL_SUBSCORES, STYLE


def _log1p_if(name: str, value: float) -> float:
    return float(np.log1p(max(value, 0.0))) if name in LOG_FEATURES else float(value)


class Artifacts:
    def __init__(self, art_dir: pathlib.Path):
        self.dir = pathlib.Path(art_dir)
        s = self.dir / "skill"
        self.skill_model = lgb.Booster(model_file=str(s / "overall.txt"))
        self.skill_iso = pickle.loads((s / "overall_iso.pkl").read_bytes())
        self.sub_models = {n: lgb.Booster(model_file=str(s / f"{n}.txt")) for n in SKILL_SUBSCORES}
        self.sub_iso = {n: pickle.loads((s / f"{n}_iso.pkl").read_bytes()) for n in SKILL_SUBSCORES}

        st = self.dir / "style"
        self.resid_models = pickle.loads((st / "resid_models.pkl").read_bytes())
        self.scaler = pickle.loads((st / "scaler.pkl").read_bytes())
        self.pca = pickle.loads((st / "pca.pkl").read_bytes())
        umap_path = st / "umap.pkl"
        self.umap = pickle.loads(umap_path.read_bytes()) if umap_path.exists() else None

        tr = self.dir / "trait"
        self.trait_model = lgb.Booster(model_file=str(tr / "wp_loss.txt"))
        self.trait_spec = json.loads((tr / "spec.json").read_text())

        self.spec = json.loads((self.dir / "feature_spec.json").read_text())
        self._load_index(st)

        # only present once stage 04 has actually trained models — some
        # test fixtures (and stage 11's validation run) don't need these
        fm_marker = self.dir / "feature_models" / "has_tactic.txt"
        self.feature_models = featuremodels.load_models(self.dir) if fm_marker.exists() else None
        ref_path = self.dir / "reference_meta.parquet"
        self.reference = pl.read_parquet(ref_path) if ref_path.exists() else None
        book_path = self.dir / "move_freq.parquet"
        if book_path.exists():
            mf = pl.read_parquet(book_path)
            self.book_set = set(zip(mf["epd_before"], mf["uci"]))
        else:
            self.book_set = set()

    def _load_index(self, st: pathlib.Path) -> None:
        faiss_path = st / "neighbours.faiss"
        if faiss_path.exists():
            import faiss  # noqa: PLC0415

            self.index = faiss.read_index(str(faiss_path))
            self.index_kind = "faiss"
        else:
            self.index = pickle.loads((st / "neighbours_sklearn.pkl").read_bytes())
            self.index_kind = "sklearn"

    # --- projection --------------------------------------------------------
    def skill(self, feat: dict[str, float]) -> dict[str, float]:
        x = np.array([[feat[f] for f in SKILL]], dtype=float)
        out = {"overall": float(self.skill_iso.transform(self.skill_model.predict(x))[0])}
        for name, cols in SKILL_SUBSCORES.items():
            xs = np.array([[feat[c] for c in cols]], dtype=float)
            out[name] = float(self.sub_iso[name].transform(self.sub_models[name].predict(xs))[0])
        return out

    def style_pca(self, feat: dict[str, float], skill_score: float) -> np.ndarray:
        raw = np.array([_log1p_if(f, feat[f]) for f in STYLE], dtype=float)
        pred = np.array(
            [m.predict(np.array([[skill_score]]))[0] for m in self.resid_models], dtype=float
        )
        z = self.scaler.transform((raw - pred).reshape(1, -1))
        return self.pca.transform(z)[0]

    def umap_xy(self, pca_vec: np.ndarray) -> tuple[float, float]:
        if self.umap is None:
            return float(pca_vec[0]), float(pca_vec[1])
        xy = self.umap.transform(pca_vec.reshape(1, -1))[0]
        return float(xy[0]), float(xy[1])

    def neighbours(self, pca_vec: np.ndarray, k: int) -> np.ndarray:
        v = np.ascontiguousarray(pca_vec.reshape(1, -1), dtype="float32")
        if self.index_kind == "faiss":
            _, idx = self.index.search(v, k)
            return idx[0]
        _, idx = self.index.kneighbors(v, n_neighbors=min(k, self.index.n_samples_fit_))
        return idx[0]
