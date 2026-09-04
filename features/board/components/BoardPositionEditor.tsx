"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
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
  onAnalyze: (fen: string) => void;
  onPlayVsStockfish: (fen: string) => void;
  onCancel: () => void;
};

export function BoardPositionEditor({
  initialFen,
  onAnalyze,
  onPlayVsStockfish,
  onCancel,
}: BoardPositionEditorProps) {
  const [position, setPosition] = useState<PositionDataType>(() =>
    fenToPositionData(initialFen),
  );
  const [sideToMove, setSideToMove] = useState<"w" | "b">(() =>
    initialFen.split(" ")[1] === "b" ? "b" : "w",
  );
  const [error, setError] = useState<string | null>(null);

  // Free-text alternatives to dragging pieces - typing/pasting into either
  // one loads that position onto the board above (one-directional: moving
  // pieces afterward doesn't write back into these fields, which would
  // otherwise mean guarding against a feedback loop for no real benefit).
  const [fenText, setFenText] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [textError, setTextError] = useState<string | null>(null);

  function applyParsedPosition(chess: Chess) {
    const fen = chess.fen();
    setPosition(fenToPositionData(fen));
    setSideToMove(fen.split(" ")[1] === "b" ? "b" : "w");
    setError(null);
  }

  function handleFenTextChange(value: string) {
    setFenText(value);
    setPgnText("");
    setTextError(null);
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      applyParsedPosition(new Chess(trimmed));
    } catch {
      setTextError("That doesn't look like a valid FEN.");
    }
  }

  function handlePgnTextChange(value: string) {
    setPgnText(value);
    setFenText("");
    setTextError(null);
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      const chess = new Chess();
      chess.loadPgn(trimmed);
      applyParsedPosition(chess);
    } catch {
      setTextError("That doesn't look like valid PGN.");
    }
  }

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

  function buildFen(): string | null {
    try {
      const fen = positionDataToFen(position, sideToMove);
      setError(null);
      return fen;
    } catch {
      setError("Every position needs exactly one king per side.");
      return null;
    }
  }

  function handleAnalyze() {
    const fen = buildFen();
    if (fen) onAnalyze(fen);
  }

  function handlePlayVsStockfish() {
    const fen = buildFen();
    if (fen) onPlayVsStockfish(fen);
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
          onClick={handleAnalyze}
          className="rounded-lg border border-accent px-4 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10"
        >
          Analyze this position
        </button>

        <button
          type="button"
          onClick={handlePlayVsStockfish}
          className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-text transition hover:brightness-110"
        >
          Play vs Stockfish
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
        >
          Cancel
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-col gap-2 pt-1">
        <div className="flex items-center gap-2 text-xs text-text-faint">
          <div className="h-px flex-1 bg-border" />
          or enter FEN / PGN
          <div className="h-px flex-1 bg-border" />
        </div>

        <input
          type="text"
          value={fenText}
          onChange={(e) => handleFenTextChange(e.target.value)}
          placeholder="Paste a FEN - updates the board above as you type"
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />

        <textarea
          value={pgnText}
          onChange={(e) => handlePgnTextChange(e.target.value)}
          placeholder="Or paste a PGN - the board shows the final position"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />

        {textError && <p className="text-center text-xs text-red-400">{textError}</p>}
      </div>
    </div>
  );
}
