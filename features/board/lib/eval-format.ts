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
