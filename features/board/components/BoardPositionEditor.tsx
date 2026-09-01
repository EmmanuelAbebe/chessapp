"use client";

import { useMemo, useState } from "react";
import { Chessboard, ChessboardProvider, SparePiece } from "react-chessboard";
import type { PieceDropHandlerArgs, PositionDataType } from "react-chessboard";
import { boardTheme } from "../lib/board-theme";
import { fenToPositionData, positionDataToFen } from "../lib/board-helpers";

const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Same row on both sides of the board, mirrored in color - an infinite
// supply of each, so dragging one onto the board never depletes it.
const SPARE_PIECE_TYPES = ["K", "Q", "R", "B", "N", "P"];

type BoardPositionEditorProps = {
  initialFen: string;
  onStart: (fen: string) => void;
  onCancel: () => void;
};

export function BoardPositionEditor({
  initialFen,
  onStart,
  onCancel,
}: BoardPositionEditorProps) {
  const [position, setPosition] = useState<PositionDataType>(() =>
    fenToPositionData(initialFen),
  );
  const [sideToMove, setSideToMove] = useState<"w" | "b">(() =>
    initialFen.split(" ")[1] === "b" ? "b" : "w",
  );
  const [error, setError] = useState<string | null>(null);

  function handlePieceDrop({
    piece,
    sourceSquare,
    targetSquare,
  }: PieceDropHandlerArgs) {
    setError(null);
    setPosition((prev) => {
      const next = { ...prev };
      if (!piece.isSparePiece) delete next[sourceSquare];
      if (targetSquare) next[targetSquare] = { pieceType: piece.pieceType };
      return next;
    });
    return true;
  }

  const options = useMemo(
    () => ({
      id: "position-editor",
      position,
      onPieceDrop: handlePieceDrop,
      allowDragging: true,
      allowDragOffBoard: true,
      allowDrawingArrows: false,
      darkSquareStyle: boardTheme.darkSquareStyle,
      lightSquareStyle: boardTheme.lightSquareStyle,
      boardStyle: boardTheme.boardStyle,
    }),
    [position],
  );

  function handleStart() {
    try {
      const fen = positionDataToFen(position, sideToMove);
      onStart(fen);
    } catch {
      setError("Every position needs exactly one king per side.");
    }
  }

  function resetToStartingPosition() {
    setPosition(fenToPositionData(STANDARD_START_FEN));
    setSideToMove("w");
    setError(null);
  }

  function clearBoard() {
    setPosition({});
    setError(null);
  }

  return (
    <div className="mx-auto flex w-(--board-size) flex-col gap-2">
      <ChessboardProvider options={options}>
        <div className="flex justify-center gap-1">
          {SPARE_PIECE_TYPES.map((type) => (
            <div
              key={`b${type}`}
              className="aspect-square w-[calc(var(--board-size)/8)]"
            >
              <SparePiece pieceType={`b${type}`} />
            </div>
          ))}
        </div>

        <div className="h-(--board-size) w-(--board-size) shrink-0 rounded">
          <Chessboard options={options} />
        </div>

        <div className="flex justify-center gap-1">
          {SPARE_PIECE_TYPES.map((type) => (
            <div
              key={`w${type}`}
              className="aspect-square w-[calc(var(--board-size)/8)]"
            >
              <SparePiece pieceType={`w${type}`} />
            </div>
          ))}
        </div>
      </ChessboardProvider>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={resetToStartingPosition}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
        >
          Starting position
        </button>

        <button
          type="button"
          onClick={clearBoard}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
        >
          Clear board
        </button>

        <div className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
          <button
            type="button"
            onClick={() => setSideToMove("w")}
            aria-pressed={sideToMove === "w"}
            className={`px-3 py-1.5 transition ${
              sideToMove === "w"
                ? "bg-accent/10 text-text"
                : "text-text-dim hover:text-text"
            }`}
          >
            White to move
          </button>
          <button
            type="button"
            onClick={() => setSideToMove("b")}
            aria-pressed={sideToMove === "b"}
            className={`px-3 py-1.5 transition ${
              sideToMove === "b"
                ? "bg-accent/10 text-text"
                : "text-text-dim hover:text-text"
            }`}
          >
            Black to move
          </button>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-text transition hover:brightness-110"
        >
          Start
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
