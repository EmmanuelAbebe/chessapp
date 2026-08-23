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
      className={`-ml-11 flex w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface py-1 font-mono text-xs text-text shadow-sm ${
        visible ? "" : "invisible"
      }`}
    >
      {formatEvalFromWhiteScore(displayScore, displayMate)}
    </div>
  );
}
