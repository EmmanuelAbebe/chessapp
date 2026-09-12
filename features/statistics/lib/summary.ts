import type { GameHistoryEntry } from "@/features/history/types";
import { openingFamilyOf } from "@/features/history/gameFacets";

// Plain counting stats - a record, opening breakdown, and a few habits -
// to sit alongside the interpretive personality traits. All notation-only
// (no engine), same as traits.ts.

// --- Record ------------------------------------------------------------------

export type WinLossRecord = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Standard scoring: win 1, draw 0.5, loss 0, as a percentage. */
  score: number;
};

function tally(games: GameHistoryEntry[]): WinLossRecord {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const g of games) {
    if (g.result === "win") wins += 1;
    else if (g.result === "draw") draws += 1;
    else losses += 1;
  }
  const games_ = games.length;
  return {
    games: games_,
    wins,
    draws,
    losses,
    score: games_ ? ((wins + draws * 0.5) / games_) * 100 : 0,
  };
}

export type RecordSummary = {
  overall: WinLossRecord;
  asWhite: WinLossRecord;
  asBlack: WinLossRecord;
};

export function computeRecord(games: GameHistoryEntry[]): RecordSummary {
  return {
    overall: tally(games),
    asWhite: tally(games.filter((g) => g.playerSide === "w")),
    asBlack: tally(games.filter((g) => g.playerSide === "b")),
  };
}

// --- Openings ---------------------------------------------------------------

export type OpeningLine = {
  /** The opening's family name - "Sicilian Defense", "Ruy Lopez", ... */
  label: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
};

export type OpeningsBreakdown = {
  /** Named families, biggest first. At most `limit` entries. */
  lines: OpeningLine[];
  /** Every game not in `lines`, aggregated, or null if the tail is empty. */
  other: Omit<OpeningLine, "label"> | null;
  /** Total games with a known opening (sum of lines + other). */
  total: number;
};

/** The player's openings by family, biggest first. Beyond `limit` named
 * slices the tail folds into `other` (so a pie of this never exceeds
 * `limit` + 1 slices). */
export function computeOpenings(
  games: GameHistoryEntry[],
  { limit = 5 }: { limit?: number } = {},
): OpeningsBreakdown {
  const groups = new Map<string, GameHistoryEntry[]>();
  for (const game of games) {
    if (game.moves.length === 0) continue;
    const name = openingFamilyOf(game);
    const list = groups.get(name);
    if (list) list.push(game);
    else groups.set(name, [game]);
  }

  const all: OpeningLine[] = [];
  for (const [name, gs] of groups) {
    const r = tally(gs);
    all.push({
      label: name,
      games: r.games,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      score: r.score,
    });
  }
  all.sort((a, b) => b.games - a.games);

  const total = all.reduce((sum, l) => sum + l.games, 0);
  const lines = all.slice(0, limit);
  const tail = all.slice(limit);
  const other =
    tail.length > 0
      ? (() => {
          const w = tail.reduce((s, l) => s + l.wins, 0);
          const d = tail.reduce((s, l) => s + l.draws, 0);
          const ls = tail.reduce((s, l) => s + l.losses, 0);
          const g = w + d + ls;
          return {
            games: g,
            wins: w,
            draws: d,
            losses: ls,
            score: g ? ((w + d * 0.5) / g) * 100 : 0,
          };
        })()
      : null;

  return { lines, other, total };
}

// --- Habits ---------------------------------------------------------------
//
// Castling split and check rate used to live here too, alongside notation-
// only aggression/volatility/vigilance traits - all dropped in favour of
// the player-behaviour model's engine-verified equivalents (castled_ply_
// mean/never_castled_rate/castle_queenside_rate/check_rate), which cover
// the same ground more reliably. Time pressure stays: it's a *frequency*
// ("how often are you low on the clock"), distinct from the model's clock
// sub-score, which measures whether accuracy actually suffers there.

function parseClockSeconds(clock: string | undefined): number | null {
  const match = clock?.match(/^(\d+):(\d+):(\d+)$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function baseSeconds(timeControl: string | undefined): number | null {
  const match = timeControl?.match(/^(\d+)\+/);
  return match ? Number(match[1]) : null;
}

export type Habits = {
  /** Average total half-moves per game. */
  avgLength: number;
  /** Share of games with a decisive (non-draw) result. */
  decisiveRate: number;
  /** Share of the player's own moves made with under 15% of their base
   * time left - null when none of the games carry clock annotations. */
  timePressureRate: number | null;
};

export function computeHabits(games: GameHistoryEntry[]): Habits | null {
  if (games.length === 0) return null;

  let totalPlies = 0;
  let decisive = 0;
  let clockedMoves = 0;
  let lowClockMoves = 0;

  for (const game of games) {
    totalPlies += game.moves.length;
    if (game.result !== "draw") decisive += 1;

    const base = baseSeconds(game.timeControl);
    if (!base) continue;
    for (const move of game.moves) {
      if (move.side !== game.playerSide) continue;
      const remaining = parseClockSeconds(move.comment);
      if (remaining === null) continue;
      clockedMoves += 1;
      if (remaining / base < 0.15) lowClockMoves += 1;
    }
  }

  const n = games.length;
  return {
    avgLength: totalPlies / n,
    decisiveRate: (decisive / n) * 100,
    timePressureRate: clockedMoves > 0 ? (lowClockMoves / clockedMoves) * 100 : null,
  };
}
