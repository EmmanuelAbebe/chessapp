import React from "react";

export function AiChatPanel() {
  return (
    <div className="flex h-28 w-full flex-col gap-1.5 rounded border border-border-soft bg-surface px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text">AI Coach</span>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-text-faint">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-text-faint">
        Game explanations and coaching will appear here.
      </p>
    </div>
  );
}
