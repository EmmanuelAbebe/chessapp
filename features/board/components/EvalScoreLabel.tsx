"use client";

import { formatEvalFromWhiteScore } from "../lib/eval-format";

type EvalScoreLabelProps = {
  visible: boolean;
  displayScore: number;
  displayMate: number | null;
};

// Width grows/shrinks first, opacity fades in only once there's room (and
// fades out before the space collapses back).
const SHOW_TRANSITION = "width 200ms ease-out, opacity 150ms ease-out 200ms";
const HIDE_TRANSITION = "opacity 150ms ease-out, width 200ms ease-out 150ms";

export function EvalScoreLabel({
  visible,
  displayScore,
  displayMate,
}: EvalScoreLabelProps) {
  return (
    <div
      className={`-ml-11 flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-border bg-surface font-mono text-xs text-text shadow-sm ${
        visible ? "w-9 border py-1 opacity-100" : "w-0 border-0 py-1 opacity-0"
      }`}
      style={{ transition: visible ? SHOW_TRANSITION : HIDE_TRANSITION }}
    >
      {/* Fixed w-9 regardless of the parent's animated width, so the label
          gets clipped by the shrinking overflow-hidden boundary instead of
          the text reflowing as it collapses. */}
      <span className="w-9 shrink-0 text-center">
        {formatEvalFromWhiteScore(displayScore, displayMate)}
      </span>
    </div>
  );
}
