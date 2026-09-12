import type { PhaseMix } from "../lib/traits";
import type { PhaseAccuracy } from "@/features/playermodel/types";

const PHASES: { key: keyof PhaseMix; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

/** Move share (how much of a game you spend in each phase) paired with
 * accuracy gap vs. players at your level in that same phase - two bars per
 * row sharing a zero-centred scale for the gap, so "biggest share" and
 * "biggest weakness" read as two separate, comparable questions instead of
 * being folded into one metric. */
export function PhaseBreakdownChart({
  mix,
  accuracy,
}: {
  mix: PhaseMix;
  accuracy?: Partial<Record<"opening" | "middlegame" | "endgame", PhaseAccuracy>>;
}) {
  const hasAccuracy = Boolean(accuracy && Object.keys(accuracy).length > 0);
  const deltas = PHASES.map(({ key }) => {
    const acc = accuracy?.[key];
    return acc ? acc.you - acc.peers : null;
  });
  const scale = Math.max(1, ...deltas.filter((d): d is number => d !== null).map((d) => Math.abs(d)));

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Phase mix{hasAccuracy ? " & accuracy" : ""}
      </h3>
      <p className="mb-3 text-[11px] text-text-faint">
        Left bar: how much of each game you spend in that phase. Right bar:{" "}
        {hasAccuracy
          ? "your move-quality gap vs. players at your level there — red is worse than typical, green is better."
          : "analyze your games above to see your accuracy gap in each phase."}
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-[9px] font-semibold tracking-wide text-text-faint uppercase">
          <span className="w-20 shrink-0 sm:w-24" />
          <span className="flex-[3]">move share</span>
          <span className="flex-[2]">accuracy gap</span>
        </div>
        {PHASES.map(({ key, label }) => {
          const share = mix[key];
          const delta = deltas[PHASES.findIndex((p) => p.key === key)];
          const pct = delta !== null ? (Math.abs(delta) / scale) * 50 : 0;
          const gapColor = delta === null ? "var(--text-faint)" : delta <= 0 ? "var(--good)" : "var(--bad)";
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-medium text-text sm:w-24">{label}</span>

              <div className="h-2 flex-[3] overflow-hidden rounded-full bg-surface-raised">
                <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-[11px] text-text-faint">
                {share.toFixed(0)}%
              </span>

              <div className="relative h-2 flex-[2] overflow-hidden rounded-full bg-surface-raised">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                {delta !== null && (
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={
                      delta >= 0
                        ? { left: "50%", width: `${pct}%`, background: gapColor }
                        : { right: "50%", width: `${pct}%`, background: gapColor }
                    }
                  />
                )}
              </div>
              <span
                className="w-14 shrink-0 text-right font-mono text-[11px] font-semibold"
                style={{ color: gapColor }}
              >
                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "pending"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
