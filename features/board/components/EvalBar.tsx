"use client";

type EvalBarProps = {
  visible: boolean;
  whitePercent: number;
  depth: number;
  bestMove: string | null;
};

// Width grows/shrinks first, opacity fades in only once there's room (and
// fades out before the space collapses back).
const SHOW_TRANSITION = "width 200ms ease-out, opacity 150ms ease-out 200ms";
const HIDE_TRANSITION = "opacity 150ms ease-out, width 200ms ease-out 150ms";

export function EvalBar({
  visible,
  whitePercent,
  depth,
  bestMove,
}: EvalBarProps) {
  return (
    <div
      className={`relative -ml-6 shrink-0 overflow-hidden border-border ${
        visible ? "w-4 border opacity-100" : "w-0 border-0 opacity-0"
      }`}
      style={{ transition: visible ? SHOW_TRANSITION : HIDE_TRANSITION }}
      title={`Depth ${depth}${bestMove ? ` • ${bestMove}` : ""}`}
    >
      {/* Fixed w-4 regardless of the parent's animated width, so the bar
          gets clipped (wiped) by the shrinking overflow-hidden boundary
          instead of squishing as it collapses. */}
      <div className="absolute top-1/2 left-0 z-10 h-px w-4 -translate-y-1/2 bg-neutral-600" />
      <div className="absolute inset-y-0 left-0 w-4 bg-background" />
      <div
        className="absolute bottom-0 left-0 w-4 bg-neutral-100"
        style={{ height: `${whitePercent}%` }}
      />
    </div>
  );
}
