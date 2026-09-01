import type React from "react";
import { Chess, type Square } from "chess.js";
import type { PositionDataType } from "react-chessboard";

export function getMoveOptions(
  chessGame: Chess,
  square: Square,
  showDots = true,
): Record<string, React.CSSProperties> | null {
  const moves = chessGame.moves({
    square,
    verbose: true,
  });

  if (moves.length === 0) {
    return null;
  }

  const newSquares: Record<string, React.CSSProperties> = {};

  if (showDots) {
    for (const move of moves) {
      newSquares[move.to] = {
        background:
          chessGame.get(move.to) &&
          chessGame.get(move.to)?.color !== chessGame.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }
  }

  newSquares[square] = {
    background: "rgba(255, 255, 0, 0.4)",
  };

  return newSquares;
}

/** Reads a FEN's piece placement into the board-editor's plain
 * `{ [square]: { pieceType } }` map - used to seed the drag-and-drop editor
 * from whatever position was on screen when it opened. */
export function fenToPositionData(fen: string): PositionDataType {
  const chess = new Chess(fen);
  const position: PositionDataType = {};

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      position[piece.square] = { pieceType: `${piece.color}${piece.type.toUpperCase()}` };
    }
  }

  return position;
}

/** The reverse of fenToPositionData - builds a FEN from the editor's
 * freely-editable position map. Rejects a missing/duplicate king itself
 * (chess.js's `put()` silently refuses a second king rather than erroring,
 * so that case needs an explicit check); anything else structurally invalid
 * (e.g. a king left in check by the side not to move) is caught via the
 * final re-parse, the same way the existing manual-FEN entry already does. */
export function positionDataToFen(
  position: PositionDataType,
  sideToMove: "w" | "b",
): string {
  const kingSquares: Record<"w" | "b", string[]> = { w: [], b: [] };
  for (const [square, { pieceType }] of Object.entries(position)) {
    const color = pieceType[0] as "w" | "b";
    if (pieceType[1] === "K") kingSquares[color].push(square);
  }
  if (kingSquares.w.length !== 1 || kingSquares.b.length !== 1) {
    throw new Error("Each side needs exactly one king.");
  }

  const chess = new Chess();
  chess.clear();
  for (const [square, { pieceType }] of Object.entries(position)) {
    chess.put(
      {
        color: pieceType[0] as "w" | "b",
        type: pieceType[1].toLowerCase() as "p" | "n" | "b" | "r" | "q" | "k",
      },
      square as Square,
    );
  }

  const fields = chess.fen().split(" ");
  fields[1] = sideToMove;
  const fen = fields.join(" ");

  new Chess(fen); // throws if still structurally invalid

  return fen;
}
