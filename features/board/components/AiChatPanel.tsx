import React from "react";

type AiChatPanelProps = {
  moveNumber: number;
};

export function AiChatPanel({ moveNumber }: AiChatPanelProps) {
  return (
    <div className="flex h-28 w-full flex-col gap-1.5 rounded border border-border-soft bg-surface px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">AI Coach</span>
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-text-faint">
            Coming soon
          </span>
        </div>
        <span className="font-mono text-xs text-text-faint">
          Move {moveNumber}
        </span>
      </div>
      <p className="text-xs text-text-faint">
        Game explanations and coaching will appear here.
      </p>
    </div>
  );
}
