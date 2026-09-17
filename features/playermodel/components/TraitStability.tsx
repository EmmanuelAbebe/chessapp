"use client";

import { useState } from "react";
import type { TraitStability as TraitStabilityRow, TraitStabilityPoint } from "../types";
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

const CHART_W = 240;
const CHART_H = 68;
const PAD_X = 4;
const PAD_T = 8;
const PAD_B = 14;
const PLOT_W = CHART_W - PAD_X * 2;
const PLOT_H = CHART_H - PAD_T - PAD_B;

/** This axis's real value across every chronological bucket (solid),
 * paired with that bucket's real median rating (dashed, its own
 * independent scale) - shows the actual shape of a change (steady drift
 * vs. a sudden jump vs. bucket-to-bucket noise), which the narrative's
 * first/last numbers alone can't. */
function TrendChart({ points, stable }: { points: TraitStabilityPoint[]; stable: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const n = points.length;
  if (n < 2) return null;

  const values = points.map((p) => p.value);
  const elos = points.map((p) => p.elo);
  const minV = Math.min(...values);
  const spanV = Math.max(0.05, Math.max(...values) - minV);
  const minE = Math.min(...elos);
  const spanE = Math.max(1, Math.max(...elos) - minE);

  const xFor = (i: number) => PAD_X + (i / (n - 1)) * PLOT_W;
  const yForV = (v: number) => PAD_T + PLOT_H - ((v - minV) / spanV) * PLOT_H;
  const yForE = (v: number) => PAD_T + PLOT_H - ((v - minE) / spanE) * PLOT_H;
  const cellW = PLOT_W / n;

  const valueColor = stable ? "var(--good)" : "var(--accent)";
  const valuePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yForV(p.value).toFixed(1)}`).join(" ");
  const eloPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yForE(p.elo).toFixed(1)}`).join(" ");

  const active = hoverIdx !== null ? points[hoverIdx] : null;
  const activeX = hoverIdx !== null ? xFor(hoverIdx) : 0;
  const tooltipLeft = activeX > PLOT_W * 0.6;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-[68px] w-[240px] shrink-0 touch-none select-none">
      <path d={eloPath} fill="none" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="2 2" />
      <path d={valuePath} fill="none" stroke={valueColor} strokeWidth={1.75} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} className="cursor-default">
          <rect x={xFor(i) - cellW / 2} y={0} width={cellW} height={CHART_H} fill="transparent" />
          <circle cx={xFor(i)} cy={yForV(p.value)} r={hoverIdx === i ? 3 : 1.75} fill={valueColor} />
        </g>
      ))}
      <text x={0} y={CHART_H - 2} fontSize="8" fill="var(--text-faint)">
        {points[0].date}
      </text>
      <text x={CHART_W} y={CHART_H - 2} textAnchor="end" fontSize="8" fill="var(--text-faint)">
        {points[n - 1].date}
      </text>
      {active && (
        <g pointerEvents="none" transform={`translate(${tooltipLeft ? activeX - 6 : activeX + 6}, ${Math.max(0, yForV(active.value) - 34)})`}>
          <rect x={tooltipLeft ? -102 : 0} y={0} width={102} height={30} rx={4} fill="var(--surface-raised)" stroke="var(--border)" />
          <text x={tooltipLeft ? -94 : 8} y={12} fontSize="9" fontWeight={600} fill="var(--text)">
            {active.date}
          </text>
          <text x={tooltipLeft ? -94 : 8} y={23} fontSize="8" fill="var(--text-faint)">
            {`value ${active.value.toFixed(2)} · ${active.elo} elo`}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Tests each style axis independently for whether it's actually stayed
 * the same across your whole selected history, or genuinely changed - a
 * trait isn't assumed stable just because "style doesn't change much,"
 * and a real history-spanning improvement isn't hidden inside a single
 * blended average either. Each row pairs the plain-language narrative
 * with a real per-bucket trend chart (solid: this axis, dashed: your
 * rating) so a "changed" axis's actual shape is visible, not just its
 * two endpoints - and so a "stable" axis's steadiness can be seen too,
 * not just claimed. Only renders once there's enough real history (60+
 * games) for the question to mean anything - most profiles won't show
 * this section at all. */
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
          text="Each style axis tested independently across your whole selected history, split into chronological chunks - not assumed stable, not blended into one average that could hide real improvement. 'Changed' axes are compared against your own real rating at the time of each chunk (from the games' own headers, no model involved) to see if the shift lines up with getting stronger. The chart's solid line is the trait's real per-chunk value; the dashed line is your real rating over the same chunks."
          width="w-64"
        />
      </h3>
      <div className="divide-y divide-border-soft rounded-lg border border-border-soft bg-surface">
        {[...changed, ...stable].map((t) => (
          <div key={t.axis_id} className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
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
            <TrendChart points={t.points} stable={t.stable} />
          </div>
        ))}
      </div>
    </div>
  );
}
