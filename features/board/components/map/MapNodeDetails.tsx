"use client";

import { winRatePercent, type NodeOutcomeStats } from "../../lib/map/node-stats";

// The previewed node's best move, styled the same as the map's own
// depth-ring hover tooltip (see MoveTreeMap) - a small pill under the mini
// board rather than a full label grid. Move/ply are already visible
// elsewhere (AiChatPanel's move counter, the ring itself); eval now shows
// as the reused EvalBar next to the board instead of a text row here.
export function MapNodeDetails({
  bestMoveSan,
  isSettled,
  stats,
}: {
  bestMoveSan: string | null;
  isSettled: boolean;
  stats: NodeOutcomeStats | undefined;
}) {
  const rate = winRatePercent(stats);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="mx-auto w-fit rounded-md border border-accent bg-surface-raised px-2 py-1 font-mono text-xs text-text">
        Best: {isSettled && bestMoveSan ? bestMoveSan : "…"}
      </div>

      {/* From the player's own recorded games (Statistics history), not
          the currently-displayed tree's structure - see node-stats.ts. */}
      <div className="font-mono text-[11px] text-text-faint">
        {rate === null || !stats ? (
          "No recorded games reached this position"
        ) : (
          <>
            {stats.games} game{stats.games === 1 ? "" : "s"} · {rate.toFixed(0)}%{" "}
            ({stats.wins}W {stats.draws}D {stats.losses}L)
          </>
        )}
      </div>
    </div>
  );
}
