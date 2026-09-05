"use client";

import { useMemo, useState } from "react";
import { FaFileImport } from "react-icons/fa6";
import { GrConfigure } from "react-icons/gr";
import { useBoardGameContext } from "../../BoardGameContext";
import { useMoveTreeCanvas } from "../../hooks/map/useMoveTreeCanvas";
import { computeNodeOutcomeStats } from "../../lib/map/node-stats";
import type { MoveNode } from "../../types";
import { useGameHistory } from "@/features/history/useGameHistory";
import { MapImportGamesModal } from "./MapImportGamesModal";
import { MapPreviewCard } from "./MapPreviewCard";
import { MapRingListPanel } from "./MapRingListPanel";
import { MapSettingsModal } from "./MapSettingsModal";
import { MapStatsPanel } from "./MapStatsPanel";
import { MoveList } from "../MoveList";

export function MoveTreeMap() {
  const {
    tree,
    currentNodeId,
    currentLine,
    goToNode,
    startVsStockfish,
    startAnalysis,
    skillLevel,
    changeOrientation,
    resetBoard,
    loadTree,
    isEngineThinking,
    isPlayingStockfish: isEngineOn,
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

  // Re-roots the whole tree at the previewed node - useful for studying a
  // line starting deep into an opening, or an endgame tactic that isn't
  // reachable by playing from move 1 at all (see resetBoard/resetTree/
  // createMoveTree, which already accepted a starting fen - this is just
  // the first thing that actually passes one through). Drops out of an
  // active Stockfish game first, since re-rooting elsewhere with an
  // engine opponent still attached to the old tree wouldn't make sense.
  function setNodeAsStart(node: MoveNode) {
    resetBoard(node.fen);
    startAnalysis();
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
    mapColors,
    setMapColor,
    resetMapColors,
    maxDisplayPly,
    setMaxDisplayPly,
  } = useMoveTreeCanvas(tree, currentNodeId, goToNode);

  // The compaction slider, depth-rings checkbox, and node/ply/fork counters
  // are secondary controls most sessions never touch - hidden by default to
  // save space, individually toggleable from the settings modal, and shown
  // as a floating panel (top-left) instead of permanent page rows when on.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showCompactionPanel, setShowCompactionPanel] = useState(false);
  const [showRingsTogglePanel, setShowRingsTogglePanel] = useState(false);
  const [showMoveListPanel, setShowMoveListPanel] = useState(false);

  // How many of the player's own recorded games (Statistics history)
  // reached each position, and what happened in them - drives both the
  // previewed node's stats line and the ring list's per-move win rates.
  const { games, addGames } = useGameHistory();
  const nodeStats = useMemo(() => computeNodeOutcomeStats(tree, games), [tree, games]);

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

  const previewNode = cardClosed
    ? null
    : pinnedId
      ? tree.nodes[pinnedId]
      : hoveredId
        ? tree.nodes[hoveredId]
        : (tree.nodes[currentNodeId] ?? null);

  return (
    // Desktop: fixed to the viewport, exactly one screen, nothing scrolls -
    // the ring move-list (see below) has to fit into the floating top-right
    // stack there instead. Mobile: plain flow at a full-screen-tall first
    // section instead, so that same ring list can go below it as a normal
    // block the user scrolls down to, rather than fighting it for room in
    // an already-cramped corner.
    <div className="flex min-h-dvh flex-col sm:fixed sm:inset-0 sm:overflow-hidden">
      <div
        ref={stageRef}
        className="relative h-dvh w-full shrink-0 bg-background sm:h-auto sm:min-h-0 sm:flex-1"
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

        {/* Top-center: off by default (see the settings modal) - when on,
            the exact same row (height, scroll behavior) the board view
            wraps its own MoveList in, just without that view's eval label
            or nav arrows, which don't have an equivalent here. */}
        {showMoveListPanel && (
          <div className="absolute top-0 left-1/2 z-20 w-[min(60vw,420px)] -translate-x-1/2 px-2">
            <div className="flex h-9 w-full items-center">
              <div className="min-w-0 flex-1">
                <MoveList
                  currentLine={currentLine}
                  currentNodeId={currentNodeId}
                  onSelectNode={goToNode}
                  onSelectStart={() => goToNode(tree.rootId)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Top-right: the node preview card above the ring move-list - the
            two are independent now (either, neither, or both can show), not
            an either/or, so which is "on top" actually matters. */}
        <div className="absolute top-3 right-3 z-20 flex max-w-[min(80vw,460px)] flex-col items-end gap-2">
          {previewNode && (
            <MapPreviewCard
              node={previewNode}
              tree={tree}
              stats={nodeStats[previewNode.id]}
              pinnedId={pinnedId}
              setPinnedId={setPinnedId}
              goToNode={goToNode}
              isEngineOn={isEngineOn}
              isEngineThinking={isEngineThinking}
              onPlayFromHere={playFromNode}
              onSetAsStart={setNodeAsStart}
            />
          )}

          {/* Desktop only - see the mobile copy below the map for why this
              one is `hidden` there instead of just being the only copy. */}
          <MapRingListPanel
            variant="floating"
            selectedRingPly={selectedRingPly}
            nodesOnSelectedRing={nodesOnSelectedRing}
            nodeStats={nodeStats}
            onClose={() => setSelectedRingPly(null)}
            goToNode={goToNode}
            setHoveredId={setHoveredId}
            hoverStartRef={hoverStartRef}
            pinnedId={pinnedId}
          />
        </div>

        <MapStatsPanel
          showStatsPanel={showStatsPanel}
          showCompactionPanel={showCompactionPanel}
          showRingsTogglePanel={showRingsTogglePanel}
          totalNodes={totalNodes}
          focusPly={tree.nodes[focusId]?.ply ?? 0}
          widestFork={widestFork}
          k={k}
          setK={setK}
          maxDisplayPly={maxDisplayPly}
          setMaxDisplayPly={setMaxDisplayPly}
          maxPly={maxPly}
          showRings={showRings}
          setShowRings={setShowRings}
        />

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

        {/* Bottom-right, just left of the settings trigger - bottom-left
            is already the map's own hint text, so this pairs with the
            other floating icon instead. Bulk game import lives here,
            not the board page's own icon menu, since it merges into the
            shared tree rather than starting or reviewing any one game. */}
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          aria-label="Import games"
          className="absolute right-16 bottom-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-dim shadow-lg transition hover:text-text"
        >
          <FaFileImport />
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

      {/* Mobile only - the map above is already a full screen on its own,
          so this sits below it as a normal block instead of squeezed into
          a floating corner; scrolling down is how it's reached. */}
      <MapRingListPanel
        variant="inline"
        selectedRingPly={selectedRingPly}
        nodesOnSelectedRing={nodesOnSelectedRing}
        nodeStats={nodeStats}
        onClose={() => setSelectedRingPly(null)}
        goToNode={goToNode}
        setHoveredId={setHoveredId}
        hoverStartRef={hoverStartRef}
        pinnedId={pinnedId}
      />

      <MapImportGamesModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        tree={tree}
        onMerge={loadTree}
        addGames={addGames}
      />

      <MapSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        showStatsPanel={showStatsPanel}
        setShowStatsPanel={setShowStatsPanel}
        showCompactionPanel={showCompactionPanel}
        setShowCompactionPanel={setShowCompactionPanel}
        showRingsTogglePanel={showRingsTogglePanel}
        setShowRingsTogglePanel={setShowRingsTogglePanel}
        showMoveListPanel={showMoveListPanel}
        setShowMoveListPanel={setShowMoveListPanel}
        mapColors={mapColors}
        setMapColor={setMapColor}
        resetMapColors={resetMapColors}
      />
    </div>
  );
}
