"use client";

import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FaCaretLeft, FaFish } from "react-icons/fa6";
import { GrConfigure } from "react-icons/gr";
import Modal from "@/components/ui/Modal";
import SettingsItem from "@/features/settings/components/SettingsItem";
import SettingsToggle from "@/features/settings/components/SettingsToggle";
import { useBoardGameContext } from "../BoardGameContext";
import { K_MAX, K_MIN, useMoveTreeCanvas } from "../hooks/useMoveTreeCanvas";
import { HUB_COLOR, isHub, nodeLabel } from "../lib/move-tree-map-helpers";
import type { MoveNode } from "../types";
import { MoveList } from "./MoveList";
import { PlayableMiniBoard } from "./PlayableMiniBoard";
import { StatPill } from "./StatPill";

export function MoveTreeMap() {
  const {
    tree,
    currentNodeId,
    currentLine,
    goToNode,
    startVsStockfish,
    skillLevel,
    changeOrientation,
    isEngineThinking,
  } = useBoardGameContext();

  // Jumps the live game to the previewed node and hands it to Stockfish -
  // the point during analysis is picking up play from *this* position, not
  // whatever the engine would've reached on its own, so the human side is
  // whoever's actually on the move here. Stays right here on the map (no
  // navigation) - pinning the node keeps the preview card following the
  // game as it continues, on this page or after switching to the board and
  // back, exactly like any other in-progress game.
  function playFromNode(node: MoveNode) {
    const sideToMove = node.fen.split(" ")[1] === "b" ? "black" : "white";
    goToNode(node.id);
    setPinnedId(node.id);
    startVsStockfish(sideToMove, skillLevel);
    changeOrientation(sideToMove);
  }

  const {
    stageRef,
    canvasRef,
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
    hoveredRingPly,
    ringTooltipPos,
    selectedRingPly,
    setSelectedRingPly,
    totalNodes,
    maxPly,
    widestFork,
  } = useMoveTreeCanvas(tree, currentNodeId, goToNode);

  // The compaction slider, depth-rings checkbox, and node/ply/fork counters
  // are secondary controls most sessions never touch - hidden by default to
  // save space, individually toggleable from the settings modal, and shown
  // as a floating panel (top-left) instead of permanent page rows when on.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showCompactionPanel, setShowCompactionPanel] = useState(false);
  const [showRingsTogglePanel, setShowRingsTogglePanel] = useState(false);
  // Roughly 5 rows by default (32px row + 4px gap each) - draggable from a
  // handle at the bottom of the list itself, since a heavily-explored ply
  // could have far more moves than fit comfortably at once.
  const [ringListHeight, setRingListHeight] = useState(176);
  // The preview card's width (it's aspect-square, so this drives its whole
  // size) - draggable from a handle on its left edge, the one that actually
  // moves as it grows since the card itself is right-anchored.
  const [previewWidth, setPreviewWidth] = useState(220);

  const nodesOnSelectedRing = useMemo(() => {
    if (selectedRingPly === null) return [];
    return Object.values(tree.nodes).filter((n) => n.ply === selectedRingPly);
  }, [tree, selectedRingPly]);

  const hoveredRingSample = useMemo(() => {
    if (hoveredRingPly === null) return null;
    return (
      Object.values(tree.nodes).find((n) => n.ply === hoveredRingPly) ?? null
    );
  }, [tree, hoveredRingPly]);

  // Plain window listeners for the duration of one drag rather than a
  // persistent effect - simpler than tracking "is dragging" as state just
  // to conditionally attach/detach these.
  function startRingListResize(e: ReactPointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = ringListHeight;
    function onMove(moveEvent: PointerEvent) {
      const next = Math.min(
        480,
        Math.max(64, startHeight + (moveEvent.clientY - startY)),
      );
      setRingListHeight(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // The card is right-anchored (`items-end`), so its right edge never moves
  // - only the left edge does as it grows. Dragging left has to mean
  // "bigger" for the handle to track the cursor instead of running away.
  function startPreviewResize(e: ReactPointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = previewWidth;
    function onMove(moveEvent: PointerEvent) {
      const next = Math.min(
        380,
        Math.max(160, startWidth + (startX - moveEvent.clientX)),
      );
      setPreviewWidth(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

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
      <div
        ref={stageRef}
        className="relative min-h-0 w-full flex-1 bg-background"
      >
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
            the map's own entry there, rather than duplicated here. Flush
            against the very top edge with no card styling of its own, so
            it reads as part of the page chrome rather than a floating panel. */}
        <div className="absolute top-0 left-1/2 z-20 w-[min(60vw,420px)] -translate-x-1/2 px-2 py-1.5">
          <MoveList
            currentLine={currentLine}
            currentNodeId={currentNodeId}
            onSelectNode={goToNode}
            onSelectStart={() => goToNode(tree.rootId)}
          />
        </div>

        {/* Top-right: the node preview card above the ring move-list - the
            two are independent now (either, neither, or both can show), not
            an either/or, so which is "on top" actually matters. */}
        <div className="absolute top-3 right-3 z-20 flex max-w-[min(80vw,460px)] flex-col items-end gap-2">
          {previewNode && (
            <div
              className="relative flex flex-col gap-1.5"
              style={{ width: previewWidth }}
            >
              {/* Left-edge handle, sitting just outside the card rather than
                  over its content - it's the edge that actually moves as the
                  (right-anchored) card grows, and staying clear of the board
                  means it never steals clicks meant for a move. */}
              <div
                onPointerDown={startPreviewResize}
                aria-hidden="true"
                className="absolute top-1/2 -left-3 z-10 flex h-10 w-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center"
              >
                <div className="h-8 w-1 rounded-full bg-border" />
              </div>

              {/* Above the board rather than overlaid on it - it's a card
                  action, not a move-in-progress control, so it shouldn't
                  compete with the board's own squares for clicks. */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => playFromNode(previewNode)}
                  aria-label="Play against Stockfish from here"
                  title="Play against Stockfish from here"
                  className="relative flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface/90 text-xs text-text-dim shadow transition hover:border-accent hover:text-text"
                >
                  <FaFish />
                  {isEngineThinking && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent"
                    />
                  )}
                </button>
              </div>

              <PlayableMiniBoard
                node={previewNode}
                tree={tree}
                animateEntry={pinnedId === previewNode.id}
                onMove={setPinnedId}
              />

              {/* Bottom bar: back, the move that got here, and whose turn is
                  next - everything about the previewed position in one row
                  under the board instead of scattered around its edges. */}
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  {previewNode.parentId && (
                    <button
                      type="button"
                      onClick={() => {
                        const parentId = previewNode.parentId!;
                        goToNode(parentId);
                        setPinnedId(parentId);
                      }}
                      aria-label="Back"
                      title="Back"
                      className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-text-dim transition hover:border-accent hover:text-text"
                    >
                      <FaCaretLeft />
                    </button>
                  )}
                  <span
                    className="truncate font-mono text-sm font-bold text-text"
                    style={
                      isHub(previewNode) ? { color: HUB_COLOR } : undefined
                    }
                  >
                    {nodeLabel(previewNode) === "Start"
                      ? "Start position"
                      : nodeLabel(previewNode)}
                  </span>
                </div>
                <span
                  aria-label={
                    previewNode.fen.split(" ")[1] === "b"
                      ? "Black to move"
                      : "White to move"
                  }
                  title={
                    previewNode.fen.split(" ")[1] === "b"
                      ? "Black to move"
                      : "White to move"
                  }
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-soft"
                  style={{
                    background:
                      previewNode.fen.split(" ")[1] === "b"
                        ? "#1a1a1a"
                        : "#f2f2f2",
                  }}
                />
              </div>

            </div>
          )}

          {selectedRingPly !== null && nodesOnSelectedRing.length > 0 && (
            <div className="flex w-55 flex-col rounded-[14px] border border-accent bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
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
                ply {selectedRingPly} · {nodesOnSelectedRing.length} move
                {nodesOnSelectedRing.length === 1 ? "" : "s"}
              </p>

              {/* Capped to roughly 5 rows by default and scrollable beyond
                  that - a heavily-explored ply could otherwise grow this
                  panel past the whole screen. Draggable from the handle
                  below since "5" won't be the right amount for everyone. */}
              <div
                className="flex flex-col gap-1 overflow-y-auto"
                style={{ height: ringListHeight }}
              >
                {nodesOnSelectedRing.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => goToNode(node.id)}
                    onMouseEnter={() => {
                      setHoveredId(node.id);
                      hoverStartRef.current = performance.now();
                    }}
                    onMouseLeave={() =>
                      setHoveredId((current) => (pinnedId ? current : null))
                    }
                    className="shrink-0 rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-left text-sm text-text-dim transition hover:border-accent hover:text-text"
                    style={isHub(node) ? { color: HUB_COLOR } : undefined}
                  >
                    {nodeLabel(node)}
                  </button>
                ))}
              </div>

              <div
                onPointerDown={startRingListResize}
                aria-hidden="true"
                className="-mb-1 flex h-3 shrink-0 cursor-ns-resize touch-none items-center justify-center"
              >
                <div className="h-1 w-8 rounded-full bg-border" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom-left: the optional compaction/rings/stats panel above the
            static hint text, both anchored to the same corner as a group. */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[min(80vw,260px)] flex-col gap-2">
          {(showStatsPanel || showCompactionPanel || showRingsTogglePanel) && (
            <div className="pointer-events-auto flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              {showStatsPanel && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-2">
                    <StatPill label="Nodes" value={String(totalNodes)} />
                    <StatPill
                      label="Focus ply"
                      value={String(tree.nodes[focusId]?.ply ?? 0)}
                    />
                    <StatPill
                      label="Widest fork"
                      value={widestFork >= 3 ? `${widestFork}-way` : "—"}
                      accent
                    />
                  </div>
                  {previewNode && isHub(previewNode) && (
                    <p className="text-xs" style={{ color: HUB_COLOR }}>
                      {previewNode.children.length}-way fork
                    </p>
                  )}
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
            <b className="text-text-dim">click a ring</b> to see every move on
            it · <b className="text-text-dim">scroll</b> to change compaction
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
          <GrConfigure />
        </button>

        {hoveredRingPly !== null &&
          selectedRingPly === null &&
          ringTooltipPos &&
          hoveredRingSample && (
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
