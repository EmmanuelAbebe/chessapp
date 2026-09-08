"use client";

import { useMemo, useState } from "react";
import { useGameHistory } from "@/features/history/useGameHistory";
import { computePersonalityProfile } from "../lib/traits";
import { TraitRadarChart } from "./TraitRadarChart";
import { PhaseMixBars } from "./PhaseMixBars";
import { ArchetypeHeadline } from "./ArchetypeHeadline";

type SideFilter = "all" | "w" | "b";

const SIDE_OPTIONS: { value: SideFilter; label: string }[] = [
  { value: "all", label: "All games" },
  { value: "w", label: "As White" },
  { value: "b", label: "As Black" },
];

export default function StatisticsSummary() {
  const { games } = useGameHistory();
  const [side, setSide] = useState<SideFilter>("all");

  const counts = useMemo(() => {
    let white = 0;
    let black = 0;
    for (const game of games) {
      if (game.playerSide === "w") white += 1;
      else if (game.playerSide === "b") black += 1;
    }
    return { white, black, total: games.length };
  }, [games]);

  const filteredGames = useMemo(
    () => (side === "all" ? games : games.filter((g) => g.playerSide === side)),
    [games, side],
  );

  const profile = useMemo(
    () => computePersonalityProfile(filteredGames),
    [filteredGames],
  );

  if (counts.total === 0) {
    return (
      <section className="rounded-lg border border-border-soft bg-surface px-4 py-8 text-center">
        <p className="text-sm text-text-dim">
          Play or import a few games to see your profile.
        </p>
        <p className="mt-1 text-xs text-text-faint">
          Games played against Stockfish are recorded automatically;
          imported games count once your usernames are set in Settings.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <div
          role="group"
          aria-label="Filter by the side you played"
          className="inline-flex rounded-lg border border-border bg-surface-raised p-0.5"
        >
          {SIDE_OPTIONS.map(({ value, label }) => {
            const active = side === value;
            const count =
              value === "all"
                ? counts.total
                : value === "w"
                  ? counts.white
                  : counts.black;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSide(value)}
                aria-pressed={active}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-accent text-text"
                    : "text-text-dim hover:text-text"
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 ${active ? "text-text/70" : "text-text-faint"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-text-faint">
          You&apos;ve recorded {counts.white} game
          {counts.white === 1 ? "" : "s"} as White and {counts.black} as Black.
        </p>
      </div>

      {profile.gamesCount === 0 ? (
        <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
          No games recorded {side === "w" ? "as White" : "as Black"} yet.
        </p>
      ) : (
        <>
          <ArchetypeHeadline archetype={profile.archetype} />

          <div className="mx-auto w-full max-w-xs">
            <TraitRadarChart traits={profile.radarTraits} />
          </div>

          {profile.phaseMix && (
            <div className="mx-auto w-full max-w-sm">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
                Phase mix
              </h3>
              <PhaseMixBars mix={profile.phaseMix} />
            </div>
          )}

          <p className="text-center text-xs text-text-faint">
            Based on{" "}
            {side === "all"
              ? `${profile.gamesCount} game${profile.gamesCount === 1 ? "" : "s"}`
              : `${profile.gamesCount} game${profile.gamesCount === 1 ? "" : "s"} you played ${side === "w" ? "as White" : "as Black"}`}
            , {profile.movesCount} of your own moves.
          </p>
        </>
      )}
    </section>
  );
}
