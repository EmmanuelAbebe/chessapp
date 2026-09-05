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
  // Identifies "the same game" regardless of when/how it was added, so
  // useGameHistory can skip re-adding one already in history - the exact
  // move sequence plus who played it, not a header field some PGN
  // sources omit, so it works uniformly for imports and live games alike.
  fingerprint: string;
};

export function createHistoryId(): string {
  return `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** A stable id for "this exact game, played by this side" - two entries
 * built from the same moves/side/opponent/result always produce the same
 * fingerprint, which is what lets a duplicate import (an accidental
 * double-paste, or re-importing a game already recorded) get skipped
 * instead of silently double-counting it in every stat. Deliberately not
 * based on any PGN header (GameId, Site, ...) since not every source
 * includes one, and a live game has none at all. */
export function computeFingerprint(
  entry: Pick<GameHistoryEntry, "playerSide" | "opponentName" | "result" | "moves">,
): string {
  const content = `${entry.playerSide}|${entry.opponentName ?? ""}|${entry.result}|${entry.moves
    .map((move) => move.uci)
    .join(",")}`;

  // A plain djb2 string hash - this only needs to be a stable, cheap
  // "are these two move sequences the same" check, not cryptographic.
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/** "1-0"/"0-1"/"1/2-1/2" (or anything else, treated as a draw) from the
 * player's own side's point of view. */
export function resultForSide(pgnResult: string, side: "w" | "b"): GameResult {
  if (pgnResult === "1-0") return side === "w" ? "win" : "loss";
  if (pgnResult === "0-1") return side === "b" ? "win" : "loss";
  return "draw";
}
