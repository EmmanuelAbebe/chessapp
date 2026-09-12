"use client";

import { useMemo, useState } from "react";
import type { GameHistoryEntry } from "@/features/history/types";

const WINDOW = 20;
const W = 640;
const H = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 26;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

type Mode = "game" | "day";

type RollingPoint = {
  index: number;
  playedAt: number;
  rate: number;
  gamesInWindow: number;
};

/** Trailing-window (<=20 games) win rate, in play order. `mode` only ever
 * changes which x-axis this same series is plotted against - "per game"
 * spaces points evenly by count, "per day" spaces them by real elapsed
 * time, so gaps in play show up as gaps instead of being smoothed away. */
function rollingWinRate(games: GameHistoryEntry[]): RollingPoint[] {
  const sorted = [...games].sort((a, b) => a.playedAt - b.playedAt);
  const queue: number[] = [];
  let sum = 0;
  return sorted.map((g, i) => {
    const score = g.result === "win" ? 100 : g.result === "draw" ? 50 : 0;
    queue.push(score);
    sum += score;
    if (queue.length > WINDOW) sum -= queue.shift()!;
    return { index: i, playedAt: g.playedAt, rate: sum / queue.length, gamesInWindow: queue.length };
  });
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WinRateTimeline({ games }: { games: GameHistoryEntry[] }) {
  const [mode, setMode] = useState<Mode>("game");
  const points = useMemo(() => rollingWinRate(games), [games]);

  if (points.length < 3) {
    return (
      <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
        A few more games will start showing a trend here.
      </p>
    );
  }

  const xVal = (p: RollingPoint) => (mode === "game" ? p.index : p.playedAt);
  const xs = points.map(xVal);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xFor = (v: number) => PAD_L + (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin)) * PLOT_W;
  const yFor = (rate: number) => PAD_T + PLOT_H - (rate / 100) * PLOT_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(xVal(p)).toFixed(1)} ${yFor(p.rate).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M ${xFor(xVal(points[0])).toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} ` +
    points.map((p) => `L ${xFor(xVal(p)).toFixed(1)} ${yFor(p.rate).toFixed(1)}`).join(" ") +
    ` L ${xFor(xVal(points[points.length - 1])).toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const tally = games.reduce(
    (acc, g) => {
      acc.games += 1;
      if (g.result === "win") acc.wins += 1;
      else if (g.result === "draw") acc.draws += 1;
      else acc.losses += 1;
      return acc;
    },
    { games: 0, wins: 0, draws: 0, losses: 0 },
  );
  const overallScore = tally.games ? ((tally.wins + tally.draws * 0.5) / tally.games) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 font-mono text-xs text-text-faint">
          <span className="text-text">
            {tally.wins}W {tally.draws}D {tally.losses}L
          </span>
          <span>· {overallScore.toFixed(0)}% overall</span>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
          {(["game", "day"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 font-medium transition ${
                mode === m ? "bg-accent text-white" : "text-text-dim hover:text-text"
              }`}
            >
              per {m}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="var(--border)"
              strokeDasharray={v === 50 ? "4 3" : undefined}
            />
            <text x={PAD_L - 6} y={yFor(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-faint)">
              {v}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--accent)" fillOpacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

        <circle cx={xFor(xVal(last))} cy={yFor(last.rate)} r={4} fill="var(--accent)" />
        <text
          x={xFor(xVal(last))}
          y={yFor(last.rate) - 8}
          textAnchor="end"
          fontSize="11"
          fontWeight={600}
          fill="var(--text)"
        >
          {last.rate.toFixed(0)}%
        </text>

        <text x={xFor(xVal(first))} y={H - 6} fontSize="10" fill="var(--text-faint)">
          {mode === "game" ? `game ${first.index + 1}` : formatDay(first.playedAt)}
        </text>
        <text
          x={xFor(xVal(last))}
          y={H - 6}
          textAnchor="end"
          fontSize="10"
          fill="var(--text-faint)"
        >
          {mode === "game" ? `game ${last.index + 1}` : formatDay(last.playedAt)}
        </text>
      </svg>

      <p className="text-[11px] text-text-faint">
        Rolling win rate over your last {WINDOW} games (win 1, draw ½) —{" "}
        {mode === "game"
          ? "spaced by game count."
          : "spaced by when you actually played, so breaks show as gaps."}
      </p>
    </div>
  );
}
