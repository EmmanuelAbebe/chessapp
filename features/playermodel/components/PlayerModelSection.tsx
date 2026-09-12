"use client";

import type { AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";
import { AnalyzePanel } from "./AnalyzePanel";
import { ProfileHero } from "./ProfileHero";
import { StyleAxes } from "./StyleAxes";
import { WhereYouDiffer } from "./WhereYouDiffer";

/** The player-behaviour model, composed onto /dashboard/statistics above
 * the existing (notation-only) StatisticsSummary, which stays as "the
 * numbers." Profile state is lifted to StatisticsPageClient (rather than
 * owned here via usePlayerProfile directly) so StatisticsSummary's phase
 * comparison chart can read the same `phase_accuracy` without a second,
 * independent fetch. */
export function PlayerModelSection({
  profile,
  status,
  error,
  onAnalyze,
}: {
  profile: PlayerProfileData | null;
  status: AnalyzeStatus;
  error: string | null;
  onAnalyze: (opts?: { force?: boolean; maxGames?: number }) => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text">Your playing style</h2>
      </div>

      <AnalyzePanel profile={profile} status={status} error={error} onAnalyze={onAnalyze} />

      {profile && (
        <>
          <ProfileHero profile={profile} />
          <StyleAxes axes={profile.style.axes} />

          <WhereYouDiffer
            strengths={profile.strengths}
            focusAreas={profile.focus_areas}
            signature={profile.style.signature}
          />

          {profile.caveats.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-text-faint">
              {profile.caveats.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
