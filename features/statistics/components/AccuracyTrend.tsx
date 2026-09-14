"use client";

import { useMemo, useRef, useState } from "react";
import type { PerGameStats } from "@/features/playermodel/types";
import { HintIcon } from "@/components/ui/HintIcon";

const WINDOW = 15;
const W = 640;
const H = 200;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

type Point = { index: number; date: string | null; wpLoss: number; blunderRate: number };

/** Rolling move-quality, independent of win/loss - the win-rate chart
 * answers "am I winning more," this answers "am I actually playing
 * better," which can lead or lag the results. Built from PerGameStats
 * (the same per-game accuracy features behind Skill estimate), not
 * GameHistoryEntry, so it only covers whatever the last analysis did -
 * unlike the win-rate chart, which spans your whole recorded history. */
function rollingAccuracy(perGame: PerGameStats[]): Point[] {
  const sorted = [...perGame].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const queue: number[] = [];
  let sum = 0;
  return sorted.map((p, i) => {
    queue.push(p.mean_wp_loss);
    sum += p.mean_wp_loss;
    if (queue.length > WINDOW) sum -= queue.shift()!;
    return { index: i, date: p.date ?? null, wpLoss: sum / queue.length, blunderRate: p.blunder_rate };
  });
}

function formatDate(d: string | null): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})[.-](\d{2})[.-](\d{2})/);
  if (!m) return d;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function AccuracyTrend({ perGame }: { perGame?: PerGameStats[] }) {
  const points = useMemo(() => rollingAccuracy(perGame ?? []), [perGame]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (points.length < 5) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
          Accuracy trend
        </h3>
        <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
          Analyze your games above to see whether your play itself is trending up or down,
          independent of results.
        </p>
      </div>
    );
  }

  const maxV = Math.max(...points.map((p) => p.wpLoss)) * 1.15;
  const maxBlunder = Math.max(...points.map((p) => p.blunderRate)) * 1.2 || 1;
  const xFor = (i: number) => PAD_L + (i / (points.length - 1)) * PLOT_W;
  const yFor = (v: number) => PAD_T + PLOT_H - (v / maxV) * PLOT_H;
  const dotBandH = PLOT_H * 0.32;
  const yForBlunder = (v: number) => PAD_T + PLOT_H - (v / maxBlunder) * dotBandH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.index)} ${yFor(p.wpLoss)}`).join(" ");
  const areaPath =
    `M ${xFor(0)} ${PAD_T + PLOT_H} ` +
    points.map((p) => `L ${xFor(p.index)} ${yFor(p.wpLoss)}`).join(" ") +
    ` L ${xFor(points.length - 1)} ${PAD_T + PLOT_H} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const active = hoverIdx !== null ? points[hoverIdx] : last;
  const activeX = xFor(active.index);
  const tooltipLeft = activeX > PAD_L + PLOT_W * 0.65;

  function nearestIndex(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return points.length - 1;
    const localX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xFor(p.index) - localX);
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
        Accuracy trend
        <HintIcon
          text="Rolling move-quality over your last 15 analyzed games - lower is better. Faint dots: blunder rate per game. Independent of win/loss: a losing stretch can still be an improving one."
          width="w-56"
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

          {points.map((p) => (
            <circle key={p.index} cx={xFor(p.index)} cy={yForBlunder(p.blunderRate)} r={1.8} fill="var(--bad)" opacity={0.5} pointerEvents="none" />
          ))}

          {hoverIdx === null && (
            <g pointerEvents="none">
              <circle cx={xFor(last.index)} cy={yFor(last.wpLoss)} r={4} fill="var(--accent)" />
              <text
                x={xFor(last.index)}
                y={yFor(last.wpLoss) - 8}
                textAnchor="end"
                fontSize="11"
                fontWeight={600}
                fill="var(--text)"
              >
                {last.wpLoss.toFixed(1)}%
              </text>
            </g>
          )}

          <text x={xFor(0)} y={H - 6} fontSize="10" fill="var(--text-faint)">
            {formatDate(first.date) || "earliest"}
          </text>
          <text x={xFor(last.index)} y={H - 6} textAnchor="end" fontSize="10" fill="var(--text-faint)">
            {formatDate(last.date) || "most recent"}
          </text>

          {hoverIdx !== null && (
            <g pointerEvents="none">
              <line x1={activeX} x2={activeX} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="var(--text-faint)" strokeDasharray="3 3" />
              <circle cx={activeX} cy={yFor(active.wpLoss)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
              <g transform={`translate(${tooltipLeft ? activeX - 8 : activeX + 8}, ${Math.max(PAD_T + 2, yFor(active.wpLoss) - 36)})`}>
                <rect
                  x={tooltipLeft ? -108 : 0}
                  y={0}
                  width={108}
                  height={32}
                  rx={5}
                  fill="var(--surface-raised)"
                  stroke="var(--border)"
                />
                <text x={tooltipLeft ? -98 : 10} y={13} fontSize="11" fontWeight={600} fill="var(--text)">
                  {active.wpLoss.toFixed(1)}% loss
                </text>
                <text x={tooltipLeft ? -98 : 10} y={25} fontSize="10" fill="var(--text-faint)">
                  {formatDate(active.date) || `game ${active.index + 1}`}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
