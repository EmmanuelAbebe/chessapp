"use client";

import { useState } from "react";
import type { StyleAxis, StyleTrajectoryPoint } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";

// Square plot, generous label margins - verified (via a real screenshot
// pass on the exploratory mock this was ported from) not to clip the
// two-line pole labels at the plot's edges.
const PAD = 60;
const SIZE = 420;
const W = PAD * 2 + SIZE;
const H = PAD * 2 + SIZE;

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

/** Uniform Catmull-Rom through `points`, converted to cubic Bezier
 * segments - a real curve through every point in order, not a hand-drawn
 * shape. Endpoints are clamped (reused as their own neighbour) so the
 * curve doesn't overshoot past the first/last real point. */
function catmullRomPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  }
  return d;
}

/** A 2D read of identity from 2 of the 5 style axes (PC0/PC3 - the pair
 * with the strongest, cleanest loadings, same as the exploratory mock)
 * plus, when available, a real curve tracing how that style actually
 * moves across a typical game (`style_trajectory` - a real per-move-
 * number style vector, no reference population, same self-referential
 * principle as critical_lessons). Domain auto-scales to this player's
 * own range (same convention `ComplexityByMove` already uses), since
 * trajectory magnitudes run much larger than the whole-game vector's
 * usual scale - two different players' compasses are never on the same
 * ruler, deliberately. */
export function StyleCompass({
  vector,
  axes,
  trajectory,
}: {
  vector: number[];
  axes: StyleAxis[];
  trajectory?: StyleTrajectoryPoint[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // No real PC0-PC3 labels for this format yet (e.g. bullet today) -
  // same "nothing to plot" gate StyleAxes uses for axes.length === 0.
  if (axes.length < 4) return null;

  const xi = 0;
  const yi = 3;
  const [xLeft, xRight] = poles(axes[xi].label);
  const [yBottom, yTop] = poles(axes[yi].label);

  const points = (trajectory ?? []).slice().sort((a, b) => a.move_number - b.move_number);
  const allX = [vector[xi], ...points.map((p) => p.vector[xi])];
  const allY = [vector[yi], ...points.map((p) => p.vector[yi])];
  const maxAbs = Math.max(3, ...allX.map(Math.abs), ...allY.map(Math.abs));
  const half = maxAbs * 1.15;

  const toX = (v: number) => PAD + ((v + half) / (2 * half)) * SIZE;
  const toY = (v: number) => PAD + SIZE - ((v + half) / (2 * half)) * SIZE;

  const curvePts: [number, number][] = points.map((p) => [toX(p.vector[xi]), toY(p.vector[yi])]);
  const pathD = catmullRomPath(curvePts);
  const overallX = toX(vector[xi]);
  const overallY = toY(vector[yi]);

  const active = hoverIdx !== null ? points[hoverIdx] : null;
  const activeXY = hoverIdx !== null ? curvePts[hoverIdx] : null;
  const tooltipLeft = activeXY !== null && activeXY[0] > PAD + SIZE * 0.6;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Style compass
        <HintIcon
          text="Two of your five style axes, plotted together. The large dot is your overall style; the curve (when shown) traces how it actually shifts across a typical game, move by move - your own moves only, scored only against Stockfish, no comparison to other players. Scaled to your own range, not a fixed ruler, so it never clips."
          width="w-64"
        />
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" preserveAspectRatio="xMidYMid meet">
        <rect x={PAD} y={PAD} width={SIZE} height={SIZE} fill="none" stroke="var(--border)" />
        <line x1={PAD} y1={PAD + SIZE / 2} x2={PAD + SIZE} y2={PAD + SIZE / 2} stroke="var(--border-soft)" strokeDasharray="3 3" />
        <line x1={PAD + SIZE / 2} y1={PAD} x2={PAD + SIZE / 2} y2={PAD + SIZE} stroke="var(--border-soft)" strokeDasharray="3 3" />

        <text x={PAD + SIZE / 2} y={PAD - 20} textAnchor="middle" fontSize="12" fill="var(--text-dim)">{yTop}</text>
        <text x={PAD + SIZE / 2} y={PAD + SIZE + 34} textAnchor="middle" fontSize="12" fill="var(--text-dim)">{yBottom}</text>
        <text
          x={PAD - 44} y={PAD + SIZE / 2} textAnchor="middle" fontSize="12" fill="var(--text-dim)"
          transform={`rotate(-90 ${PAD - 44} ${PAD + SIZE / 2})`}
        >
          {xLeft}
        </text>
        <text
          x={PAD + SIZE + 44} y={PAD + SIZE / 2} textAnchor="middle" fontSize="12" fill="var(--text-dim)"
          transform={`rotate(90 ${PAD + SIZE + 44} ${PAD + SIZE / 2})`}
        >
          {xRight}
        </text>

        {pathD && <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.75} />}
        {points.map((p, i) => {
          const [x, y] = curvePts[i];
          const isHovered = hoverIdx === i;
          return (
            <g key={p.move_number} className="cursor-default" onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
              <circle cx={x} cy={y} r={10} fill="transparent" />
              <circle
                cx={x} cy={y} r={isHovered ? 5.5 : 4}
                fill="var(--surface)" stroke="var(--accent)" strokeWidth={2}
                className="transition-all"
              />
            </g>
          );
        })}

        <circle cx={overallX} cy={overallY} r={8} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />
        <text x={overallX} y={overallY - 14} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--accent)">
          You
        </text>

        {active && activeXY && (
          <g pointerEvents="none">
            <g transform={`translate(${tooltipLeft ? activeXY[0] - 8 : activeXY[0] + 8}, ${Math.max(PAD + 2, activeXY[1] - 40)})`}>
              <rect x={tooltipLeft ? -128 : 0} y={0} width={128} height={32} rx={5} fill="var(--surface-raised)" stroke="var(--border)" />
              <text x={tooltipLeft ? -118 : 10} y={13} fontSize="11" fontWeight={600} fill="var(--text)">
                Move {active.move_number}-{active.move_number + 4}
              </text>
              <text x={tooltipLeft ? -118 : 10} y={25} fontSize="10" fill="var(--text-faint)">
                {active.n} moves in this range
              </text>
            </g>
          </g>
        )}
      </svg>
      <p className="text-[11px] text-text-faint">
        Scaled to your own range (±{half.toFixed(1)}), not a fixed ruler - shape matters here, not the absolute
        number, and this scale isn't the same from one player's compass to another's.
      </p>
    </div>
  );
}
