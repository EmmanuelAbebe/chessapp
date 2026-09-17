"use client";

import type { TraitStability as TraitStabilityRow } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

function narrative(t: TraitStabilityRow): string {
  if (t.stable) {
    return `Consistent from ${t.first_elo} to ${t.last_elo} rated play - a real, stable part of your style, not just this period.`;
  }
  const [left, right] = poles(t.label);
  const towardRight = t.last_value > t.first_value;
  const towardLabel = towardRight ? right : left;
  const base = `Moved toward "${towardLabel}" as your rating went from ${t.first_elo} to ${t.last_elo}`;
  if (t.correlation_with_rating == null) return `${base}.`;
  const strength = Math.abs(t.correlation_with_rating) >= 0.6 ? "strongly" : "loosely";
  return `${base} - ${strength} linked to that rating change (r=${t.correlation_with_rating.toFixed(2)}), not proof one caused the other.`;
}

/** Tests each style axis independently for whether it's actually stayed
 * the same across your whole selected history, or genuinely changed - a
 * trait isn't assumed stable just because "style doesn't change much,"
 * and a real history-spanning improvement isn't hidden inside a single
 * blended average either. Only renders once there's enough real history
 * (60+ games) for the question to mean anything - most profiles won't
 * show this section at all. */
export function TraitStability({ traits }: { traits?: TraitStabilityRow[] }) {
  const rows = traits ?? [];
  if (rows.length === 0) return null;

  const changed = rows.filter((t) => !t.stable);
  const stable = rows.filter((t) => t.stable);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        What's changed, what hasn't
        <HintIcon
          text="Each style axis tested independently across your whole selected history, split into chronological chunks - not assumed stable, not blended into one average that could hide real improvement. 'Changed' axes are compared against your own real rating at the time of each chunk (from the games' own headers, no model involved) to see if the shift lines up with getting stronger."
          width="w-64"
        />
      </h3>
      <div className="divide-y divide-border-soft rounded-lg border border-border-soft bg-surface">
        {[...changed, ...stable].map((t) => (
          <div key={t.axis_id} className="flex flex-col gap-1 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  t.stable ? "bg-good-soft text-good" : "bg-accent/15 text-accent"
                }`}
              >
                {t.stable ? "Stable" : "Changed"}
              </span>
              <span className="text-xs font-medium text-text">{t.label}</span>
            </div>
            <p className="text-[11px] text-text-faint">{narrative(t)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
