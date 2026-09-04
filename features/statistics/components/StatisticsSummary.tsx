"use client";

import { useMemo } from "react";
import { useGameHistory } from "@/features/history/useGameHistory";
import { computePersonalityProfile } from "../lib/traits";
import { TraitRadarChart } from "./TraitRadarChart";
import { PhaseMixBars } from "./PhaseMixBars";
import { ArchetypeHeadline } from "./ArchetypeHeadline";

export default function StatisticsSummary() {
  const { games } = useGameHistory();
  const profile = useMemo(() => computePersonalityProfile(games), [games]);

  if (profile.gamesCount === 0) {
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
        Based on {profile.gamesCount} game{profile.gamesCount === 1 ? "" : "s"}
        , {profile.movesCount} of your own moves.
      </p>
    </section>
  );
}
