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

export type Evidence = {
  feature: string;
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
};

export type Strength = {
  id: string;
  title: string;
  evidence: Evidence[];
  text?: string;
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
  focus_areas: FocusArea[];
  strengths: Strength[];
  coach_context: string;
  caveats: string[];
};
