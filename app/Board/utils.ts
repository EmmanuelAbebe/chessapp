// utils.ts

export interface BoardState {
  board: (string | null)[][];
  activeColor: "w" | "b";
  castling: string; // e.g. "KQkq" or "-"
  enPassant: string; // "e3" or "-"
  halfmoveClock: number;
  fullmoveNumber: number;
}

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
