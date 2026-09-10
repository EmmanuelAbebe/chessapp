"""Stage 11 — sanity checks. Writes ``artifacts/validation_report.md``.

  stylometry  — project each player's two half-samples (player_vectors_split)
                through the fitted pipeline; can half-0 find its own half-1
                among all half-1 vectors? report top-1 / top-10 / vs random.
  skill MAE   — from artifacts/skill/report.md
  disentangle — from artifacts/style/report.md

Longitudinal validation and face-validity on real accounts are Phase 2 /
post-service manual steps.

    python pipeline/11_validate.py
"""

from __future__ import annotations

import pathlib
import re
import sys

import numpy as np
import polars as pl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.features import STYLE  # noqa: E402
from pipeline.common.project import Artifacts  # noqa: E402


def _grep(path: pathlib.Path, pattern: str) -> str:
    if not path.exists():
        return "n/a"
    m = re.search(pattern, path.read_text())
    return m.group(0) if m else "n/a"


def _stylometry(art: Artifacts, split: pl.DataFrame) -> dict:
    # keep players present in both halves
    both = (
        split.group_by("player_hash").agg(pl.col("_half").n_unique().alias("h"))
        .filter(pl.col("h") == 2)["player_hash"]
    )
    split = split.filter(pl.col("player_hash").is_in(both))
    if split.height < 40:
        return {"note": f"only {split.height // 2} players in both halves — skipped"}

    def project(row: dict) -> np.ndarray:
        sk = art.skill(row)["overall"]
        return art.style_pca(row, sk)

    h0 = split.filter(pl.col("_half") == 0).sort("player_hash")
    h1 = split.filter(pl.col("_half") == 1).sort("player_hash")
    ids = h0["player_hash"].to_list()
    P0 = np.vstack([project(r) for r in h0.iter_rows(named=True)])
    P1 = np.vstack([project(r) for r in h1.iter_rows(named=True)])

    n = len(ids)
    ranks = []
    for i in range(n):
        d = np.linalg.norm(P1 - P0[i], axis=1)
        ranks.append(int((d < d[i]).sum()) + 1)
    ranks = np.array(ranks)
    return {
        "players": n,
        "top1": float((ranks == 1).mean()),
        "top10": float((ranks <= 10).mean()),
        "median_rank": float(np.median(ranks)),
        "random_median": n / 2,
    }


def run() -> None:
    cfg = cfgmod.load()
    month_dir = cfgmod.month_dir(cfg)
    art_dir = cfg["paths"]["artifacts_dir"]
    art = Artifacts(art_dir)

    split = pl.read_parquet(month_dir / "player_vectors_split.parquet")
    sty = _stylometry(art, split)

    skill_mae = _grep(art_dir / "skill" / "report.md", r"MAE [\d.]+ Elo")
    disent = _grep(art_dir / "style" / "report.md", r"R² \(GBT, 3-fold\): [-\d.]+")
    thr = cfg["validate"]

    lines = [f"# validation — {cfg['lichess']['month']}", ""]
    lines.append("## stylometry (self re-identification)")
    if "note" in sty:
        lines.append(f"- {sty['note']}")
    else:
        verdict = "✅" if sty["top10"] > 5 * (10 / sty["players"]) else "⚠️"
        lines += [
            f"- players tested: {sty['players']}",
            f"- top-1: {sty['top1']:.1%} · top-10: {sty['top10']:.1%}  {verdict}",
            f"- median rank: {sty['median_rank']:.0f} (random ≈ {sty['random_median']:.0f})",
        ]
    lines += [
        "",
        "## skill model",
        f"- {skill_mae}  (target ≤ {thr['skill_mae_max']})",
        "",
        "## disentanglement",
        f"- {disent}  (target < {thr['disentanglement_r2_max']})",
        "",
        "## deferred to Phase 2",
        "- longitudinal (does flagging a focus area at T predict cohort convergence by T+6mo)",
        "- face-validity on 5 known accounts (needs the service — run after Part B)",
    ]
    (art_dir / "validation_report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    run()
