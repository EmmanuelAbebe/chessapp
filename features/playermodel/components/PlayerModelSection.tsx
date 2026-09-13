"use client";

import type { AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";
import { AnalyzePanel } from "./AnalyzePanel";
import { ProfileHero } from "./ProfileHero";
import { ProfileSkeleton } from "./ProfileSkeleton";
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
      <div>
        <h2 className="text-lg font-bold text-text">Your playing style</h2>
        <p className="mt-0.5 text-xs text-text-faint">
          Engine-verified, compared against players who share your style - skill estimate,
          style axes, and where you differ from them.
        </p>
      </div>

      <AnalyzePanel profile={profile} status={status} error={error} onAnalyze={onAnalyze} />

      {profile ? (
        <div className={status === "loading" ? "relative" : undefined}>
          {status === "loading" && (
            <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-full border border-border-soft bg-surface px-2.5 py-1 text-[11px] text-text-dim shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Refreshing…
            </div>
          )}
          <div className={`flex flex-col gap-6 transition-opacity ${status === "loading" ? "opacity-50" : ""}`}>
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
          </div>
        </div>
      ) : (
        status === "loading" && <ProfileSkeleton />
      )}
    </section>
  );
}
