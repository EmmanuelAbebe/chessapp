"""Stage 10 — bundle everything the service needs into ``artifacts/``.

  reference_meta.parquet  — per player: hashed id, embedding, skill, traits,
                            + raw modelled features (for cohort deviation)
  feature_spec.json       — feature lists, Elo-band fill medians, PC axis
                            labels (from config.yaml's style_axis_labels,
                            hand-derived after reading style/pc_loadings.md),
                            trait buckets
  norms.json              — per Elo-band mean/std of each feature (dashboard bars)
  move_freq.parquet       — copied from data/ (opening rarity)
  manifest.json           — month(s), player count, Elo range, dates, metrics

The model directories (feature_models/, skill/, style/, trait/) are written
by their own stages and only verified here.

    python pipeline/10_export_artifacts.py
"""

from __future__ import annotations

import json
import pathlib
import shutil
import sys
import time

import polars as pl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import (  # noqa: E402
    LOG_FEATURES, MODELLED, SKILL, SKILL_SUBSCORES, STYLE, TRAITS,
)


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)
    art = cfg["paths"]["artifacts_dir"]
    art.mkdir(parents=True, exist_ok=True)

    for sub in ("feature_models", "skill", "style", "trait"):
        if not (art / sub).is_dir():
            sys.exit(f"missing {art / sub} — run its stage first")

    pv = pl.read_parquet(month_dir / "player_vectors_final.parquet")

    embed_cols = [f"pca_{i}" for i in range(10)] + ["umap_x", "umap_y"]
    skill_cols = ["skill_score"] + [f"skill_{n}" for n in SKILL_SUBSCORES]
    meta_cols = [
        "player_hash", "player_elo", "elo_band", "elo_trend",
        "n_games", "n_games_white", "n_games_black",
        *embed_cols, *skill_cols, *TRAITS, *MODELLED,
    ]
    pv.select([c for c in meta_cols if c in pv.columns]).write_parquet(art / "reference_meta.parquet")

    # Elo-band fill medians + norms
    bands = pv.group_by("elo_band").agg(
        [pl.col(f).median().alias(f"{f}__med") for f in MODELLED]
        + [pl.col(f).mean().alias(f"{f}__mean") for f in MODELLED]
        + [pl.col(f).std().alias(f"{f}__std") for f in MODELLED]
    ).sort("elo_band")
    fill = {
        str(row["elo_band"]): {f: row[f"{f}__med"] for f in MODELLED}
        for row in bands.iter_rows(named=True)
    }
    norms = {
        str(row["elo_band"]): {
            f: {"mean": row[f"{f}__mean"], "std": row[f"{f}__std"]} for f in MODELLED
        }
        for row in bands.iter_rows(named=True)
    }
    (art / "norms.json").write_text(json.dumps(norms, indent=2))

    spec = {
        "schema_version": 1,
        "skill_features": SKILL,
        "style_features": STYLE,
        "log_features": sorted(LOG_FEATURES),
        "skill_subscores": SKILL_SUBSCORES,
        "traits": TRAITS,
        "elo_band_fill": fill,
        "global_fill": {f: pv[f].median() for f in MODELLED},
        "pc_axis_labels": [
            cfg.get("style_axis_labels", {}).get(i, f"PC{i}") for i in range(10)
        ],
        "cohort": cfg["cohort"],
    }
    (art / "feature_spec.json").write_text(json.dumps(spec, indent=2))

    mf = month_dir / "move_freq.parquet"
    if mf.exists():
        shutil.copy(mf, art / "move_freq.parquet")

    manifest = {
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "months": [cfg["lichess"]["month"]],
        "n_players": pv.height,
        "elo_range": [int(pv["player_elo"].min()), int(pv["player_elo"].max())],
        "reports": {
            name: (art / name / "report.md").read_text()
            for name in ("feature_models", "skill", "style")
            if (art / name / "report.md").exists()
        },
    }
    (art / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"artifacts/ ready — {pv.height:,} reference players")


if __name__ == "__main__":
    run()
