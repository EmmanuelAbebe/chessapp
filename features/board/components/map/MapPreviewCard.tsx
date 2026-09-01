"use client";

import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Chess } from "chess.js";
import { FaUndo } from "react-icons/fa";
import { FaFish, FaFlag } from "react-icons/fa6";
import { EvalBar } from "../EvalBar";
import { useEvalScore } from "../../hooks/useEvalScore";
import { MapNodeDetails } from "./MapNodeDetails";
import { PlayableMiniBoard } from "./PlayableMiniBoard";
import type { MoveNode, MoveTreeState } from "../../types";

const ANALYSIS_DEPTH = 12;
// Settling delay before a previewed node's position actually gets sent to
// the engine - sweeping the cursor across several nodes a second would
// otherwise restart the search that many times a second too.
const HOVER_SETTLE_MS = 200;

// The top-right node preview card: a resize handle, the play-vs-Stockfish
// and set-as-start-position buttons, a back+turn-indicator row, the
// playable mini board, and its details panel. Width is owned here (not
// lifted to MoveTreeMap) since nothing outside this card ever needs to
// know it.
export function MapPreviewCard({
  node,
  tree,
  pinnedId,
  setPinnedId,
  goToNode,
  isEngineOn,
  isEngineThinking,
  onPlayFromHere,
  onSetAsStart,
}: {
  node: MoveNode;
  tree: MoveTreeState;
  pinnedId: string | null;
  setPinnedId: (id: string | null) => void;
  goToNode: (nodeId: string) => void;
  isEngineOn: boolean;
  isEngineThinking: boolean;
  onPlayFromHere: (node: MoveNode) => void;
  onSetAsStart: (node: MoveNode) => void;
}) {
  // The preview card's width (it's aspect-square, so this drives its whole
  // size) - draggable from a handle on its left edge, the one that actually
  // moves as it grows since the card itself is right-anchored.
  const [previewWidth, setPreviewWidth] = useState(220);

  // Settles on `node.fen` 200ms after it stops changing, so hovering across
  // several nodes in a row doesn't restart the engine search that many
  // times a second - shared by the eval bar and the best-move pill below,
  // which would otherwise each need (and each separately run) their own copy.
  const [settledFen, setSettledFen] = useState(node.fen);
  useEffect(() => {
    const timeout = setTimeout(() => setSettledFen(node.fen), HOVER_SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [node.fen]);
  const isSettled = settledFen === node.fen;
  const evalScore = useEvalScore(settledFen, ANALYSIS_DEPTH, true);

  const bestMoveSan = (() => {
    if (!isSettled || !evalScore.bestMove) return null;
    try {
      const chess = new Chess(settledFen);
      const move = chess.move({
        from: evalScore.bestMove.slice(0, 2),
        to: evalScore.bestMove.slice(2, 4),
        promotion: evalScore.bestMove.slice(4) || undefined,
      });
      return move?.san ?? null;
    } catch {
      return null;
    }
  })();

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

  return (
    <div
      className="relative flex flex-col gap-1.5"
      style={{ width: previewWidth }}
    >
      {/* Left-edge handle, sitting just outside the card rather than over
          its content - it's the edge that actually moves as the
          (right-anchored) card grows, and staying clear of the board means
          it never steals clicks meant for a move. */}
      <div
        onPointerDown={startPreviewResize}
        aria-hidden="true"
        className="absolute top-1/2 -left-3 z-10 flex h-10 w-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center"
      >
        <div className="h-8 w-1 rounded-full bg-border" />
      </div>

      {/* Above the board rather than overlaid on it - it's a row of card
          actions/status, not move-in-progress controls, so it shouldn't
          compete with the board's own squares for clicks. Fish stays on the
          left; back and the turn indicator sit together on the right, in
          that order. Which move got here is shown on the board itself now
          (see PlayableMiniBoard's own last-move highlight) rather than as a
          text label. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-label={
              node.fen.split(" ")[1] === "b" ? "Black to move" : "White to move"
            }
            title={
              node.fen.split(" ")[1] === "b" ? "Black to move" : "White to move"
            }
            className="h-3.5 w-3.5 shrink-0 rounded-sm border border-border-soft"
            style={{
              background:
                node.fen.split(" ")[1] === "b" ? "#1a1a1a" : "#f2f2f2",
            }}
          />
          <button
            type="button"
            onClick={() => onPlayFromHere(node)}
            aria-label={
              isEngineOn
                ? "Playing against Stockfish"
                : "Play against Stockfish from here"
            }
            title={
              isEngineOn
                ? "Playing against Stockfish"
                : "Play against Stockfish from here"
            }
            className={`relative flex h-6 w-6 items-center text-gray-300 justify-center rounded-full text-xs shadow transition hover:border hover:border-accent hover:text-text ${
              isEngineOn
                ? "text-green-500"
                : "border-border bg-surface/90 opacity-70"
            }`}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSetAsStart(node)}
            aria-label="Set as start position"
            title="Set as start position - re-roots the whole tree here"
            className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-text-dim transition hover:border-accent hover:text-text"
          >
            <FaFlag />
          </button>
          <button
            type="button"
            onClick={() => {
              const parentId = node.parentId!;
              goToNode(parentId);
              setPinnedId(parentId);
            }}
            disabled={!node.parentId}
            aria-label="Back"
            title="Back"
            className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-text-dim transition hover:border-accent hover:text-text disabled:opacity-50 disabled:pointer-events-none"
          >
            <FaUndo />
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <EvalBar
          visible={isSettled}
          whitePercent={evalScore.whitePercent}
          depth={evalScore.depth}
          bestMove={evalScore.bestMove}
        />

        <div className="min-w-0 flex-1">
          <PlayableMiniBoard
            node={node}
            tree={tree}
            animateEntry={pinnedId === node.id}
            onMove={setPinnedId}
          />
        </div>
      </div>

      <MapNodeDetails bestMoveSan={bestMoveSan} isSettled={isSettled} />
    </div>
  );
}
