"""Game-level sanitization — the cheap header checks stage 01 runs before
paying to parse movetext, plus the shared speed bucketing.
"""

from __future__ import annotations

_VALID_RESULTS = {"1-0", "0-1", "1/2-1/2"}
_VALID_TERMINATION = {"Normal", "Time forfeit"}


def parse_time_control(tc: str | None) -> tuple[int, int] | None:
    """``"300+2"`` -> (300, 2). ``"-"`` (correspondence) / missing -> None."""
    if not tc or "+" not in tc:
        return None
    base, _, inc = tc.partition("+")
    try:
        return int(base), int(inc)
    except ValueError:
        return None


def speed_bucket(tc: str | None) -> str | None:
    """Lichess's own bucketing: estimated duration = base + 40 * increment."""
    parsed = parse_time_control(tc)
    if parsed is None:
        return None
    base, inc = parsed
    estimated = base + 40 * inc
    if estimated < 30:
        return "ultrabullet"
    if estimated < 180:
        return "bullet"
    if estimated < 480:
        return "blitz"
    if estimated < 1500:
        return "rapid"
    return "classical"


def _int(value: str | None) -> int | None:
    try:
        return int(value) if value is not None else None
    except ValueError:
        return None


def header_ok(h: dict[str, str], cfg_ingest: dict) -> bool:
    """True if the game is worth parsing. Everything here is a header
    lookup — no movetext. `%eval` coverage and ply count are checked later,
    on the parsed game."""
    if speed_bucket(h.get("TimeControl")) != cfg_ingest["speed"]:
        return False
    if h.get("Result") not in _VALID_RESULTS:
        return False
    if h.get("Termination") not in _VALID_TERMINATION:
        return False
    if not h.get("Event", "").startswith("Rated"):
        return False
    if h.get("WhiteTitle") == "BOT" or h.get("BlackTitle") == "BOT":
        return False

    we, be = _int(h.get("WhiteElo")), _int(h.get("BlackElo"))
    lo, hi = cfg_ingest["elo_min"], cfg_ingest["elo_max"]
    if we is None or be is None:
        return False
    return lo <= we <= hi and lo <= be <= hi
