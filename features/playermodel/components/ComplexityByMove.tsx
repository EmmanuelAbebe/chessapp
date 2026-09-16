"use client";

import { useState } from "react";
import type { ComplexityByMoveBucket } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";

const W = 640;
const H = 200;
const PAD_L = 30;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

// Same thresholds the ml pipeline itself uses to call a position "quiet"
// or "high complexity" (ml/pipeline/common/gameagg.py) - reused here so
// the chart's zones mean the same thing everywhere in the app.
const QUIET_MAX = 15;
const SHARP_MIN = 25;

function colorFor(v: number): string {
  if (v >= SHARP_MIN) return "var(--bad)";
  if (v <= QUIET_MAX) return "var(--text-faint)";
  return "var(--accent)";
}

/** The "arc" of a typical game: average position complexity at each move
 * number, across every analyzed game - where it's still known/quiet
 * opening play, and where it turns into real fighting chess. Replaces
 * the old complexity-vs-quality chart (accuracy at different complexity
 * levels), which wasn't landing - this answers a clearer question. */
export function ComplexityByMove({ buckets }: { buckets?: ComplexityByMoveBucket[] }) {
  const data = buckets ?? [];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 3) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
          Game complexity arc
        </h3>
        <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
          Analyze more games to see where your games typically turn from opening theory to sharper play.
        </p>
      </div>
    );
  }

  const maxV = Math.max(SHARP_MIN + 5, ...data.map((b) => b.mean_complexity)) * 1.1;
  const barW = PLOT_W / data.length;
  const xFor = (i: number) => PAD_L + i * barW;
  const yFor = (v: number) => PAD_T + PLOT_H - (v / maxV) * PLOT_H;
  const heightFor = (v: number) => PLOT_H - (yFor(v) - PAD_T);

  const lastMove = data[data.length - 1];
  const lastLabel = lastMove.move_number >= 40 ? "40+" : String(lastMove.move_number);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Game complexity arc
        <HintIcon
          text={`Average position complexity at each move number, across all your analyzed games. Below ${QUIET_MAX} is quiet/known play; above ${SHARP_MIN} is sharp, tactical territory - the same thresholds used elsewhere in your profile. Hover a bar for the exact number and sample size.`}
          width="w-64"
        />
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 480 }} className="w-full" preserveAspectRatio="xMidYMid meet">
          {[QUIET_MAX, SHARP_MIN].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={W - PAD_R} y={yFor(v) - 3} textAnchor="end" fontSize="9" fill="var(--text-faint)">
                {v === QUIET_MAX ? "quiet" : "sharp"}
              </text>
            </g>
          ))}

          {data.map((b, i) => {
            const x = xFor(i);
            const y = yFor(b.mean_complexity);
            const isHovered = hoverIdx === i;
            return (
              <g
                key={b.move_number}
                className="cursor-default"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <rect
                  x={x + 1}
                  y={y}
                  width={Math.max(1, barW - 2)}
                  height={heightFor(b.mean_complexity)}
                  fill={colorFor(b.mean_complexity)}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-opacity"
                />
                <title>
                  Move {b.move_number}
                  {b.move_number >= 40 ? "+" : ""}: complexity {b.mean_complexity.toFixed(1)} ({b.n} moves)
                </title>
              </g>
            );
          })}

          <text x={xFor(0) + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
            move 1
          </text>
          <text x={xFor(data.length - 1) + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
            move {lastLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}
