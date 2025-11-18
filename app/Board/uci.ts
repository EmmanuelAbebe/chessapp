// src/chess/uci.ts

import { Move, Square } from "./types";
import { algebraicToSquare } from "./utils";

export function parseUciMove(uci: string): Move | null {
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

  return move;
}
