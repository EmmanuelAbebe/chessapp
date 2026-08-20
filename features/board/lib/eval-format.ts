export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function scoreToWhite(
  cp: number | null,
  mate: number | null,
  turn: "w" | "b",
) {
  if (mate !== null) {
    const huge = 1000;
    const stmScore = mate > 0 ? huge : -huge;
    return turn === "w" ? stmScore : -stmScore;
  }

  if (cp === null) return 0;
  return turn === "w" ? cp : -cp;
}

export function formatEvalFromWhiteScore(
  whiteScore: number,
  mate: number | null,
) {
  if (mate !== null) {
    return whiteScore > 0 ? `M${Math.abs(mate)}` : `-M${Math.abs(mate)}`;
  }

  const pawns = whiteScore / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

export function whitePercentFromScore(displayScore: number) {
  const compressedScore = 1000 * Math.tanh(displayScore / 350);
  return clamp(((compressedScore + 1000) / 2000) * 100, 0, 100);
}

/** A single comparable number for a cp/mate pair - mate always dominates
 * any cp value, and shorter mates are "better" than longer ones. */
export function toComparableScore(cp: number | null, mate: number | null) {
  if (mate !== null) {
    return mate > 0 ? 100000 - mate : -100000 - mate;
  }
  return cp ?? 0;
}

/**
 * Given engine candidates ranked best-first (as MultiPV lines already are),
 * keep the leading run that stays within `thresholdCp` of the best move's
 * score - e.g. 3-4 moves when they're all roughly as good, just 1-2 when
 * one move is clearly best.
 */
export function selectCloseCandidates<
  T extends { cp: number | null; mate: number | null },
>(candidates: T[], thresholdCp = 50): T[] {
  if (candidates.length === 0) return [];

  const bestScore = toComparableScore(candidates[0].cp, candidates[0].mate);

  // Already losing even with the best move - alternatives that are merely
  // "close in badness" aren't useful suggestions, so just show the top move.
  if (bestScore < 0) return [candidates[0]];

  const shown: T[] = [];

  for (const candidate of candidates) {
    const gap = bestScore - toComparableScore(candidate.cp, candidate.mate);
    if (gap > thresholdCp) break;
    shown.push(candidate);
  }

  return shown;
}
