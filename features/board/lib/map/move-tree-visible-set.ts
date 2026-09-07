import { projectToDisk, recenterPolar } from "./hyperboloid";
import type { Complex } from "./poincare-disk";
import type { FlatTree } from "./move-tree-flat";

// Walks outward from the focus node collecting only the nodes that can
// actually land inside the disk, instead of recentering + projecting all N
// every frame (the previous behaviour). For a 10k-node tree with the focus
// deep in a line this visits a few dozen nodes rather than 10k.
//
// The visible region is a hyperbolic disk of radius D = acosh(pruneT)
// around the camera. A node at canonical (r, dtheta) is visible iff
//   cosh(fR)cosh(r) - sinh(fR)sinh(r)cos(dtheta) <= pruneT
// (that left side is exactly recenterPolar's `t`).
//
// Traversal can't prune on the first invisible node - an invisible shallow
// ancestor can still lead to a visible cousin subtree. So:
//
//   * Toward the parent (up toward the root): always keep going. The
//     ancestor chain is O(depth) (<= a few hundred), and each ancestor's
//     OTHER children are then explored as child-direction pushes with the
//     full prune below.
//
//   * Toward a child: prune the whole subtree when it PROVABLY holds
//     nothing visible. For a node at (r, theta) with r >= r_ci (subtree
//     root) and |theta| >= a (= |dtheta_ci| - spread[ci], the smallest
//     |angle| anything in the subtree can have),
//       t = cosh(fR - r) + 2 sinh(fR) sinh(r) sin^2(theta/2)
//         >= 1 + 2 sinh(fR) sinh(r_ci) sin^2(a/2)
//     so if that lower bound already exceeds pruneT, nothing in the subtree
//     is visible. Plus the exact radial checks: the subtree spans r in
//     [r_ci, 2k*subtreeMaxPly[ci]] - skip if that never overlaps
//     [fR - D, fR + D].
//
// dtheta is carried incrementally along tree edges from the focus (0), the
// same local-offset accumulation computeThetaDeltas does - never forming an
// absolute root-anchored angle (see move-tree-hyperbolic-layout.ts).

export type VisibleWalkScratch = {
  visited: Uint8Array;
  stackIdx: Int32Array;
  stackDtheta: Float64Array;
};

export function makeVisibleWalkScratch(n: number): VisibleWalkScratch {
  return {
    visited: new Uint8Array(n),
    // Each node is pushed at most once per tree-neighbour that pops before
    // it is marked visited; 2*(n-1) is a safe upper bound on live entries.
    stackIdx: new Int32Array(2 * Math.max(n, 1)),
    stackDtheta: new Float64Array(2 * Math.max(n, 1)),
  };
}

/** spread[i] = max over descendants d of |dtheta(d) - dtheta(i)|, i.e. the
 * widest angular reach of i's subtree relative to i. Bottom-up over the
 * flat tree's leaves-first order. Depends on the layout (localTheta), so
 * it's recomputed whenever k changes, alongside the canonical arrays. */
export function computeSubtreeSpread(
  flat: FlatTree,
  canonLocalTheta: Float64Array,
): Float64Array {
  const spread = new Float64Array(flat.n);
  const { postorder, parent } = flat;
  for (let o = 0; o < flat.n; o++) {
    const i = postorder[o];
    const p = parent[i];
    if (p < 0) continue;
    const reach = Math.abs(canonLocalTheta[i]) + spread[i];
    if (reach > spread[p]) spread[p] = reach;
  }
  return spread;
}

export function collectVisibleNodes(
  flat: FlatTree,
  /** index -> canonical rapidity (root-centred). */
  canonR: Float64Array,
  /** index -> localTheta (angle relative to own parent's forward axis). */
  canonLocalTheta: Float64Array,
  /** index -> subtree angular reach, from computeSubtreeSpread. */
  subtreeSpread: Float64Array,
  focusIdx: number,
  focusR: number,
  k: number,
  pruneT: number,
  /** nodes with ply > this are neither drawn nor descended past. */
  drawLimitPly: number,
  scratch: VisibleWalkScratch,
): Map<number, Complex> {
  const n = flat.n;
  const { visited, stackIdx, stackDtheta } = scratch;
  visited.fill(0, 0, n);

  // Radial half-window: |r - fR| beyond D can't be visible (true distance
  // is always >= |r - fR|). acosh needs arg >= 1; pruneT always is.
  const D = Math.acosh(Math.max(pruneT, 1));
  const rLoVisible = focusR - D;
  const rHiVisible = focusR + D;
  const sinhF = Math.sinh(focusR);

  const out = new Map<number, Complex>();
  const two_k = 2 * k;

  stackIdx[0] = focusIdx;
  stackDtheta[0] = 0;
  let sp = 1;

  while (sp > 0) {
    sp--;
    const idx = stackIdx[sp];
    if (visited[idx]) continue;
    visited[idx] = 1;
    const dtheta = stackDtheta[sp];

    const ply = flat.ply[idx];
    if (ply <= drawLimitPly) {
      const cam = recenterPolar(canonR[idx], focusR, dtheta);
      // <= (not >) so NaN/Infinity from sinh/cosh overflow at extreme
      // compaction counts as "not visible", same as sub-pixel.
      if (cam.t <= pruneT) out.set(idx, projectToDisk(cam));
    }

    // Parent direction: unconditional (up to the root). Cheap - O(depth) -
    // and the productive pruning happens on each ancestor's other children.
    const pIdx = flat.parent[idx];
    if (pIdx >= 0 && !visited[pIdx]) {
      stackIdx[sp] = pIdx;
      stackDtheta[sp] = dtheta - canonLocalTheta[idx];
      sp++;
    }

    // Child direction: prune subtrees that provably hold nothing visible.
    if (ply < drawLimitPly) {
      const cs = flat.childStart[idx];
      const ce = flat.childStart[idx + 1];
      for (let c = cs; c < ce; c++) {
        const ci = flat.childIdx[c];
        if (visited[ci]) continue;

        // Radial: subtree r spans [r_ci, 2k * maxPlyInSubtree]. Skip if it
        // never overlaps [fR - D, fR + D].
        const rCi = canonR[ci];
        if (rCi > rHiVisible) continue; // whole subtree deeper than the window
        const subMaxPly = Math.min(flat.subtreeMaxPly[ci], drawLimitPly);
        if (two_k * subMaxPly < rLoVisible) continue; // whole subtree too shallow

        // Angular: `a` is the smallest |angle| anything in this subtree can
        // have. Lower-bound t at (r_ci, a) and skip the subtree if that
        // already exceeds pruneT. Require the subtree's whole raw angle
        // band to stay in [-pi, pi] so `a` is a true bound with no wrap.
        const dCi = dtheta + canonLocalTheta[ci];
        const a = Math.abs(dCi) - subtreeSpread[ci];
        if (a > 0 && Math.abs(dCi) + subtreeSpread[ci] <= Math.PI) {
          const half = Math.sin(a / 2);
          const sin2 = half * half;
          // sin2 === 0 means the angle is below the point where recenterPolar
          // itself collapses to the on-axis case - the subtree may then
          // render exactly on-axis and be visible, so defer to the radial
          // checks above rather than pruning here.
          if (sin2 > 0 && 1 + 2 * sinhF * Math.sinh(rCi) * sin2 > pruneT) {
            continue;
          }
        }

        stackIdx[sp] = ci;
        stackDtheta[sp] = dCi;
        sp++;
      }
    }
  }

  return out;
}
