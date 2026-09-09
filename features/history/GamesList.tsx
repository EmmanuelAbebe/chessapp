"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FaChessBoard, FaUpRightFromSquare } from "react-icons/fa6";
import { FiHelpCircle } from "react-icons/fi";
import { PiGraph } from "react-icons/pi";
import { pgnPlayedAt, type GameHistoryEntry } from "./types";
import { stashExploreGame } from "./exploreGame";
import { lookupOpeningName } from "@/features/statistics/lib/openings-book";
import {
  TIME_CATEGORIES,
  timeControlCategory,
  timeCategoryLabel,
  openingFamilyOf,
} from "./gameFacets";

// The recorded games as a filterable, day-grouped list.

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

/** When a game was actually played - the PGN date if we have it, else
 * the import time - for sorting and grouping. */
function playedTimestamp(game: GameHistoryEntry): number {
  return pgnPlayedAt(game.meta) ?? game.playedAt;
}

function dayKey(ts: number): string {
  return new Date(ts).toDateString();
}
function formatDayHeader(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function formatTimeOfDay(game: GameHistoryEntry): string | null {
  if (!game.meta?.time) return null;
  return new Date(playedTimestamp(game)).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A tiny "?" that reveals a one-line explanation on hover / focus. */
function HintIcon({ text }: { text: string }) {
  return (
    <span className="group/hint relative inline-flex align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="text-text-faint transition hover:text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <FiHelpCircle className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-48 -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-[11px] leading-snug font-normal text-text-dim opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function DetailField({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string;
  hint?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] tracking-wide text-text-faint uppercase">
        {label}
      </dt>
      <dd className="flex items-center gap-1 text-text">
        {value}
        {hint && <HintIcon text={hint} />}
      </dd>
    </div>
  );
}

function GameDetail({ game }: { game: GameHistoryEntry }) {
  const router = useRouter();
  const meta = game.meta ?? {};
  const asWhite = game.playerSide === "w";
  const cat = timeControlCategory(game.timeControl, game.source);

  const whiteName = meta.whiteName ?? (asWhite ? "You" : game.opponentName);
  const blackName = meta.blackName ?? (asWhite ? game.opponentName : "You");
  const whiteLine = [whiteName ?? "White", meta.whiteElo && `(${meta.whiteElo})`]
    .filter(Boolean)
    .join(" ");
  const blackLine = [blackName ?? "Black", meta.blackElo && `(${meta.blackElo})`]
    .filter(Boolean)
    .join(" ");

  const explore = (to: "/board" | "/map") => {
    stashExploreGame(game);
    router.push(to);
  };

  return (
    <div className="border-t border-border-soft bg-surface-raised/40 px-3 py-3">
      <div className="mb-3 text-sm">
        <span className={asWhite ? "font-medium text-text" : "text-text-dim"}>
          <span
            className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-border-soft align-middle"
            style={{ background: "#f2f2f2" }}
          />
          {whiteLine}
        </span>
        <span className="mx-2 text-text-faint">vs</span>
        <span className={!asWhite ? "font-medium text-text" : "text-text-dim"}>
          <span
            className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-border-soft align-middle"
            style={{ background: "#1a1a1a" }}
          />
          {blackLine}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <DetailField
          label="Played"
          value={
            meta.date
              ? `${meta.date.replace(/\./g, "-")}${meta.time ? ` ${meta.time}` : ""}`
              : `${new Date(game.playedAt).toLocaleString()} (recorded)`
          }
        />
        <DetailField
          label="Time control"
          value={
            cat
              ? `${cat.name}${game.timeControl && game.source !== "live" ? ` · ${game.timeControl}` : ""}`
              : game.timeControl
          }
          hint={cat?.blurb}
        />
        <DetailField label="Event" value={meta.event} />
        <DetailField label="Round" value={meta.round} />
        <DetailField
          label="Opening"
          value={
            [meta.eco, meta.opening ?? lookupOpeningName(game.moves) ?? undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        <DetailField label="Termination" value={meta.termination} />
        <DetailField
          label="Moves"
          value={`${Math.ceil(game.moves.length / 2)}`}
        />
        <DetailField
          label="Source"
          value={game.source === "live" ? "vs Stockfish" : "Imported"}
        />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => explore("/board")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
        >
          <FaChessBoard aria-hidden="true" className="h-3 w-3" />
          Explore on board
        </button>
        <button
          type="button"
          onClick={() => explore("/map")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
        >
          <PiGraph aria-hidden="true" className="h-3 w-3" />
          Explore on map
        </button>
        {meta.gameUrl && (
          <a
            href={meta.gameUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
          >
            <FaUpRightFromSquare aria-hidden="true" className="h-3 w-3" />
            {meta.gameUrl.includes("lichess") ? "View on Lichess" : "Open game"}
          </a>
        )}
      </div>
    </div>
  );
}

const selectClass =
  "rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text focus:border-accent focus:outline-none";

export function GamesList({ games }: { games: GameHistoryEntry[] }) {
  const [timeCat, setTimeCat] = useState("all");
  const [opponent, setOpponent] = useState("all");
  const [opening, setOpening] = useState("all");
  const [rangeDays, setRangeDays] = useState(0);
  const [minVsOpponent, setMinVsOpponent] = useState(1);
  const [streakType, setStreakType] = useState<"all" | "win" | "loss">("all");
  const [minStreak, setMinStreak] = useState(3);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const opponentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) {
      const name = g.opponentName?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [games]);

  const timeCatOptions = useMemo(() => {
    const present = new Set(
      games.map((g) => timeControlCategory(g.timeControl, g.source)?.key),
    );
    return TIME_CATEGORIES.filter((c) => present.has(c.key));
  }, [games]);

  const openingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) {
      const name = openingFamilyOf(g);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [games]);

  const opponentOptions = useMemo(
    () =>
      [...opponentCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    [opponentCounts],
  );

  const openingOptions = useMemo(
    () =>
      [...openingCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    [openingCounts],
  );

  const repeatOpponentTotal = useMemo(
    () =>
      [...opponentCounts.values()].filter((c) => c >= Math.max(2, minVsOpponent))
        .length,
    [opponentCounts, minVsOpponent],
  );

  // Length of the consecutive same-result run each game belongs to, over
  // the player's actual game sequence (chronological, not the filtered
  // view) - so "in a 3+ loss streak" means what it says.
  const streakLen = useMemo(() => {
    const chrono = [...games].sort(
      (a, b) => playedTimestamp(a) - playedTimestamp(b),
    );
    const map = new Map<string, number>();
    let runStart = 0;
    for (let i = 0; i <= chrono.length; i++) {
      if (i === chrono.length || chrono[i].result !== chrono[runStart].result) {
        for (let j = runStart; j < i; j++) map.set(chrono[j].id, i - runStart);
        runStart = i;
      }
    }
    return map;
  }, [games]);

  const filtered = useMemo(() => {
    const cutoff =
      rangeDays > 0 ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : 0;
    return games
      .filter((g) => {
        if (
          timeCat !== "all" &&
          timeControlCategory(g.timeControl, g.source)?.key !== timeCat
        )
          return false;
        if (opponent !== "all" && g.opponentName?.trim() !== opponent)
          return false;
        if (opening !== "all" && openingFamilyOf(g) !== opening) return false;
        if (cutoff && playedTimestamp(g) < cutoff) return false;
        if (minVsOpponent > 1) {
          const name = g.opponentName?.trim();
          if (!name || (opponentCounts.get(name) ?? 0) < minVsOpponent)
            return false;
        }
        if (streakType !== "all") {
          if (g.result !== streakType) return false;
          if ((streakLen.get(g.id) ?? 1) < minStreak) return false;
        }
        return true;
      })
      .sort((a, b) => playedTimestamp(b) - playedTimestamp(a));
  }, [
    games,
    timeCat,
    opponent,
    opening,
    rangeDays,
    minVsOpponent,
    opponentCounts,
    streakType,
    minStreak,
    streakLen,
  ]);

  if (games.length === 0) return null;

  const anyFilterActive =
    timeCat !== "all" ||
    opponent !== "all" ||
    opening !== "all" ||
    rangeDays > 0 ||
    minVsOpponent > 1 ||
    streakType !== "all";

  function clearFilters() {
    setTimeCat("all");
    setOpponent("all");
    setOpening("all");
    setRangeDays(0);
    setMinVsOpponent(1);
    setStreakType("all");
  }

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
          value={timeCat}
          onChange={(e) => setTimeCat(e.target.value)}
          className={selectClass}
        >
          <option value="all">Any speed</option>
          {timeCatOptions.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Opening"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          className={selectClass}
        >
          <option value="all">Any opening</option>
          {openingOptions.map(({ name, count }) => (
            <option key={name} value={name}>
              {name} ({count})
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
          <select
            aria-label="Streak"
            value={streakType}
            onChange={(e) =>
              setStreakType(e.target.value as "all" | "win" | "loss")
            }
            className="bg-transparent text-text focus:outline-none"
          >
            <option value="all">Any run</option>
            <option value="win">Win streak</option>
            <option value="loss">Loss streak</option>
          </select>
          {streakType !== "all" && (
            <>
              <input
                type="number"
                min={2}
                max={50}
                value={minStreak}
                onChange={(e) =>
                  setMinStreak(Math.max(2, Number(e.target.value) || 2))
                }
                className="w-9 rounded border border-border bg-surface px-1 py-0.5 text-center text-text focus:border-accent focus:outline-none"
              />
              +
            </>
          )}
        </label>

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
            onClick={clearFilters}
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
        <ul className="flex flex-col overflow-hidden rounded-lg border border-border-soft">
          {filtered.map((game, i) => {
            const ts = playedTimestamp(game);
            const newDay =
              i === 0 || dayKey(ts) !== dayKey(playedTimestamp(filtered[i - 1]));
            const asWhite = game.playerSide === "w";
            const open = expandedId === game.id;
            const time = formatTimeOfDay(game);
            return (
              <Fragment key={game.id}>
                {newDay && (
                  <li className="flex justify-end border-t border-border-soft bg-surface-raised/60 px-3 py-1 text-[11px] font-medium text-text-faint first:border-t-0">
                    {formatDayHeader(ts)}
                  </li>
                )}
                <li className="border-t border-border-soft bg-surface">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : game.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-raised/50"
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
                      {timeCategoryLabel(game)}
                    </span>
                    {time && (
                      <span className="shrink-0 font-mono text-xs text-text-faint">
                        {time}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-90" : ""}`}
                    >
                      ›
                    </span>
                  </button>

                  {open && <GameDetail game={game} />}
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
