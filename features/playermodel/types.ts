// Mirrors ml/service/schemas.py's Profile - the shape /api/player-profile
// returns verbatim (it's stored in Prisma's PlayerProfile.data untouched).
// Loose typing (no runtime validation) since the service is the source of
// truth for the actual shape; this just gives the dashboard components
// autocomplete.

export type SubScore = {
  score: number;
  pct_in_band?: number | null;
};

export type Skill = {
  overall: number;
  confidence: number;
  sub: Record<string, SubScore>;
};

export type StyleAxis = {
  id: string;
  label: string;
  value: number;
  blurb?: string;
};

export type SignatureItem = {
  feature: string;
  you: number;
  peers: number;
  z: number;
  text?: string;
};

export type Style = {
  vector: number[];
  umap_xy: [number, number];
  axes: StyleAxis[];
  signature: SignatureItem[];
};

export type Cohort = {
  size: number;
  your_band: [number, number];
  stronger_band: [number, number];
  description?: string;
};

export type PhaseAccuracy = {
  you: number;
  /** Your own overall average wp_loss across all phases - self-
   * referential (previously a peer-population median). */
  your_overall: number;
};

export type Evidence = {
  feature: string;
  label?: string;
  you: number;
  cohort: number;
  unit?: string;
};

export type ExamplePosition = {
  game_id: string;
  ply: number;
  fen: string;
  wp_loss: number;
  seed?: string;
};

export type Coaching = {
  what?: string | null;
  why?: string | null;
  missed?: string | null;
  principle?: string | null;
  drill?: string | null;
};

export type FocusArea = {
  id: string;
  rank: number;
  title: string;
  evidence: Evidence[];
  estimated_rating_gain: number;
  confidence: "low" | "medium" | "high";
  example_positions: ExamplePosition[];
  coaching: Coaching;
  /** Direction-corrected z vs. the stronger-cohort median - negative,
   * consistently, since a focus area is by definition a weakness. Shares
   * a sign convention with Strength.z and SignatureItem.z. */
  z: number;
  /** False when this focus area came from a style feature (no known
   * good/bad direction) rather than a graded skill feature - z is still
   * present but not meaningfully "worse," so exclude it from a chart that
   * plots skill gaps on a good/bad scale. */
  graded: boolean;
};

export type Strength = {
  id: string;
  title: string;
  evidence: Evidence[];
  text?: string;
  z: number;
};

export type SituationalGap = {
  id: string;
  label: string;
  /** Mean win-probability lost in this situation, scored only against
   * Stockfish's own best move - no peer/population comparison. */
  your_wp_loss: number;
  /** Fraction of this player's analyzed moves that fall in this
   * situation. */
  share_of_moves: number;
  /** your_wp_loss * share_of_moves - how much of this player's *total*
   * lost win-probability this situation accounts for. critical_lessons
   * ranks by this; strong_situations ranks by your_wp_loss instead. */
  impact: number;
  example_positions: ExamplePosition[];
  coaching: Coaching;
};

export type ComplexityByMoveBucket = {
  move_number: number;
  mean_complexity: number;
  /** Real win-probability lost vs. Stockfish's best move, averaged at
   * this move number - paired with complexity so the chart shows not
   * just where things get sharp, but how that goes for you. */
  mean_wp_loss?: number | null;
  n: number;
};

export type FeatureDelta = {
  feature: string;
  label: string;
  bin_value: number;
  overall_value: number;
};

export type StyleTrajectoryPoint = {
  /** Bin start (1, 6, 11, ...) - a 5-move-wide window, not a single ply. */
  move_number: number;
  /** This player's style vector (same 5 PCA components as style.vector),
   * recomputed from only the moves in this window - no reference
   * population, same self-referential principle as critical_lessons. */
  vector: number[];
  /** Moves observed in this bin. */
  n: number;
  /** This bin's dominant game phase - opening is a fixed ply cutoff, but
   * the middlegame/endgame boundary is real board-state-dependent, so
   * this varies per player/game, not a fixed move-number rule. */
  phase: "opening" | "middlegame" | "endgame";
  /** Why this bin sits where it does on the compass's 2 axes - real
   * behaviors in this move range vs. this player's own overall average. */
  feature_deltas: FeatureDelta[];
};

export type TraitStabilityPoint = {
  value: number;
  /** Real median rating in this bucket, straight from each game's own
   * PGN header, no skill model involved. */
  elo: number;
  /** This bucket's most recent game date ("YYYY.MM.DD"). */
  date: string;
};

export type TraitStability = {
  axis_id: string;
  label: string;
  /** Whether this axis has actually stayed the same across your whole
   * selected history, or genuinely changed - tested per axis, never
   * assumed either way. */
  stable: boolean;
  first_value: number;
  last_value: number;
  /** Real median rating in the earliest/latest chronological game-bucket
   * - straight from each game's own PGN header, no skill model involved. */
  first_elo: number;
  last_elo: number;
  /** Only set when `stable` is false - a real Pearson r between this
   * axis's per-bucket value and per-bucket rating across your history.
   * Suggestive (moved alongside rating), not causal. */
  correlation_with_rating?: number | null;
  n_buckets: number;
  /** Every bucket's own value/rating/date, not just the first/last
   * summary above - lets a chart show the real shape of a change. */
  points: TraitStabilityPoint[];
};

export type StyleGroup = {
  /** Stable machine id - an ECO code, or a complexity-tercile id. */
  key: string;
  label: string;
  n_games: number;
  /** Same identity-axis count as style.vector/style.axes. */
  vector: number[];
};

export type PerGameStats = {
  game_id: string;
  date?: string | null;
  result: "win" | "loss" | "draw";
  mean_wp_loss: number;
  blunder_rate: number;
  mistake_rate: number;
  wp_loss_opening?: number | null;
  wp_loss_middlegame?: number | null;
  wp_loss_endgame?: number | null;
};

export type Source = {
  provider: string;
  username: string;
  games_analyzed: number;
  time_class: string;
  date_range?: [string, string] | null;
  eval_source: string;
};

export type PlayerProfileData = {
  schema_version: number;
  computed_at: string;
  source: Source;
  skill: Skill;
  style: Style;
  cohort: Cohort;
  /** Peer-comparison concepts - kept in the type for a future pass, but
   * the server always returns these empty today (see ml/service/profile.py's
   * _finalize_profile). critical_lessons/strong_situations below are the
   * current self-referential replacement. */
  focus_areas: FocusArea[];
  strengths: Strength[];
  /** Self-referential: ranked purely against Stockfish's own evaluation
   * of this player's own moves, no population involved. Works identically
   * for every provider/format. */
  critical_lessons: SituationalGap[];
  strong_situations: SituationalGap[];
  phase_accuracy: Partial<Record<"opening" | "middlegame" | "endgame", PhaseAccuracy>>;
  per_game: PerGameStats[];
  /** Optional: absent on a profile persisted before this field existed -
   * only a fresh re-analysis populates it, so treat it as possibly
   * missing rather than always an array. */
  complexity_by_move?: ComplexityByMoveBucket[];
  /** Optional for the same reason as complexity_by_move - only a fresh
   * re-analysis populates it. Empty when this format has no real PC0-PC3
   * labels yet (same gate style.axes uses), not just when stale. */
  style_trajectory?: StyleTrajectoryPoint[];
  /** Optional for the same reason as complexity_by_move - only a fresh
   * re-analysis populates it. Empty for most profiles: needs a real long
   * history (60+ games) before testing a trait for drift means anything. */
  trait_stability?: TraitStability[];
  /** Optional for the same reason as trait_stability - only a fresh
   * re-analysis populates these, and most profiles won't clear either
   * gate (needs enough repeated openings / enough total games). */
  style_by_opening?: StyleGroup[];
  style_by_complexity?: StyleGroup[];
  coach_context: string;
  caveats: string[];
};
