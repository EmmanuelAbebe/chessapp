import { detectGamePhase, type GamePhase } from "@/features/board/lib/move-analysis";
import type { GameHistoryEntry } from "@/features/history/types";

// Style/personality traits (aggression, volatility, vigilance, repertoire
// breadth) and the archetype headline built from them used to live here,
// computed from notation alone. They were dropped in favour of the
// player-behaviour model (features/playermodel) on the same page, which
// covers the same ground from real engine evaluations instead of a
// notation-only proxy - see PlayerModelSection's style axes/signature/
// strengths. What's left here is genuinely complementary: phase mix has
// no engine equivalent (the model has per-phase *accuracy*, not how much
// of a game is spent in each phase).

export type PhaseMix = Record<GamePhase, number>;

/** Share of the player's own moves falling in each game phase - a mix, not
 * a strength-by-phase breakdown. Pairs with the player-behaviour model's
 * per-phase accuracy (PhaseBreakdownChart) when that's available. */
export function computePhaseMix(games: GameHistoryEntry[]): PhaseMix | null {
  const counts: PhaseMix = { opening: 0, middlegame: 0, endgame: 0 };
  let total = 0;

  for (const game of games) {
    game.moves.forEach((move, index) => {
      if (move.side !== game.playerSide) return;
      counts[detectGamePhase(move.fen, index + 1)]++;
      total++;
    });
  }
  if (total === 0) return null;

  return {
    opening: (counts.opening / total) * 100,
    middlegame: (counts.middlegame / total) * 100,
    endgame: (counts.endgame / total) * 100,
  };
}
