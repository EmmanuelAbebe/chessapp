"""End-to-end service check: build a small real reference set (stages
02, 04-10 over generated-but-valid PGN), then run the service's
build_profile on a synthetic user's own PGN, and hit the FastAPI app
through TestClient. No network, no real Stockfish (falls back gracefully
if a games needs one and none is configured — none should here, every
game carries dense %eval by construction).

    .venv/bin/python tests/smoke_service.py
"""

from __future__ import annotations

import pathlib
import random
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fixtures import build_reference, random_game_pgn  # noqa: E402

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.project import Artifacts  # noqa: E402
from service.profile import NotEnoughGames, build_profile  # noqa: E402


def _gen_user_pgn(username: str, n_games: int, true_elo_val: int) -> str:
    rng = random.Random(42)
    true_elo = {username: true_elo_val, "opponent": 1500}
    out = []
    for i in range(n_games):
        i_am_white = i % 2 == 0
        white, black = (username, "opponent") if i_am_white else ("opponent", username)
        pgn = random_game_pgn(
            rng, f"u{i:04d}", white, black, true_elo_val, 1500, true_elo, n_ply=rng.randint(40, 70)
        )
        if pgn:
            out.append(pgn)
    return "\n".join(out)


def main() -> None:
    tmp = pathlib.Path(__file__).resolve().parents[1] / "data" / "_svc"
    art_dir = pathlib.Path(__file__).resolve().parents[1] / "artifacts" / "_svc"
    for d in (tmp, art_dir):
        if d.exists():
            shutil.rmtree(d)

    cfg = cfgmod.load()
    print("building reference set (this runs the real stage 02, 04-10)...")
    build_reference(tmp, art_dir, cfg)

    art = Artifacts(art_dir)
    assert art.reference is not None and art.reference.height >= 20, "reference too small"
    assert art.feature_models is not None
    print(f"reference ready: {art.reference.height} players")

    user_pgn = _gen_user_pgn("hero", 22, true_elo_val=1750)
    profile = build_profile(user_pgn, "hero", "blitz", art, cfg)

    print(f"\nskill: {profile.skill.overall} (confidence {profile.skill.confidence})")
    print(f"cohort size (betters): {profile.cohort.size}")
    print(f"style vector[:3]: {profile.style.vector[:3]}")
    print(f"axes: {[a.label for a in profile.style.axes]}")
    print(f"critical lessons: {[(g.label, g.your_wp_loss, g.share_of_moves) for g in profile.critical_lessons]}")
    print(f"strong situations: {[(g.label, g.your_wp_loss) for g in profile.strong_situations]}")
    print(f"style trajectory: {[(p.move_number, p.n, p.phase, p.vector[:2]) for p in profile.style_trajectory]}")
    if profile.style_trajectory:
        print(f"feature deltas (first point): {[(fd.label, fd.bin_value, fd.overall_value) for fd in profile.style_trajectory[0].feature_deltas]}")
    print(f"coach_context: {profile.coach_context}")
    print(f"caveats: {profile.caveats}")

    assert profile.source.games_analyzed >= 15
    # skill/cohort/focus_areas/strengths are peer-comparison concepts,
    # deliberately not computed today (see profile.py's _finalize_profile) -
    # kept as valid, zeroed/empty schema fields for a future pass.
    assert profile.skill.overall == 0 and profile.cohort.size == 0
    assert profile.focus_areas == [] and profile.strengths == []
    assert len(profile.style.vector) == 10
    assert profile.source.eval_source == "lichess"  # every game had dense %eval by construction
    # critical_lessons/strong_situations are self-referential (Stockfish's
    # own evaluation only, no population) - real signal even off this
    # small synthetic fixture.
    assert len(profile.critical_lessons) > 0, "expected at least one situational lesson"
    lesson_ids = {g.id for g in profile.critical_lessons}
    strong_ids = {g.id for g in profile.strong_situations}
    assert not (lesson_ids & strong_ids), "a situation shouldn't appear in both lists"
    for g in profile.critical_lessons:
        assert g.your_wp_loss >= 0 and 0 <= g.share_of_moves <= 1
        for ep in g.example_positions:
            assert len(ep.fen.split()) >= 4  # a real FEN
    for phase in ("opening", "middlegame", "endgame"):
        assert phase in profile.phase_accuracy  # unconditional now, no peer-population gate

    # style_trajectory: real per-move-number style, no population involved
    # either - may be empty on a very small/short-games fixture (each bin
    # needs _MIN_TRAJECTORY_MOVES of its own), but shouldn't be malformed.
    move_numbers = [p.move_number for p in profile.style_trajectory]
    assert move_numbers == sorted(move_numbers), "bins should be in ascending move-number order"
    for p in profile.style_trajectory:
        assert len(p.vector) == 10 and p.n > 0
        assert p.phase in ("opening", "middlegame", "endgame")
        assert len(p.feature_deltas) > 0
        for fd in p.feature_deltas:
            assert fd.label  # real human label, not a raw feature key

    # complexity_by_move now also carries real accuracy alongside
    # complexity - paired, not a single-dimension chart.
    assert len(profile.complexity_by_move) > 0
    assert any(b.mean_wp_loss is not None for b in profile.complexity_by_move)

    # trait_stability needs a real long history (>= 60 games) to mean
    # anything - this fixture's 22 games should come back empty, which is
    # exactly the gate working, not a missing feature.
    assert profile.trait_stability == []

    # not enough games -> NotEnoughGames
    try:
        build_profile(_gen_user_pgn("newbie", 3, 1200), "newbie", "blitz", art, cfg)
        raise AssertionError("expected NotEnoughGames")
    except NotEnoughGames:
        pass

    # --- FastAPI wiring ---------------------------------------------------
    from fastapi.testclient import TestClient
    from service.app import create_app

    fmt = cfgmod.current_format(cfg)
    client = TestClient(create_app({fmt: art}, cfg, fmt))
    health = client.get("/health").json()
    assert health["status"] == "ok" and health["formats"][fmt]["reference_players"] == art.reference.height

    resp = client.post("/profile", json={"games_pgn": user_pgn, "username": "hero", "time_class": "blitz"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source"]["username"] == "hero"

    bad = client.post("/profile", json={"games_pgn": "", "username": "hero"})
    assert bad.status_code == 422, bad.text

    print("\nSMOKE SERVICE OK")
    for d in (tmp, art_dir):
        shutil.rmtree(d)


if __name__ == "__main__":
    main()
