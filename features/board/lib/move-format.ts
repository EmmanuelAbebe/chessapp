export function formatMove(move: string) {
  return move;
}

const PIECE_LETTERS = new Set(["K", "Q", "R", "B", "N"]);

export type SanParts = {
  pieceLetter: string | null;
  rest: string;
};

/** Splits a SAN move into its piece letter (if any) and the remainder.
 * Pawn moves and castling have no letter to replace with a figurine icon,
 * so pieceLetter is null for those. */
export function splitSanPieceLetter(san: string): SanParts {
  const firstChar = san[0];
  if (firstChar && PIECE_LETTERS.has(firstChar)) {
    return { pieceLetter: firstChar, rest: san.slice(1) };
  }
  return { pieceLetter: null, rest: san };
}
