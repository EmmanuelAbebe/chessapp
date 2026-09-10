"""Pure-function checks for stage 03 (no Stockfish needed).

    .venv/bin/python tests/smoke_stage03.py
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

import polars as pl

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_spec = importlib.util.spec_from_file_location("s03", ROOT / "pipeline" / "03_engine_labels.py")
s03 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s03)


def test_pick_plies() -> None:
    # short game -> all plies
    assert s03._pick_plies([50.0, 51.0, 49.0], want=10) == [1, 2, 3]

    # a game with one sharp swing at ply 20 -> that ply must be picked
    wp = [50.0] * 40
    wp[19] = 90.0  # ply 20 jumps
    picks = s03._pick_plies(wp, want=8)
    assert 20 in picks and len(picks) == 8 and picks == sorted(picks)
    assert all(2 <= p <= 40 for p in picks)


def test_stratified_sampling() -> None:
    games = pl.DataFrame(
        {
            "game_id": [f"g{i}" for i in range(600)],
            "white_elo": [800 + (i % 6) * 200 for i in range(600)],   # 6 bands
            "black_elo": [800 + (i % 6) * 200 for i in range(600)],
        }
    )
    picked = s03._stratified_game_ids(games, sample=120, elo_lo=600, elo_hi=2200)
    assert len(picked) <= 120
    assert len(set(picked)) == len(picked)  # no dupes
    # bands should each contribute — check the low and high bands are represented
    elo = dict(zip(games["game_id"], games["white_elo"]))
    bands = {(elo[g] // 200) for g in picked}
    assert len(bands) >= 4, bands


if __name__ == "__main__":
    test_pick_plies()
    test_stratified_sampling()
    print("SMOKE STAGE-03 OK")
