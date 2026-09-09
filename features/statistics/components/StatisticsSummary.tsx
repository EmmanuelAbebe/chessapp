"use client";

import { useMemo, useState } from "react";
import { useGameHistory } from "@/features/history/useGameHistory";
import {
  SidePlayedFilter,
  filterGamesBySide,
  sideGameCounts,
  type SideFilter,
} from "@/features/history/SidePlayedFilter";
import { GamesList } from "@/features/history/GamesList";
import { computePersonalityProfile } from "../lib/traits";
import { TraitRadarChart } from "./TraitRadarChart";
import { PhaseMixBars } from "./PhaseMixBars";
import { ArchetypeHeadline } from "./ArchetypeHeadline";

export default function StatisticsSummary() {
  const { games } = useGameHistory();
  const [side, setSide] = useState<SideFilter>("all");

  const counts = useMemo(() => sideGameCounts(games), [games]);
  const filteredGames = useMemo(
    () => filterGamesBySide(games, side),
    [games, side],
  );
  const profile = useMemo(
    () => computePersonalityProfile(filteredGames),
    [filteredGames],
  );

  if (counts.all === 0) {
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
        <SidePlayedFilter value={side} onChange={setSide} counts={counts} />
        <p className="text-xs text-text-faint">
          You&apos;ve recorded {counts.w} game{counts.w === 1 ? "" : "s"} as
          White and {counts.b} as Black.
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

      <GamesList games={filteredGames} />
    </section>
  );
}
