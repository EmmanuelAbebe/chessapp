import type { GameHistoryEntry } from "@/features/history/types";

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
  /** e.g. "1.e4 c5 2.Nf3" - the first few plies rendered as a mainline. */
  label: string;
  games: number;
  score: number;
  results: { wins: number; draws: number; losses: number };
};

/** The player's most-played opening lines (first `plies` half-moves),
 * newest tie-broken by frequency. `plies` of 4 groups by the first two
 * full moves - enough to tell 1.e4 e5 2.Nf3 from 1.e4 e5 2.Bc4 without
 * splintering into hundreds of one-game lines. */
export function computeOpenings(
  games: GameHistoryEntry[],
  { plies = 4, limit = 6 }: { plies?: number; limit?: number } = {},
): OpeningLine[] {
  const groups = new Map<
    string,
    { label: string; games: GameHistoryEntry[] }
  >();

  for (const game of games) {
    if (game.moves.length === 0) continue;
    const seq = game.moves.slice(0, plies);
    const key = seq.map((m) => m.uci).join(" ");
    let label = "";
    seq.forEach((m, i) => {
      if (i % 2 === 0) label += `${i / 2 + 1}.`;
      label += `${m.san} `;
    });
    label = label.trim();

    const entry = groups.get(key);
    if (entry) entry.games.push(game);
    else groups.set(key, { label, games: [game] });
  }

  const lines: OpeningLine[] = [];
  for (const { label, games: gs } of groups.values()) {
    const r = tally(gs);
    lines.push({
      label,
      games: r.games,
      score: r.score,
      results: { wins: r.wins, draws: r.draws, losses: r.losses },
    });
  }
  lines.sort((a, b) => b.games - a.games);
  return lines.slice(0, limit);
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
