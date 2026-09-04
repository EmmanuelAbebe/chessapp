"use client";

type EvalBarProps = {
  visible: boolean;
  whitePercent: number;
  depth: number;
  bestMove: string | null;
};

export function EvalBar({
  visible,
  whitePercent,
  depth,
  bestMove,
}: EvalBarProps) {
  return (
    <div
      className={`relative -ml-6 w-4 shrink-0 overflow-hidden border border-border transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      title={`Depth ${depth}${bestMove ? ` • ${bestMove}` : ""}`}
    >
      <div className="absolute inset-0 bg-neutral-900" />
      <div
        className="absolute right-0 bottom-0 left-0 bg-neutral-100"
        style={{ height: `${whitePercent}%` }}
      />
      <div className="absolute left-0 top-1/2 z-10 h-px w-full -translate-y-1/2 bg-neutral-600" />
    </div>
  );
}
