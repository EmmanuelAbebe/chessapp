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
    # Which site these games came from - "lichess" | "chesscom". Not just
    # metadata: the reference population/skill+style/cohort machinery is
    # built entirely from Lichess data, so a non-"lichess" provider skips
    # all of that (see build_profile's provider param) rather than compare
    # a chess.com player against Lichess-calibrated ratings.
    provider: str = "lichess"


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


class PhaseAccuracy(BaseModel):
    """Win-probability loss (lower is better) in one game phase, vs. your
    own overall average across all phases - self-referential (previously
    compared against a peer population's median; that needed a reference
    population this doesn't). Unconditional - always populated for every
    phase, so the dashboard can pair this against its own phase move-share
    chart regardless of anything else."""

    you: float
    your_overall: float


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
    # direction-corrected z (negative = worse, matching Strength.z's sign
    # convention) so a client can plot strengths + focus_areas on one
    # shared diverging scale. `graded` is false for a focus area that
    # turned up on a style feature (no known good/bad direction) - still
    # worth surfacing as a focus area, but excluded from that shared chart.
    z: float = 0.0
    graded: bool = True


class Strength(BaseModel):
    id: str
    title: str
    evidence: list[Evidence]
    text: str = ""
    z: float = 0.0


class PerGameStats(BaseModel):
    """Real move-quality features for one analyzed game - the same
    per-game row moves_agg/game_level_agg already compute on the way to
    the player-level aggregate, just not discarded this time. `game_id`
    is the Lichess game id (from the PGN's Site header), so a client can
    match it against a GameHistoryEntry's meta.gameUrl to explain a
    specific win-rate stretch with real accuracy numbers, not just the
    game list."""

    game_id: str
    date: str | None = None
    result: str  # "win" | "loss" | "draw", from this player's side
    mean_wp_loss: float
    blunder_rate: float
    mistake_rate: float
    wp_loss_opening: float | None = None
    wp_loss_middlegame: float | None = None
    wp_loss_endgame: float | None = None


class ComplexityByMoveBucket(BaseModel):
    """Average position complexity *and* real move accuracy at one move
    number, across all of your analyzed games - the "arc" of a typical
    game: where it's still known/quiet opening play, and where it turns
    sharp, paired with how well you actually played there (win-
    probability lost vs. Stockfish's best move) - so the shape isn't just
    "where things get sharp," it's "where things get sharp and how that
    goes for you." `move_number` is the standard chess move count
    (ceil(ply/2)), capped at a max so a few very long games don't produce
    a long, sparse tail - moves at/after the cap are folded into one
    final bucket."""

    move_number: int
    mean_complexity: float
    mean_wp_loss: float | None = None
    n: int


class SituationalGap(BaseModel):
    """One situation (tactical positions, low on the clock, defending, ...)
    bucketed from a player's own moves, scored purely against Stockfish's
    own best move in each position - no peer/reference population
    involved. `your_wp_loss` is the mean win-probability lost in this
    situation, `share_of_moves` how often it comes up, and `impact` is
    their product - how much of this player's *total* lost win-probability
    this situation accounts for, which is what critical_lessons/
    strong_situations are ranked by."""

    id: str
    label: str
    your_wp_loss: float
    share_of_moves: float
    impact: float
    example_positions: list[ExamplePosition] = []
    coaching: Coaching = Coaching()


class FeatureDelta(BaseModel):
    """One real behavior that actually drives the 2 style axes being
    plotted (StyleCompass.tsx's PC0/PC3) - `bin_value` in this move range
    vs. `overall_value` across this player's whole game history. Why a
    trajectory point sits where it does, in the player's own vocabulary,
    not the raw PCA math."""

    feature: str
    label: str
    bin_value: float
    overall_value: float


class StyleTrajectoryPoint(BaseModel):
    """This player's real style vector (same 5 PCA components as
    style.vector) computed from only the moves in one move-number range,
    instead of their whole game history - the "shape" of how their style
    actually changes across a typical game. Self-referential, same as
    critical_lessons: no reference population involved, just this
    player's own moves re-bucketed by when in the game they happened.
    `move_number` is the bin's starting move (1, 6, 11, ...); `n` is how
    many of this player's own moves fall in it, for a confidence/opacity
    cue - later bins naturally have fewer games still going. `phase` is
    this bin's dominant game phase (most common among this player's own
    moves landing in it) - opening is a fixed ply cutoff but the
    middlegame/endgame boundary is real board-state-dependent (see
    pipeline/common/chessext.py's game_phase), so this is real signal,
    not an assumed cutoff."""

    move_number: int
    vector: list[float]
    n: int
    phase: str
    feature_deltas: list[FeatureDelta] = []


class Profile(BaseModel):
    schema_version: int = 1
    computed_at: str
    source: Source
    # Peer/reference-population-based - kept for a future pass, left at
    # empty/zero defaults for now (see critical_lessons/strong_situations
    # below for what replaced them as the leading coaching narrative).
    skill: Skill
    style: Style
    cohort: Cohort
    focus_areas: list[FocusArea]
    strengths: list[Strength]
    # Self-referential - Stockfish's own best move is the only standard,
    # ranked by how much of a player's own total lost win-probability each
    # situation accounts for. Works identically for every provider/format,
    # no reference population needed.
    critical_lessons: list[SituationalGap] = []
    strong_situations: list[SituationalGap] = []
    style_trajectory: list[StyleTrajectoryPoint] = []
    phase_accuracy: dict[str, PhaseAccuracy] = {}
    per_game: list[PerGameStats] = []
    complexity_by_move: list[ComplexityByMoveBucket] = []
    coach_context: str
    caveats: list[str] = []


class JobStatus(BaseModel):
    """Progress + latest snapshot for a chunked /profile/jobs run. `profile`
    is a real, honestly-computed snapshot of however many games have been
    folded in so far - not a placeholder - so a client can render it right
    away and just watch it update as more batches complete."""

    status: str  # "running" | "done" | "error"
    games_processed: int = 0
    games_total: int = 0
    profile: Profile | None = None
    error: str | None = None
