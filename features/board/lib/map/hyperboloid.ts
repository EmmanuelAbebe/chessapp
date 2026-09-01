// The Lorentz hyperboloid model of hyperbolic geometry: points live on the
// upper sheet of t^2 - x^2 - y^2 = 1 in Minkowski 3-space, instead of inside
// a bounded disk. Unlike the Poincare disk this replaces, there's no
// boundary any point asymptotically approaches - sinh/cosh grow without
// bound instead of tanh saturating toward 1.
//
// Every node's canonical position is a clean (rapidity, angle) pair (see
// move-tree-hyperbolic-layout.ts) - `r = 2*k*ply`, angle from the
// sector-subdivision. Recentering the view onto some focus node needs the
// point's angle *relative to the focus* (dtheta) - and getting that safely
// is the one place real care is needed. It is NOT enough to give each node
// a clean scalar "absolute" angle and subtract two of them at render time:
// once a branch is deep enough that two siblings' angular gap (which
// shrinks exponentially with depth) drops below the *absolute* angle's own
// precision (~1e-16 relative, i.e. ~1e-16 absolute for an angle near, say,
// pi), storing "parentAngle + tinyGap" as a single float64 rounds right
// back to parentAngle - the two children end up bit-identical, not just
// visually close (verified directly: at ply 79, k=0.24 in this app's own
// numbers, `parentAngle + 1.65e-17 === parentAngle` is true). The fix lives
// in move-tree-hyperbolic-layout.ts and useMoveTreeCanvas.ts's
// computeThetaDeltas: every node's angle is stored purely as a small local
// offset from its own parent, and dtheta between any two nodes is
// reconstructed by summing local offsets along their short tree-path (via
// their lowest common ancestor) - never by forming or subtracting an
// absolute, root-anchored angle at all.
//
// Because of that, recenterPolar below takes dtheta directly (precomputed
// by the caller) rather than two separate absolute angles - the caller is
// what's responsible for producing it safely.

export type HPoint = { x: number; y: number; t: number };

// The isometry sending the focus point at (rf, dtheta=0) to the origin,
// applied to the point at (rp, dtheta) - the sole recentering primitive.
// Safe at any rapidity: every term is either a difference of two rapidities
// (cheap and exact regardless of their individual size) or a plain product
// (which can legitimately grow huge/overflow when the two points are far
// apart, which is the correct answer, not a numerical failure). There's no
// final "rotate back by the focus's own absolute angle" step - only
// relative positions ever get rendered, so the focus's own direction is
// simply defined as the positive x-axis; nothing needs an absolute angle to
// exist at all, which is exactly what keeps this safe at any depth.
export function recenterPolar(rp: number, rf: number, dtheta: number): HPoint {
  const halfSin = Math.sin(dtheta / 2);
  const sin2 = halfSin * halfSin;
  const sinhP = Math.sinh(rp);
  const sinhF = Math.sinh(rf);
  const coshF = Math.cosh(rf);

  const x = Math.sinh(rp - rf) - 2 * coshF * sinhP * sin2;
  const y = sinhP * Math.sin(dtheta);
  const t = Math.cosh(rf - rp) + 2 * sinhF * sinhP * sin2;

  return { x, y, t };
}

// The one and only place hyperboloid coordinates become 2D screen-disk
// coordinates - t = cosh(r) >= 1 always, so this denominator is never
// smaller than 2, regardless of how deep `p` is.
export function projectToDisk(p: HPoint): { x: number; y: number } {
  const denom = 1 + p.t;
  return { x: p.x / denom, y: p.y / denom };
}
