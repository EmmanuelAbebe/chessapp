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

/** The "arc" of a typical game: average position complexity at each move
 * number, across every analyzed game - where it's still known/quiet
 * opening play, and where it turns into real fighting chess. Scaled and
 * colored relative to this account's own observed range, not a fixed
 * absolute threshold - those (used per-move elsewhere) are calibrated
 * for one position, not an average over hundreds of moves, so the
 * average essentially never reaches them and the chart reads as flat. */
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

  const values = data.map((b) => b.mean_complexity);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(0.001, maxV - minV);
  const axisMax = maxV * 1.15 || 1;

  function colorFor(v: number): string {
    const t = (v - minV) / span; // 0..1, relative to this account's own range
    if (t >= 0.66) return "var(--bad)";
    if (t <= 0.33) return "var(--text-faint)";
    return "var(--accent)";
  }

  const barW = PLOT_W / data.length;
  const xFor = (i: number) => PAD_L + i * barW;
  const yFor = (v: number) => PAD_T + PLOT_H - (v / axisMax) * PLOT_H;
  const heightFor = (v: number) => PLOT_H - (yFor(v) - PAD_T);

  const lastMove = data[data.length - 1];
  const lastLabel = lastMove.move_number >= 40 ? "40+" : String(lastMove.move_number);

  // The move number where things get sharpest, excluding the aggregated
  // 40+ tail bucket (a mix of every deep-game move, not a real "peak") -
  // this is the always-meaningful version of "where it turns tactical,"
  // relative to this account's own games rather than a universal cutoff.
  const peakIdx = data.reduce(
    (best, b, i) => (b.move_number < 40 && b.mean_complexity > data[best].mean_complexity ? i : best),
    0,
  );
  const peak = data[peakIdx];

  const active = hoverIdx !== null ? data[hoverIdx] : null;
  const activeX = hoverIdx !== null ? xFor(hoverIdx) + barW / 2 : 0;
  const tooltipLeft = activeX > PAD_L + PLOT_W * 0.65;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Game complexity arc
        <HintIcon
          text="Average position complexity at each move number, across all your analyzed games - scaled to your own range, so the shape (rising/falling), not the absolute number, is the point. The dashed line marks where your games typically get sharpest. Hover a bar for the exact value and sample size."
          width="w-64"
        />
      </h3>
      <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {[0, axisMax / 2, axisMax].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--border)" />
              <text x={PAD_L - 4} y={yFor(v) + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)">
                {v.toFixed(0)}
              </text>
            </g>
          ))}

          {peakIdx !== 0 && (
            <g pointerEvents="none">
              <line
                x1={xFor(peakIdx) + barW / 2}
                x2={xFor(peakIdx) + barW / 2}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                stroke="var(--text-faint)"
                strokeDasharray="3 3"
              />
              <text x={xFor(peakIdx) + barW / 2} y={PAD_T - 4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
                sharpest ~move {peak.move_number}
              </text>
            </g>
          )}

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
                <rect x={x} y={PAD_T} width={barW} height={PLOT_H} fill="transparent" />
                <rect
                  x={x + 1}
                  y={y}
                  width={Math.max(1, barW - 2)}
                  height={Math.max(1, heightFor(b.mean_complexity))}
                  fill={colorFor(b.mean_complexity)}
                  opacity={isHovered ? 1 : 0.7}
                  stroke={isHovered ? "var(--text)" : "none"}
                  strokeWidth={1}
                  className="transition-opacity"
                />
              </g>
            );
          })}

          <text x={xFor(0) + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
            move 1
          </text>
          <text x={xFor(data.length - 1) + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
            move {lastLabel}
          </text>

          {active && (
            <g pointerEvents="none">
              <g transform={`translate(${tooltipLeft ? activeX - 8 : activeX + 8}, ${Math.max(PAD_T + 2, yFor(active.mean_complexity) - 44)})`}>
                <rect
                  x={tooltipLeft ? -118 : 0}
                  y={0}
                  width={118}
                  height={36}
                  rx={5}
                  fill="var(--surface-raised)"
                  stroke="var(--border)"
                />
                <text x={tooltipLeft ? -108 : 10} y={13} fontSize="11" fontWeight={600} fill="var(--text)">
                  {`Move ${active.move_number}${active.move_number >= 40 ? "+" : ""}`}
                </text>
                <text x={tooltipLeft ? -108 : 10} y={25} fontSize="10" fill="var(--text-faint)">
                  {`complexity ${active.mean_complexity.toFixed(1)} · ${active.n} moves`}
                </text>
              </g>
            </g>
          )}
        </svg>
    </div>
  );
}
