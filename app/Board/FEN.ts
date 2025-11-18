// FEN.ts

import { BoardState, fenToBoard } from "./utils";

// export const startPosition =
//   "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const startPosition = "8/3k4/8/8/3QNK3/8/8/8 w - - 0 1";

export type ParsedFEN = BoardState;

/**
 * Full FEN parser -> BoardState.
 */
export const parseFEN = (fen: string): ParsedFEN => {
  const parts = fen.trim().split(/\s+/);

  const board = fenToBoard(fen);
  const activeColor = (parts[1] ?? "w") === "b" ? "b" : "w";
  const castling = parts[2] ?? "-";
  const enPassant = parts[3] ?? "-";
  const halfmoveClock = Number(parts[4] ?? "0");
  const fullmoveNumber = Number(parts[5] ?? "1");

  return {
    board,
    activeColor,
    castling,
    enPassant,
    halfmoveClock,
    fullmoveNumber,
  };
};
