"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FaGear } from "react-icons/fa6";
import { Chessboard } from "react-chessboard";
import type { Arrow, SquareHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import Modal from "@/components/ui/Modal";
import SettingsItem from "@/features/settings/components/SettingsItem";
import SettingsToggle from "@/features/settings/components/SettingsToggle";
import { useBoardGameContext } from "../BoardGameContext";
import { getMoveOptions } from "../lib/board-helpers";
import { boardTheme } from "../lib/board-theme";
import { computeHyperbolicLayout } from "../lib/move-tree-hyperbolic-layout";
import { drawGeodesic, lerpComplex, mobiusTranslate, transformedRing, type Complex } from "../lib/poincare-disk";
import { MoveList } from "./MoveList";
import type { MoveNode, MoveTreeState, OptionSquares } from "../types";

const ORIGIN: Complex = { x: 0, y: 0 };
const FOCUS_ANIM_MS = 450;
const K_MIN = 0.06;
const K_MAX = 0.42;
const K_DEFAULT = 0.2;
const MIN_HIT_RADIUS = 16;

// Forks aren't part of the app's neutral theme token set (like `bad`/`good`,
// this is a new semantic this feature introduces) - fixed regardless of
// theme shade, matching the color validated in the standalone prototype.
const HUB_COLOR = "#e0a458";

type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  borderSoft: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
};

// Canvas fill/stroke colors have to be resolved strings, not CSS vars - read
// straight from the current theme (charcoal/midnight/slate, whichever the
// user has selected) rather than hardcoding one palette, so the map matches
// the rest of the app's theming instead of only ever looking right in one
// theme.
function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    background: get("--background", "#0a0a0a"),
    surface: get("--surface", "#171717"),
    border: get("--border", "#3a3a3a"),
    borderSoft: get("--border-soft", "#262626"),
    text: get("--text", "#e8e8e6"),
    textDim: get("--text-dim", "#9a9a97"),
    textFaint: get("--text-faint", "#6b6b68"),
    accent: get("--accent", "#5b9dfa"),
    accentSoft: get("--accent-soft", "rgba(91, 157, 250, 0.14)"),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  if (Number.isNaN(value)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isHub(node: MoveNode): boolean {
  return node.children.length >= 3;
}

function nodeLabel(node: MoveNode): string {
  return node.parentId === null ? "Start" : (node.san ?? "?");
}

function getBreadcrumb(tree: MoveTreeState, focusId: string): MoveNode[] {
  const chain: MoveNode[] = [];
  let cursor: string | null = focusId;
  while (cursor) {
    const node: MoveNode = tree.nodes[cursor];
    chain.unshift(node);
    cursor = node.parentId;
  }
  return chain;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const RING_HIGHLIGHT_STEP = 0.18; // per-frame ease rate, ~5-6 frames to settle at 60fps

// Eases every tracked ply's intensity toward 1 if it's the current target,
// toward 0 otherwise, and drops entries once they've fully faded out so the
// map doesn't grow forever as the cursor wanders across rings.
function stepIntensityMap(map: Map<number, number>, targetPly: number | null) {
  if (targetPly !== null && !map.has(targetPly)) map.set(targetPly, 0);
  for (const [ply, value] of map) {
    const target = ply === targetPly ? 1 : 0;
    const next = value + (target - value) * RING_HIGHLIGHT_STEP;
    if (target === 0 && next < 0.01) map.delete(ply);
    else map.set(ply, next);
  }
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-[88px] flex-col gap-0.5 rounded-[10px] border border-border-soft px-2.5 py-1.5">
      <span className="font-mono text-[0.62rem] tracking-wide text-text-faint uppercase">{label}</span>
      <span
        className="font-mono text-[0.92rem] [font-variant-numeric:tabular-nums]"
        style={accent ? { color: HUB_COLOR } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

// A real, playable board for the previewed node - lets a sideline be tried
// out right from the map without first jumping the whole game there. Moves
// play via click-to-move (same interaction as the main board) and land as a
// new branch off `node` via `playMoveAt`; `onMove` reports the resulting
// node id so the caller can keep the preview card pointed at it.
function PlayableMiniBoard({
  node,
  tree,
  animateEntry,
  onMove,
}: {
  node: MoveNode;
  tree: MoveTreeState;
  animateEntry: boolean;
  onMove: (nodeId: string) => void;
}) {
  const { playMoveAt } = useBoardGameContext();
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<OptionSquares>({});
  // Read after mount rather than in a lazy initializer - the card now
  // renders by default (not just on hover/pin), including during SSR/build
  // prerendering where `document` doesn't exist. A raw SVG stroke attribute
  // (unlike a CSS property) won't resolve a `var(--accent)` reference
  // either, so the resolved color still has to come from the DOM once
  // there is one.
  const [accentColor, setAccentColor] = useState("#5b9dfa");
  useEffect(() => {
    setAccentColor(readThemeColors().accent);
  }, []);

  // What the board actually displays, plus whether the *next* position
  // update should animate - lets a click on any node (however far from
  // whatever was on screen before) always play as one clean single-move
  // slide: snap instantly to the position just before that move, then
  // animate forward into it, rather than animating a jump between two
  // unrelated positions (or not animating at all).
  const [displayFen, setDisplayFen] = useState(node.fen);
  const [animateNow, setAnimateNow] = useState(false);

  // Runs before paint so the "snap to the pre-move position" step is never
  // itself visible as a flash of the wrong position.
  useLayoutEffect(() => {
    setMoveFrom("");
    setOptionSquares({});

    const parent = node.parentId ? tree.nodes[node.parentId] : null;
    setAnimateNow(false);
    setDisplayFen(animateEntry && parent ? parent.fen : node.fen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // One tick later (after the snap above has actually painted) transition
  // to the real position with animation turned on, so react-chessboard has
  // a "before" frame to diff against instead of collapsing both updates
  // into a single unanimated jump.
  useEffect(() => {
    const parent = node.parentId ? tree.nodes[node.parentId] : null;
    if (!animateEntry || !parent) return;
    const raf = requestAnimationFrame(() => {
      setAnimateNow(true);
      setDisplayFen(node.fen);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const chess = useMemo(() => new Chess(node.fen), [node.fen]);

  // Every move already explored from this position - shown as arrows so
  // "moving forward" needs no dedicated control: it's just clicking a move
  // that already has a visible destination, same as playing a brand new one.
  const exploredArrows = useMemo<Arrow[]>(() => {
    return node.children
      .map((childId) => tree.nodes[childId]?.uci)
      .filter((uci): uci is string => !!uci)
      .map((uci) => ({
        startSquare: uci.slice(0, 2),
        endSquare: uci.slice(2, 4),
        color: accentColor,
      }));
  }, [node.children, tree.nodes, accentColor]);

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (chess.isGameOver()) return;

    if (!moveFrom && piece) {
      const nextOptions = getMoveOptions(chess, square as Square);
      setOptionSquares(nextOptions ?? {});
      if (nextOptions) setMoveFrom(square);
      return;
    }

    const moves = chess.moves({ square: moveFrom as Square, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      const nextOptions = getMoveOptions(chess, square as Square);
      setOptionSquares(nextOptions ?? {});
      setMoveFrom(nextOptions ? square : "");
      return;
    }

    const resultId = playMoveAt(node.id, { from: moveFrom, to: square, promotion: "q" });
    if (resultId) onMove(resultId);
    setMoveFrom("");
    setOptionSquares({});
  }

  const options = useMemo(
    () => ({
      id: "move-tree-preview-board",
      position: displayFen,
      onSquareClick,
      squareStyles: optionSquares,
      allowDragging: false,
      allowDrawingArrows: false,
      arrows: exploredArrows,
      showAnimations: animateNow,
      animationDurationInMs: 280,
      showNotation: false,
      darkSquareStyle: boardTheme.darkSquareStyle,
      lightSquareStyle: boardTheme.lightSquareStyle,
      boardStyle: boardTheme.boardStyle,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayFen, animateNow, optionSquares, moveFrom, exploredArrows],
  );

  return (
    <div className="aspect-square w-full overflow-hidden rounded-md border border-border-soft">
      <Chessboard options={options} />
    </div>
  );
}

type FocusAnim = { from: Complex; toId: string; start: number };

export function MoveTreeMap() {
  const { tree, currentNodeId, currentLine, goToNode } = useBoardGameContext();

  const [focusId, setFocusId] = useState(currentNodeId);
  const [k, setK] = useState(K_DEFAULT);
  const [showRings, setShowRings] = useState(true);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // The preview card is always showing something by default (falling back
  // to the live current node) - closing it is a deliberate action, and
  // interacting with any node again is what brings it back.
  const [cardClosed, setCardClosed] = useState(false);

  // The compaction slider, depth-rings checkbox, and node/ply/fork counters
  // are secondary controls most sessions never touch - hidden by default to
  // save space, individually toggleable from the settings modal, and shown
  // as a floating panel (top-left) instead of permanent page rows when on.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showCompactionPanel, setShowCompactionPanel] = useState(false);
  const [showRingsTogglePanel, setShowRingsTogglePanel] = useState(false);
  const [hoveredRingPly, setHoveredRingPly] = useState<number | null>(null);
  const [ringTooltipPos, setRingTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [selectedRingPly, setSelectedRingPly] = useState<number | null>(null);

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

  const nodesOnSelectedRing = useMemo(() => {
    if (selectedRingPly === null) return [];
    return Object.values(tree.nodes).filter((n) => n.ply === selectedRingPly);
  }, [tree, selectedRingPly]);

  const hoveredRingSample = useMemo(() => {
    if (hoveredRingPly === null) return null;
    return Object.values(tree.nodes).find((n) => n.ply === hoveredRingPly) ?? null;
  }, [tree, hoveredRingPly]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<FocusAnim | null>(null);
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
  const hoveredRingPlyRef = useRef<number | null>(null);
  const selectedRingPlyRef = useRef<number | null>(null);
  hoveredIdRef.current = hoveredId;
  pinnedIdRef.current = pinnedId;
  goToNodeRef.current = goToNode;
  showRingsRef.current = showRings;
  canonRef.current = canon;
  treeRef.current = tree;
  focusIdRef.current = focusId;
  currentNodeIdRef.current = currentNodeId;
  kRef.current = k;
  maxPlyRef.current = maxPly;
  hoveredRingPlyRef.current = hoveredRingPly;
  selectedRingPlyRef.current = selectedRingPly;

  // Reads whatever's currently on screen (mid-transition or settled) so a
  // fresh click can smoothly retarget from wherever the view actually is,
  // and so the draw loop and hit-testing always agree on positions.
  function currentFocusComplex(now: number): Complex {
    const anim = animRef.current;
    const canonNow = canonRef.current;
    if (!anim) return canonNow.get(focusIdRef.current) ?? ORIGIN;
    const t = Math.min(1, (now - anim.start) / FOCUS_ANIM_MS);
    if (t >= 1) {
      animRef.current = null;
      return canonNow.get(anim.toId) ?? ORIGIN;
    }
    return lerpComplex(anim.from, canonNow.get(anim.toId) ?? ORIGIN, easeOutCubic(t));
  }

  // Recentering is a single Mobius transform of the whole disk, not a
  // relayout - the tree structure and every node's canonical position stay
  // exactly the same, only which point currently sits at the origin changes.
  function doSetFocus(id: string) {
    if (!treeRef.current.nodes[id] || id === focusIdRef.current) return;
    const now = performance.now();
    animRef.current = { from: currentFocusComplex(now), toId: id, start: now };
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
    let boundaryColor = hexToRgba(colors.accent, 0.22);
    let ringMajorColor = hexToRgba(colors.accent, 0.16);
    function refreshColors() {
      colors = readThemeColors();
      boundaryColor = hexToRgba(colors.accent, 0.22);
      ringMajorColor = hexToRgba(colors.accent, 0.16);
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
    function frameGeometry() {
      const rect = stage!.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      const scale = (Math.min(rect.width, rect.height) / 2) * 0.92;
      const focusA = currentFocusComplex(performance.now());
      return { rect, cx, cy, scale, focusA };
    }

    const RING_HIT_PX = 6;
    function hitTestRing(mx: number, my: number, cx: number, cy: number, scale: number, focusA: Complex): number | null {
      let best: number | null = null;
      let bestDelta = Infinity;
      for (let ply = 1; ply <= maxPlyRef.current; ply++) {
        const canonR = Math.tanh(kRef.current * ply);
        if (canonR > 0.999) continue;
        const ring = transformedRing(canonR, focusA);
        if (!ring || !isFinite(ring.r)) continue;
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
      const { rect, cx, cy, scale, focusA } = frameGeometry();
      ctx!.save();
      ctx!.scale(dpr, dpr);
      ctx!.clearRect(0, 0, rect.width, rect.height);

      ctx!.strokeStyle = boundaryColor;
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
        for (let ply = 1; ply <= maxPlyRef.current; ply++) {
          const canonR = Math.tanh(kRef.current * ply);
          if (canonR > 0.999) continue;
          const ring = transformedRing(canonR, focusA);
          if (!ring || !isFinite(ring.r) || ring.r * scale > 8000) continue;
          // Every ply is a half-move (one side's move); a ring only lands on
          // a completed full move once both sides have moved, i.e. at an
          // even ply - so only those get labeled by default. Odd (half-move)
          // rings still exist and are still hoverable, just unlabeled for now.
          const major = ply % 2 === 0;
          const ringCx = cx + ring.x * scale, ringCy = cy + ring.y * scale, ringR = ring.r * scale;

          ctx!.strokeStyle = major ? ringMajorColor : colors.borderSoft;
          ctx!.lineWidth = major ? 1.2 : 0.75;
          ctx!.beginPath();
          ctx!.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
          ctx!.stroke();

          const hoverI = ringHoverIntensityRef.current.get(ply) ?? 0;
          const selectI = ringSelectIntensityRef.current.get(ply) ?? 0;
          const highlightI = Math.max(hoverI * 0.7, selectI);
          if (highlightI > 0.01) {
            ctx!.strokeStyle = hexToRgba(colors.accent, 0.12 + 0.68 * highlightI);
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
      const rendered = new Map<string, Complex>();
      for (const [id, pos] of canonRef.current) rendered.set(id, mobiusTranslate(pos, focusA));

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
          ? hexToRgba(colors.accent, 0.6)
          : parentIsHub
            ? hexToRgba(HUB_COLOR, 0.35)
            : colors.border;
        drawGeodesic(ctx!, p, q, cx, cy, scale, onMainLine ? colors.accent : parentIsHub ? HUB_COLOR : colors.textFaint);
      }

      renderedPosRef.current.clear();
      const now = performance.now();
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
        if (isHub(node)) ctx!.fillStyle = HUB_COLOR;
        else if (isBlackMove) ctx!.fillStyle = colors.background;
        else ctx!.fillStyle = hexToRgba(colors.text, brighten ? 1 : 0.35 + closeness * 0.5);
        ctx!.fill();

        if (isBlackMove && !isHub(node)) {
          ctx!.strokeStyle = hexToRgba(colors.text, brighten ? 1 : 0.4 + closeness * 0.5);
          ctx!.lineWidth = brighten ? 1.8 : 1.3;
          ctx!.beginPath();
          ctx!.arc(sx, sy, drawRadius, 0, Math.PI * 2);
          ctx!.stroke();
        }

        if (isFocus) {
          ctx!.strokeStyle = hexToRgba(colors.accent, 0.5);
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, drawRadius + 4, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (isCurrent) {
          ctx!.strokeStyle = colors.accent;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, drawRadius + 3, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (ringSpotlight > 0.01) {
          ctx!.strokeStyle = hexToRgba(colors.accent, 0.6 * ringSpotlight);
          ctx!.lineWidth = 1.6 * ringSpotlight;
          ctx!.beginPath();
          ctx!.arc(sx, sy, radius + 3, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (isHovered) {
          ctx!.strokeStyle = hexToRgba(colors.text, 0.55);
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

      // A node under the cursor always takes priority over a ring behind it.
      if (hit) {
        if (hoveredRingPlyRef.current !== null) {
          hoveredRingPlyRef.current = null;
          setHoveredRingPly(null);
        }
        return;
      }
      const { cx, cy, scale, focusA } = frameGeometry();
      const ringHit = hitTestRing(mx, my, cx, cy, scale, focusA);
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
        goToNodeRef.current(hit);
        setPinnedId(hit);
        setCardClosed(false);
        selectedRingPlyRef.current = null;
        setSelectedRingPly(null);
        return;
      }
      const { cx, cy, scale, focusA } = frameGeometry();
      const ringHit = hitTestRing(mx, my, cx, cy, scale, focusA);
      if (ringHit !== null) {
        const next = selectedRingPlyRef.current === ringHit ? null : ringHit;
        selectedRingPlyRef.current = next;
        setSelectedRingPly(next);
        setPinnedId(null);
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

  const previewNode = cardClosed
    ? null
    : pinnedId
      ? tree.nodes[pinnedId]
      : hoveredId
        ? tree.nodes[hoveredId]
        : (tree.nodes[currentNodeId] ?? null);

  return (
    // Fixed to the viewport rather than filling `main`'s flex space: the
    // sticky site header reserves a full h-14 of layout height even though
    // its own box renders nothing visible on desktop (the icon dial is
    // absolutely positioned starting at its bottom edge) - fixed-to-viewport
    // sidesteps that reserved gap entirely and reclaims the full screen.
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <div ref={stageRef} className="relative min-h-0 w-full flex-1 bg-background">
        {/* Absolutely positioned rather than a normal-flow block: a canvas
            is a replaced element, and its intrinsic/attribute size can leak
            into an ancestor flex item's content-based min-height even with
            `h-full` set, quietly growing the whole page taller than the
            viewport and making it scrollable. Taking it out of flow makes
            that impossible regardless of the exact resolution order. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full cursor-pointer touch-none"
        />

        {/* Top-center: the same move list as the board view - fixed width
            so it scrolls internally (MoveList's own overflow-x-auto)
            instead of growing without bound as the game gets longer.
            "Back to board" now lives in the main header's nav dial, next to
            the map's own entry there, rather than duplicated here. */}
        <div className="absolute top-3 left-1/2 z-20 w-[min(60vw,420px)] -translate-x-1/2 rounded-[14px] border border-border-soft bg-surface/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <MoveList
            currentLine={currentLine}
            currentNodeId={currentNodeId}
            onSelectNode={goToNode}
            onSelectStart={() => goToNode(tree.rootId)}
          />
        </div>

        {/* Top-right: whichever of the ring move-list / node preview card is
            currently showing (the two never show at once). */}
        <div className="absolute top-3 right-3 z-20 flex max-w-[min(70vw,320px)] flex-col items-end gap-2">
          {selectedRingPly !== null && nodesOnSelectedRing.length > 0 && (
            <div className="w-[220px] rounded-[14px] border border-accent bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-accent">
                  Move {nodesOnSelectedRing[0].moveNumber}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRingPly(null)}
                  aria-label="Close"
                  className="text-text-faint transition hover:text-text"
                >
                  ×
                </button>
              </div>
              <p className="mb-2 font-mono text-xs text-text-faint">
                ply {selectedRingPly} · {nodesOnSelectedRing.length} move{nodesOnSelectedRing.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-col gap-1">
                {nodesOnSelectedRing.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => goToNode(node.id)}
                    className="rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-left text-sm text-text-dim transition hover:border-accent hover:text-text"
                    style={isHub(node) ? { color: HUB_COLOR } : undefined}
                  >
                    {nodeLabel(node)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {previewNode && (
            <div className="w-[220px] rounded-[14px] border border-border bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="font-mono text-sm font-bold text-text"
                  style={isHub(previewNode) ? { color: HUB_COLOR } : undefined}
                >
                  {nodeLabel(previewNode) === "Start" ? "Start position" : nodeLabel(previewNode)}
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-text-faint">
                  {previewNode.ply ? `ply ${previewNode.ply}` : ""}
                  <button
                    type="button"
                    onClick={() => {
                      setPinnedId(null);
                      setCardClosed(true);
                    }}
                    aria-label="Close"
                    className="text-text-faint transition hover:text-text"
                  >
                    ×
                  </button>
                </span>
              </div>

              <PlayableMiniBoard
                node={previewNode}
                tree={tree}
                animateEntry={pinnedId === previewNode.id}
                onMove={setPinnedId}
              />

              {previewNode.parentId && (
                <button
                  type="button"
                  onClick={() => {
                    const parentId = previewNode.parentId!;
                    goToNode(parentId);
                    setPinnedId(parentId);
                  }}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-center text-sm text-text-dim transition hover:border-accent hover:text-text"
                >
                  ← Back
                </button>
              )}
              {isHub(previewNode) && (
                <p className="mt-2 text-center text-xs" style={{ color: HUB_COLOR }}>
                  {previewNode.children.length}-way fork
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom-left: the optional compaction/rings/stats panel above the
            static hint text, both anchored to the same corner as a group. */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[min(80vw,260px)] flex-col gap-2">
          {(showStatsPanel || showCompactionPanel || showRingsTogglePanel) && (
            <div className="pointer-events-auto flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              {showStatsPanel && (
                <div className="flex flex-wrap gap-2">
                  <StatPill label="Nodes" value={String(totalNodes)} />
                  <StatPill label="Focus ply" value={String(tree.nodes[focusId]?.ply ?? 0)} />
                  <StatPill label="Widest fork" value={widestFork >= 3 ? `${widestFork}-way` : "—"} accent />
                </div>
              )}
              {showCompactionPanel && (
                <div className="flex items-center gap-2 text-sm text-text-dim">
                  <label htmlFor="map-compaction" className="whitespace-nowrap">
                    Compaction
                  </label>
                  <input
                    id="map-compaction"
                    type="range"
                    min={K_MIN * 1000}
                    max={K_MAX * 1000}
                    value={k * 1000}
                    onChange={(e) => setK(Number(e.target.value) / 1000)}
                    className="flex-1 accent-accent"
                  />
                </div>
              )}
              {showRingsTogglePanel && (
                <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-text-dim">
                  <input
                    type="checkbox"
                    checked={showRings}
                    onChange={(e) => setShowRings(e.target.checked)}
                    className="accent-accent"
                  />
                  depth rings
                </label>
              )}
            </div>
          )}

          <div className="max-w-[60ch] text-[0.74rem] text-text-faint">
            <b className="text-text-dim">Click</b> a node to go to that move ·{" "}
            <b className="text-text-dim">click a ring</b> to see every move on it ·{" "}
            <b className="text-text-dim">scroll</b> to change compaction
          </div>
        </div>

        {/* Bottom-right: the settings trigger, floating the same way the
            site's own nav icons already do - nothing else needs to reserve
            layout space for it, so the map can fill the whole screen. */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Map settings"
          className="absolute right-3 bottom-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-dim shadow-lg transition hover:text-text"
        >
          <FaGear />
        </button>

        {hoveredRingPly !== null && selectedRingPly === null && ringTooltipPos && hoveredRingSample && (
          <div
            className="pointer-events-none absolute z-20 rounded-md border border-accent bg-surface-raised px-2 py-1 font-mono text-xs text-text"
            style={{ left: ringTooltipPos.left, top: ringTooltipPos.top }}
          >
            Move {hoveredRingSample.moveNumber} · ply {hoveredRingPly}
          </div>
        )}
      </div>

      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="w-full max-w-sm">
          <header className="px-4 pt-3 pb-6">
            <h2 className="text-xl font-bold text-text">Map settings</h2>
          </header>

          <div className="px-4">
            <SettingsItem
              item={{
                title: "Node/ply/fork counters",
                content: (
                  <SettingsToggle
                    setting={{
                      label: "Node/ply/fork counters",
                      isSelected: showStatsPanel,
                      onChange: setShowStatsPanel,
                    }}
                  />
                ),
              }}
            />
            <SettingsItem
              item={{
                title: "Compaction slider",
                content: (
                  <SettingsToggle
                    setting={{
                      label: "Compaction slider",
                      isSelected: showCompactionPanel,
                      onChange: setShowCompactionPanel,
                    }}
                  />
                ),
              }}
            />
            <SettingsItem
              item={{
                title: "Depth rings toggle",
                content: (
                  <SettingsToggle
                    setting={{
                      label: "Depth rings toggle",
                      isSelected: showRingsTogglePanel,
                      onChange: setShowRingsTogglePanel,
                    }}
                  />
                ),
              }}
            />
          </div>

          <div className="flex justify-end px-4 pt-6 pb-3">
            <button
              onClick={() => setSettingsOpen(false)}
              className="rounded-lg bg-surface-raised px-4 py-2 text-sm font-medium text-text transition hover:brightness-110 focus:ring-2 focus:ring-border focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
