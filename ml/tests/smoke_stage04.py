"""Synthetic end-to-end check of stage 04 (train + apply) — no engine, no
real data. Fabricates a move_features/ + engine_labels/ tree where the
labels are a noisy function of the static features, runs s04.run() against
it, and asserts the four prediction columns land on move_features/.

    .venv/bin/python tests/smoke_stage04.py
"""

from __future__ import annotations

import importlib.util
import pathlib
import shutil
import sys

import numpy as np
import polars as pl

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.chessext import STATIC_FEATURE_NAMES  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "s04", ROOT / "pipeline" / "04_feature_models.py"
)
s04 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s04)

RNG = np.random.default_rng(3)
PIECES = ["p", "n", "b", "r", "q", "k"]
PHASES = ["opening", "middlegame", "endgame"]


def _make_move_features(n_games: int, plies: int) -> pl.DataFrame:
    rows = []
    for g in range(n_games):
        for ply in range(1, plies + 1):
            st = {name: float(RNG.integers(0, 6)) for name in STATIC_FEATURE_NAMES}
            st["st_legal_moves"] = float(RNG.integers(8, 45))
            st["st_checks_available"] = float(RNG.integers(0, 5))
            rows.append(
                {
                    "game_id": f"g{g:04d}",
                    "ply": ply,
                    "phase": PHASES[min(2, ply // 8)],
                    "piece_moved": PIECES[RNG.integers(0, 6)],
                    "is_capture": bool(RNG.random() < 0.3),
                    "is_check": bool(RNG.random() < 0.1),
                    "is_castle": bool(RNG.random() < 0.05),
                    "is_pawn_push": bool(RNG.random() < 0.4),
                    "see": float(RNG.integers(-3, 3)),
                    "king_dist_delta": int(RNG.integers(-2, 3)),
                    **st,
                }
            )
    return pl.DataFrame(rows)


def _make_labels(mf: pl.DataFrame) -> pl.DataFrame:
    checks = mf["st_checks_available"].to_numpy()
    legal = mf["st_legal_moves"].to_numpy()
    see = mf["see"].to_numpy()
    n = mf.height
    has_tactic = (checks + RNG.normal(0, 1, n)) > 2.5
    only_move = (checks + RNG.normal(0, 1.5, n)) > 3.5
    complexity = legal * 0.8 + RNG.normal(0, 5, n)
    wp_loss = np.clip(-see * 2 + RNG.normal(3, 3, n), 0, None)
    # scatter real nulls into only_move / complexity like the stage-03 output
    mask = RNG.random(n) < 0.15
    return pl.DataFrame(
        {
            "game_id": mf["game_id"],
            "ply": mf["ply"],
            "has_tactic": pl.Series(has_tactic, dtype=pl.Boolean),
            "only_move": pl.Series(
                [None if m else bool(v) for m, v in zip(mask, only_move)], dtype=pl.Boolean
            ),
            "complexity": pl.Series(
                [None if m else float(v) for m, v in zip(mask, complexity)], dtype=pl.Float64
            ),
            "wp_loss_engine": wp_loss,
        }
    )


def main() -> None:
    tmp = ROOT / "data" / "_smoke04"
    art = ROOT / "artifacts" / "_smoke04"
    for d in (tmp, art):
        if d.exists():
            shutil.rmtree(d)
    (tmp / "move_features").mkdir(parents=True)
    (tmp / "engine_labels").mkdir(parents=True)
    art.mkdir(parents=True)

    mf = _make_move_features(60, 20)
    mf.write_parquet(tmp / "move_features" / "part_00000.parquet")
    _make_labels(mf).write_parquet(tmp / "engine_labels" / "part_00000.parquet")

    real_cfg = cfgmod.load()
    real_cfg["paths"]["artifacts_dir"] = art
    cfgmod.load = lambda: real_cfg  # noqa: E731
    cfgmod.month_dir = lambda _cfg: tmp  # noqa: E731

    s04.run()

    out = pl.read_parquet(tmp / "move_features" / "*.parquet")
    for col in ("has_tactic_pred", "only_move_pred", "complexity_pred", "wp_loss_model"):
        assert col in out.columns, out.columns
    assert out["has_tactic_pred"].is_between(0, 1).all()
    assert out.height == mf.height
    for name in ("has_tactic", "only_move", "complexity", "wp_loss"):
        assert (art / "feature_models" / f"{name}.txt").exists()
    assert (art / "feature_models" / "report.md").exists()
    print("SMOKE STAGE-04 OK")

    shutil.rmtree(tmp)
    shutil.rmtree(art)


if __name__ == "__main__":
    main()
