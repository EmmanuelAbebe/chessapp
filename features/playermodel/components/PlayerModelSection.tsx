"use client";

import type { AnalyzeOptions, AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";
import { AnalyzePanel } from "./AnalyzePanel";
import { ComplexityByMove } from "./ComplexityByMove";
import { ProfileHero } from "./ProfileHero";
import { ProfileSkeleton } from "./ProfileSkeleton";
import { StyleAxes } from "./StyleAxes";
import { WhereYouDiffer } from "./WhereYouDiffer";

/** The player-behaviour model, composed onto /dashboard/statistics above
 * the existing (notation-only) StatisticsSummary, which stays as "Game
 * history." Profile state is lifted to StatisticsPageClient (rather than
 * owned here via usePlayerProfile directly) so StatisticsSummary's phase
 * comparison chart can read the same `phase_accuracy` without a second,
 * independent fetch. */
export function PlayerModelSection({
  profile,
  status,
  error,
  progress,
  onAnalyze,
}: {
  profile: PlayerProfileData | null;
  status: AnalyzeStatus;
  error: string | null;
  progress?: { processed: number; total: number } | null;
  onAnalyze: (opts?: AnalyzeOptions) => void;
}) {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-text">
        Your playing style
        <HintIcon
          text="Engine-verified, compared against players who share your style - skill estimate, style axes, and where you differ from them."
          width="w-56"
        />
      </h2>

      <AnalyzePanel profile={profile} status={status} error={error} progress={progress} onAnalyze={onAnalyze} />

      {profile ? (
        <div className={status === "loading" ? "relative" : undefined}>
          {status === "loading" && (
            <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-full border border-border-soft bg-surface px-2.5 py-1 text-[11px] text-text-dim shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {progress ? `Updating… ${progress.processed}/${progress.total} games` : "Refreshing…"}
            </div>
          )}
          {/* Content stays at full opacity while loading - the whole point
              of chunked analysis is watching these numbers/charts update
              live as more games are folded in, not staring at a dimmed
              placeholder until it's all done. */}
          <div className="flex flex-col gap-16">
            {profile.source.provider === "lichess" ? (
              <ProfileHero profile={profile} />
            ) : (
              // Skill estimate and "where you differ" both need the
              // Lichess-built reference population/cohort matching - not
              // meaningful for a chess.com profile (see the caveat below).
              // Style axes ARE shown below regardless: they're computed
              // from this player's own games only, no comparison group
              // involved, same as the per-game charts.
              <p className="text-xs text-text-faint">
                {profile.source.games_analyzed} {profile.source.time_class} games
                {profile.source.date_range ? ` · ${profile.source.date_range[0]} – ${profile.source.date_range[1]}` : ""}
              </p>
            )}
            <StyleAxes axes={profile.style.axes} />
            <ComplexityByMove buckets={profile.complexity_by_move} />

            {profile.source.provider === "lichess" && (
              <WhereYouDiffer
                strengths={profile.strengths}
                focusAreas={profile.focus_areas}
                signature={profile.style.signature}
              />
            )}

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
