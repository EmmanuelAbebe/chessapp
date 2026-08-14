import type React from "react";
import type { Chess, Square } from "chess.js";

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
