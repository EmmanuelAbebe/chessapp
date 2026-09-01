"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawGeodesic, transformedRing, type Complex } from "../../lib/map/poincare-disk";
import { projectToDisk, recenterPolar } from "../../lib/map/hyperboloid";
import {
  computeHyperbolicLayout,
  type Polar,
} from "../../lib/map/move-tree-hyperbolic-layout";
import { computeThetaDeltas } from "../../lib/map/move-tree-angles";
import {
  HUB_COLOR,
  easeOutCubic,
  getBreadcrumb,
  hexToRgba,
  isHub,
  nodeLabel,
  readThemeColors,
  stepIntensityMap,
  type MapColorKey,
  type MapColorOverrides,
} from "../../lib/map/move-tree-map-helpers";
import type { MoveTreeState } from "../../types";

const FOCUS_ANIM_MS = 450;
export const K_MIN = 0.06;
export const K_MAX = 0.42;
export const K_DEFAULT = 0.2;
const MIN_HIT_RADIUS = 16;
// Below this on-screen radius/distance-from-boundary, a node or ring is
// smaller than can actually be seen - drawing, labeling, or hit-testing it
// is pure waste, and a heavily-branched or very deep tree can have a lot of
// these once compaction or focus pushes most of it up against the edge.
const MIN_VISIBLE_PX = 0.5;

// A node's projected disk radius is within ~1/t of the boundary - convert
// "closer than minVisiblePx to the boundary" into the camera-relative t
// threshold that implies, given the current canvas scale (recomputed every
// frame since scale itself can change on resize). Exact inverse of
// projectToDisk's radius formula, not just the 1/t approximation, so it
// stays correct even when minVisiblePx/scale isn't tiny.
function pruneThresholdT(scale: number): number {
  const eps = MIN_VISIBLE_PX / scale;
  const q = (1 - eps) ** 2;
  return (1 + q) / (1 - q);
}

type FocusAnim = { fromId: string; toId: string; start: number };

/** Owns the hyperbolic move-tree canvas: the rAF draw loop, hit-testing, and
 * every pointer/wheel interaction on it, plus the state a caller needs to
 * read (or occasionally set from outside, e.g. a preview card's own close
 * button) to build the surrounding UI. Everything the draw loop and pointer
 * handlers need is mirrored into refs on every render (a plain assignment,
 * not an effect - cheap and synchronous) so the mount-once canvas effect
 * never needs to react to a dependency change; it just picks up new data on
 * its next frame, same as the standalone prototype's plain rAF loop. */
export function useMoveTreeCanvas(
  tree: MoveTreeState,
  currentNodeId: string,
  goToNode: (nodeId: string) => void,
) {
  const [focusId, setFocusId] = useState(currentNodeId);
  const [k, setK] = useState(K_DEFAULT);
  const [showRings, setShowRings] = useState(true);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // The preview card is always showing something by default (falling back
  // to the live current node) - closing it is a deliberate action, and
  // interacting with any node again is what brings it back.
  const [cardClosed, setCardClosed] = useState(false);
  const [hoveredRingPly, setHoveredRingPly] = useState<number | null>(null);
  const [ringTooltipPos, setRingTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [selectedRingPly, setSelectedRingPly] = useState<number | null>(null);
  // Debug/preview tool - lets someone try out different colors for the
  // map's curves/nodes/highlights live, without a code change. Empty by
  // default, meaning "use the current theme's colors" for everything.
  const [mapColors, setMapColors] = useState<MapColorOverrides>({});
  function setMapColor(key: MapColorKey, value: string) {
    setMapColors((prev) => ({ ...prev, [key]: value }));
  }
  function resetMapColors() {
    setMapColors({});
  }
  // Caps how deep the map actually draws/hit-tests, independent of how deep
  // the tree really goes - `null` means "no cap, show everything" (today's
  // behavior). Meant for when a much bigger merged-games tree makes drawing
  // (and just visually parsing) the whole thing impractical - a fixed ply
  // budget that doesn't creep back open on its own as deeper moves get
  // explored is what makes it useful as a "browse the first N plies" control
  // rather than something you have to keep re-dragging after every move.
  const [maxDisplayPly, setMaxDisplayPly] = useState<number | null>(null);

  // The map always follows the live game position - clicking elsewhere in
  // the tree only moves the view (see doSetFocus), never the actual game,
  // so this never fights a deliberate look-around.
  useEffect(() => {
    if (tree.nodes[currentNodeId]) doSetFocus(currentNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId]);

  // If the pinned preview card was showing exactly the live position, keep
  // it there as that position advances - e.g. the engine opponent replying
  // right after a move played on the card itself. Without this, the tree
  // gains the reply as a new node (and the explored-move arrow for it), but
  // the card's own board never actually shows it happening. A pin left on
  // some other, unrelated node (deliberately reviewing history) is never
  // yanked forward by this - only a pin that was already at the live tip.
  const lastCurrentNodeIdRef = useRef(currentNodeId);
  useEffect(() => {
    const prevNodeId = lastCurrentNodeIdRef.current;
    lastCurrentNodeIdRef.current = currentNodeId;
    if (currentNodeId === prevNodeId) return;
    setPinnedId((pinned) => (pinned === prevNodeId ? currentNodeId : pinned));
  }, [currentNodeId]);

  useEffect(() => {
    if (!tree.nodes[focusId]) setFocusId(tree.nodes[currentNodeId] ? currentNodeId : tree.rootId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  // Canonical (root-centered) positions only depend on tree shape and the
  // compaction slider - never on focus, so recentering the view (the whole
  // point of this layout) never triggers a relayout, unlike the Euclidean
  // map this replaces.
  const canon = useMemo(() => computeHyperbolicLayout(tree, k).canon, [tree, k]);

  const { totalNodes, maxPly, widestFork } = useMemo(() => {
    let maxPlySeen = 0, widest = 0;
    const ids = Object.keys(tree.nodes);
    for (const id of ids) {
      const node = tree.nodes[id];
      if (node.ply > maxPlySeen) maxPlySeen = node.ply;
      if (node.children.length > widest) widest = node.children.length;
    }
    return { totalNodes: ids.length, maxPly: maxPlySeen, widestFork: widest };
  }, [tree]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<FocusAnim | null>(null);
  // Wherever nodes visually were the last time the tree's shape actually
  // changed (a move played, a branch explored) - lets the layout ease from
  // there into its freshly recomputed positions instead of snapping, since
  // adding one node can shift how much of the disk every sibling subtree
  // gets. A generic per-node position tween, not move-specific, so it'll
  // still hold up once search/analysis can add many nodes at once later.
  const layoutAnimRef = useRef<{ from: Map<string, Polar>; start: number } | null>(null);
  // Distinguishes "the tree changed shape" from "only k changed" for the
  // layout-animation trigger below - see the comment there.
  const treeIdentityRef = useRef(tree);
  const renderedPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Per-ply highlight strength (0..1), eased toward whichever ply is
  // hovered/selected each frame rather than snapping - lets a ring fade
  // out smoothly too, since more than one entry can be mid-fade at once
  // (the ring you just left, and the one you're entering).
  const ringHoverIntensityRef = useRef<Map<number, number>>(new Map());
  const ringSelectIntensityRef = useRef<Map<number, number>>(new Map());

  // Everything the draw loop and pointer handlers need is mirrored into
  // refs on every render (a plain assignment, not an effect - cheap and
  // synchronous). The canvas setup effect below reads only these refs and
  // never depends on the state itself, so dragging the compaction slider
  // (or just moving the mouse) can't retrigger it: only a ref value
  // changes, not a dependency the effect tears down and rebuilds for.
  // Previously k/hoveredId sat in that effect's dependency array, so every
  // tick of the slider re-ran `resize()` - which always clears the canvas'
  // pixel buffer via its width/height setters - producing a visible flash
  // on every fractional change instead of a smooth redraw.
  const hoveredIdRef = useRef<string | null>(null);
  const pinnedIdRef = useRef<string | null>(null);
  const goToNodeRef = useRef(goToNode);
  // When the currently-hovered node last *became* hovered - lets the bounce
  // in the draw loop damp out over a fixed window instead of pulsing for as
  // long as the cursor happens to sit still.
  const hoverStartRef = useRef(0);
  const showRingsRef = useRef(showRings);
  const canonRef = useRef(canon);
  const treeRef = useRef(tree);
  const focusIdRef = useRef(focusId);
  const currentNodeIdRef = useRef(currentNodeId);
  const kRef = useRef(k);
  const maxPlyRef = useRef(maxPly);
  const maxDisplayPlyRef = useRef(maxDisplayPly);
  const hoveredRingPlyRef = useRef<number | null>(null);
  const selectedRingPlyRef = useRef<number | null>(null);
  const mapColorsRef = useRef<MapColorOverrides>(mapColors);
  mapColorsRef.current = mapColors;
  hoveredIdRef.current = hoveredId;
  pinnedIdRef.current = pinnedId;
  goToNodeRef.current = goToNode;
  showRingsRef.current = showRings;
  // Detected exactly once per actual recompute, since canon is memoized -
  // captures the outgoing layout before it's overwritten below. Only a
  // tree change (a move played, a branch explored) animates; a
  // compaction-slider change snaps straight to its new layout instead.
  // Dragging is a continuous scrub firing many k updates a second - easing
  // toward each one in turn (rather than snapping) meant every tick
  // restarted the tween from scratch, so nodes spent the whole drag
  // permanently chasing wherever the slider currently was rather than
  // tracking it directly - and the depth rings, which read k live with no
  // easing of their own, visibly pulled ahead of that chase once there
  // were enough nodes for the lag to be noticeable.
  if (canonRef.current !== canon) {
    layoutAnimRef.current =
      treeIdentityRef.current !== tree
        ? { from: canonRef.current, start: performance.now() }
        : null;
  }
  canonRef.current = canon;
  treeIdentityRef.current = tree;
  treeRef.current = tree;
  focusIdRef.current = focusId;
  currentNodeIdRef.current = currentNodeId;
  kRef.current = k;
  maxPlyRef.current = maxPly;
  maxDisplayPlyRef.current = maxDisplayPly;
  hoveredRingPlyRef.current = hoveredRingPly;
  selectedRingPlyRef.current = selectedRingPly;

  // Blends two (rapidity, local-angle) pairs - a plain lerp on both. Unlike
  // an absolute angle, a localTheta is always small and bounded (at most
  // MAX_SPAN_PER_CHILD_SHALLOW wide - see move-tree-hyperbolic-layout.ts),
  // so it never needs shortest-path/wraparound handling the way lerping two
  // arbitrary points on a circle would.
  function lerpPolar(a: Polar, b: Polar, t: number): Polar {
    return { r: a.r + (b.r - a.r) * t, localTheta: a.localTheta + (b.localTheta - a.localTheta) * t };
  }

  // The canonical layout mid-tween when it just changed shape, or simply
  // the latest one once that settles. Read by both the focus animation
  // (so recentering targets wherever a node visually is right now, not
  // where it's headed) and the draw loop's own node/edge positions.
  function effectiveCanon(now: number): Map<string, Polar> {
    const anim = layoutAnimRef.current;
    const target = canonRef.current;
    if (!anim) return target;
    const t = Math.min(1, (now - anim.start) / FOCUS_ANIM_MS);
    if (t >= 1) {
      layoutAnimRef.current = null;
      return target;
    }
    const eased = easeOutCubic(t);
    const blended = new Map<string, Polar>();
    for (const [id, toPos] of target) {
      // A brand-new node has no "from" position to ease out of - it just
      // appears at its final spot rather than flying in from nowhere.
      const fromPos = anim.from.get(id) ?? toPos;
      blended.set(id, lerpPolar(fromPos, toPos, eased));
    }
    return blended;
  }

  // Recentering is a single Lorentz boost of the whole hyperboloid, not a
  // relayout - the tree structure and every node's canonical position stay
  // exactly the same, only which point currently sits at the origin changes.
  // Only records which node the transition is *from* (not a captured
  // position) - frameGeometry derives the animated in-between state fresh
  // each frame via computeThetaDeltas, relative to that same starting node,
  // which is what keeps the transition itself numerically safe at any
  // depth (see hyperboloid.ts's recenterPolar comment).
  function doSetFocus(id: string) {
    if (!treeRef.current.nodes[id] || id === focusIdRef.current) return;
    animRef.current = { fromId: focusIdRef.current, toId: id, start: performance.now() };
    setFocusId(id);
  }

  // Canvas render loop + interaction, set up once on mount. Every value it
  // needs (tree, canon, focus, k, ...) is read live from the refs synced
  // above, so nothing here ever needs to react to a dependency change -
  // the draw loop just picks up new data on its next frame, same as the
  // standalone prototype's plain rAF loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors = readThemeColors();
    // An override (from the color-tuning tool) substitutes for the theme's
    // own base color, but the alpha a given element draws with is still the
    // draw loop's own call - overriding a color never has to mean also
    // reproducing its opacity. Read live every frame (not cached alongside
    // `colors` below) since a picker edit should show up immediately, not
    // wait for the next theme change.
    function baseColor(key: MapColorKey, fallback: string): string {
      return mapColorsRef.current[key] ?? fallback;
    }
    function refreshColors() {
      colors = readThemeColors();
    }
    // Theme shade can change while the map is open; the effect no longer
    // re-attaches on its own to pick that up incidentally, so watch for it.
    const themeObserver = new MutationObserver(refreshColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-shade"] });

    function resize() {
      const rect = stage!.getBoundingClientRect();
      canvas!.width = rect.width * devicePixelRatio;
      canvas!.height = rect.height * devicePixelRatio;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);

    // Shared by the draw loop and the pointer handlers below, so hit-testing
    // a ring always agrees with wherever it's actually drawn this frame.
    // `deltas` gives every node's angle relative to the camera (dtheta,
    // safe at any depth - see move-tree-angles.ts); `focusR` is the
    // camera's own rapidity. Mid-transition, both describe the animated
    // in-between camera rather than the settled focus node.
    function frameGeometry() {
      const rect = stage!.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      const scale = (Math.min(rect.width, rect.height) / 2) * 0.92;
      const now = performance.now();
      const canonNow = effectiveCanon(now);
      const tree = treeRef.current;
      const anim = animRef.current;

      if (!anim) {
        const focusR = canonNow.get(focusIdRef.current)?.r ?? 0;
        const deltas = computeThetaDeltas(tree, canonNow, focusIdRef.current);
        return { rect, cx, cy, scale, focusR, deltas };
      }

      const t = Math.min(1, (now - anim.start) / FOCUS_ANIM_MS);
      if (t >= 1) {
        animRef.current = null;
        const focusR = canonNow.get(anim.toId)?.r ?? 0;
        const deltas = computeThetaDeltas(tree, canonNow, anim.toId);
        return { rect, cx, cy, scale, focusR, deltas };
      }

      // Mid-transition: every quantity stays relative to the node the
      // transition started FROM - the camera's own rapidity is a plain
      // scalar lerp (both ends are root-relative rapidities already, so no
      // extra care needed), and its angle-relative-to-"from" eases from 0
      // up to the full dtheta(to, from) - both safe, since they only ever
      // combine values already computed relative to a single, real anchor
      // node rather than forming an absolute angle anywhere.
      const eased = easeOutCubic(t);
      const deltasFromOld = computeThetaDeltas(tree, canonNow, anim.fromId);
      const rFrom = canonNow.get(anim.fromId)?.r ?? 0;
      const rTo = canonNow.get(anim.toId)?.r ?? 0;
      const focusR = rFrom + (rTo - rFrom) * eased;
      const virtualDtheta = (deltasFromOld.get(anim.toId) ?? 0) * eased;
      const deltas = new Map<string, number>();
      for (const [id, d] of deltasFromOld) deltas.set(id, d - virtualDtheta);
      return { rect, cx, cy, scale, focusR, deltas };
    }

    // The lower of "how deep the tree actually goes" and "how deep the
    // display-ply slider currently allows" - the single bound every ring
    // loop and the node/edge pass below all draw and hit-test against.
    function effectiveMaxPly(): number {
      return Math.min(maxPlyRef.current, maxDisplayPlyRef.current ?? Infinity);
    }

    const RING_HIT_PX = 6;
    function hitTestRing(
      mx: number,
      my: number,
      cx: number,
      cy: number,
      scale: number,
      focusR: number,
    ): number | null {
      let best: number | null = null;
      let bestDelta = Infinity;
      for (let ply = 1; ply <= effectiveMaxPly(); ply++) {
        // True hyperbolic distance, not a disk radius - see
        // move-tree-hyperbolic-layout.ts for why it's 2 * k * ply.
        const rapidity = 2 * kRef.current * ply;
        const ring = transformedRing(rapidity, focusR);
        // A ring too small to see is also too small to click - and not
        // worth the hit-distance math either.
        if (!isFinite(ring.r) || ring.r * scale < MIN_VISIBLE_PX) continue;
        const delta = Math.abs(Math.hypot(mx - (cx + ring.x * scale), my - (cy + ring.y * scale)) - ring.r * scale);
        if (delta < RING_HIT_PX && delta < bestDelta) {
          bestDelta = delta;
          best = ply;
        }
      }
      return best;
    }

    let raf = 0;
    function draw() {
      const dpr = devicePixelRatio;
      const now = performance.now();
      const { rect, cx, cy, scale, focusR, deltas } = frameGeometry();
      ctx!.save();
      ctx!.scale(dpr, dpr);
      ctx!.clearRect(0, 0, rect.width, rect.height);

      ctx!.strokeStyle = hexToRgba(baseColor("boundary", colors.accent), 0.22);
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx!.stroke();

      // Stepped every frame regardless of whether rings are shown, so a
      // fade-out already in progress doesn't freeze mid-transition and
      // then jump when rings are toggled back on.
      stepIntensityMap(ringHoverIntensityRef.current, showRingsRef.current ? hoveredRingPlyRef.current : null);
      stepIntensityMap(ringSelectIntensityRef.current, showRingsRef.current ? selectedRingPlyRef.current : null);

      if (showRingsRef.current) {
        for (let ply = 1; ply <= effectiveMaxPly(); ply++) {
          const rapidity = 2 * kRef.current * ply;
          const ring = transformedRing(rapidity, focusR);
          // Skip anything too small to actually see - a deep or heavily
          // compacted tree can have many rings crowded up against the
          // boundary, and none of them are worth a draw call.
          if (!isFinite(ring.r) || ring.r * scale < MIN_VISIBLE_PX) continue;
          // Every ply is a half-move (one side's move); a ring only lands on
          // a completed full move once both sides have moved, i.e. at an
          // even ply - so only those get labeled by default. Odd (half-move)
          // rings still exist and are still hoverable, just unlabeled for now.
          const major = ply % 2 === 0;
          const ringCx = cx + ring.x * scale, ringCy = cy + ring.y * scale, ringR = ring.r * scale;

          ctx!.strokeStyle = major
            ? hexToRgba(baseColor("ringMajor", colors.accent), 0.16)
            : baseColor("ringMinor", colors.borderSoft);
          ctx!.lineWidth = major ? 1.2 : 0.75;
          ctx!.beginPath();
          ctx!.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
          ctx!.stroke();

          const hoverI = ringHoverIntensityRef.current.get(ply) ?? 0;
          const selectI = ringSelectIntensityRef.current.get(ply) ?? 0;
          const highlightI = Math.max(hoverI * 0.7, selectI);
          if (highlightI > 0.01) {
            ctx!.strokeStyle = hexToRgba(baseColor("highlightRingSelect", colors.accent), 0.12 + 0.68 * highlightI);
            ctx!.lineWidth = (major ? 1.2 : 0.75) + 1.6 * highlightI;
            ctx!.beginPath();
            ctx!.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
            ctx!.stroke();
          }

          if (major || highlightI > 0.02) {
            const lx = ringCx, ly = cy + (ring.y - ring.r) * scale;
            if (lx > -20 && lx < rect.width + 20 && ly > -20 && ly < rect.height + 20) {
              // The move number (both plies of a full move share one), not
              // the raw ply count - matches how the hover/select panels
              // already label these rings elsewhere.
              const moveNumberLabel = String(Math.ceil(ply / 2));
              ctx!.font = `${highlightI > 0.5 ? "bold " : ""}${10 + highlightI}px ui-monospace, monospace`;
              ctx!.textAlign = "center";
              ctx!.textBaseline = "middle";
              ctx!.globalAlpha = 1 - highlightI;
              ctx!.fillStyle = colors.textFaint;
              ctx!.fillText(moveNumberLabel, lx, ly);
              ctx!.globalAlpha = highlightI;
              ctx!.fillStyle = colors.accent;
              ctx!.fillText(moveNumberLabel, lx, ly);
              ctx!.globalAlpha = 1;
            }
          }
        }
      }

      const currentTree = treeRef.current;
      const displayLimit = effectiveMaxPly();
      const rendered = new Map<string, Complex>();
      const pruneT = pruneThresholdT(scale);
      for (const [id, pos] of effectiveCanon(now)) {
        // A node past the display-ply cap is skipped entirely here, so it's
        // simultaneously invisible, un-hit-testable, and (since an edge only
        // draws once both its ends are in `rendered`) never leaves a
        // dangling edge toward whatever's been cut off.
        if ((currentTree.nodes[id]?.ply ?? 0) > displayLimit) continue;
        const camRelative = recenterPolar(pos.r, focusR, deltas.get(id) ?? 0);
        // Same treatment for anything so far from the camera it'd compact
        // into sub-pixel space anyway - see pruneThresholdT's own comment.
        if (camRelative.t > pruneT) continue;
        rendered.set(id, projectToDisk(camRelative));
      }

      // Every node from the game's start down to wherever play actually is
      // right now - the edges along it get a distinct highlight so the
      // "main line" reads at a glance against the rest of the tree.
      const mainLineIds = new Set(
        getBreadcrumb(currentTree, currentNodeIdRef.current).map((n) => n.id),
      );

      for (const id in currentTree.nodes) {
        const node = currentTree.nodes[id];
        if (!node.parentId) continue;
        const p = rendered.get(node.parentId), q = rendered.get(id);
        if (!p || !q) continue;
        const onMainLine = mainLineIds.has(id);
        const parentIsHub = isHub(currentTree.nodes[node.parentId]);
        ctx!.lineWidth = onMainLine ? 1.8 : 1.1;
        ctx!.strokeStyle = onMainLine
          ? hexToRgba(baseColor("edgeMainLine", colors.accent), 0.6)
          : parentIsHub
            ? hexToRgba(baseColor("edgeHubParent", HUB_COLOR), 0.35)
            : baseColor("edge", colors.border);
        drawGeodesic(
          ctx!,
          p,
          q,
          cx,
          cy,
          scale,
          onMainLine
            ? baseColor("edgeMainLine", colors.accent)
            : parentIsHub
              ? baseColor("edgeHubParent", HUB_COLOR)
              : baseColor("edge", colors.textFaint),
        );
      }

      renderedPosRef.current.clear();
      for (const id in currentTree.nodes) {
        const node = currentTree.nodes[id];
        const z = rendered.get(id);
        if (!z) continue;
        const mag = Math.hypot(z.x, z.y);
        const sx = cx + z.x * scale, sy = cy + z.y * scale;
        renderedPosRef.current.set(id, { x: sx, y: sy });

        const isFocus = id === focusIdRef.current && !animRef.current;
        const isCurrent = id === currentNodeIdRef.current;
        const ringSpotlight = ringSelectIntensityRef.current.get(node.ply) ?? 0;
        const closenessRaw = 1 - Math.min(1, mag);
        // Clicking a ring spotlights every move at that ply - eased toward a
        // comfortably visible size/opacity regardless of how compacted or
        // far from focus it actually is, so distant rings stay inspectable
        // without needing to recenter onto them first.
        const closeness = Math.max(closenessRaw, 0.85 * ringSpotlight);
        const radius = isFocus ? 7 : 2 + closeness * 8;

        // Who moved into this position, at a glance: a solid light dot for a
        // White move, a hollow (rim-only) dot for a Black move - same
        // convention as light/dark checkers pieces, and it survives the
        // closeness fade since the rim's alpha fades instead of the fill.
        const isBlackMove = node.side === "b";
        const isHovered = id === hoveredIdRef.current;
        // Focus and hover are called out via outer rings below, not by
        // recoloring the dot - its mover color stays intact, just pushed to
        // full brightness instead of the usual closeness-based fade.
        const brighten = isFocus || isHovered;
        // Hovering the node that's already selected wouldn't otherwise show
        // any feedback at all - its focus/current ring is already showing
        // regardless of hover - so pulse its size instead. The pulse damps
        // out over a fixed 3s window (from whenever this hover started)
        // rather than continuing indefinitely while the cursor sits still.
        const hoverElapsed = now - hoverStartRef.current;
        const bounceEnvelope = isHovered && hoverElapsed < 3000 ? 1 - hoverElapsed / 3000 : 0;
        const bounceScale =
          (isFocus || isCurrent) && bounceEnvelope > 0
            ? 1 + 0.16 * bounceEnvelope * Math.sin(now / 130)
            : 1;
        const drawRadius = radius * bounceScale;

        ctx!.beginPath();
        ctx!.arc(sx, sy, drawRadius, 0, Math.PI * 2);
        // A node's color is only ever about who moved into it (light/dark
        // dot) - whether it's a fork is an edge-level fact (see the
        // hub-parent edge color above), not something the node itself
        // should visually change for.
        if (isBlackMove) ctx!.fillStyle = colors.background;
        else ctx!.fillStyle = hexToRgba(baseColor("nodeWhite", colors.text), brighten ? 1 : 0.35 + closeness * 0.5);
        ctx!.fill();

        if (isBlackMove) {
          ctx!.strokeStyle = hexToRgba(baseColor("nodeBlack", colors.text), brighten ? 1 : 0.4 + closeness * 0.5);
          ctx!.lineWidth = brighten ? 1.8 : 1.3;
          ctx!.beginPath();
          ctx!.arc(sx, sy, drawRadius, 0, Math.PI * 2);
          ctx!.stroke();
        }

        if (isFocus) {
          ctx!.strokeStyle = hexToRgba(baseColor("highlightFocus", colors.accent), 0.5);
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, drawRadius + 4, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (isCurrent) {
          ctx!.strokeStyle = baseColor("highlightCurrent", colors.accent);
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, drawRadius + 3, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (ringSpotlight > 0.01) {
          ctx!.strokeStyle = hexToRgba(baseColor("highlightRingSelect", colors.accent), 0.6 * ringSpotlight);
          ctx!.lineWidth = 1.6 * ringSpotlight;
          ctx!.beginPath();
          ctx!.arc(sx, sy, radius + 3, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (isHovered) {
          ctx!.strokeStyle = hexToRgba(baseColor("highlightHover", colors.text), 0.55);
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.arc(sx, sy, radius + 3, 0, Math.PI * 2);
          ctx!.stroke();
        }

        const baseLabelOpacity = Math.max(0, closeness * 0.9 - 0.05) + (isFocus ? 0.9 : 0);
        const labelOpacity = Math.max(baseLabelOpacity, 0.95 * ringSpotlight);
        if (labelOpacity > 0.06) {
          ctx!.font = "11px ui-monospace, monospace";
          ctx!.fillStyle = hexToRgba(colors.text, Math.min(1, labelOpacity));
          ctx!.textAlign = "left";
          ctx!.textBaseline = "bottom";
          ctx!.fillText(nodeLabel(node), sx + radius + 4, sy - 2);
        }
      }

      ctx!.restore();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    function hitTest(mx: number, my: number): string | null {
      let best: string | null = null;
      let bestD = Infinity;
      for (const [id, p] of renderedPosRef.current) {
        const d = Math.hypot(mx - p.x, my - p.y);
        if (d <= MIN_HIT_RADIUS && d < bestD) {
          bestD = d;
          best = id;
        }
      }
      return best;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.01 : 0.01;
      setK((prev) => Math.min(K_MAX, Math.max(K_MIN, prev + delta)));
    }

    function onPointerMove(e: PointerEvent) {
      const rect = stage!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit !== hoveredIdRef.current) {
        setHoveredId(hit);
        hoverStartRef.current = performance.now();
        if (hit) setCardClosed(false);
      }

      // A node under the cursor always takes priority over a ring behind it
      // - but it gets the same Move/ply tooltip a ring hover would, keyed by
      // its own ply (any node sharing that ply has the same move number).
      if (hit) {
        const hoveredPly = treeRef.current.nodes[hit]?.ply ?? null;
        if (hoveredPly !== hoveredRingPlyRef.current) {
          hoveredRingPlyRef.current = hoveredPly;
          setHoveredRingPly(hoveredPly);
        }
        if (hoveredPly !== null) {
          setRingTooltipPos({ left: Math.min(mx + 14, rect.width - 120), top: Math.max(my - 28, 8) });
        }
        return;
      }
      const { cx, cy, scale, focusR } = frameGeometry();
      const ringHit = hitTestRing(mx, my, cx, cy, scale, focusR);
      if (ringHit !== hoveredRingPlyRef.current) {
        hoveredRingPlyRef.current = ringHit;
        setHoveredRingPly(ringHit);
      }
      if (ringHit !== null) {
        setRingTooltipPos({ left: Math.min(mx + 14, rect.width - 120), top: Math.max(my - 28, 8) });
      }
    }
    function onPointerLeave() {
      if (!pinnedIdRef.current) {
        setHoveredId(null);
      }
      if (hoveredRingPlyRef.current !== null) {
        hoveredRingPlyRef.current = null;
        setHoveredRingPly(null);
      }
    }
    function onClick(e: MouseEvent) {
      const rect = stage!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit) {
        // Clicking a node commits to it - same effect the old "Go to this
        // move" button had - so the main-line highlight always tracks
        // whatever was just clicked instead of needing a separate confirm.
        // The ring-move-list (if one's open) is left alone - the two panels
        // are independent now, not an either/or.
        goToNodeRef.current(hit);
        setPinnedId(hit);
        setCardClosed(false);
        return;
      }
      const { cx, cy, scale, focusR } = frameGeometry();
      const ringHit = hitTestRing(mx, my, cx, cy, scale, focusR);
      if (ringHit !== null) {
        const next = selectedRingPlyRef.current === ringHit ? null : ringHit;
        selectedRingPlyRef.current = next;
        setSelectedRingPly(next);
        // Centering on the true game start (rather than wherever the
        // camera happened to be) is what makes every node on the ring
        // equidistant from the origin, so it - and every move on it -
        // reads as an undistorted circle instead of the lopsided arc a
        // Mobius transform gives a ring around some other, off-center
        // point.
        if (next !== null) doSetFocus(treeRef.current.rootId);
        return;
      }
      setPinnedId(null);
      selectedRingPlyRef.current = null;
      setSelectedRingPly(null);
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onClick);
    };
    // Mount-once by design - see the comment on the refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    stageRef,
    canvasRef,
    // Exposed so external triggers of a hover (e.g. the ring move-list)
    // can reset the same damped-bounce timer canvas hover does - it's a
    // plain ref, safe to hand out and mutate from outside.
    hoverStartRef,
    focusId,
    k,
    setK,
    showRings,
    setShowRings,
    pinnedId,
    setPinnedId,
    hoveredId,
    setHoveredId,
    cardClosed,
    setCardClosed,
    hoveredRingPly,
    ringTooltipPos,
    selectedRingPly,
    setSelectedRingPly,
    totalNodes,
    maxPly,
    widestFork,
    mapColors,
    setMapColor,
    resetMapColors,
    maxDisplayPly,
    setMaxDisplayPly,
  };
}
