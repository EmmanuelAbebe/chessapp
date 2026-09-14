"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpeningsBreakdown as Breakdown, OpeningLine } from "../lib/summary";
import type { GameHistoryEntry } from "@/features/history/types";
import { openingFamilyOf } from "@/features/history/gameFacets";
import { stashExploreGame } from "@/features/history/exploreGame";
import { HintIcon } from "@/components/ui/HintIcon";

type Row = OpeningLine & { key: string };

const RESULT_LABEL: Record<GameHistoryEntry["result"], string> = { win: "Won", draw: "Drew", loss: "Lost" };
const RESULT_COLOR: Record<GameHistoryEntry["result"], string> = {
  win: "text-good", draw: "text-text-dim", loss: "text-bad",
};

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A bar per opening family instead of a donut - matches the bar-based
 * language the rest of the page converged on, and scales past ~6 entries
 * without a forced "top 5 + other" grouping (a pie chart's usual limit;
 * this now defaults to 8 named rows precisely because bars handle more
 * of them without becoming unreadable). Click a row to see the actual
 * games in it. */
export function OpeningsBreakdown({
  breakdown,
  side,
  games,
}: {
  breakdown: Breakdown;
  side: "all" | "w" | "b";
  games: GameHistoryEntry[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows: Row[] = breakdown.lines.map((line) => ({ key: line.label, ...line }));
  if (breakdown.other) {
    rows.push({ key: "__other__", label: "Other openings", ...breakdown.other });
  }

  const total = breakdown.total;
  if (rows.length === 0 || total === 0) return null;

  const heading =
    side === "w" ? "Your openings as White" : side === "b" ? "Your openings as Black" : "Your openings";
  const maxGames = Math.max(...rows.map((r) => r.games));

  function openGame(game: GameHistoryEntry) {
    stashExploreGame(game);
    router.push("/board");
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
          {heading}
          <HintIcon text="Bar length is share of these games; the % is win-rate (win 1, draw ½). Click a row for the games. Family names come from the PGN's own opening tag where present." width="w-64" />
        </h3>
        <span className="font-mono text-xs text-text-faint">{total} games</span>
      </div>

      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const share = (r.games / total) * 100;
          const barPct = (r.games / maxGames) * 100;
          const scoreColor = r.score >= 55 ? "var(--good)" : r.score <= 45 ? "var(--bad)" : "var(--text-dim)";
          const expandable = r.key !== "__other__";
          const isOpen = expanded === r.key;
          const rowGames = expandable ? games.filter((g) => openingFamilyOf(g) === r.label) : [];

          const row = (
            <div
              className={`flex flex-col gap-1 rounded-md px-2 py-1.5 transition ${expandable ? "cursor-pointer hover:bg-surface-raised/60" : ""}`}
              onClick={expandable ? () => setExpanded(isOpen ? null : r.key) : undefined}
            >
              <div className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-text sm:w-48">{r.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${barPct}%` }} />
                </div>
                <span
                  className="w-12 shrink-0 text-right font-mono text-xs font-semibold"
                  style={{ color: scoreColor }}
                >
                  {r.score.toFixed(0)}%
                </span>
              </div>
              <p className="font-mono text-[11px] text-text-faint">
                {r.games} game{r.games === 1 ? "" : "s"} ({share.toFixed(0)}%) ·{" "}
                <span className="text-good">{r.wins}W</span> {r.draws}D{" "}
                <span className="text-bad">{r.losses}L</span>
              </p>
            </div>
          );

          return (
            <div key={r.key}>
              {row}
              {isOpen && (
                <div className="ml-2 flex flex-col divide-y divide-border-soft border-l border-border-soft pl-3">
                  {rowGames.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                      <span className="text-text-faint">{formatDay(g.playedAt)}</span>
                      <span className={`font-medium ${RESULT_COLOR[g.result]}`}>{RESULT_LABEL[g.result]}</span>
                      <span className="min-w-0 flex-1 truncate text-text-faint">{g.opponentName ?? "—"}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openGame(g);
                        }}
                        className="shrink-0 rounded-md border border-border px-2 py-0.5 text-text-dim transition hover:border-accent hover:text-text"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
