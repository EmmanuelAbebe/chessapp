import type { GameHistoryEntry } from "@/features/history/types";
import { openingFamilyOf } from "@/features/history/gameFacets";

// Plain counting stats - a win/loss tally and an opening breakdown - to sit
// alongside the player-behaviour model above. Notation-only (no engine),
// same as traits.ts.
//
// A per-side record breakdown (overall/White/Black, each its own W/D/L bar)
// used to live here, replaced by WinRateTimeline's rolling trend - the
// side split is still available (it's what the page's own side filter
// already narrows `games` to before calling computeTally), it's just one
// number/line now instead of three parallel bars. Habits (game length,
// decisive rate, time-in-trouble) were dropped outright - not redundant
// with anything, just not meaningfully informative on their own.

export type WinLossRecord = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Standard scoring: win 1, draw 0.5, loss 0, as a percentage. */
  score: number;
};

export function computeTally(games: GameHistoryEntry[]): WinLossRecord {
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
    const r = computeTally(gs);
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
