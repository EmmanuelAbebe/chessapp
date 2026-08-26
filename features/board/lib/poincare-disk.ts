// Minimal Poincare-disk geometry: complex-number points in the open unit
// disk, the Mobius isometry that recenters a chosen point to the origin, and
// enough circle-fitting math to draw the resulting geodesic edges/rings as
// true circular arcs rather than straight-line approximations.

export type Complex = { x: number; y: number };

export function cSub(a: Complex, b: Complex): Complex {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function cMul(a: Complex, b: Complex): Complex {
  return { x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x };
}

export function cConj(a: Complex): Complex {
  return { x: a.x, y: -a.y };
}

export function cDiv(n: Complex, d: Complex): Complex {
  const denom = d.x * d.x + d.y * d.y;
  return { x: (n.x * d.x + n.y * d.y) / denom, y: (n.y * d.x - n.x * d.y) / denom };
}

// Isometry of the Poincare disk mapping `a` to the origin - the whole-disk
// "recenter" behind clicking a node to bring it to the middle.
export function mobiusTranslate(z: Complex, a: Complex): Complex {
  const numer = cSub(z, a);
  const denom = cSub({ x: 1, y: 0 }, cMul(cConj(a), z));
  return cDiv(numer, denom);
}

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
function fillArrowhead(
  ctx: CanvasRenderingContext2D,
  childX: number,
  childY: number,
  dirX: number,
  dirY: number,
  backOff: number,
) {
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-6) return;
  const ux = dirX / len, uy = dirY / len;
  const tipX = childX - ux * backOff, tipY = childY - uy * backOff;
  const px = -uy, py = ux;
  const SIZE = 6.5;
  const backX = tipX - ux * SIZE, backY = tipY - uy * SIZE;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backX + px * SIZE * 0.55, backY + py * SIZE * 0.55);
  ctx.lineTo(backX - px * SIZE * 0.55, backY - py * SIZE * 0.55);
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
  // Capped by the edge's own on-screen length so a very short edge (nodes
  // packed close together under heavy compaction) doesn't push the
  // arrowhead back past its parent.
  const backOff = Math.min(10, Math.sqrt(dist2) * scale * 0.4);
  const inv1 = invertPoint(p1);
  const circ = inv1 ? circumcircle(p1, p2, inv1) : null;
  ctx.beginPath();
  if (!circ || !isFinite(circ.r) || circ.r * scale > 6000) {
    ctx.moveTo(cx + p1.x * scale, cy + p1.y * scale);
    ctx.lineTo(cx + p2.x * scale, cy + p2.y * scale);
    ctx.stroke();
    fillArrowhead(ctx, cx + p2.x * scale, cy + p2.y * scale, p2.x - p1.x, p2.y - p1.y, backOff);
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
  );
}

// A depth ring is a circle centered on the canonical origin (the game's
// start position). Mobius transforms map circles to circles, so sampling
// three points on it and re-fitting a circle after the focus transform
// gives the ring's true position/size post-recenter - it still passes
// through exactly the same set of nodes (same ply count from start).
export function transformedRing(canonRadius: number, focusA: Complex): Circle | null {
  const a0 = 0.35; // avoid symmetric sample angles that could degenerate near k=0
  const pts: Complex[] = [a0, a0 + (2 * Math.PI) / 3, a0 + (4 * Math.PI) / 3].map((a) =>
    mobiusTranslate({ x: canonRadius * Math.cos(a), y: canonRadius * Math.sin(a) }, focusA),
  );
  return circumcircle(pts[0], pts[1], pts[2]);
}
