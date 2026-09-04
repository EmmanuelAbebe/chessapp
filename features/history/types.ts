import type { ParsedMove } from "../board/lib/pgn-import";

export type GameResult = "win" | "loss" | "draw";

export type GameHistoryEntry = {
  id: string;
  source: "import" | "live";
  playedAt: number;
  playerSide: "w" | "b";
  result: GameResult;
  opponentName?: string;
  timeControl?: string;
  moves: ParsedMove[];
};

export function createHistoryId(): string {
  return `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** "1-0"/"0-1"/"1/2-1/2" (or anything else, treated as a draw) from the
 * player's own side's point of view. */
export function resultForSide(pgnResult: string, side: "w" | "b"): GameResult {
  if (pgnResult === "1-0") return side === "w" ? "win" : "loss";
  if (pgnResult === "0-1") return side === "b" ? "win" : "loss";
  return "draw";
}
