import type { PhaseMix } from "../lib/traits";
import type { PhaseAccuracy } from "@/features/playermodel/types";

const PHASES: { key: keyof PhaseMix; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

/** Where your games go (move-share, notation-only, always available) next
 * to where you actually lose accuracy (win-probability loss vs. players at
 * your level, from the player-behaviour model above) - two different axes
 * neither section shows alone: a phase can dominate your move count without
 * being where you're weakest, or vice versa. */
export function PhaseComparisonChart({
  mix,
  accuracy,
}: {
  mix: PhaseMix;
  accuracy?: Partial<Record<"opening" | "middlegame" | "endgame", PhaseAccuracy>>;
}) {
  const hasAccuracy = Boolean(accuracy && Object.keys(accuracy).length > 0);

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Phase mix{hasAccuracy ? " & accuracy" : ""}
      </h3>
      <p className="mb-3 text-[11px] text-text-faint">
        The bar is how much of each game you spend in that phase.{" "}
        {hasAccuracy
          ? "The number on the right is your move-quality gap vs. players at your level in that phase (from “Your playing style” above) — negative means you do better than typical there."
          : "Analyze your games above to also see your accuracy gap vs. players at your level in each phase."}
      </p>
      <div className="flex flex-col gap-2">
        {PHASES.map(({ key, label }) => {
          const acc = accuracy?.[key];
          const delta = acc ? acc.you - acc.peers : null;
          return (
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
              {delta !== null && acc && (
                <span
                  title={`You: ${acc.you.toFixed(1)} vs. players at your level: ${acc.peers.toFixed(1)} (win-probability loss - lower is better)`}
                  className={`w-20 shrink-0 text-right font-mono text-[11px] ${
                    delta <= 0 ? "text-good" : "text-bad"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} vs peers
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
