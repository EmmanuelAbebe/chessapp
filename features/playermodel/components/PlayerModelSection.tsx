"use client";

import type { AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";
import { AnalyzePanel } from "./AnalyzePanel";
import { FocusAreaCards } from "./FocusAreaCards";
import { ProfileHero } from "./ProfileHero";
import { SignatureCards } from "./SignatureCards";
import { StrengthCards } from "./StrengthCards";
import { StyleAxes } from "./StyleAxes";

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
          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <ProfileHero profile={profile} />
            <StyleAxes axes={profile.style.axes} />
          </div>

          <SignatureCards items={profile.style.signature} />
          <StrengthCards strengths={profile.strengths} />
          <FocusAreaCards areas={profile.focus_areas} />

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
