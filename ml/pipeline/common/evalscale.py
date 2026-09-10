"""Win-probability transform and move classification.

These must stay numerically identical to the web app so a profile computed
here lines up with what a user sees on the board:
  - `features/board/lib/eval-format.ts` :: whitePercentFromScore / scoreToWhite
  - `features/board/lib/move-analysis.ts` :: classifyMove

`cp` is centipawns from White's point of view. Mate collapses to a fixed
±1000 cp sentinel, exactly as `scoreToWhite` does.
"""

from __future__ import annotations

import math

MATE_CP = 1000  # scoreToWhite's `huge`


def white_score(cp: int | None, mate: int | None) -> float:
    """A single White-relative number for a (cp, mate) pair already in
    White's frame (Lichess `%eval` is White-relative)."""
    if mate is not None:
        return float(MATE_CP if mate > 0 else -MATE_CP)
    return float(cp or 0)


def white_percent(score: float) -> float:
    """0..100, White's win chance. whitePercentFromScore, simplified:
    50 * (tanh(score / 350) + 1)."""
    compressed = 1000.0 * math.tanh(score / 350.0)
    return max(0.0, min(100.0, (compressed + 1000.0) / 2000.0 * 100.0))


def mover_percent(cp: int | None, mate: int | None, mover: str) -> float:
    """White-relative eval -> the *mover's* win chance (0..100)."""
    wp = white_percent(white_score(cp, mate))
    return wp if mover == "w" else 100.0 - wp


CLASSES = ("best", "good", "inaccuracy", "mistake", "blunder")


def classify(drop: float, thresholds: dict[str, float]) -> str:
    """`drop` = mover win% before - mover win% after (>= 0). Buckets match
    classifyMove; `thresholds` comes from config.move_features.classify."""
    if drop <= thresholds["best"]:
        return "best"
    if drop <= thresholds["good"]:
        return "good"
    if drop <= thresholds["inaccuracy"]:
        return "inaccuracy"
    if drop <= thresholds["mistake"]:
        return "mistake"
    return "blunder"
