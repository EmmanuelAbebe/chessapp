"use client";

import type { GameHistoryEntry } from "./types";

// A plain list of the recorded games - so "which side was I in this game"
// is actually visible somewhere, and the side filter's effect is concrete
// rather than only moving numbers on a chart. Newest first.

const RESULT_STYLE: Record<GameHistoryEntry["result"], string> = {
  win: "text-emerald-500",
  loss: "text-red-400",
  draw: "text-text-dim",
};
const RESULT_LABEL: Record<GameHistoryEntry["result"], string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GamesList({ games }: { games: GameHistoryEntry[] }) {
  if (games.length === 0) return null;

  const sorted = [...games].sort((a, b) => b.playedAt - a.playedAt);

  return (
    <div className="w-full">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Games ({sorted.length})
      </h3>
      <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-lg border border-border-soft">
        {sorted.map((game) => {
          const asWhite = game.playerSide === "w";
          return (
            <li
              key={game.id}
              className="flex items-center gap-3 bg-surface px-3 py-2 text-sm"
            >
              <span
                title={asWhite ? "You played White" : "You played Black"}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-dim"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm border border-border-soft"
                  style={{ background: asWhite ? "#f2f2f2" : "#1a1a1a" }}
                />
                {asWhite ? "White" : "Black"}
              </span>

              <span
                className={`w-10 shrink-0 font-medium ${RESULT_STYLE[game.result]}`}
              >
                {RESULT_LABEL[game.result]}
              </span>

              <span className="min-w-0 flex-1 truncate text-text">
                {game.opponentName ? `vs ${game.opponentName}` : "vs —"}
              </span>

              <span className="hidden shrink-0 text-xs text-text-faint sm:inline">
                {game.source === "live" ? "Stockfish" : game.timeControl || "import"}
              </span>
              <span className="shrink-0 text-xs text-text-faint">
                {formatDate(game.playedAt)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
