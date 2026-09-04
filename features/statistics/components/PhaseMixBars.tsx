import type { PhaseMix } from "../lib/traits";

const PHASES: { key: keyof PhaseMix; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

/** How far the player's games tend to go, not where they're strongest -
 * a share of moves per phase, same solid-fill convention EvalBar uses,
 * not a strength breakdown (that needs move-quality classification,
 * deferred with the other engine-grounded traits). */
export function PhaseMixBars({ mix }: { mix: PhaseMix }) {
  return (
    <div className="flex flex-col gap-2">
      {PHASES.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-xs text-text-dim">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${mix[key]}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-xs text-text-faint">
            {mix[key].toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
