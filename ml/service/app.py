"""FastAPI inference service.

    uvicorn service.app:app --port 8000

Env:
  SERVICE_TOKEN                required header X-Service-Token if set
  PLAYERMODEL_ARTIFACTS_DIR    overrides config.yaml's paths.artifacts_dir
                                (the parent directory formats live under)

Loads every format that has a built artifacts/<format>/ directory (see
pipeline/common/config.py - a format is a (variant, speed) reference
population, e.g. standard_blitz, standard_bullet) and picks the right one
per request from time_class, assuming variant "standard" until the client
can ask for another. A request for a speed with no reference population
yet falls back to config.yaml's default format - the resulting Profile
carries a caveat explaining the mismatch (see service/profile.py), rather
than the request failing.

/profile is the original single-shot endpoint (blocks until the whole
request is analyzed - fine for a request that finishes in seconds). For
anything large enough that a client wants to show progress or render
partial results, use /profile/jobs instead: POST starts a chunked
background run and returns a job id immediately, GET polls it. Jobs live
in an in-memory dict - fine for this single local process, not meant to
survive a restart.
"""

from __future__ import annotations

import os
import pathlib
import sys
import threading
import time
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from pipeline.common import config as cfgmod  # noqa: E402
from pipeline.common.project import Artifacts  # noqa: E402
from service.profile import NotEnoughGames, build_profile, build_profile_chunks  # noqa: E402
from service.schemas import JobStatus, Profile, ProfileRequest  # noqa: E402

_JOB_TTL_SECONDS = 3600  # opportunistically purged, not actively scheduled


def create_app(art_by_format: dict[str, Artifacts], cfg: dict, default_format: str) -> FastAPI:
    app = FastAPI(title="chessapp player-model service", version="1")
    token = os.environ.get("SERVICE_TOKEN")

    jobs: dict[str, dict] = {}
    jobs_lock = threading.Lock()

    def _check_token(x_service_token: str | None) -> None:
        if token and x_service_token != token:
            raise HTTPException(status_code=401, detail="bad or missing X-Service-Token")

    def _purge_stale_jobs() -> None:
        cutoff = time.time() - _JOB_TTL_SECONDS
        stale = [jid for jid, j in jobs.items() if j["created_at"] < cutoff]
        for jid in stale:
            del jobs[jid]

    def _resolve(time_class: str) -> tuple[Artifacts, str]:
        """(Artifacts, reference_speed) for a request's time_class - its
        own population if one's been built (assuming variant "standard"
        until the client can ask for another), else the default format's,
        with reference_speed left at the default's real speed so the
        profile's caveat names it correctly."""
        fmt = f"standard_{time_class}"
        if fmt in art_by_format:
            return art_by_format[fmt], time_class
        default_speed = cfgmod.format_spec(cfg, default_format)["speed"]
        return art_by_format[default_format], default_speed

    def _run_job(job_id: str, req: ProfileRequest) -> None:
        try:
            art, reference_speed = _resolve(req.time_class)
            for processed, total, profile in build_profile_chunks(
                req.games_pgn, req.username, req.time_class, art, cfg,
                reference_speed=reference_speed, provider=req.provider,
            ):
                with jobs_lock:
                    job = jobs[job_id]
                    job["games_processed"] = processed
                    job["games_total"] = total
                    if profile is not None:
                        job["profile"] = profile
            with jobs_lock:
                jobs[job_id]["status"] = "done"
        except NotEnoughGames as e:
            with jobs_lock:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = str(e)
        except Exception as e:  # noqa: BLE001 — surface it to the client rather than hang the job forever
            with jobs_lock:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = f"internal error: {e}"

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "default_format": default_format,
            "formats": {
                fmt: {
                    "reference_players": a.reference.height if a.reference is not None else 0,
                    "has_feature_models": a.feature_models is not None,
                }
                for fmt, a in art_by_format.items()
            },
        }

    @app.post("/profile", response_model=Profile)
    def profile(req: ProfileRequest, x_service_token: str | None = Header(default=None)):
        _check_token(x_service_token)
        art, reference_speed = _resolve(req.time_class)
        try:
            return build_profile(
                req.games_pgn, req.username, req.time_class, art, cfg,
                reference_speed=reference_speed, provider=req.provider,
            )
        except NotEnoughGames as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"internal: profile failed validation: {e}") from e

    @app.post("/profile/jobs")
    def start_profile_job(req: ProfileRequest, x_service_token: str | None = Header(default=None)):
        _check_token(x_service_token)
        with jobs_lock:
            _purge_stale_jobs()
            job_id = uuid.uuid4().hex
            jobs[job_id] = {
                "status": "running", "games_processed": 0, "games_total": 0,
                "profile": None, "error": None, "created_at": time.time(),
            }
        threading.Thread(target=_run_job, args=(job_id, req), daemon=True).start()
        return {"job_id": job_id}

    @app.get("/profile/jobs/{job_id}", response_model=JobStatus)
    def get_profile_job(job_id: str, x_service_token: str | None = Header(default=None)):
        _check_token(x_service_token)
        with jobs_lock:
            job = jobs.get(job_id)
            if job is None:
                raise HTTPException(status_code=404, detail="job not found")
            return JobStatus(
                status=job["status"], games_processed=job["games_processed"],
                games_total=job["games_total"], profile=job["profile"], error=job["error"],
            )

    return app


def _default_app() -> FastAPI:
    cfg = cfgmod.load()
    override = os.environ.get("PLAYERMODEL_ARTIFACTS_DIR")
    default_format = cfgmod.current_format(cfg)

    art_by_format: dict[str, Artifacts] = {}
    for fmt in cfg["formats"]:
        fmt_dir = pathlib.Path(override) / fmt if override else cfgmod.artifacts_dir(cfg, fmt)
        # artifacts_dir() mkdir's as a side effect, so an empty/never-built
        # format's directory exists too - check for a file stage 10 only
        # ever writes once a real export has actually completed.
        if (fmt_dir / "manifest.json").exists():
            art_by_format[fmt] = Artifacts(fmt_dir)
    if default_format not in art_by_format:
        sys.exit(
            f"default format {default_format!r} has no built artifacts "
            f"— run the pipeline for it first, or point config.yaml's `format:` at one that exists"
        )

    return create_app(art_by_format, cfg, default_format)


app = _default_app()
