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
      className={`-ml-11 flex w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 py-1 font-mono text-xs text-neutral-200 shadow-sm ${
        visible ? "" : "invisible"
      }`}
    >
      {formatEvalFromWhiteScore(displayScore, displayMate)}
    </div>
  );
}
