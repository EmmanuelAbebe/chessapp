"use client";

import { formatEvalFromWhiteScore } from "../lib/eval-format";

type EvalScoreLabelProps = {
  visible: boolean;
  displayScore: number;
  displayMate: number | null;
};

export function EvalScoreLabel({
  visible,
  displayScore,
  displayMate,
}: EvalScoreLabelProps) {
  return (
    <div
      className={`shrink-0 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-center font-mono text-xs text-neutral-200 shadow-sm ${
        visible ? "" : "invisible"
      }`}
    >
      {formatEvalFromWhiteScore(displayScore, displayMate)}
    </div>
  );
}
