"use client";

// The previewed node's best move, styled the same as the map's own
// depth-ring hover tooltip (see MoveTreeMap) - a small pill under the mini
// board rather than a full label grid. Move/ply are already visible
// elsewhere (AiChatPanel's move counter, the ring itself); eval now shows
// as the reused EvalBar next to the board instead of a text row here.
export function MapNodeDetails({
  bestMoveSan,
  isSettled,
}: {
  bestMoveSan: string | null;
  isSettled: boolean;
}) {
  return (
    <div className="mx-auto w-fit rounded-md border border-accent bg-surface-raised px-2 py-1 font-mono text-xs text-text">
      Best: {isSettled && bestMoveSan ? bestMoveSan : "…"}
    </div>
  );
}
