import type { MoveTreeState } from "../types";
import type { Complex } from "./poincare-disk";

export type HyperbolicLayout = {
  // Canonical (root-centered) position per node, independent of which node
  // is currently focused - only depends on tree shape and compaction `k`.
  // Focus is applied separately at render time via mobiusTranslate, so
  // recentering the view never requires recomputing this.
  canon: Map<string, Complex>;
};

function computeSubtreeSizes(tree: MoveTreeState): Map<string, number> {
  const sizes = new Map<string, number>();
  function dfs(id: string): number {
    const node = tree.nodes[id];
    let size = 1;
    for (const childId of node.children) size += dfs(childId);
    sizes.set(id, size);
    return size;
  }
  dfs(tree.rootId);
  return sizes;
}

// Each child gets up to this many radians of the parent's sector - an upper
// bound, never a fraction the sector gets rescaled by. That distinction
// matters: a node's "available" sector below the root IS whatever its own
// parent already decided to give it, so scaling it down by a *fraction*
// (e.g. children/6) at every level compounds - and since most of a game is
// just one move after another with no fork at all, that fraction was being
// applied on nearly every single ply, squeezing what's left to almost
// nothing just a few moves past an actual branch (branch nodes deep in the
// tree ending up practically on top of each other). Capping with `min`
// instead has a fixed point: a sole child bumping into this cap inherits
// that same width unchanged next ply (min(cap, cap) = cap) rather than
// shrinking it further, and it only ever binds where a node actually had
// more available than it needs - overwhelmingly the root, where a small
// sibling group would otherwise spread across the entire circle for what's
// just 2-3 alternative replies to the same position.
const MAX_SPAN_PER_CHILD = Math.PI / 2.5; // 72deg

// Each node inherits an angular sector from its parent (the full 2*PI at the
// root) and sits at that sector's midpoint; its own children subdivide a
// (possibly narrower, see MAX_SPAN_PER_CHILD) wedge centered in that SAME
// sector, never a fresh 2*PI of their own - that's what keeps two sibling
// subtrees from ever pointing in overlapping directions, no matter how deep
// either goes. Radius is `tanh(k * ply)` - ply already IS graph depth from
// root (see move-tree.ts, each child is parent.ply + 1), so this lands every
// node at exactly the right ring regardless of branch shape, with no
// hub-size-based length term: hyperbolic space already gives big forks room
// via its own exponential circumference growth, unlike the Euclidean layout
// this replaces.
export function computeHyperbolicLayout(
  tree: MoveTreeState,
  k: number,
): HyperbolicLayout {
  const sizes = computeSubtreeSizes(tree);
  const canon = new Map<string, Complex>();

  function place(id: string, a0: number, a1: number) {
    const node = tree.nodes[id];
    const angle = (a0 + a1) / 2;
    const rDisk = Math.tanh(k * node.ply);
    canon.set(id, { x: rDisk * Math.cos(angle), y: rDisk * Math.sin(angle) });
    if (!node.children.length) return;

    const available = a1 - a0;
    const usedSpan = Math.min(
      available,
      MAX_SPAN_PER_CHILD * node.children.length,
    );
    const start = angle - usedSpan / 2;

    const total = node.children.reduce(
      (sum, c) => sum + (sizes.get(c) ?? 1),
      0,
    );
    let cursor = start;
    for (const childId of node.children) {
      const span = usedSpan * ((sizes.get(childId) ?? 1) / total);
      place(childId, cursor, cursor + span);
      cursor += span;
    }
  }

  place(tree.rootId, 0, Math.PI * 2);
  return { canon };
}
