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
  /** The most-played first few moves under this name, as a mainline
   * ("1.e4 c5 2.Nf3"), for a bit of detail under the name. */
  sample: string;
  games: number;
  score: number;
  results: { wins: number; draws: number; losses: number };
};

function mainlineLabel(moves: GameHistoryEntry["moves"], plies = 6): string {
  let label = "";
  moves.slice(0, plies).forEach((m, i) => {
    if (i % 2 === 0) label += `${i / 2 + 1}.`;
    label += `${m.san} `;
  });
  return label.trim();
}

export type OpeningsBreakdown = {
  /** Named families, biggest first. At most `limit` entries. */
  lines: OpeningLine[];
  /** Every game not in `lines`, aggregated, or null if the tail is empty. */
  other: { games: number; score: number } | null;
  /** Total games with a known opening (sum of lines + other). */
  total: number;
};

/** The player's openings by family, biggest first. Beyond `limit` named
 * slices the tail folds into `other` (so a pie of this never exceeds
 * `limit` + 1 slices). Each line carries a representative move order,
 * game count, and score. */
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
    const seqCounts = new Map<string, number>();
    for (const g of gs) {
      const s = mainlineLabel(g.moves);
      seqCounts.set(s, (seqCounts.get(s) ?? 0) + 1);
    }
    const sample =
      [...seqCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    all.push({
      label: name,
      sample,
      games: r.games,
      score: r.score,
      results: { wins: r.wins, draws: r.draws, losses: r.losses },
    });
  }
  all.sort((a, b) => b.games - a.games);

  const total = all.reduce((sum, l) => sum + l.games, 0);
  const lines = all.slice(0, limit);
  const tail = all.slice(limit);
  const other =
    tail.length > 0
      ? {
          games: tail.reduce((s, l) => s + l.games, 0),
          score: (() => {
            const w = tail.reduce((s, l) => s + l.results.wins, 0);
            const d = tail.reduce((s, l) => s + l.results.draws, 0);
            const g = tail.reduce((s, l) => s + l.games, 0);
            return g ? ((w + d * 0.5) / g) * 100 : 0;
          })(),
        }
      : null;

  return { lines, other, total };
}

// --- Habits ---------------------------------------------------------------

export type Habits = {
  /** Average total half-moves per game. */
  avgLength: number;
  /** Share of games the player castled kingside / queenside / not at all. */
  castledKingside: number;
  castledQueenside: number;
  neverCastled: number;
  /** Share of games with a decisive (non-draw) result. */
  decisiveRate: number;
  /** Share of the player's own moves that give check. */
  checkRate: number;
};

export function computeHabits(games: GameHistoryEntry[]): Habits | null {
  if (games.length === 0) return null;

  let totalPlies = 0;
  let kingside = 0;
  let queenside = 0;
  let decisive = 0;
  let ownMoves = 0;
  let checks = 0;

  for (const game of games) {
    totalPlies += game.moves.length;
    if (game.result !== "draw") decisive += 1;

    let castled: "k" | "q" | null = null;
    for (const move of game.moves) {
      if (move.side === game.playerSide) {
        ownMoves += 1;
        if (move.san.includes("+") || move.san.includes("#")) checks += 1;
        if (!castled) {
          if (move.san === "O-O") castled = "k";
          else if (move.san === "O-O-O") castled = "q";
        }
      }
    }
    if (castled === "k") kingside += 1;
    else if (castled === "q") queenside += 1;
  }

  const n = games.length;
  return {
    avgLength: totalPlies / n,
    castledKingside: (kingside / n) * 100,
    castledQueenside: (queenside / n) * 100,
    neverCastled: ((n - kingside - queenside) / n) * 100,
    decisiveRate: (decisive / n) * 100,
    checkRate: ownMoves ? (checks / ownMoves) * 100 : 0,
  };
}
