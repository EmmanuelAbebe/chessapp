"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa6";
import { defaultPieces } from "react-chessboard";
import { useBoardGameContext } from "../BoardGameContext";
import { computeHyperbolicLayout } from "../lib/move-tree-hyperbolic-layout";
import { drawGeodesic, lerpComplex, mobiusTranslate, transformedRing, type Complex } from "../lib/poincare-disk";
import type { MoveNode, MoveTreeState } from "../types";

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

function MiniBoard({ fen }: { fen: string }) {
  const rows = fen.split(" ")[0]?.split("/") ?? [];
  const squares: { file: number; rank: number; piece: string | null }[] = [];

  rows.forEach((row, rankIdx) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) {
          squares.push({ file, rank: rankIdx, piece: null });
          file++;
        }
      } else {
        squares.push({ file, rank: rankIdx, piece: ch });
        file++;
      }
    }
  });

  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md border border-border-soft">
      {squares.map(({ file, rank, piece }) => {
        const light = (file + rank) % 2 === 0;
        const side = piece ? (piece === piece.toUpperCase() ? "w" : "b") : null;
        const letter = piece ? piece.toUpperCase() : null;
        const Icon = side && letter ? defaultPieces[`${side}${letter}` as keyof typeof defaultPieces] : null;

        return (
          <div
            key={`${file}-${rank}`}
            className={`flex items-center justify-center ${light ? "bg-[#d7dbc8]" : "bg-[#7a8a5c]"}`}
          >
            {Icon && (
              <span className="block h-[85%] w-[85%]">
                <Icon />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type FocusAnim = { from: Complex; toId: string; start: number };

export function MoveTreeMap() {
  const { tree, currentNodeId, goToNode } = useBoardGameContext();

  const [focusId, setFocusId] = useState(currentNodeId);
  const [k, setK] = useState(K_DEFAULT);
  const [showRings, setShowRings] = useState(true);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ left: number; top: number } | null>(null);

  // The map always follows the live game position - clicking elsewhere in
  // the tree only moves the view (see doSetFocus), never the actual game,
  // so this never fights a deliberate look-around.
  useEffect(() => {
    if (tree.nodes[currentNodeId]) doSetFocus(currentNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const breadcrumb = useMemo(() => getBreadcrumb(tree, focusId), [tree, focusId]);

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
  const renderedPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());

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
  const showRingsRef = useRef(showRings);
  const canonRef = useRef(canon);
  const treeRef = useRef(tree);
  const focusIdRef = useRef(focusId);
  const currentNodeIdRef = useRef(currentNodeId);
  const kRef = useRef(k);
  const maxPlyRef = useRef(maxPly);
  hoveredIdRef.current = hoveredId;
  pinnedIdRef.current = pinnedId;
  showRingsRef.current = showRings;
  canonRef.current = canon;
  treeRef.current = tree;
  focusIdRef.current = focusId;
  currentNodeIdRef.current = currentNodeId;
  kRef.current = k;
  maxPlyRef.current = maxPly;

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

  function updatePreviewPosition(id: string) {
    const stage = stageRef.current;
    const pos = renderedPosRef.current.get(id);
    if (!stage || !pos) return;
    const rect = stage.getBoundingClientRect();
    const cardW = 220, cardH = 320;
    const left = Math.min(Math.max(pos.x + 16, 8), rect.width - cardW - 8);
    const top = Math.min(Math.max(pos.y - cardH / 2, 8), rect.height - cardH - 8);
    setPreviewPos({ left, top });
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

    let raf = 0;
    function draw() {
      const rect = stage!.getBoundingClientRect();
      const dpr = devicePixelRatio;
      ctx!.save();
      ctx!.scale(dpr, dpr);
      ctx!.clearRect(0, 0, rect.width, rect.height);

      const cx = rect.width / 2, cy = rect.height / 2;
      const scale = Math.min(rect.width, rect.height) / 2 * 0.92;
      const focusA = currentFocusComplex(performance.now());

      ctx!.strokeStyle = boundaryColor;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx!.stroke();

      if (showRingsRef.current) {
        for (let ply = 1; ply <= maxPlyRef.current; ply++) {
          const canonR = Math.tanh(kRef.current * ply);
          if (canonR > 0.999) continue;
          const ring = transformedRing(canonR, focusA);
          if (!ring || !isFinite(ring.r) || ring.r * scale > 8000) continue;
          const major = ply % 5 === 0 || ply === maxPly;
          ctx!.strokeStyle = major ? ringMajorColor : colors.borderSoft;
          ctx!.lineWidth = major ? 1.2 : 0.75;
          ctx!.beginPath();
          ctx!.arc(cx + ring.x * scale, cy + ring.y * scale, ring.r * scale, 0, Math.PI * 2);
          ctx!.stroke();
          if (major) {
            const lx = cx + ring.x * scale, ly = cy + (ring.y - ring.r) * scale;
            if (lx > -20 && lx < rect.width + 20 && ly > -20 && ly < rect.height + 20) {
              ctx!.font = "10px ui-monospace, monospace";
              ctx!.fillStyle = colors.textFaint;
              ctx!.textAlign = "center";
              ctx!.textBaseline = "middle";
              ctx!.fillText(String(ply), lx, ly);
            }
          }
        }
      }

      const currentTree = treeRef.current;
      const rendered = new Map<string, Complex>();
      for (const [id, pos] of canonRef.current) rendered.set(id, mobiusTranslate(pos, focusA));

      ctx!.lineWidth = 1.1;
      for (const id in currentTree.nodes) {
        const node = currentTree.nodes[id];
        if (!node.parentId) continue;
        const p = rendered.get(node.parentId), q = rendered.get(id);
        if (!p || !q) continue;
        ctx!.strokeStyle = isHub(currentTree.nodes[node.parentId]) ? hexToRgba(HUB_COLOR, 0.35) : colors.border;
        drawGeodesic(ctx!, p, q, cx, cy, scale);
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
        const closeness = 1 - Math.min(1, mag);
        const radius = isFocus ? 7 : 2 + closeness * 8;

        ctx!.beginPath();
        ctx!.arc(sx, sy, radius, 0, Math.PI * 2);
        if (isFocus) ctx!.fillStyle = colors.accent;
        else if (id === hoveredIdRef.current) ctx!.fillStyle = colors.text;
        else if (isHub(node)) ctx!.fillStyle = HUB_COLOR;
        else ctx!.fillStyle = hexToRgba(colors.text, 0.35 + closeness * 0.5);
        ctx!.fill();

        if (isFocus) {
          ctx!.strokeStyle = hexToRgba(colors.accent, 0.5);
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, radius + 4, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (isCurrent) {
          ctx!.strokeStyle = colors.accent;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, radius + 3, 0, Math.PI * 2);
          ctx!.stroke();
        }

        const labelOpacity = Math.max(0, closeness * 0.9 - 0.05) + (isFocus ? 0.9 : 0);
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
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit !== hoveredIdRef.current) {
        setHoveredId(hit);
        if (hit && !pinnedIdRef.current) updatePreviewPosition(hit);
        if (!hit && !pinnedIdRef.current) setPreviewPos(null);
      } else if (hit) {
        updatePreviewPosition(hit);
      }
    }
    function onPointerLeave() {
      if (!pinnedIdRef.current) {
        setHoveredId(null);
        setPreviewPos(null);
      }
    }
    function onClick(e: MouseEvent) {
      const rect = stage!.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        doSetFocus(hit);
        setPinnedId(hit);
        updatePreviewPosition(hit);
      } else {
        setPinnedId(null);
        setPreviewPos(null);
      }
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

  const previewNode = pinnedId ? tree.nodes[pinnedId] : hoveredId ? tree.nodes[hoveredId] : null;

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-3 overflow-x-auto p-3 sm:p-4">
      <div className="flex w-full max-w-5xl flex-col gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/board"
            className="flex items-center gap-1.5 rounded text-sm text-text-faint transition hover:text-text"
          >
            <FaArrowLeft className="text-xs" />
            Board
          </Link>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-mono text-sm text-text-faint">
            {breadcrumb.map((node, i) => (
              <React.Fragment key={node.id}>
                {i > 0 && <span className="text-border">›</span>}
                {i === breadcrumb.length - 1 ? (
                  <span className="text-accent">{nodeLabel(node)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => doSetFocus(node.id)}
                    className="rounded px-1 py-0.5 text-text-dim hover:bg-surface-raised hover:text-text"
                  >
                    {nodeLabel(node)}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[10px] border border-border-soft bg-surface px-3 py-2 text-sm text-text-dim">
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
          <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showRings}
              onChange={(e) => setShowRings(e.target.checked)}
              className="accent-accent"
            />
            depth rings
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatPill label="Nodes" value={String(totalNodes)} />
          <StatPill label="Focus ply" value={String(tree.nodes[focusId]?.ply ?? 0)} />
          <StatPill label="Widest fork" value={widestFork >= 3 ? `${widestFork}-way` : "—"} accent />
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border-soft bg-background">
          <div ref={stageRef} className="relative h-[min(75vw,600px)] w-full bg-background">
            <canvas ref={canvasRef} className="block h-full w-full cursor-pointer touch-none" />

            <div className="pointer-events-none absolute bottom-3 left-3 max-w-[60ch] text-[0.74rem] text-text-faint">
              <b className="text-text-dim">Click</b> a node to bring it to center ·{" "}
              <b className="text-text-dim">scroll</b> to change compaction
            </div>

            {previewNode && previewPos && (
              <div
                className="absolute z-20 w-[220px] rounded-[14px] border border-border bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
                style={{ left: previewPos.left, top: previewPos.top }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="font-mono text-sm font-bold text-text"
                    style={isHub(previewNode) ? { color: HUB_COLOR } : undefined}
                  >
                    {nodeLabel(previewNode) === "Start" ? "Start position" : nodeLabel(previewNode)}
                  </span>
                  <span className="font-mono text-xs text-text-faint">
                    {previewNode.ply ? `ply ${previewNode.ply}` : ""}
                  </span>
                </div>

                <MiniBoard fen={previewNode.fen} />

                <button
                  type="button"
                  onClick={() => goToNode(previewNode.id)}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-center text-sm text-text-dim transition hover:border-accent hover:text-text"
                >
                  Go to this move
                </button>
                {isHub(previewNode) && (
                  <p className="mt-2 text-center text-xs" style={{ color: HUB_COLOR }}>
                    {previewNode.children.length}-way fork
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
