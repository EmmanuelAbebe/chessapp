"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawGeodesic, transformedRing, type Complex } from "../../lib/map/poincare-disk";
import { projectToDisk, recenterPolar } from "../../lib/map/hyperboloid";
import {
  computeHyperbolicLayout,
  type Polar,
} from "../../lib/map/move-tree-hyperbolic-layout";
import { computeThetaDeltas } from "../../lib/map/move-tree-angles";
import { buildFlatTree } from "../../lib/map/move-tree-flat";
import {
  collectVisibleNodes,
  computeSubtreeSpread,
  makeVisibleWalkScratch,
  type VisibleWalkScratch,
} from "../../lib/map/move-tree-visible-set";
import {
  HUB_COLOR,
  easeOutCubic,
  getBreadcrumb,
  hexToRgba,
  isHub,
  nodeLabel,
  readThemeColors,
  shortestRotation,
  stepIntensityMap,
  type MapColorKey,
  type MapColorOverrides,
} from "../../lib/map/move-tree-map-helpers";
import type { MoveTreeState } from "../../types";

const FOCUS_ANIM_MS = 450;
// Compaction `k` sets true hyperbolic distance per ply: `r = 2*k*ply`, which
// projects to disk radius `tanh(k*ply)` for a node measured from the root
// (see move-tree-hyperbolic-layout.ts / hyperboloid.ts - the layout is the
// Lorentz hyperboloid model, `tanh` only appears as the closed-form
// projection onto the focus axis).
//
// The range is as wide as stays legible AND finite:
//  - K_MAX 0.7: at the top end only the focus and ~2-3 plies around it sit
//    inside the disk (tanh(0.7)=0.60, tanh(1.4)=0.89, tanh(2.1)=0.97);
//    everything deeper is culled sub-pixel against the boundary. Past this
//    even the focus's own children are jammed on the rim - not navigable.
//    `2*k*ply` also stays under the ~710 where sinh/cosh overflow float64
//    for any game shorter than ~500 plies; deeper nodes at max k overflow
//    to +/-Infinity and are culled by the `isFinite` guard in the draw
//    loop (correct: an overflowed node really is boundary-distance away).
//  - K_MIN 0.02: the whole tree still fills a usable fraction of the disk
//    even 40+ plies deep (tanh(0.8)=0.66). Lower and consecutive plies land
//    within a node-radius of each other and edges/arrowheads collapse.
export const K_MIN = 0.02;
export const K_MAX = 0.7;
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

  // Flat, index-addressed topology (rebuilt only on a tree change) and the
  // canonical layout as parallel typed arrays indexed the same way. The
  // steady-state draw path (no animation running) walks these instead of
  // iterating the `canon` Map + doing string/object lookups per node.
  const flat = useMemo(() => buildFlatTree(tree), [tree]);
  const canonArrays = useMemo(() => {
    const r = new Float64Array(flat.n);
    const localTheta = new Float64Array(flat.n);
    for (let i = 0; i < flat.n; i++) {
      const p = canon.get(flat.ids[i]);
      if (p) {
        r[i] = p.r;
        localTheta[i] = p.localTheta;
      }
    }
    // Per-subtree angular reach, used by the visible-set walk to prune
    // whole subtrees. Depends on localTheta (hence k), so it lives here.
    const spread = computeSubtreeSpread(flat, localTheta);
    return { r, localTheta, spread };
  }, [flat, canon]);

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

  // --- Draw-loop scheduling + projected-position cache ---------------------
  // The draw loop only runs while something is actually moving (a focus or
  // layout transition, a ring fade, a hovered-node bounce); once it settles
  // it stops scheduling frames, so an idle map - even with a 10k-node tree -
  // costs nothing until the next interaction re-arms it (see the effect that
  // calls requestDrawRef, and needsAnimation in the draw effect).
  const requestDrawRef = useRef<(() => void) | null>(null);
  // `rendered` (every visible node's disk position) only depends on k, the
  // focus, the tree, the canvas size and the ply cap - never on hover, pins
  // or ring selection. When a redraw is triggered by one of those and the
  // geometry inputs are unchanged, the O(n) recenter/project pass is skipped
  // and this cached map is reused.
  const renderedCacheRef = useRef<Map<string, Complex> | null>(null);
  const focusRCacheRef = useRef(0);
  const geomCacheKeyRef = useRef("");
  const geomCacheTreeRef = useRef<MoveTreeState | null>(null);
  // Reused scratch buffers for the visible-set walk - grown (never shrunk)
  // to fit the current node count so the walk allocates nothing per frame.
  const walkScratchRef = useRef<VisibleWalkScratch>(makeVisibleWalkScratch(0));
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
  const flatRef = useRef(flat);
  const canonArraysRef = useRef(canonArrays);
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
  flatRef.current = flat;
  canonArraysRef.current = canonArrays;
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
    // setFocusId's re-render would re-arm the loop anyway, but the anim
    // clock has already started - kick it now so the first eased frame
    // isn't a render tick late.
    requestDrawRef.current?.();
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

    // Declared up here (not next to draw()) so the observers' resize()/
    // refreshColors() - which run during setup, before draw's own block -
    // can call requestDraw() without tripping the `running` TDZ.
    let raf = 0;
    let running = false;

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
      requestDraw();
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
      // The canvas size feeds the geometry cache key, so a resize forces a
      // re-project on the next frame anyway - just make sure there is one.
      requestDraw();
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
    //
    // `wantDeltas` is false for the pointer handlers: ring hit-testing only
    // needs `focusR`, so they skip the O(n) computeThetaDeltas entirely on
    // every mousemove.
    function frameGeometry(wantDeltas = true) {
      const rect = stage!.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      const scale = (Math.min(rect.width, rect.height) / 2) * 0.92;
      const now = performance.now();
      const canonNow = effectiveCanon(now);
      const tree = treeRef.current;
      const anim = animRef.current;

      if (!anim) {
        const focusR = canonNow.get(focusIdRef.current)?.r ?? 0;
        const deltas = wantDeltas
          ? computeThetaDeltas(tree, canonNow, focusIdRef.current)
          : null;
        return { rect, cx, cy, scale, focusR, deltas, canonNow };
      }

      const t = Math.min(1, (now - anim.start) / FOCUS_ANIM_MS);
      if (t >= 1) {
        animRef.current = null;
        const focusR = canonNow.get(anim.toId)?.r ?? 0;
        const deltas = wantDeltas
          ? computeThetaDeltas(tree, canonNow, anim.toId)
          : null;
        return { rect, cx, cy, scale, focusR, deltas, canonNow };
      }

      // Mid-transition: every quantity stays relative to the node the
      // transition started FROM - the camera's own rapidity is a plain
      // scalar lerp (both ends are root-relative rapidities already, so no
      // extra care needed), and its angle-relative-to-"from" eases from 0
      // up to dtheta(to, from) - safe since it only ever combines values
      // already computed relative to a single, real anchor node rather
      // than forming an absolute angle anywhere. Wrapped to the shortest
      // equivalent turn first: the raw tree-path sum can come out close to
      // a half-turn or more for two nodes that are visually right next to
      // each other (e.g. cousins under different parents), and rotating by
      // that or by its shorter equivalent ends up at the exact same final
      // orientation either way (see shortestRotation's own comment).
      const eased = easeOutCubic(t);
      const rFrom = canonNow.get(anim.fromId)?.r ?? 0;
      const rTo = canonNow.get(anim.toId)?.r ?? 0;
      const focusR = rFrom + (rTo - rFrom) * eased;
      if (!wantDeltas) {
        return { rect, cx, cy, scale, focusR, deltas: null, canonNow };
      }
      const deltasFromOld = computeThetaDeltas(tree, canonNow, anim.fromId);
      const virtualDtheta = shortestRotation(deltasFromOld.get(anim.toId) ?? 0) * eased;
      const deltas = new Map<string, number>();
      for (const [id, d] of deltasFromOld) deltas.set(id, d - virtualDtheta);
      return { rect, cx, cy, scale, focusR, deltas, canonNow };
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

    // Schedules a frame if one isn't already pending. The loop stops itself
    // once everything settles (see needsAnimation), so this is what brings
    // it back - called from the re-arm effect, the observers, and
    // doSetFocus.
    function requestDraw() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(draw);
    }
    requestDrawRef.current = requestDraw;

    // Whether anything is still visibly in motion this frame. When false and
    // no new requestDraw() comes in, the loop goes idle - a static 10k-node
    // map then costs zero per frame.
    function needsAnimation(now: number, ringsMoving: boolean): boolean {
      if (animRef.current || layoutAnimRef.current || ringsMoving) return true;
      // The hovered-node bounce only applies to the focus / current node,
      // and only for 3s - a plain node hover draws once and then idles.
      const hov = hoveredIdRef.current;
      if (
        hov &&
        (hov === focusIdRef.current || hov === currentNodeIdRef.current) &&
        now - hoverStartRef.current < 3000
      ) {
        return true;
      }
      return false;
    }

    function draw() {
      const dpr = devicePixelRatio;
      const now = performance.now();

      const rect = stage!.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      const scale = (Math.min(rect.width, rect.height) / 2) * 0.92;
      const currentTree = treeRef.current;
      const displayLimit = effectiveMaxPly();

      const pruneT = pruneThresholdT(scale);
      const flatTree = flatRef.current;
      const focusIdx = flatTree.idToIdx.get(focusIdRef.current);
      // The fast walk (see collectVisibleNodes) needs a settled camera at a
      // real focus node. During a focus or layout transition the camera is
      // a virtual in-between point and node positions are mid-tween, so
      // fall back to the O(n) pass driven by frameGeometry - it only runs
      // for the ~450ms an animation lasts.
      const animating = !!animRef.current || !!layoutAnimRef.current;

      // Every visible node's disk position depends only on these inputs -
      // not on hover / pin / ring selection. When a redraw is triggered by
      // one of those and none of the geometry inputs changed, reuse last
      // frame's projected map and skip the recenter/project pass entirely.
      // `animating` is in the key so the first settled frame after a
      // transition recomputes instead of reusing a mid-tween snapshot.
      const geomKey = `${kRef.current}|${focusIdRef.current}|${scale}|${displayLimit}|${animating}`;
      const canReuse =
        !animating &&
        renderedCacheRef.current !== null &&
        geomCacheTreeRef.current === currentTree &&
        geomCacheKeyRef.current === geomKey;

      let rendered: Map<string, Complex>;
      let focusR: number;

      if (canReuse) {
        rendered = renderedCacheRef.current!;
        focusR = focusRCacheRef.current;
      } else if (animating || focusIdx === undefined) {
        const g = frameGeometry(true);
        focusR = g.focusR;
        const deltas = g.deltas!;
        // A node's hyperbolic distance from the camera is always >= the gap
        // between the two rapidities (hyperbolic law of cosines, with
        // cos(dtheta) <= 1), so anything whose radial gap alone already
        // exceeds the sub-pixel distance can skip recenterPolar - roughly
        // 5 sinh/cosh calls - outright. Never culls a node pruneT wouldn't.
        const radialCull = Math.acosh(pruneT);
        rendered = new Map<string, Complex>();
        for (const [id, pos] of g.canonNow) {
          if ((currentTree.nodes[id]?.ply ?? 0) > displayLimit) continue;
          if (Math.abs(pos.r - focusR) > radialCull) continue;
          const camRelative = recenterPolar(pos.r, focusR, deltas.get(id) ?? 0);
          // Also catches t === NaN/Infinity from sinh/cosh overflow at very
          // high k + deep ply - boundary-distance away, same as sub-pixel.
          if (!(camRelative.t <= pruneT)) continue;
          rendered.set(id, projectToDisk(camRelative));
        }
        renderedCacheRef.current = rendered;
        focusRCacheRef.current = focusR;
        geomCacheKeyRef.current = geomKey;
        geomCacheTreeRef.current = currentTree;
      } else {
        // Steady state: walk out from the focus, touching only nodes that
        // can reach the disk. O(visible), not O(n).
        const arrays = canonArraysRef.current;
        focusR = arrays.r[focusIdx];
        if (walkScratchRef.current.visited.length < flatTree.n) {
          walkScratchRef.current = makeVisibleWalkScratch(flatTree.n);
        }
        const visible = collectVisibleNodes(
          flatTree,
          arrays.r,
          arrays.localTheta,
          arrays.spread,
          focusIdx,
          focusR,
          kRef.current,
          pruneT,
          displayLimit,
          walkScratchRef.current,
        );
        rendered = new Map<string, Complex>();
        for (const [idx, pos] of visible) rendered.set(flatTree.ids[idx], pos);
        renderedCacheRef.current = rendered;
        focusRCacheRef.current = focusR;
        geomCacheKeyRef.current = geomKey;
        geomCacheTreeRef.current = currentTree;
      }

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
      // then jump when rings are toggled back on. Both calls always run
      // (no short-circuit) - each map has to be advanced every frame.
      const hoverMoving = stepIntensityMap(
        ringHoverIntensityRef.current,
        showRingsRef.current ? hoveredRingPlyRef.current : null,
      );
      const selectMoving = stepIntensityMap(
        ringSelectIntensityRef.current,
        showRingsRef.current ? selectedRingPlyRef.current : null,
      );
      const ringsMoving = hoverMoving || selectMoving;

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

      // Every node from the game's start down to wherever play actually is
      // right now - the edges along it get a distinct highlight so the
      // "main line" reads at a glance against the rest of the tree.
      const mainLineIds = new Set(
        getBreadcrumb(currentTree, currentNodeIdRef.current).map((n) => n.id),
      );

      // Iterate only what's actually on screen (`rendered`), not every node
      // in the tree - at 10k nodes with the focus deep in a line, that's a
      // few dozen instead of the lot.
      for (const [id, q] of rendered) {
        const node = currentTree.nodes[id];
        if (!node?.parentId) continue;
        const p = rendered.get(node.parentId);
        if (!p) continue;
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
      for (const [id, z] of rendered) {
        const node = currentTree.nodes[id];
        if (!node) continue;
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

        // On-screen gap to the parent node - a cheap local-density proxy.
        // `closeness` alone measures only distance from the disk center, so
        // at low compaction (whole tree packed near the center) every node
        // reads as "close" and renders big and labeled, overlapping into an
        // unreadable clump. `roomFactor` ramps 0 -> 1 as the parent edge goes
        // from ~12px to ~36px on screen, so a dense region stays small
        // unlabeled dots and only opens up into sized, labeled nodes where
        // there's actually space.
        const parentZ = node.parentId ? rendered.get(node.parentId) : null;
        const parentGapPx = parentZ
          ? Math.hypot(z.x - parentZ.x, z.y - parentZ.y) * scale
          : Infinity;
        // Ring-spotlight overrides the density damping - a spotlit ply is
        // meant to stay comfortably sized/labeled wherever it sits.
        const roomFactor = Math.max(
          ringSpotlight,
          Math.min(1, Math.max(0, (parentGapPx - 12) / 24)),
        );

        const radius = isFocus
          ? 6
          : Math.max(1.3, (1.5 + closeness * 3.3) * (0.45 + 0.55 * roomFactor));

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

        // A label shows only for a node that's both prominent (well inside
        // the disk, so `closeness` past ~0.5) AND has elbow room around it
        // (`roomFactor`) - so a compacted clump near the center stays
        // unlabeled however "close" it measures. Focus and ring-spotlit
        // nodes are always labeled; those are deliberate callouts.
        const proximityForLabel = Math.max(0, Math.min(1, (0.85 - mag) / 0.55));
        const baseLabelOpacity =
          proximityForLabel * roomFactor + (isFocus ? 1 : 0);
        const labelOpacity = Math.max(baseLabelOpacity, 0.95 * ringSpotlight);
        if (labelOpacity > 0.15 && (drawRadius > 2.4 || isFocus)) {
          ctx!.font = "11px ui-monospace, monospace";
          ctx!.fillStyle = hexToRgba(colors.text, Math.min(1, labelOpacity));
          ctx!.textAlign = "left";
          ctx!.textBaseline = "bottom";
          ctx!.fillText(nodeLabel(node), sx + radius + 4, sy - 2);
        }
      }

      ctx!.restore();

      if (needsAnimation(now, ringsMoving)) {
        raf = requestAnimationFrame(draw);
      } else {
        running = false;
      }
    }
    requestDraw();

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
      const { cx, cy, scale, focusR } = frameGeometry(false);
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
      const { cx, cy, scale, focusR } = frameGeometry(false);
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
      running = false;
      requestDrawRef.current = null;
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

  // Re-arm the (otherwise self-stopping) draw loop whenever something that
  // actually changes the canvas changes. Deliberately NOT depending on
  // ringTooltipPos / pinnedId / cardClosed - those re-render but don't
  // affect anything drawn, so they shouldn't cost a frame.
  useEffect(() => {
    requestDrawRef.current?.();
  }, [
    k,
    focusId,
    hoveredId,
    hoveredRingPly,
    selectedRingPly,
    showRings,
    currentNodeId,
    maxDisplayPly,
    tree,
    mapColors,
  ]);

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
