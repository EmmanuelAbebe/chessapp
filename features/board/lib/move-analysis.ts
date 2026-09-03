import { Chess } from "chess.js";
import { whitePercentFromScore } from "./eval-format";
import type { CandidateMove } from "../hooks/useEvalScore";

export type MoveClassification = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

/** How much of the mover's own win probability their move gave up,
 * compared to the best available at that point - bucketed the way
 * Lichess/chess.com-style move annotations are (a win-probability drop,
 * not a raw centipawn one, since a given cp swing matters far more near
 * an even position than in an already-decided one). Both percents are
 * White's win% (the same convention `evalScore.whitePercent` already
 * uses) - flipped to the mover's own side here so the same thresholds
 * apply regardless of color. */
export function classifyMove(
  beforeWhitePercent: number,
  afterWhitePercent: number,
  moverColor: "w" | "b",
): MoveClassification {
  const beforeMover = moverColor === "w" ? beforeWhitePercent : 100 - beforeWhitePercent;
  const afterMover = moverColor === "w" ? afterWhitePercent : 100 - afterWhitePercent;
  const drop = beforeMover - afterMover;

  if (drop <= 2) return "best";
  if (drop <= 6) return "good";
  if (drop <= 12) return "inaccuracy";
  if (drop <= 25) return "mistake";
  return "blunder";
}

export type Difficulty = "critical" | "normal" | "flexible";

// Mate dominates any cp value and collapses to a fixed huge score,
// matching the same sentinel scoreToWhite/whitePercentFromScore already
// use elsewhere - candidates' own cp/mate are already relative to
// whoever was to move (the mover), so no color flip is needed here at
// all: comparing two candidates already in the same reference frame.
function moverRelativeSentinel(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 1000 : -1000;
  return cp ?? 0;
}

/** Whether the position before the move had one clearly-best option or
 * several comparable ones - a big gap between the top two MultiPV lines
 * means only the top move was any good (a position that's objectively
 * harder to find the right move in); a small gap means multiple moves
 * scored about the same (easier - little to calculate). `null` when
 * fewer than two candidates were available yet (depth too shallow). */
export function assessDifficulty(candidates: (CandidateMove | undefined)[]): Difficulty | null {
  const ranked = candidates.filter((c): c is CandidateMove => c !== undefined);
  if (ranked.length < 2) return null;

  const percentOf = (c: CandidateMove) =>
    whitePercentFromScore(moverRelativeSentinel(c.cp, c.mate));
  const gap = percentOf(ranked[0]) - percentOf(ranked[1]);

  if (gap >= 15) return "critical";
  if (gap <= 5) return "flexible";
  return "normal";
}

/** Whether an eval result actually belongs to this position, not a
 * stale one still in flight - useEvalScore's own reset-and-research
 * cycle (stop the old search, wait for the engine to ack, reposition,
 * go) is a real Worker round-trip, not instant, so for a window after
 * any position change it can still be returning the *previous*
 * position's fully-converged data (deep, plausible-looking, and
 * completely wrong) rather than "no data yet." A stale bestMove is
 * essentially never also a legal move in the new position, so checking
 * that catches it regardless of how long the staleness window lasts -
 * far more robust than trying to time it out. */
export function evalMatchesPosition(fen: string, bestMoveUci: string | null): boolean {
  if (!bestMoveUci) return false;

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return false;
  }

  return chess
    .moves({ verbose: true })
    .some((move) => `${move.from}${move.to}${move.promotion ?? ""}` === bestMoveUci);
}

export type GamePhase = "opening" | "middlegame" | "endgame";

/** A cheap, approximate phase signal (not real phase detection) good
 * enough to pick which coaching angle applies: development/center/king
 * safety early on, piece activity/tactics in the middlegame, king
 * activity/technique once material has thinned out. */
export function detectGamePhase(fen: string, ply: number): GamePhase {
  if (ply <= 20) return "opening";

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return "middlegame";
  }

  const majorMinorCount = chess
    .board()
    .flat()
    .filter((piece) => piece && piece.type !== "k" && piece.type !== "p").length;

  return majorMinorCount <= 6 ? "endgame" : "middlegame";
}
