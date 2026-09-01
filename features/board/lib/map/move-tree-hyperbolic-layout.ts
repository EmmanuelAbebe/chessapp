import type { MoveTreeState } from "../../types";

// `localTheta` is this node's angle *relative to its own parent's own
// angle* (0 = "continue straight ahead from the parent"), not an absolute
// angle from the root. That distinction is what keeps this system usable
// at real depth: an absolute angle is some root-anchored, O(1)-magnitude
// float (e.g. sitting anywhere in [0, 2*PI)), and once a branch is deep
// enough that its two children's angular gap - which shrinks exponentially
// with depth, see maxSpanAtDepth - drops below that float's own precision
// (~1e-16 relative, so ~1e-16 absolute for an angle near, say, pi), adding
// the gap to the parent's absolute angle rounds right back to the parent's
// own value: the two children end up bit-identical, not just visually
// close. That's a real, confirmed failure (verified directly: at ply 79,
// k=0.24, `parentAngle + 1.65e-17 === parentAngle` is true in float64) -
// not a rendering limitation, the information is destroyed before
// rendering ever sees it. A *local* offset never has this problem: it's
// always a small, freshly-computed number on its own, never added into an
// unrelated O(1) accumulator - see computeThetaDeltas (in useMoveTreeCanvas)
// for how two nodes' angle relative to each other gets safely reconstructed
// from these without ever forming an absolute angle at all.
export type Polar = { r: number; localTheta: number };

export type HyperbolicLayout = {
  // Canonical (root-centered) radius plus parent-relative angle per node -
  // independent of which node is currently focused, only depends on tree
  // shape and compaction `k`. Focus is applied separately at render time.
  canon: Map<string, Polar>;
};

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
const MAX_SPAN_PER_CHILD_SHALLOW = Math.PI / 2.5; // 72deg

// How far apart (true hyperbolic distance) two branches should be, right
// where they diverge - one edge's worth, the same length as any single
// parent-child hop, whether the fork happens at ply 1 or ply 40.
//
// A FIXED angular cap (the 72deg above, used verbatim) can't deliver that:
// hyperbolic space grows exponentially with depth, so the very same
// root-frame angle implies a true separation that explodes the deeper it
// occurs - a 72deg gap between two branches is a modest ~0.5 units apart at
// ply 1, but the exact same 72deg gap 20 plies deep puts them roughly 15
// units apart, all because sinh(r) has grown so much in between. That's
// what made a branch created deep in the tree feel like it came out of
// nowhere: recentering onto (or away from) it really did move everything
// else that enormous true distance, despite the tree's own bookkeeping
// calling it "just" 72 degrees. Scaling the cap so the true separation
// stays pinned to one edge's length, regardless of depth, is the fix -
// see maxSpanAtDepth below for the formula this implies.
function maxSpanAtDepth(r: number, k: number): number {
  if (r < 1e-9) return MAX_SPAN_PER_CHILD_SHALLOW;
  // Inverts cosh(target) = 1 + 2*sinh(r)^2*sin^2(dtheta/2) (the same
  // hyperbolic-law-of-cosines identity recenterPolar uses) for dtheta,
  // with target = one edge's rapidity (2k).
  const target = 2 * k;
  const s = Math.sqrt((Math.cosh(target) - 1) / 2) / Math.sinh(r);
  return Math.min(MAX_SPAN_PER_CHILD_SHALLOW, 2 * Math.asin(Math.min(1, s)));
}

// Each node inherits an angular sector from its parent (the full 2*PI at the
// root) and sits at that sector's midpoint; its own children subdivide a
// (possibly narrower, see maxSpanAtDepth) wedge centered in that SAME
// sector, never a fresh 2*PI of their own - that's what keeps two sibling
// subtrees from ever pointing in overlapping directions, no matter how deep
// either goes. True hyperbolic distance from root is `2 * k * ply` - ply
// already IS graph depth from root (see move-tree.ts, each child is
// parent.ply + 1). The factor of 2 keeps this visually identical to the
// old disk-radius formula (`tanh(k * ply)`, under the curvature convention
// where Euclidean disk radius = tanh(distance / 2)) rather than suddenly
// looking twice as compact - see hyperboloid.ts for the model itself. No
// hub-size-based length term: hyperbolic space already gives big forks room
// via its own exponential circumference growth, unlike the Euclidean layout
// this replaces.
export function computeHyperbolicLayout(
  tree: MoveTreeState,
  k: number,
): HyperbolicLayout {
  const canon = new Map<string, Polar>();
  canon.set(tree.rootId, { r: 0, localTheta: 0 });

  // `available` is how much angular room id's own parent set aside for
  // id's *entire* subtree - id's own position was already fixed (as a
  // localTheta offset from its parent) by the caller. Each of id's own
  // children gets a fresh window centered on id's own direction (0 =
  // "continue straight ahead"), never id's *parent's* window - that's what
  // keeps every localTheta small and independent of how deep id itself is,
  // rather than an ever-widening absolute interval.
  function place(id: string, available: number) {
    const node = tree.nodes[id];
    if (!node.children.length) return;

    const childRapidity = 2 * k * (node.ply + 1);
    const usedSpan = Math.min(
      available,
      maxSpanAtDepth(childRapidity, k) * node.children.length,
    );

    // Split evenly across siblings, not by whatever their subtrees have
    // grown to *today*. Weighting by subtree size means every single move
    // played anywhere below a branch reshuffles that branch's own share of
    // the circle - harmless while all branches stay small, but a variation
    // that gets played out 20 moves deep ends up owning the entire sector,
    // squeezing every other reply from that position into a sliver next to
    // it (and re-squeezing it, visibly, on every one of those 20 moves,
    // since none of them left the other siblings' shares alone). An equal
    // split never depends on how deep anyone has gone, so a branch's own
    // position is stable the moment it's created - unaffected by what
    // happens later in any of its siblings.
    const span = usedSpan / node.children.length;
    let cursor = -usedSpan / 2;
    for (const childId of node.children) {
      const childNode = tree.nodes[childId];
      canon.set(childId, {
        r: 2 * k * childNode.ply,
        localTheta: cursor + span / 2,
      });
      place(childId, span);
      cursor += span;
    }
  }

  place(tree.rootId, Math.PI * 2);
  return { canon };
}
