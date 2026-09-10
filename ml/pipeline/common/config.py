"""Load ``config.yaml`` once and resolve its paths relative to the ml/ root.

Every stage does ``cfg = load()`` and reads from the returned dict. Paths in
the ``paths:`` block are returned as absolute ``pathlib.Path`` objects so a
stage can be run from anywhere.
"""

from __future__ import annotations

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


def month_dir(cfg: dict[str, Any]) -> pathlib.Path:
    """``data/<month>/`` — the per-month working directory for the current run."""
    d = cfg["paths"]["data_dir"] / cfg["lichess"]["month"]
    d.mkdir(parents=True, exist_ok=True)
    return d


def dump_url(cfg: dict[str, Any]) -> str:
    return cfg["lichess"]["url_template"].format(month=cfg["lichess"]["month"])
