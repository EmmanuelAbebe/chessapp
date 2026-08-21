import React from "react";

export function AiChatPanel() {
  return (
    <div className="flex h-28 w-full flex-col gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-300">AI Coach</span>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-neutral-500">
        Game explanations and coaching will appear here.
      </p>
    </div>
  );
}
