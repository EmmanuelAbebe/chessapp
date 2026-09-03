import { Chess } from "chess.js";

// A plain material heuristic, not a full recursive static-exchange
// evaluation - good enough to flag a real hang (an outright free piece,
// or one only defended by something more valuable than what's attacking
// it) without trying to solve deeper tactics.
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export type HangingPiece = { square: string };

/** Every non-king piece on the board that's attacked and either
 * undefended or only defended at a material loss - kings are excluded,
 * since a king in check is already highlighted elsewhere (checkSquares
 * in useBoardGame.ts). Pure, synchronous, and needs no engine - just
 * chess.js's own attackers() (the same code path it uses internally for
 * legality/check detection). */
export function detectHangingPieces(fen: string): HangingPiece[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }

  const hanging: HangingPiece[] = [];

  for (const piece of chess.board().flat()) {
    if (!piece || piece.type === "k") continue;

    const opponent = piece.color === "w" ? "b" : "w";
    const attackers = chess.attackers(piece.square, opponent);
    if (attackers.length === 0) continue;

    const defenders = chess.attackers(piece.square, piece.color);
    const cheapestAttackerValue = Math.min(
      ...attackers.map((square) => PIECE_VALUE[chess.get(square)?.type ?? "p"]),
    );

    const isHanging =
      defenders.length === 0 || cheapestAttackerValue < PIECE_VALUE[piece.type];

    if (isHanging) hanging.push({ square: piece.square });
  }

  return hanging;
}
