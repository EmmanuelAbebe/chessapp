"use client";

import { winRatePercent, type NodeOutcomeStats } from "../../lib/map/node-stats";
import {
  SIDE_FILTER_OPTIONS,
  type SideFilter,
} from "@/features/history/SidePlayedFilter";

// Under the mini board: the side-played filter as three swatches, then
// the previewed node's win/loss line from the player's own recorded games
// (Statistics history) for whichever side is selected. The filter used to
// be a "Best: <move>" pill here - the eval bar beside the board already
// carries the engine's read, and reshaping the map by side is the more
// useful control to have one click away.
const SWATCH_STYLE: Record<SideFilter, string> = {
  all: "linear-gradient(135deg, #f2f2f2 0 50%, #1a1a1a 50% 100%)",
  w: "#f2f2f2",
  b: "#1a1a1a",
};

export function MapNodeDetails({
  stats,
  statsSide,
  setStatsSide,
  sideCounts,
}: {
  stats: NodeOutcomeStats | undefined;
  statsSide: SideFilter;
  setStatsSide: (next: SideFilter) => void;
  sideCounts: { all: number; w: number; b: number };
}) {
  const rate = winRatePercent(stats);
  const hasHistory = sideCounts.all > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      {hasHistory && (
        <div
          role="group"
          aria-label="Filter stats by the side you played"
          className="flex items-center gap-1 rounded-md border border-border bg-surface-raised p-0.5"
        >
          {SIDE_FILTER_OPTIONS.map(({ value, label }) => {
            const active = statsSide === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatsSide(value)}
                aria-pressed={active}
                aria-label={label}
                title={label}
                className={`flex h-5 w-5 items-center justify-center rounded transition ${
                  active ? "ring-2 ring-accent" : "opacity-60 hover:opacity-100"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded-sm border border-border-soft"
                  style={{ background: SWATCH_STYLE[value] }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* From the player's own recorded games (Statistics history), not
          the currently-displayed tree's structure - see node-stats.ts. */}
      <div className="text-center font-mono text-[11px] text-text-faint">
        {rate === null || !stats ? (
          statsSide === "all"
            ? "No recorded games reached this position"
            : `No ${statsSide === "w" ? "White" : "Black"} games reached this position`
        ) : (
          <>
            {stats.games} game{stats.games === 1 ? "" : "s"} · {rate.toFixed(0)}%{" "}
            ({stats.wins}W {stats.draws}D {stats.losses}L)
          </>
        )}
      </div>
    </div>
  );
}
