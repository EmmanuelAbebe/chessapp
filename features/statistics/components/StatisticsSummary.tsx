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
import { GameDataCard } from "@/features/history/GameDataCard";
import { computePersonalityProfile } from "../lib/traits";
import { computeRecord, computeOpenings, computeHabits } from "../lib/summary";
import { TraitRadarChart } from "./TraitRadarChart";
import { PhaseMixBars } from "./PhaseMixBars";
import { ArchetypeHeadline } from "./ArchetypeHeadline";
import { RecordSummary } from "./RecordSummary";
import { OpeningsBreakdown } from "./OpeningsBreakdown";
import { HabitsRow } from "./HabitsRow";

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
  const record = useMemo(() => computeRecord(games), [games]);
  const openings = useMemo(
    () => computeOpenings(filteredGames),
    [filteredGames],
  );
  const habits = useMemo(() => computeHabits(filteredGames), [filteredGames]);

  if (counts.all === 0) {
    return (
      <section className="flex flex-col gap-4">
        <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
          Play or import a few games to see your profile. Games against
          Stockfish are recorded automatically; set your usernames below,
          then paste a PGN or a lichess export URL.
        </p>
        <div className="rounded-lg border border-border-soft bg-surface p-4">
          <GameDataCard />
        </div>
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
        <>
          <RecordSummary record={record} />
          <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
            No games recorded {side === "w" ? "as White" : "as Black"} yet.
          </p>
        </>
      ) : (
        <>
          <ArchetypeHeadline archetype={profile.archetype} />

          {/* Chart on the left; the record and the plain numbers on the
              right (stacks on narrow screens). */}
          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <div className="mx-auto w-full max-w-xs">
              <TraitRadarChart traits={profile.radarTraits} />
            </div>

            <div className="flex flex-col gap-4">
              <RecordSummary record={record} />

              {habits && (
                <HabitsRow habits={habits} movesCount={profile.movesCount} />
              )}

              {profile.phaseMix && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
                    Phase mix
                  </h3>
                  <PhaseMixBars mix={profile.phaseMix} />
                </div>
              )}
            </div>
          </div>

          <OpeningsBreakdown breakdown={openings} side={side} />
        </>
      )}

      <GamesList games={filteredGames} />

      <details className="rounded-lg border border-border-soft bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold tracking-wide text-text-faint uppercase">
          Manage games
        </summary>
        <div className="border-t border-border-soft p-4">
          <GameDataCard />
        </div>
      </details>
    </section>
  );
}
