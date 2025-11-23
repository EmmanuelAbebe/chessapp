// utils.ts

import { CastlingRights, Color, Square } from "./types";

export interface BoardState {
  board: (string | null)[][];
  activeColor: "w" | "b";
  castling: string; // e.g. "KQkq" or "-"
  enPassant: string; // "e3" or "-"
  halfmoveClock: number;
  fullmoveNumber: number;
}

/**
 * Parse only the board part of a FEN string into an 8x8 array.
 * Uppercase = white, lowercase = black, null = empty.
 */
export const fenToBoard = (fen: string): (string | null)[][] => {
  const boardPart = fen.split(" ")[0];
  const rows = boardPart.split("/");
  const board: (string | null)[][] = [];

  for (const row of rows) {
    const rowArr: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        const count = Number(ch);
        for (let i = 0; i < count; i++) rowArr.push(null);
      } else {
        rowArr.push(ch);
      }
    }
    board.push(rowArr);
  }

  return board;
};

// /**
//  * Convert board array back to the first (piece placement) field of FEN.
//  * Does NOT append side-to-move, castling etc.
//  */
// export const boardToFenBoardPart = (board: (string | null)[][]): string => {
//   return board
//     .map((row) => {
//       let out = "";
//       let empty = 0;
//       for (const cell of row) {
//         if (!cell) {
//           empty++;
//         } else {
//           if (empty > 0) {
//             out += String(empty);
//             empty = 0;
//           }
//           out += cell;
//         }
//       }
//       if (empty > 0) out += String(empty);
//       return out;
//     })
//     .join("/");
// };

export const inBounds = (r: number, c: number) =>
  r >= 0 && r < 8 && c >= 0 && c < 8;

export const isWhite = (p: string | null) =>
  p !== null && p === p.toUpperCase();

export const isBlack = (p: string | null) =>
  p !== null && p === p.toLowerCase();

export const pieceColor = (p: string | null): "white" | "black" | null => {
  if (!p) return null;
  return isWhite(p) ? "white" : "black";
};

/**
 * rank-file -> {row,col} and back. Row 0 is rank 8 (top),
 * row 7 is rank 1 (bottom). 'a1' => row 7, col 0.
 */
export const algebraicToSquare = (
  sq: string
): { row: number; col: number } | null => {
  if (!/^[a-h][1-8]$/.test(sq)) return null;
  const file = sq.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(sq[1]); // "1".."8"
  const row = 8 - rank;
  const col = file;
  if (!inBounds(row, col)) return null;
  return { row, col };
};

export const squareToAlgebraic = (row: number, col: number): string => {
  const file = String.fromCharCode("a".charCodeAt(0) + col);
  const rank = 8 - row;
  return `${file}${rank}`;
};

export const boardToFenBoardPart = (board: (string | null)[][]): string => {
  return board
    .map((row) => {
      let out = "";
      let empty = 0;
      for (const cell of row) {
        if (!cell) {
          empty++;
        } else {
          if (empty > 0) {
            out += String(empty);
            empty = 0;
          }
          out += cell;
        }
      }
      if (empty > 0) out += String(empty);
      return out;
    })
    .join("/");
};

// NEW: build full FEN from current board state
export function buildFenFromPosition(
  board: (string | null)[][],
  sideToMove: Color,
  castlingRights: CastlingRights,
  enPassantTarget: Square | null,
  halfmoveClock = 0,
  fullmoveNumber = 1
): string {
  const boardPart = boardToFenBoardPart(board);
  const side = sideToMove === "white" ? "w" : "b";

  let castlingStr = "";
  if (castlingRights.K) castlingStr += "K";
  if (castlingRights.Q) castlingStr += "Q";
  if (castlingRights.k) castlingStr += "k";
  if (castlingRights.q) castlingStr += "q";
  if (!castlingStr) castlingStr = "-";

  let epStr = "-";
  if (enPassantTarget) {
    epStr = squareToAlgebraic(enPassantTarget.row, enPassantTarget.col);
  }

  return `${boardPart} ${side} ${castlingStr} ${epStr} ${halfmoveClock} ${fullmoveNumber}`;
}
