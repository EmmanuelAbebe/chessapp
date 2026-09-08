import { findChildByUci } from "../move-tree";
import type { MoveTreeState } from "../../types";
import type { GameHistoryEntry } from "@/features/history/types";
import type { SideFilter } from "@/features/history/SidePlayedFilter";

/** Restrict the move tree to just the lines the player's own games of a
 * given side actually went down (plus the current live line, always, so
 * the map never hides where play is). `side === "all"` returns the tree
 * unchanged.
 *
 * Everything downstream - the hyperbolic layout, the visible-set walk,
 * the ring list, the per-node win-rate stats - runs on whatever tree it's
 * handed, so passing the filtered tree in makes "as White" / "as Black"
 * genuinely reshape the map (a White repertoire and a Black repertoire
 * share almost no moves) rather than just re-tinting the same structure.
 *
 * The kept set is prefix-closed (every game walks from the root, and the
 * live line is a root path too), so the pruned tree is always a single
 * connected tree rooted at the same node. */
export function filterTreeBySide(
  tree: MoveTreeState,
  /** Already narrowed to the chosen side by the caller. */
  sideGames: GameHistoryEntry[],
  side: SideFilter,
  currentNodeId: string,
): MoveTreeState {
  if (side === "all") return tree;

  const keep = new Set<string>([tree.rootId]);

  // The current live line is always kept, whichever side it is - the map
  // shouldn't hide the position play is actually at.
  let cursor: string | null = currentNodeId;
  while (cursor && tree.nodes[cursor]) {
    keep.add(cursor);
    cursor = tree.nodes[cursor].parentId;
  }

  // Every node each game of this side passes through, walked against the
  // current tree the same way computeNodeOutcomeStats does.
  for (const game of sideGames) {
    let nodeId = tree.rootId;
    for (const move of game.moves) {
      const childId = findChildByUci(tree, nodeId, move.uci);
      if (!childId) break;
      nodeId = childId;
      keep.add(nodeId);
    }
  }

  if (keep.size === Object.keys(tree.nodes).length) return tree;

  const nodes: MoveTreeState["nodes"] = {};
  for (const id of keep) {
    const node = tree.nodes[id];
    if (!node) continue;
    nodes[id] = { ...node, children: node.children.filter((c) => keep.has(c)) };
  }

  return {
    rootId: tree.rootId,
    currentNodeId: keep.has(currentNodeId) ? currentNodeId : tree.rootId,
    nodes,
  };
}
