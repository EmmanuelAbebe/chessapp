// Minimal Poincare-disk geometry: complex-number points in the open unit
// disk, plus enough circle-fitting math to draw geodesic edges/rings as true
// circular arcs rather than straight-line approximations. Recentering used
// to happen here too (a Mobius transform, `mobiusTranslate`), but that's now
// done in hyperboloid coordinates instead (see hyperboloid.ts) - everything
// below only ever operates on already-projected disk points.

export type Complex = { x: number; y: number };

export function lerpComplex(a: Complex, b: Complex, t: number): Complex {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export type Circle = { x: number; y: number; r: number };

function circumcircle(p1: Complex, p2: Complex, p3: Complex): Circle | null {
  const { x: ax, y: ay } = p1, { x: bx, y: by } = p2, { x: cx, y: cy } = p3;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { x: ux, y: uy, r: Math.hypot(ax - ux, ay - uy) };
}

function invertPoint(z: Complex): Complex | null {
  const denom = z.x * z.x + z.y * z.y;
  if (denom < 1e-9) return null;
  return { x: z.x / denom, y: z.y / denom };
}

function normAngle(a: number): number {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

// A small filled chevron pointing along (dirX, dirY), its tip pulled back
// `backOff` px from the child's exact position - marks which end of an edge
// is the child, since two nodes of very different closeness/size otherwise
// give no visual hint of which way the move goes. The tip has to stop short
// of the node's own center: edges are drawn before nodes, so a tip placed
// exactly at the child's position would just be painted over by its dot.
// `size` (its length) is the caller's call - see drawGeodesic for why it's
// not a fixed constant.
function fillArrowhead(
  ctx: CanvasRenderingContext2D,
  childX: number,
  childY: number,
  dirX: number,
  dirY: number,
  backOff: number,
  size: number,
) {
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-6) return;
  const ux = dirX / len, uy = dirY / len;
  const tipX = childX - ux * backOff, tipY = childY - uy * backOff;
  const px = -uy, py = ux;
  const backX = tipX - ux * size, backY = tipY - uy * size;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backX + px * size * 0.55, backY + py * size * 0.55);
  ctx.lineTo(backX - px * size * 0.55, backY - py * size * 0.55);
  ctx.closePath();
  ctx.fill();
}

// The geodesic between two points in the disk is an arc of the unique circle
// through both that's orthogonal to the unit circle - equivalently, the
// circumcircle of p1, p2, and the inversion of p1 through the unit circle
// (an orthogonal circle is invariant under that inversion). Drawn as a
// directed edge (p1 = parent, p2 = child) with an arrowhead at the child end.
// The line itself uses whatever `ctx.strokeStyle` the caller set (deliberately
// dim/structural) but the arrowhead takes its own, brighter `arrowColor` -
// otherwise it's just as faint as the line it sits on and easy to miss.
export function drawGeodesic(
  ctx: CanvasRenderingContext2D,
  p1: Complex,
  p2: Complex,
  cx: number,
  cy: number,
  scale: number,
  arrowColor: string,
) {
  const dist2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
  if (dist2 < 1e-8) return;
  ctx.fillStyle = arrowColor;
  // Both the arrowhead's size and how far its tip sits back from the child
  // scale with the edge's own on-screen length, not a fixed pixel count -
  // otherwise a constant-size arrowhead increasingly dominates (or even
  // spans clear across) an edge that's gotten short on screen, whether from
  // heavy compaction or just being far from the current focus, which is
  // what made arrows look like they'd "moved" onto the middle of the curve
  // at some zoom levels but not others.
  const edgeLenPx = Math.sqrt(dist2) * scale;
  const size = Math.max(3, Math.min(6.5, edgeLenPx * 0.35));
  const backOff = Math.min(10, edgeLenPx * 0.4);
  const inv1 = invertPoint(p1);
  const circ = inv1 ? circumcircle(p1, p2, inv1) : null;
  ctx.beginPath();
  if (!circ || !isFinite(circ.r) || circ.r * scale > 6000) {
    ctx.moveTo(cx + p1.x * scale, cy + p1.y * scale);
    ctx.lineTo(cx + p2.x * scale, cy + p2.y * scale);
    ctx.stroke();
    fillArrowhead(ctx, cx + p2.x * scale, cy + p2.y * scale, p2.x - p1.x, p2.y - p1.y, backOff, size);
    return;
  }
  const a1 = Math.atan2(p1.y - circ.y, p1.x - circ.x);
  const a2 = Math.atan2(p2.y - circ.y, p2.x - circ.x);
  const diff = normAngle(a2 - a1);
  const midShort = a1 + diff / 2;
  const pShort = { x: circ.x + circ.r * Math.cos(midShort), y: circ.y + circ.r * Math.sin(midShort) };
  const shortInside = pShort.x * pShort.x + pShort.y * pShort.y < 1;
  const shortAnticlockwise = diff < 0;
  const anticlockwise = shortInside ? shortAnticlockwise : !shortAnticlockwise;
  ctx.arc(cx + circ.x * scale, cy + circ.y * scale, circ.r * scale, a1, a2, anticlockwise);
  ctx.stroke();
  // Tangent to the circle at p2, oriented along the direction the arc was
  // just drawn in (canvas sweeps toward increasing angle unless
  // `anticlockwise`, so the forward tangent flips sign with it).
  const tangentSign = anticlockwise ? -1 : 1;
  fillArrowhead(
    ctx,
    cx + p2.x * scale,
    cy + p2.y * scale,
    tangentSign * -Math.sin(a2),
    tangentSign * Math.cos(a2),
    backOff,
    size,
  );
}

// A depth ring is a circle centered on the canonical origin (the game's
// start position), of true hyperbolic radius `rapidity`. Recentered onto
// a focus at rapidity `focusR`, it maps to a Euclidean circle in the disk -
// computed here in closed form rather than by sampling 3 points and fitting
// a circumcircle (the previous approach), because that technique degrades
// hard once the focus gets deep: none of its 3 fixed sample angles has any
// reason to sit near the focus's own direction, and recentering a point at
// a large angular offset from a deep focus saturates its disk x-coordinate
// to the same boundary point (the direction opposite the focus) well before
// float64 loses precision anywhere else in this system - 3 saturated points
// are indistinguishable from 3 collinear ones, so the circumcircle fit
// degenerates and the ring silently fails to draw.
//
// The two points where the ring crosses the meridian through the focus
// (dtheta = 0, "in front of" it) and that meridian's antipode (dtheta = pi,
// "behind" it) are always safe to recenter: dtheta = 0 collapses the general
// recentering formula to a plain rapidity subtraction, and dtheta = pi to a
// plain rapidity sum - neither ever needs to subtract two independently
// huge numbers to get a small one, unlike a generic sample angle does once
// the focus is deep. Both points lie on the ring's own diameter along the
// focus's axis (the boost is symmetric about that axis), so together they
// fully determine the circle - no third sample, no circumcircle fit, and no
// case where the samples collapse into each other, since there are only
// ever these two, chosen specifically to never need to.
//
// No angle parameter: the root sits exactly on the focus's own axis by
// definition (the focus's "forward direction" is, literally, the direction
// continuing away from the root through the focus's own ancestry), so every
// ring - concentric around the root - is always centered on that same axis,
// which this whole module treats as the x-axis (see hyperboloid.ts's
// recenterPolar for why nothing here ever needs an absolute angle).
export function transformedRing(rapidity: number, focusR: number): Circle {
  const front = Math.tanh((rapidity - focusR) / 2);
  const back = -Math.tanh((rapidity + focusR) / 2);
  return {
    x: (front + back) / 2,
    y: 0,
    r: Math.abs(front - back) / 2,
  };
}
