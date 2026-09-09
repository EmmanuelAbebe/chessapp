"use client";

import { useMemo, useState } from "react";
import type { GameHistoryEntry } from "./types";

// The recorded games as a filterable list - so "which side was I in this
// game" is visible somewhere, and the side filter's effect is concrete.
// Newest first. The interpretive traits are a separate, fuzzier thing;
// this is just the raw log.

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

const DATE_RANGES = [
  { label: "Any time", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The label the list shows for a game's "source" column - also what the
 * time-control filter matches on, so they stay in step. */
function sourceLabel(game: GameHistoryEntry): string {
  if (game.source === "live") return "Stockfish";
  return game.timeControl || "import";
}

const selectClass =
  "rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text focus:border-accent focus:outline-none";

export function GamesList({ games }: { games: GameHistoryEntry[] }) {
  const [timeControl, setTimeControl] = useState("all");
  const [opponent, setOpponent] = useState("all");
  const [rangeDays, setRangeDays] = useState(0);
  const [minVsOpponent, setMinVsOpponent] = useState(1);

  // How many times each opponent appears in the (side-filtered) set -
  // drives the opponent dropdown order and the "repeat opponents" filter.
  const opponentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) {
      const name = g.opponentName?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [games]);

  const timeControlOptions = useMemo(() => {
    const set = new Set(games.map(sourceLabel));
    return [...set].sort();
  }, [games]);

  const opponentOptions = useMemo(
    () =>
      [...opponentCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    [opponentCounts],
  );

  const repeatOpponentTotal = useMemo(
    () =>
      [...opponentCounts.values()].filter((c) => c >= Math.max(2, minVsOpponent))
        .length,
    [opponentCounts, minVsOpponent],
  );

  const filtered = useMemo(() => {
    const cutoff =
      rangeDays > 0 ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : 0;
    return games
      .filter((g) => {
        if (timeControl !== "all" && sourceLabel(g) !== timeControl) return false;
        if (opponent !== "all" && g.opponentName?.trim() !== opponent)
          return false;
        if (cutoff && g.playedAt < cutoff) return false;
        if (minVsOpponent > 1) {
          const name = g.opponentName?.trim();
          if (!name || (opponentCounts.get(name) ?? 0) < minVsOpponent)
            return false;
        }
        return true;
      })
      .sort((a, b) => b.playedAt - a.playedAt);
  }, [
    games,
    timeControl,
    opponent,
    rangeDays,
    minVsOpponent,
    opponentCounts,
  ]);

  if (games.length === 0) return null;

  const anyFilterActive =
    timeControl !== "all" ||
    opponent !== "all" ||
    rangeDays > 0 ||
    minVsOpponent > 1;

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
          Games
        </h3>
        <span className="text-xs text-text-faint">
          {anyFilterActive
            ? `${filtered.length} of ${games.length}`
            : `${games.length}`}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          aria-label="Time control"
          value={timeControl}
          onChange={(e) => setTimeControl(e.target.value)}
          className={selectClass}
        >
          <option value="all">Any time control</option>
          {timeControlOptions.map((tc) => (
            <option key={tc} value={tc}>
              {tc}
            </option>
          ))}
        </select>

        <select
          aria-label="Opponent"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          className={selectClass}
        >
          <option value="all">Any opponent</option>
          {opponentOptions.map(({ name, count }) => (
            <option key={name} value={name}>
              {name}
              {count > 1 ? ` (${count})` : ""}
            </option>
          ))}
        </select>

        <select
          aria-label="Date range"
          value={rangeDays}
          onChange={(e) => setRangeDays(Number(e.target.value))}
          className={selectClass}
        >
          {DATE_RANGES.map(({ label, days }) => (
            <option key={days} value={days}>
              {label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text-dim">
          Faced
          <input
            type="number"
            min={1}
            max={99}
            value={minVsOpponent}
            onChange={(e) =>
              setMinVsOpponent(Math.max(1, Number(e.target.value) || 1))
            }
            className="w-9 rounded border border-border bg-surface px-1 py-0.5 text-center text-text focus:border-accent focus:outline-none"
          />
          +&nbsp;times
          {minVsOpponent > 1 && (
            <span className="text-text-faint">
              ({repeatOpponentTotal} opponent
              {repeatOpponentTotal === 1 ? "" : "s"})
            </span>
          )}
        </label>

        {anyFilterActive && (
          <button
            type="button"
            onClick={() => {
              setTimeControl("all");
              setOpponent("all");
              setRangeDays(0);
              setMinVsOpponent(1);
            }}
            className="rounded-md border border-border px-2 py-1 text-xs text-text-dim transition hover:text-text"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border-soft bg-surface px-3 py-4 text-center text-xs text-text-faint">
          No games match these filters.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-lg border border-border-soft">
          {filtered.map((game) => {
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
                  {sourceLabel(game)}
                </span>
                <span className="shrink-0 text-xs text-text-faint">
                  {formatDate(game.playedAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
