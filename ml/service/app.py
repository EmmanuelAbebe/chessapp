"""FastAPI inference service.

    uvicorn service.app:app --port 8000

Env:
  SERVICE_TOKEN                required header X-Service-Token if set
  PLAYERMODEL_ARTIFACTS_DIR    overrides config.yaml's paths.artifacts_dir
"""

from __future__ import annotations

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.project import Artifacts  # noqa: E402
from service.profile import NotEnoughGames, build_profile  # noqa: E402
from service.schemas import Profile, ProfileRequest  # noqa: E402


def create_app(art: Artifacts, cfg: dict) -> FastAPI:
    app = FastAPI(title="chessapp player-model service", version="1")
    token = os.environ.get("SERVICE_TOKEN")

    def _check_token(x_service_token: str | None) -> None:
        if token and x_service_token != token:
            raise HTTPException(status_code=401, detail="bad or missing X-Service-Token")

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "reference_players": art.reference.height if art.reference is not None else 0,
            "has_feature_models": art.feature_models is not None,
        }

    @app.post("/profile", response_model=Profile)
    def profile(req: ProfileRequest, x_service_token: str | None = Header(default=None)):
        _check_token(x_service_token)
        try:
            return build_profile(req.games_pgn, req.username, req.time_class, art, cfg)
        except NotEnoughGames as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"internal: profile failed validation: {e}") from e

    return app


def _default_app() -> FastAPI:
    cfg = cfgmod.load()
    override = os.environ.get("PLAYERMODEL_ARTIFACTS_DIR")
    art_dir = pathlib.Path(override) if override else cfg["paths"]["artifacts_dir"]
    return create_app(Artifacts(art_dir), cfg)


app = _default_app()
