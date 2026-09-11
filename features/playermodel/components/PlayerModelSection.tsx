"use client";

import { usePlayerProfile } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";
import { AnalyzePanel } from "./AnalyzePanel";
import { FocusAreaCards } from "./FocusAreaCards";
import { ProfileHero } from "./ProfileHero";
import { SignatureCards } from "./SignatureCards";
import { StrengthCards } from "./StrengthCards";
import { StyleAxes } from "./StyleAxes";

/** The player-behaviour model, composed onto /dashboard/statistics above
 * the existing (notation-only) StatisticsSummary, which stays as "the
 * numbers." `initialProfile` comes from the server (features/playermodel/
 * data.ts); usePlayerProfile takes over from there for Analyze/Refresh. */
export function PlayerModelSection({
  initialProfile,
}: {
  initialProfile: PlayerProfileData | null;
}) {
  const { profile, status, error, analyze } = usePlayerProfile(initialProfile);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text">Your playing style</h2>
      </div>

      <AnalyzePanel profile={profile} status={status} error={error} onAnalyze={analyze} />

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
