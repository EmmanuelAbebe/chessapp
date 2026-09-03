import React from "react";
import type { CommentaryStatus } from "../hooks/useMoveCommentary";

export type CommentarySentiment = "good" | "bad" | "neutral";

type AiChatPanelProps = {
  moveNumber: number;
  text: string;
  status: CommentaryStatus;
  /** Whether the eval swung in favor of whoever just moved - drives the
   * left edge and glyph color. "neutral" also covers "no eval yet". */
  sentiment: CommentarySentiment;
  /** The eval chip's label - a signed pawn/mate score when one's
   * available, "Move N" otherwise (idle/no-eval, or before enough depth
   * has been reached). */
  evalLabel: string;
};

const SENTIMENT_BORDER: Record<CommentarySentiment, string> = {
  good: "border-l-good",
  bad: "border-l-bad",
  neutral: "border-l-accent",
};

const SENTIMENT_GLYPH: Record<CommentarySentiment, string> = {
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-accent-soft text-accent",
};

const SENTIMENT_CHIP: Record<CommentarySentiment, string> = {
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-accent-soft text-accent",
};

export function AiChatPanel({
  moveNumber,
  text,
  status,
  sentiment,
  evalLabel,
}: AiChatPanelProps) {
  return (
    <div
      className={`flex h-28 w-full flex-col gap-1.5 rounded border border-l-[3px] border-border-soft bg-surface px-3 py-3 ${SENTIMENT_BORDER[sentiment]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${SENTIMENT_GLYPH[sentiment]}`}
          >
            ♞
          </span>
          <span className="text-sm font-medium text-text">AI Coach</span>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${SENTIMENT_CHIP[sentiment]}`}
        >
          {evalLabel}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === "idle" ? (
          <p className="text-xs text-text-faint">
            Play a move to get coaching commentary.
          </p>
        ) : status === "loading" ? (
          <p className="flex items-center gap-1.5 text-xs text-text-dim italic">
            Thinking
            <span className="inline-flex gap-0.5">
              <span
                aria-hidden="true"
                className="coach-thinking-dot h-1 w-1 rounded-full bg-text-faint"
              />
              <span
                aria-hidden="true"
                className="coach-thinking-dot h-1 w-1 rounded-full bg-text-faint"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                aria-hidden="true"
                className="coach-thinking-dot h-1 w-1 rounded-full bg-text-faint"
                style={{ animationDelay: "0.3s" }}
              />
            </span>
          </p>
        ) : status === "error" ? (
          <p className="text-xs text-text-faint">
            Couldn't reach the coach right now.
          </p>
        ) : (
          <p className="font-serif text-[13.5px] leading-snug text-text">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
