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

// Each node inherits an angular sector from its parent (the full 2*PI at the
// root) and sits at that sector's midpoint; its own children subdivide that
// SAME sector proportionally by subtree size, never a fresh 2*PI of their
// own - that's what keeps two sibling subtrees from ever pointing in
// overlapping directions, no matter how deep either goes. Radius is
// `tanh(k * ply)` - ply already IS graph depth from root (see move-tree.ts,
// each child is parent.ply + 1), so this lands every node at exactly the
// right ring regardless of branch shape, with no hub-size-based length term:
// hyperbolic space already gives big forks room via its own exponential
// circumference growth, unlike the Euclidean layout this replaces.
export function computeHyperbolicLayout(tree: MoveTreeState, k: number): HyperbolicLayout {
  const sizes = computeSubtreeSizes(tree);
  const canon = new Map<string, Complex>();

  function place(id: string, a0: number, a1: number) {
    const node = tree.nodes[id];
    const angle = (a0 + a1) / 2;
    const rDisk = Math.tanh(k * node.ply);
    canon.set(id, { x: rDisk * Math.cos(angle), y: rDisk * Math.sin(angle) });
    if (!node.children.length) return;
    const total = node.children.reduce((sum, c) => sum + (sizes.get(c) ?? 1), 0);
    let cursor = a0;
    for (const childId of node.children) {
      const span = (a1 - a0) * ((sizes.get(childId) ?? 1) / total);
      place(childId, cursor, cursor + span);
      cursor += span;
    }
  }

  place(tree.rootId, 0, Math.PI * 2);
  return { canon };
}
