"use client";

import { useRef, useState } from "react";
import type { ComplexityBucket } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";

const W = 640;
const H = 200;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function rangeLabel(b: ComplexityBucket): string {
  return `${b.complexity_lo.toFixed(0)}–${b.complexity_hi.toFixed(0)}`;
}

/** Your move quality (wp_loss) as position complexity rises, in equal-
 * count buckets of your own moves - does accuracy hold up as things get
 * sharper, or is there a threshold where it falls off? Same rolling-line
 * interaction pattern as AccuracyTrend, but the x-axis is a complexity
 * bucket, not time. */
export function ComplexityQuality({ buckets: rawBuckets }: { buckets?: ComplexityBucket[] }) {
  const buckets = rawBuckets ?? [];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (buckets.length < 3) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
          Complexity vs. quality
        </h3>
        <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
          Analyze more games to see whether your accuracy holds up as positions get sharper.
        </p>
      </div>
    );
  }

  const maxV = Math.max(...buckets.map((b) => b.mean_wp_loss)) * 1.15 || 1;
  const xFor = (i: number) => PAD_L + (i / (buckets.length - 1)) * PLOT_W;
  const yFor = (v: number) => PAD_T + PLOT_H - (v / maxV) * PLOT_H;

  const linePath = buckets.map((b, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(b.mean_wp_loss)}`).join(" ");
  const areaPath =
    `M ${xFor(0)} ${PAD_T + PLOT_H} ` +
    buckets.map((b, i) => `L ${xFor(i)} ${yFor(b.mean_wp_loss)}`).join(" ") +
    ` L ${xFor(buckets.length - 1)} ${PAD_T + PLOT_H} Z`;

  const active = hoverIdx !== null ? buckets[hoverIdx] : null;
  const activeIdx = hoverIdx ?? buckets.length - 1;
  const activeX = xFor(activeIdx);
  const tooltipLeft = activeX > PAD_L + PLOT_W * 0.65;

  function nearestIndex(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return buckets.length - 1;
    const localX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    buckets.forEach((_, i) => {
      const d = Math.abs(xFor(i) - localX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Complexity vs. quality
        <HintIcon
          text="Your own moves, grouped into equal-size buckets by how sharp/complex the position was (low to high, left to right), showing average win-probability lost in each. A rising line means your accuracy drops off as positions get sharper; flat means you hold up regardless."
          width="w-64"
        />
      </h3>
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: 480 }}
          className="w-full cursor-crosshair touch-none select-none"
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={(e) => setHoverIdx(nearestIndex(e.clientX))}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {[0, maxV / 2, maxV].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--border)" />
              <text x={PAD_L - 6} y={yFor(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-faint)">
                {v.toFixed(1)}%
              </text>
            </g>
          ))}

          <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} stroke="none" pointerEvents="none" />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />

          {buckets.map((b, i) => (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(b.mean_wp_loss)}
              r={hoverIdx === i ? 4.5 : 3}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth={1.5}
              className="transition-[r]"
              pointerEvents="none"
            />
          ))}

          <text x={xFor(0)} y={H - 8} fontSize="10" fill="var(--text-faint)">
            low complexity
          </text>
          <text x={xFor(buckets.length - 1)} y={H - 8} textAnchor="end" fontSize="10" fill="var(--text-faint)">
            high complexity
          </text>

          {active && (
            <g pointerEvents="none">
              <line x1={activeX} x2={activeX} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="var(--text-faint)" strokeDasharray="3 3" />
              <g transform={`translate(${tooltipLeft ? activeX - 8 : activeX + 8}, ${Math.max(PAD_T + 2, yFor(active.mean_wp_loss) - 44)})`}>
                <rect
                  x={tooltipLeft ? -128 : 0}
                  y={0}
                  width={128}
                  height={40}
                  rx={5}
                  fill="var(--surface-raised)"
                  stroke="var(--border)"
                />
                <text x={tooltipLeft ? -118 : 10} y={13} fontSize="11" fontWeight={600} fill="var(--text)">
                  {active.mean_wp_loss.toFixed(1)}% loss
                </text>
                <text x={tooltipLeft ? -118 : 10} y={25} fontSize="10" fill="var(--text-faint)">
                  complexity {rangeLabel(active)}
                </text>
                <text x={tooltipLeft ? -118 : 10} y={36} fontSize="10" fill="var(--text-faint)">
                  {active.n} moves
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
