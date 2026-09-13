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
import type { PlayerProfileData } from "@/features/playermodel/types";
import { computePhaseMix } from "../lib/traits";
import { computeOpenings } from "../lib/summary";
import { PhaseBreakdownChart } from "./PhaseBreakdownChart";
import { OpeningsBreakdown } from "./OpeningsBreakdown";
import { WinRateTimeline } from "./WinRateTimeline";

export default function StatisticsSummary({
  phaseAccuracy,
}: {
  /** From the player-behaviour model above (StatisticsPageClient), so the
   * phase chart can pair move-share with real accuracy without a second
   * fetch. Undefined until that model has been analyzed at least once. */
  phaseAccuracy?: PlayerProfileData["phase_accuracy"];
}) {
  const { games } = useGameHistory();
  const [side, setSide] = useState<SideFilter>("all");

  const counts = useMemo(() => sideGameCounts(games), [games]);
  const filteredGames = useMemo(
    () => filterGamesBySide(games, side),
    [games, side],
  );
  const openings = useMemo(
    () => computeOpenings(filteredGames),
    [filteredGames],
  );
  const phaseMix = useMemo(() => computePhaseMix(filteredGames), [filteredGames]);

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

      {filteredGames.length === 0 ? (
        <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
          No games recorded {side === "w" ? "as White" : "as Black"} yet.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-border-soft bg-surface p-4">
            <WinRateTimeline games={filteredGames} />
          </div>

          {phaseMix && (
            <div className="rounded-lg border border-border-soft bg-surface p-4">
              <PhaseBreakdownChart mix={phaseMix} accuracy={phaseAccuracy} />
            </div>
          )}
          <div className="rounded-lg border border-border-soft bg-surface p-4">
            <OpeningsBreakdown breakdown={openings} side={side} />
          </div>
        </>
      )}

      <details className="rounded-lg border border-border-soft bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold tracking-wide text-text-faint uppercase">
          Manage games
        </summary>
        <div className="border-t border-border-soft p-4">
          <GameDataCard />
        </div>
      </details>

      <GamesList games={filteredGames} />
    </section>
  );
}
