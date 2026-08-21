import type { Chess } from "chess.js";

export type GameStatus = {
  isOver: boolean;
  result: "checkmate" | "stalemate" | "draw" | null;
  winner: "white" | "black" | null;
};

export function getGameStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return {
      isOver: true,
      result: "checkmate",
      winner: chess.turn() === "w" ? "black" : "white",
    };
  }

  if (chess.isStalemate()) {
    return { isOver: true, result: "stalemate", winner: null };
  }

  if (chess.isDraw()) {
    return { isOver: true, result: "draw", winner: null };
  }

  return { isOver: false, result: null, winner: null };
}

export function formatGameStatus(status: GameStatus): string | null {
  if (!status.isOver) return null;

  if (status.result === "checkmate" && status.winner) {
    const winnerLabel = status.winner === "white" ? "White" : "Black";
    return `Checkmate — ${winnerLabel} wins`;
  }

  if (status.result === "stalemate") return "Draw — Stalemate";
  if (status.result === "draw") return "Draw";

  return null;
}
