"""Synthetic end-to-end run of stages 05 -> 11 on fabricated data.

Generates a move_features/ + games/ tree for ~44 players (each with a
hidden 'true Elo' that drives their wp_loss), then runs every stage in
order against a temp config and asserts the outputs land. No engine, no
download; uses the PCA-2D / sklearn-NN fallbacks (umap/faiss optional).

    .venv/bin/python tests/smoke_pipeline.py
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

RNG = np.random.default_rng(11)
PIECES = ["p", "p", "p", "n", "b", "r", "q", "k"]
ECOS = ["B10", "C50", "D02", "A45", "C41", "B01"]


def _load(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "pipeline" / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _gen(tmp: pathlib.Path) -> None:
    (tmp / "games").mkdir(parents=True)
    (tmp / "move_features").mkdir(parents=True)

    n_players = 44
    true_elo = {f"p{i:02d}": int(RNG.uniform(950, 2050)) for i in range(n_players)}
    games, moves = [], []
    gid = 0
    for pi in range(n_players):
        me = f"p{pi:02d}"
        for _ in range(int(RNG.integers(16, 24))):
            opp = f"p{RNG.integers(0, n_players):02d}"
            if opp == me:
                continue
            gid += 1
            g = f"g{gid:05d}"
            i_am_white = bool(RNG.random() < 0.5)
            white, black = (me, opp) if i_am_white else (opp, me)
            n_ply = int(RNG.integers(44, 78))
            castle_ply = {"w": int(RNG.integers(7, 20)), "b": int(RNG.integers(8, 21))}
            res = RNG.choice(["1-0", "0-1", "1/2-1/2"])
            month = RNG.integers(1, 4)
            games.append(
                {
                    "game_id": g, "white": white, "black": black,
                    "white_elo": true_elo[white] + int(RNG.normal(0, 40)),
                    "black_elo": true_elo[black] + int(RNG.normal(0, 40)),
                    "result": res, "eco": RNG.choice(ECOS),
                    "utc_date": f"2024.{month:02d}.{RNG.integers(1, 28):02d}",
                    "time_control": "300+0",
                }
            )
            wp_white = 50.0
            clock = 30000
            for ply in range(1, n_ply + 1):
                mover = "w" if ply % 2 == 1 else "b"
                mover_name = white if mover == "w" else black
                weakness = (2050 - true_elo[mover_name]) / 1100  # 0..1
                phase = "opening" if ply <= 20 else ("endgame" if ply > n_ply - 16 else "middlegame")
                tactic_p = float(RNG.beta(1.5, 6))
                cplx = float(RNG.uniform(2, 40))
                base = 2 + 8 * weakness + (6 if tactic_p > 0.5 else 0) + cplx * 0.15 * weakness
                wp_loss = float(np.clip(RNG.gamma(2.0, base / 2.0), 0, 60))
                wp_white += wp_loss * (-1 if mover == "w" else 1) * RNG.choice([1, -0.3])
                wp_white = float(np.clip(wp_white, 1, 99))
                clock = max(200, clock - int(RNG.uniform(200, 2500)))
                cls = (
                    "best" if wp_loss <= 2 else "good" if wp_loss <= 6
                    else "inaccuracy" if wp_loss <= 12 else "mistake" if wp_loss <= 25 else "blunder"
                )
                st = {k: float(RNG.integers(0, 5)) for k in STATIC_FEATURE_NAMES}
                st["st_legal_moves"] = float(RNG.integers(6, 44))
                st["st_pawn_tension"] = float(RNG.integers(0, 4))
                st["st_material_imbalance"] = float(RNG.integers(0, 6))
                is_castle = ply == castle_ply[mover]
                moves.append(
                    {
                        "game_id": g, "ply": ply, "mover": mover,
                        "san": "O-O" if is_castle else "Nf3",
                        "uci": RNG.choice(["e2e4", "d2d4", "g1f3", "c2c4"]) if ply <= 2 else "a2a3",
                        "eval_cp": int((wp_white - 50) * 8), "eval_mate": None,
                        "clock_cs": clock,
                        "wp_white_after": wp_white, "wp_loss": wp_loss, "classification": cls,
                        "phase": phase, "material_swing": float(RNG.integers(0, 3)),
                        "piece_moved": RNG.choice(PIECES),
                        "is_capture": bool(RNG.random() < 0.3), "is_check": bool(RNG.random() < 0.08),
                        "is_castle": is_castle, "is_dev_move": bool(ply < 12 and RNG.random() < 0.3),
                        "is_pawn_push": bool(RNG.random() < 0.4),
                        "king_dist_delta": int(RNG.integers(-2, 3)),
                        "see": float(RNG.integers(-3, 3)),
                        "pawn_tension_before": int(RNG.integers(0, 4)),
                        "released_tension": bool(RNG.random() < 0.2),
                        "is_defending": bool(wp_white < 43 if mover == "w" else wp_white > 57),
                        "think_time_s": float(RNG.uniform(0.5, 12)),
                        "legal_moves_before": int(RNG.integers(6, 44)),
                        "in_book": bool(ply <= RNG.integers(4, 14)),
                        "plies_since_book_exit": max(0, ply - int(RNG.integers(4, 14))),
                        "has_tactic_pred": tactic_p, "only_move_pred": float(RNG.beta(1.5, 6)),
                        "complexity_pred": cplx, "wp_loss_model": wp_loss + float(RNG.normal(0, 3)),
                        **st,
                    }
                )
    pl.DataFrame(games).write_parquet(tmp / "games" / "part_00000.parquet")
    pl.DataFrame(moves).write_parquet(tmp / "move_features" / "part_00000.parquet")


def main() -> None:
    tmp = ROOT / "data" / "_pipe"
    art = ROOT / "artifacts" / "_pipe"
    for d in (tmp, art):
        if d.exists():
            shutil.rmtree(d)
    _gen(tmp)

    cfg = cfgmod.load()
    cfg["paths"]["artifacts_dir"] = art
    cfg["player_vectors"].update(min_games=8, min_games_with_clocks=0, max_games_per_player=100)
    cfgmod.load = lambda: cfg  # noqa: E731
    cfgmod.month_dir = lambda _c=None: tmp  # noqa: E731

    s05 = _load("s05", "05_game_agg.py")
    s06 = _load("s06", "06_player_vectors.py")
    s07 = _load("s07", "07_skill_model.py")
    s08 = _load("s08", "08_style_embedding.py")
    s09 = _load("s09", "09_trait_models.py")
    s10 = _load("s10", "10_export_artifacts.py")
    s11 = _load("s11", "11_validate.py")

    s05.run()
    assert (tmp / "game_agg.parquet").exists()
    ga = pl.read_parquet(tmp / "game_agg.parquet")
    assert ga.height > 400 and "mean_wp_loss" in ga.columns

    s06.run()
    pv = pl.read_parquet(tmp / "player_vectors.parquet")
    from pipeline.common.features import MODELLED
    assert pv.height >= 20, pv.height
    assert not any(pv[f].is_null().any() for f in MODELLED), "nulls left after fill"

    s07.run()
    pvs = pl.read_parquet(tmp / "player_vectors_skill.parquet")
    assert {"skill_score", "skill_tactical", "skill_endgame"} <= set(pvs.columns)

    s08.run()
    pvf = pl.read_parquet(tmp / "player_vectors_full.parquet")
    assert {"pca_0", "pca_9", "umap_x"} <= set(pvf.columns)
    assert (art / "style" / "pc_loadings.md").exists()

    s09.run()
    pvfin = pl.read_parquet(tmp / "player_vectors_final.parquet")
    from pipeline.common.features import TRAITS
    assert set(TRAITS) <= set(pvfin.columns)
    for t in TRAITS:
        assert abs(pvfin[t].mean()) < 0.05, (t, pvfin[t].mean())  # z-scored

    # stage 04 (feature models) is covered by smoke_stage04.py and needs an
    # engine sample; just satisfy stage 10's presence check and move_freq copy.
    (art / "feature_models").mkdir(parents=True, exist_ok=True)
    pl.DataFrame({"epd_before": ["x"], "uci": ["e2e4"], "len": [99]}).write_parquet(
        tmp / "move_freq.parquet"
    )

    s10.run()
    assert (art / "reference_meta.parquet").exists()
    assert (art / "feature_spec.json").exists()
    ref = pl.read_parquet(art / "reference_meta.parquet")
    assert ref.height == pvfin.height

    # move_freq is produced by stage 02; fake one so stage 10's copy path is covered next run
    s11.run()
    assert (art / "validation_report.md").exists()
    print("\nSMOKE PIPELINE OK  ({} players, {} ref rows)".format(pv.height, ref.height))

    for d in (tmp, art):
        shutil.rmtree(d)


if __name__ == "__main__":
    main()
