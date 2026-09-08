"use client";

import type { GameHistoryEntry } from "./types";

// Shared "which side were the games yours on" filter, used by both the
// Statistics profile and the Map's per-node win-rate stats so the two
// stay in step. `playerSide` on each recorded game is "w" | "b" from the
// player's own point of view (see features/history/types.ts).

export type SideFilter = "all" | "w" | "b";

export const SIDE_FILTER_OPTIONS: {
  value: SideFilter;
  label: string;
  shortLabel: string;
}[] = [
  { value: "all", label: "All games", shortLabel: "All" },
  { value: "w", label: "As White", shortLabel: "White" },
  { value: "b", label: "As Black", shortLabel: "Black" },
];

export function filterGamesBySide<T extends Pick<GameHistoryEntry, "playerSide">>(
  games: T[],
  side: SideFilter,
): T[] {
  return side === "all" ? games : games.filter((g) => g.playerSide === side);
}

export function sideGameCounts(
  games: Pick<GameHistoryEntry, "playerSide">[],
): { all: number; w: number; b: number } {
  let w = 0;
  let b = 0;
  for (const g of games) {
    if (g.playerSide === "w") w += 1;
    else if (g.playerSide === "b") b += 1;
  }
  return { all: games.length, w, b };
}

export function SidePlayedFilter({
  value,
  onChange,
  counts,
  size = "md",
}: {
  value: SideFilter;
  onChange: (next: SideFilter) => void;
  /** Optional per-option game counts shown next to each label. */
  counts?: { all: number; w: number; b: number };
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";
  return (
    <div
      role="group"
      aria-label="Filter by the side you played"
      className="inline-flex rounded-lg border border-border bg-surface-raised p-0.5 text-xs font-medium"
    >
      {SIDE_FILTER_OPTIONS.map(({ value: v, label, shortLabel }) => {
        const active = value === v;
        const count = counts
          ? v === "all"
            ? counts.all
            : v === "w"
              ? counts.w
              : counts.b
          : null;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={`rounded-md transition ${pad} ${
              active ? "bg-accent text-text" : "text-text-dim hover:text-text"
            }`}
          >
            {size === "sm" ? shortLabel : label}
            {count !== null && (
              <span
                className={`ml-1.5 ${active ? "text-text/70" : "text-text-faint"}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
