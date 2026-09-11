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
    print(f"focus areas: {[f.title for f in profile.focus_areas]}")
    print(f"strengths: {[s.title for s in profile.strengths]}")
    print(f"coach_context: {profile.coach_context}")
    print(f"caveats: {profile.caveats}")

    assert profile.source.games_analyzed >= 15
    assert 600 <= profile.skill.overall <= 2400
    assert len(profile.style.vector) == 10
    assert profile.source.eval_source == "lichess"  # every game had dense %eval by construction
    for fa in profile.focus_areas:
        assert fa.estimated_rating_gain > 0
        for ep in fa.example_positions:
            assert len(ep.fen.split()) >= 4  # a real FEN

    # not enough games -> NotEnoughGames
    try:
        build_profile(_gen_user_pgn("newbie", 3, 1200), "newbie", "blitz", art, cfg)
        raise AssertionError("expected NotEnoughGames")
    except NotEnoughGames:
        pass

    # --- FastAPI wiring ---------------------------------------------------
    from fastapi.testclient import TestClient
    from service.app import create_app

    client = TestClient(create_app(art, cfg))
    health = client.get("/health").json()
    assert health["status"] == "ok" and health["reference_players"] == art.reference.height

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
