"use client";

import { usePlayerProfile } from "@/features/playermodel/usePlayerProfile";
import { PlayerModelSection } from "@/features/playermodel/components/PlayerModelSection";
import type { PlayerProfileData } from "@/features/playermodel/types";
import StatisticsSummary from "./StatisticsSummary";

/** Owns the one usePlayerProfile instance for /dashboard/statistics, so
 * PlayerModelSection and StatisticsSummary's phase comparison chart share
 * the same profile (and the same Analyze/Refresh) instead of each fetching
 * its own copy. */
export function StatisticsPageClient({
  initialProfile,
}: {
  initialProfile: PlayerProfileData | null;
}) {
  const { profile, status, error, analyze } = usePlayerProfile(initialProfile);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 text-xl font-bold text-text">Statistics</h1>
        <PlayerModelSection
          profile={profile}
          status={status}
          error={error}
          onAnalyze={analyze}
        />
      </div>

      <div className="border-t border-border-soft pt-6">
        <h2 className="text-lg font-bold text-text">The numbers</h2>
        <p className="mt-0.5 mb-6 text-xs text-text-faint">
          Plain counts from your recorded games - no engine, no comparison group. Read
          alongside &quot;Your playing style&quot; above for what these numbers actually mean.
        </p>
        <StatisticsSummary phaseAccuracy={profile?.phase_accuracy} perGame={profile?.per_game} />
      </div>
    </div>
  );
}
