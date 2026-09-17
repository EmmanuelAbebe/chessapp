"use client";

import { useState } from "react";
import type { PhaseAccuracy, StyleAxis, StyleTrajectoryPoint } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";
import type { PhaseMix } from "@/features/statistics/lib/traits";

// Square plot, generous label margins - verified (via a real screenshot
// pass on the exploratory mock this was ported from) not to clip the
// two-line pole labels at the plot's edges.
const PAD = 60;
const SIZE = 420;
const W = PAD * 2 + SIZE;
const H = PAD * 2 + SIZE;

const PHASE_LABEL: Record<StyleTrajectoryPoint["phase"], string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
};
// Distinct from --accent (used for the overall "You" dot) so "which
// stretch of the game" and "your overall style" never get confused.
const PHASE_COLOR: Record<StyleTrajectoryPoint["phase"], string> = {
  opening: "var(--good)",
  middlegame: "var(--accent)",
  endgame: "var(--bad)",
};

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

/** Uniform Catmull-Rom through `points`, converted to per-segment cubic
 * Bezier curves - a real curve through every point in order, not a
 * hand-drawn shape. Returns one segment per consecutive pair (rather
 * than one joined path) so each can be colored by its own game phase;
 * the control-point math is identical either way. Endpoints are clamped
 * (reused as their own neighbour) so the curve doesn't overshoot past
 * the first/last real point. */
function catmullRomSegments(points: [number, number][]): { d: string; toIdx: number }[] {
  if (points.length < 2) return [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const segments: { d: string; toIdx: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    segments.push({ d: `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`, toIdx: i + 1 });
  }
  return segments;
}

function formatFeatureValue(feature: string, value: number): string {
  // mean_think_time (seconds) and the two approximated features read
  // oddly as a percentage - everything else in this fixed explain-list
  // is a genuine 0..1 rate.
  if (feature === "mean_think_time") return `${value.toFixed(1)}s`;
  if (feature === "eval_volatility_mean" || feature === "material_swing_mean") return value.toFixed(1);
  return `${Math.round(value * 100)}%`;
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
 * ruler, deliberately. The curve is colored by each stretch's dominant
 * game phase; clicking a point explains why it sits where it does, in
 * terms of this player's own real behaviors vs. their overall average -
 * plus, when available, that phase's overall move-share and accuracy
 * gap (formerly a separate, disconnected "phase mix" chart - absorbed
 * here since every point already carries a real phase label). */
export function StyleCompass({
  vector,
  axes,
  trajectory,
  phaseMix,
  phaseAccuracy,
}: {
  vector: number[];
  axes: StyleAxis[];
  trajectory?: StyleTrajectoryPoint[];
  phaseMix?: PhaseMix | null;
  phaseAccuracy?: Partial<Record<StyleTrajectoryPoint["phase"], PhaseAccuracy>>;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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
  const segments = catmullRomSegments(curvePts);
  const overallX = toX(vector[xi]);
  const overallY = toY(vector[yi]);

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const hoveredXY = hoverIdx !== null ? curvePts[hoverIdx] : null;
  const tooltipLeft = hoveredXY !== null && hoveredXY[0] > PAD + SIZE * 0.6;

  const selected = selectedIdx !== null ? points[selectedIdx] : null;
  const phasesShown = [...new Set(points.map((p) => p.phase))] as StyleTrajectoryPoint["phase"][];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Style compass
        <HintIcon
          text="Two of your five style axes, plotted together. The large dot is your overall style; the curve (when shown) traces how it actually shifts across a typical game, colored by game phase - your own moves only, scored only against Stockfish, no comparison to other players. Click a point to see why it sits where it does, plus that phase's move-share and accuracy. Scaled to your own range, not a fixed ruler, so it never clips."
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

        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={PHASE_COLOR[points[seg.toIdx].phase]}
            strokeWidth={selectedIdx === seg.toIdx || selectedIdx === seg.toIdx - 1 ? 3 : 2}
            opacity={0.8}
          />
        ))}
        {points.map((p, i) => {
          const [x, y] = curvePts[i];
          const isHovered = hoverIdx === i;
          const isSelected = selectedIdx === i;
          return (
            <g
              key={p.move_number}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            >
              <circle cx={x} cy={y} r={11} fill="transparent" />
              <circle
                cx={x} cy={y} r={isSelected ? 6.5 : isHovered ? 5.5 : 4}
                fill={isSelected ? PHASE_COLOR[p.phase] : "var(--surface)"}
                stroke={PHASE_COLOR[p.phase]} strokeWidth={2}
                className="transition-all"
              />
            </g>
          );
        })}

        <circle cx={overallX} cy={overallY} r={8} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />
        <text x={overallX} y={overallY - 14} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--accent)">
          You
        </text>

        {hovered && hoveredXY && selectedIdx === null && (
          <g pointerEvents="none">
            <g transform={`translate(${tooltipLeft ? hoveredXY[0] - 8 : hoveredXY[0] + 8}, ${Math.max(PAD + 2, hoveredXY[1] - 40)})`}>
              <rect x={tooltipLeft ? -128 : 0} y={0} width={128} height={32} rx={5} fill="var(--surface-raised)" stroke="var(--border)" />
              <text x={tooltipLeft ? -118 : 10} y={13} fontSize="11" fontWeight={600} fill="var(--text)">
                Move {hovered.move_number}-{hovered.move_number + 4}
              </text>
              <text x={tooltipLeft ? -118 : 10} y={25} fontSize="10" fill="var(--text-faint)">
                {PHASE_LABEL[hovered.phase]} · {hovered.n} moves
              </text>
            </g>
          </g>
        )}
      </svg>

      {phasesShown.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-faint">
          {phasesShown.map((phase) => (
            <span key={phase} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[phase] }} />
              {PHASE_LABEL[phase]}
            </span>
          ))}
          <span>· click a point for detail</span>
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-surface-raised/60 px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text">
              Move {selected.move_number}-{selected.move_number + 4} · {PHASE_LABEL[selected.phase]}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIdx(null)}
              className="text-[11px] text-text-faint transition hover:text-text"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-text-faint">
            Why this stretch sits where it does, vs. your own overall average - no comparison to other players.
          </p>
          {(phaseMix?.[selected.phase] !== undefined || phaseAccuracy?.[selected.phase]) && (
            <div className="flex flex-col gap-1 border-b border-border-soft pb-2">
              {phaseMix?.[selected.phase] !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-dim">Share of a typical game</span>
                  <span className="font-mono text-text">{Math.round(phaseMix[selected.phase])}%</span>
                </div>
              )}
              {phaseAccuracy?.[selected.phase] && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-dim">Accuracy here vs. your overall average</span>
                  <span className="font-mono text-text">
                    {phaseAccuracy[selected.phase]!.you.toFixed(1)}%
                    <span className="text-text-faint"> vs {phaseAccuracy[selected.phase]!.your_overall.toFixed(1)}%</span>
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            {selected.feature_deltas.map((fd) => (
              <div key={fd.feature} className="flex items-center justify-between text-xs">
                <span className="text-text-dim">{fd.label}</span>
                <span className="font-mono text-text">
                  {formatFeatureValue(fd.feature, fd.bin_value)}
                  <span className="text-text-faint"> here · {formatFeatureValue(fd.feature, fd.overall_value)} overall</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-faint">
        Scaled to your own range (±{half.toFixed(1)}), not a fixed ruler - shape matters here, not the absolute
        number, and this scale isn't the same from one player's compass to another's.
      </p>
    </div>
  );
}
