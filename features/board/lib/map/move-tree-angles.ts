// Reconstructs the angle between two tree nodes safely at any depth, by
// summing the small local-offset values move-tree-hyperbolic-layout.ts
// already stores (see its own comment for why an absolute, root-anchored
// angle can't survive real depth) along the short tree-path between them,
// rather than ever forming or subtracting an absolute angle.

import type { MoveTreeState } from "../../types";
import type { Polar } from "./move-tree-hyperbolic-layout";

// For every node in the tree, its angle relative to `focusId`'s own angle
// (dtheta = thetaNode - thetaFocus, safely reconstructed) - `0` for
// `focusId` itself. Two passes, both O(depth) or O(n), never O(n * depth):
// first walk from focus up to the root, accumulating each ancestor's own
// delta relative to focus along the way (this seeds the whole
// focus-to-root spine in one pass); then a single traversal of the rest of
// the tree propagates forward from whichever seeded ancestor (or the root)
// a node descends from, adding one small local offset at a time. Every
// number involved is either a fresh local offset (small by construction)
// or a running sum of a handful of them along a short path - never an
// absolute, root-anchored angle.
export function computeThetaDeltas(
  tree: MoveTreeState,
  canon: Map<string, Polar>,
  focusId: string,
): Map<string, number> {
  const deltas = new Map<string, number>();
  deltas.set(focusId, 0);

  const ancestors: string[] = [focusId];
  let cur = focusId;
  while (tree.nodes[cur]?.parentId) {
    cur = tree.nodes[cur].parentId!;
    ancestors.push(cur);
  }
  for (let i = 1; i < ancestors.length; i++) {
    const child = ancestors[i - 1]; // one step closer to focus
    const parent = ancestors[i]; // one step further out
    const childLocalTheta = canon.get(child)?.localTheta ?? 0;
    deltas.set(parent, (deltas.get(child) ?? 0) - childLocalTheta);
  }

  const stack = [tree.rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const own = deltas.get(id) ?? 0;
    if (!deltas.has(id)) deltas.set(id, own);
    for (const childId of tree.nodes[id].children) {
      if (deltas.has(childId)) {
        stack.push(childId); // already seeded from the ancestor walk above
        continue;
      }
      const childLocalTheta = canon.get(childId)?.localTheta ?? 0;
      deltas.set(childId, own + childLocalTheta);
      stack.push(childId);
    }
  }

  return deltas;
}
