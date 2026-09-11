"""The profile JSON contract — pydantic on this side, mirrored by
``features/playermodel/types.ts`` on the Next.js side. See the "Data
contract" section of the plan for the annotated example.
"""

from __future__ import annotations

from pydantic import BaseModel


class ProfileRequest(BaseModel):
    games_pgn: str
    username: str
    time_class: str = "blitz"


class Source(BaseModel):
    provider: str = "lichess"
    username: str
    games_analyzed: int
    time_class: str
    date_range: tuple[str, str] | None = None
    eval_source: str  # "lichess" | "internal_depth16" | "mixed"


class SubScore(BaseModel):
    score: float
    pct_in_band: float | None = None


class Skill(BaseModel):
    overall: float
    confidence: float
    sub: dict[str, SubScore]


class StyleAxis(BaseModel):
    id: str
    label: str
    value: float
    blurb: str = ""


class SignatureItem(BaseModel):
    feature: str
    you: float
    peers: float
    z: float
    text: str = ""


class Style(BaseModel):
    vector: list[float]
    umap_xy: tuple[float, float]
    axes: list[StyleAxis]
    signature: list[SignatureItem]


class Cohort(BaseModel):
    size: int
    your_band: tuple[float, float]
    stronger_band: tuple[float, float]
    description: str = ""


class Evidence(BaseModel):
    feature: str
    label: str = ""
    you: float
    cohort: float
    unit: str = ""


class ExamplePosition(BaseModel):
    game_id: str
    ply: int
    fen: str
    wp_loss: float
    seed: str = ""


class Coaching(BaseModel):
    what: str | None = None
    why: str | None = None
    missed: str | None = None
    principle: str | None = None
    drill: str | None = None


class FocusArea(BaseModel):
    id: str
    rank: int
    title: str
    evidence: list[Evidence]
    estimated_rating_gain: float
    confidence: str  # "low" | "medium" | "high"
    example_positions: list[ExamplePosition]
    coaching: Coaching = Coaching()


class Strength(BaseModel):
    id: str
    title: str
    evidence: list[Evidence]
    text: str = ""


class Profile(BaseModel):
    schema_version: int = 1
    computed_at: str
    source: Source
    skill: Skill
    style: Style
    cohort: Cohort
    focus_areas: list[FocusArea]
    strengths: list[Strength]
    coach_context: str
    caveats: list[str] = []
