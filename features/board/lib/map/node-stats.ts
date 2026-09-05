import { findChildByUci } from "../move-tree";
import type { MoveTreeState } from "../../types";
import type { GameHistoryEntry } from "@/features/history/types";

export type NodeOutcomeStats = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
};

export function emptyOutcomeStats(): NodeOutcomeStats {
  return { games: 0, wins: 0, losses: 0, draws: 0 };
}

/** For every node in `tree`, how many of the player's own recorded games
 * (features/history) passed through that exact position, and what
 * happened in those games. Walks each game's own move sequence against
 * the CURRENT tree via the same uci lookup mergeGamesIntoTree already
 * uses, rather than trusting whatever tree the game was originally
 * merged into (which may no longer be the one on screen) - so this stays
 * correct regardless of when/how the currently-displayed tree was built.
 * A game's walk stops the moment its next move isn't a child of the
 * current node; whatever it explored beyond that point isn't part of
 * this tree, so it isn't counted for it. */
export function computeNodeOutcomeStats(
  tree: MoveTreeState,
  games: GameHistoryEntry[],
): Record<string, NodeOutcomeStats> {
  const stats: Record<string, NodeOutcomeStats> = {};

  for (const game of games) {
    let nodeId = tree.rootId;
    for (const move of game.moves) {
      const childId = findChildByUci(tree, nodeId, move.uci);
      if (!childId) break;
      nodeId = childId;

      const entry = stats[nodeId] ?? (stats[nodeId] = emptyOutcomeStats());
      entry.games++;
      if (game.result === "win") entry.wins++;
      else if (game.result === "loss") entry.losses++;
      else entry.draws++;
    }
  }

  return stats;
}

/** Standard chess scoring (win=1, draw=0.5, loss=0) as a percentage -
 * `null` when no recorded game reached this node at all, so callers can
 * show "no data" instead of a misleading 0%. */
export function winRatePercent(stats: NodeOutcomeStats | undefined): number | null {
  if (!stats || stats.games === 0) return null;
  return ((stats.wins + stats.draws * 0.5) / stats.games) * 100;
}
