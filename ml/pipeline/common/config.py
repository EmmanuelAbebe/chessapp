"""Load ``config.yaml`` once and resolve its paths relative to the ml/ root.

Every stage does ``cfg = load()`` and reads from the returned dict. Paths in
the ``paths:`` block are returned as absolute ``pathlib.Path`` objects so a
stage can be run from anywhere.

Reference populations are built per "format" - a (variant, speed) pair,
e.g. standard_blitz, standard_bullet, chess960_blitz - so more than one can
exist side by side without one run's data/artifacts overwriting another's.
``format:`` in config.yaml picks the default; override per-invocation with
the PLAYERMODEL_FORMAT env var (e.g. to run a stage for bullet without
editing the file, or to run two formats' pipelines concurrently).
"""

from __future__ import annotations

import os
import pathlib
from typing import Any

import yaml

ML_ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG_PATH = ML_ROOT / "config.yaml"


def load() -> dict[str, Any]:
    cfg = yaml.safe_load(CONFIG_PATH.read_text())
    cfg["paths"] = {
        key: (ML_ROOT / value).resolve()
        for key, value in cfg["paths"].items()
    }
    return cfg


def current_format(cfg: dict[str, Any]) -> str:
    """Which named format (key into `cfg["formats"]`) this process is
    building/serving - PLAYERMODEL_FORMAT overrides config.yaml's
    `format:` default, so a stage script or service instance can target a
    specific one without editing the shared file."""
    return os.environ.get("PLAYERMODEL_FORMAT", cfg["format"])


def format_spec(cfg: dict[str, Any], fmt: str | None = None) -> dict[str, str]:
    """{"variant": ..., "speed": ...} for `fmt` (default: current_format)."""
    fmt = fmt or current_format(cfg)
    try:
        return cfg["formats"][fmt]
    except KeyError:
        raise KeyError(
            f"unknown format {fmt!r} - add it to config.yaml's `formats:` map first"
        ) from None


def month_dir(cfg: dict[str, Any], fmt: str | None = None) -> pathlib.Path:
    """``data/<month>/<format>/`` — the per-format working directory for the
    current run. Isolated per format so building e.g. standard_bullet can
    never read or clobber standard_blitz's intermediate parquet."""
    d = cfg["paths"]["data_dir"] / cfg["lichess"]["month"] / (fmt or current_format(cfg))
    d.mkdir(parents=True, exist_ok=True)
    return d


def artifacts_dir(cfg: dict[str, Any], fmt: str | None = None) -> pathlib.Path:
    """``artifacts/<format>/`` — where a format's fitted models + reference
    table are written/read. Same isolation reasoning as month_dir."""
    d = cfg["paths"]["artifacts_dir"] / (fmt or current_format(cfg))
    d.mkdir(parents=True, exist_ok=True)
    return d


def dump_url(cfg: dict[str, Any], fmt: str | None = None) -> str:
    variant = format_spec(cfg, fmt)["variant"]
    if variant != "standard":
        raise NotImplementedError(
            f"lichess.url_template is only verified for the standard-variant dump; "
            f"add and confirm the real URL for variant {variant!r} before using it here"
        )
    return cfg["lichess"]["url_template"].format(month=cfg["lichess"]["month"])
