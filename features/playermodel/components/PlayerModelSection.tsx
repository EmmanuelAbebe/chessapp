"use client";

import { useMemo } from "react";
import type { AnalyzeOptions, AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";
import { useGameHistory } from "@/features/history/useGameHistory";
import { computePhaseMix } from "@/features/statistics/lib/traits";
import { AnalyzePanel } from "./AnalyzePanel";
import { ComplexityByMove } from "./ComplexityByMove";
import { CriticalLessons } from "./CriticalLessons";
import { ProfileSkeleton } from "./ProfileSkeleton";
import { StyleRadar } from "./StyleRadar";

/** The player-behaviour model, composed onto /dashboard/statistics above
 * the existing (notation-only) StatisticsSummary, which stays as "Game
 * history." Profile state is lifted to StatisticsPageClient (rather than
 * owned here via usePlayerProfile directly) so it's shared with
 * StatisticsSummary's own charts without a second, independent fetch.
 * StyleRadar absorbs what used to be three separate sections here
 * (StyleAxes' bars, StyleCompass' 2D scatter + trajectory, TraitStability's
 * badges) into one radar with a filter switch (overall/career/phase/
 * opening/complexity) - phase mix + accuracy feed its "game phase" filter
 * the same way they used to feed StyleCompass's click detail.
 *
 * Everything below is self-referential - style axes are a fixed transform
 * of this player's own games, and critical lessons rank purely against
 * Stockfish's own evaluation of their own moves. No peer/reference
 * population involved, so this renders identically for every provider
 * and format. */
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
  // All-games phase mix (opening/middlegame/endgame move share) - not
  // part of the ML profile at all (it reads recorded-game notation, a
  // separate data source), computed here so the compass's click detail
  // can pair a phase with how much of a typical game it takes up, not
  // just this player's own real move-quality there. Deliberately not
  // filtered by White/Black side - the compass's phase context is about
  // which part of the game, not which side was played.
  const { games } = useGameHistory();
  const phaseMix = useMemo(() => computePhaseMix(games), [games]);

  return (
    <section className="flex flex-col gap-8">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-text">
        Your playing style
        <HintIcon
          text="Engine-verified, from your own games only: what kind of player you are (style axes) and where you lose the most win-probability vs. Stockfish's best move (critical lessons)."
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
            <p className="text-xs text-text-faint">
              {profile.source.games_analyzed} {profile.source.time_class} games
              {profile.source.date_range ? ` · ${profile.source.date_range[0]} – ${profile.source.date_range[1]}` : ""}
            </p>
            <StyleRadar
              vector={profile.style.vector}
              axes={profile.style.axes}
              trajectory={profile.style_trajectory}
              traitStability={profile.trait_stability}
              styleByOpening={profile.style_by_opening}
              styleByComplexity={profile.style_by_complexity}
              phaseMix={phaseMix}
              phaseAccuracy={profile.phase_accuracy}
            />
            <ComplexityByMove buckets={profile.complexity_by_move} />
            <CriticalLessons lessons={profile.critical_lessons} strong={profile.strong_situations} />

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
