// app/Board/uci.ts

import { Move, Square, Board as BoardType, CastlingRights } from "./types";
import { algebraicToSquare, inBounds } from "./utils";

export function parseUciMove(
  uci: string,
  board: BoardType,
  castling: CastlingRights,
  enPassantTarget: Square | null
): Move | null {
  // e2e4, e7e8q, etc.
  if (!/^[a-h][1-8][a-h][1-8][qrbnQ-RB-N]?$/.test(uci)) return null;

  const fromStr = uci.slice(0, 2);
  const toStr = uci.slice(2, 4);
  const promoStr = uci.slice(4); // "" or letter

  const from = algebraicToSquare(fromStr);
  const to = algebraicToSquare(toStr);

  if (!from || !to) return null;

  const move: Move = {
    from: from as Square,
    to: to as Square,
  };

  if (promoStr) {
    move.promotion = promoStr.toUpperCase();
  }

  const movingPiece = board[from.row][from.col];
  if (!movingPiece) return null;

  // Castling detection (assuming standard start squares)
  if (
    (movingPiece === "K" &&
      fromStr === "e1" &&
      (toStr === "g1" || toStr === "c1")) ||
    (movingPiece === "k" &&
      fromStr === "e8" &&
      (toStr === "g8" || toStr === "c8"))
  ) {
    move.castling = toStr === "g1" || toStr === "g8" ? "king" : "queen";
  }

  // Double pawn push (for en passant target)
  if (movingPiece.toLowerCase() === "p") {
    if (Math.abs(from.row - to.row) === 2) {
      move.doublePawn = true;
    }
  }

  // En-passant capture
  if (
    enPassantTarget &&
    movingPiece.toLowerCase() === "p" &&
    to.row === enPassantTarget.row &&
    to.col === enPassantTarget.col &&
    from.col !== to.col
  ) {
    move.enPassant = true;
  }

  return move;
}
