"""Real Stockfish check for stage 03's _analyse_game — needs
./stockfish/stockfish. Runs one game containing a known blunder (3...Nf6??
allowing 4.Qxf7#) and checks the labels are sane.

    .venv/bin/python tests/engine_check.py
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline.common import config as cfgmod  # noqa: E402

_spec = importlib.util.spec_from_file_location("s03", ROOT / "pipeline" / "03_engine_labels.py")
s03 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s03)


def main() -> None:
    sf = cfgmod.load()["paths"]["stockfish"]
    if not sf.exists():
        sys.exit(f"no stockfish at {sf}")

    # depth 8 keeps this runnable on a weak/loaded laptop; the pipeline
    # itself uses config.engine_labels.depth (14) on the cloud VM.
    s03._init_worker(str(sf), threads=1, depth=8, multipv=4, plies=10, only_gap=15.0)

    # 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    ucis = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]
    wp_after = [52.0, 50.0, 55.0, 50.0, 58.0, 50.0, 100.0]
    rows = s03._analyse_game(("scholar", ucis, wp_after))

    by_ply = {r[1]: r for r in rows}
    cols = [
        "game_id", "ply", "mover", "fen_before", "played_uci", "best_uci",
        "matches_best", "wp_loss_engine", "only_move", "complexity", "has_tactic",
        "n_lines", "cp1", "mate1",
    ]
    for ply in sorted(by_ply):
        r = dict(zip(cols, by_ply[ply]))
        print(
            f"ply {r['ply']:>2} {r['mover']} played={r['played_uci']} best={r['best_uci']} "
            f"match={r['matches_best']} wp_loss={r['wp_loss_engine']:.1f} "
            f"only={r['only_move']} cplx={r['complexity']:.1f} tactic={r['has_tactic']}"
        )

    blunder = dict(zip(cols, by_ply[6]))  # 3...Nf6??
    assert blunder["mover"] == "b"
    assert blunder["played_uci"] == "g8f6"
    assert blunder["matches_best"] is False, blunder
    assert blunder["wp_loss_engine"] > 40.0, blunder  # gave up ~half the win prob or more
    assert blunder["best_uci"] != "g8f6", blunder

    mate_ply = dict(zip(cols, by_ply[7]))  # 4.Qxf7#
    assert mate_ply["matches_best"] is True, mate_ply
    assert mate_ply["has_tactic"] is True, mate_ply    # forcing move + huge win% gap
    assert mate_ply["only_move"] is True, mate_ply

    s03._ENGINE.quit()
    print("ENGINE CHECK OK")


if __name__ == "__main__":
    main()
