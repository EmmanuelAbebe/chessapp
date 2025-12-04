import { Square, Move, Board as BoardType } from "./types";

const squareToAlg = (sq: Square): string => {
  const file = String.fromCharCode("a".charCodeAt(0) + sq.col);
  const rank = String(8 - sq.row);
  return file + rank;
};

export function moveToSimpleNotation(m: Move, boardBefore: BoardType): string {
  // Castling
  if (m.castling) {
    return m.castling === "king" ? "O-O" : "O-O-O";
  }

  const piece = boardBefore[m.from.row][m.from.col];
  const p = piece?.toUpperCase();
  const dest = squareToAlg(m.to);

  // Pawn
  if (p === "P") {
    let out = dest;
    if (m.promotion) out += "=" + m.promotion.toUpperCase();
    return out;
  }

  // Minor/major pieces
  const symbol = p; // N / B / R / Q / K
  return symbol + dest;
}
