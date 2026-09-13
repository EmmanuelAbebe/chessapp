"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameHistoryEntry } from "@/features/history/types";
import { stashExploreGame } from "@/features/history/exploreGame";
import { openingFamilyOf } from "@/features/history/gameFacets";
import type { PerGameStats } from "@/features/playermodel/types";

const WINDOW = 20;
const W = 640;
const H = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 26;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const MAX_BUCKETS = 12;

type Mode = "game" | "day";

type RollingPoint = {
  index: number;
  playedAt: number;
  rate: number;
  gamesInWindow: number;
  result: GameHistoryEntry["result"];
};

type Bucket = {
  startIdx: number;
  endIdx: number; // inclusive
  games: GameHistoryEntry[];
  wins: number;
  draws: number;
  losses: number;
  score: number; // this batch's own win rate, 0-100 - not the rolling average
};

/** Trailing-window (<=20 games) win rate, in play order. `mode` only ever
 * changes which x-axis this same series is plotted against - "per game"
 * spaces points evenly by count, "per day" spaces them by real elapsed
 * time, so gaps in play show up as gaps instead of being smoothed away. */
function rollingWinRate(sorted: GameHistoryEntry[]): RollingPoint[] {
  const queue: number[] = [];
  let sum = 0;
  return sorted.map((g, i) => {
    const score = g.result === "win" ? 100 : g.result === "draw" ? 50 : 0;
    queue.push(score);
    sum += score;
    if (queue.length > WINDOW) sum -= queue.shift()!;
    return {
      index: i, playedAt: g.playedAt, rate: sum / queue.length,
      gamesInWindow: queue.length, result: g.result,
    };
  });
}

/** Chunks of consecutive games (like a stock chart's candles) - each
 * bucket's own win rate, not the rolling average, so a stretch that
 * dragged the trend down shows up as a bar you can click into to see
 * exactly which games did that and why. */
function computeBuckets(sorted: GameHistoryEntry[]): Bucket[] {
  const n = sorted.length;
  if (n === 0) return [];
  const bucketSize = Math.max(3, Math.ceil(n / MAX_BUCKETS));
  const buckets: Bucket[] = [];
  for (let start = 0; start < n; start += bucketSize) {
    const end = Math.min(n, start + bucketSize);
    const slice = sorted.slice(start, end);
    let wins = 0, draws = 0, losses = 0;
    for (const g of slice) {
      if (g.result === "win") wins += 1;
      else if (g.result === "draw") draws += 1;
      else losses += 1;
    }
    buckets.push({
      startIdx: start, endIdx: end - 1, games: slice, wins, draws, losses,
      score: ((wins + draws * 0.5) / slice.length) * 100,
    });
  }
  return buckets;
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The Lichess game id from a GameHistoryEntry's stored URL - the same id
 * PerGameStats.game_id carries (both come from the PGN's Site header),
 * so this is the join key between "games in this bucket" and "real
 * move-quality for this bucket," despite the two coming from separate
 * fetches (GameRecord vs. the last /profile analysis). */
function lichessIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
  return m ? m[1] : null;
}

function average(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number");
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

type QualitySummary = {
  meanWpLoss: number | null;
  blunderRate: number | null;
  mistakeRate: number | null;
  matched: number;
  total: number;
};

function summarizeQuality(games: GameHistoryEntry[], perGameById: Map<string, PerGameStats>): QualitySummary {
  const matched = games
    .map((g) => perGameById.get(lichessIdFromUrl(g.meta?.gameUrl) ?? ""))
    .filter((p): p is PerGameStats => p !== undefined);
  return {
    meanWpLoss: average(matched.map((p) => p.mean_wp_loss)),
    blunderRate: average(matched.map((p) => p.blunder_rate)),
    mistakeRate: average(matched.map((p) => p.mistake_rate)),
    matched: matched.length,
    total: games.length,
  };
}

function QualityRow({
  label,
  bucketValue,
  overallValue,
  unit = "%",
  scale = 1,
}: {
  label: string;
  bucketValue: number | null;
  overallValue: number | null;
  unit?: string;
  scale?: number;
}) {
  if (bucketValue === null || overallValue === null) return null;
  const diffPct = overallValue === 0 ? 0 : ((bucketValue - overallValue) / overallValue) * 100;
  const better = bucketValue < overallValue; // both metrics here are "lower is better"
  const color = Math.abs(diffPct) < 5 ? "var(--text-dim)" : better ? "var(--good)" : "var(--bad)";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-faint">{label}</span>
      <span className="font-mono" style={{ color }}>
        {(bucketValue * scale).toFixed(1)}
        {unit} (overall {(overallValue * scale).toFixed(1)}
        {unit}) {Math.abs(diffPct) < 5 ? "· about the same" : better ? "· better" : "· worse"}
      </span>
    </div>
  );
}

function dominantOpening(games: GameHistoryEntry[]): string {
  const counts = new Map<string, number>();
  for (const g of games) {
    const name = openingFamilyOf(g);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = "—";
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return counts.size > 1 ? `mostly ${best}` : best;
}

const RESULT_LABEL: Record<GameHistoryEntry["result"], string> = { win: "Won", draw: "Drew", loss: "Lost" };
const RESULT_COLOR: Record<GameHistoryEntry["result"], string> = {
  win: "text-good", draw: "text-text-dim", loss: "text-bad",
};

function BucketDetail({
  bucket,
  onOpenGame,
  perGameById,
  overall,
}: {
  bucket: Bucket;
  onOpenGame: (g: GameHistoryEntry) => void;
  perGameById: Map<string, PerGameStats>;
  overall: QualitySummary;
}) {
  const first = bucket.games[0];
  const last = bucket.games[bucket.games.length - 1];
  const dateRange =
    first.playedAt === last.playedAt || formatDay(first.playedAt) === formatDay(last.playedAt)
      ? formatDay(first.playedAt)
      : `${formatDay(first.playedAt)} – ${formatDay(last.playedAt)}`;

  const quality = summarizeQuality(bucket.games, perGameById);
  const hasQuality = quality.matched >= Math.max(2, Math.ceil(quality.total / 2));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-text">
          Games {bucket.startIdx + 1}–{bucket.endIdx + 1} · {dateRange}
        </span>
        <span className="font-mono text-xs text-text-dim">
          {bucket.wins}W {bucket.draws}D {bucket.losses}L · {bucket.score.toFixed(0)}% this stretch
        </span>
      </div>
      <p className="text-xs text-text-faint">{dominantOpening(bucket.games)}</p>

      {hasQuality ? (
        <div className="flex flex-col gap-1 rounded-md bg-surface-raised/60 p-2.5">
          <span className="mb-0.5 text-[10px] font-semibold tracking-wide text-text-faint uppercase">
            Real move quality this stretch, vs. your overall average
          </span>
          <QualityRow label="Move accuracy loss" bucketValue={quality.meanWpLoss} overallValue={overall.meanWpLoss} />
          <QualityRow
            label="Blunder rate"
            bucketValue={quality.blunderRate}
            overallValue={overall.blunderRate}
            scale={100}
          />
          <QualityRow
            label="Mistake rate"
            bucketValue={quality.mistakeRate}
            overallValue={overall.mistakeRate}
            scale={100}
          />
        </div>
      ) : (
        <p className="text-[11px] text-text-faint">
          Not enough of these games matched your last analysis to compare real move quality —
          try Analyze/Refresh above with a games count that covers this stretch.
        </p>
      )}

      <div className="flex flex-col divide-y divide-border-soft">
        {bucket.games.map((g) => {
          const pg = perGameById.get(lichessIdFromUrl(g.meta?.gameUrl) ?? "");
          return (
            <div key={g.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span className="text-text-faint">{formatDay(g.playedAt)}</span>
              <span className={`font-medium ${RESULT_COLOR[g.result]}`}>{RESULT_LABEL[g.result]}</span>
              <span className="min-w-0 flex-1 truncate text-text-dim">{openingFamilyOf(g)}</span>
              {pg && (
                <span className="shrink-0 font-mono text-text-faint" title="Move accuracy loss (lower is better)">
                  −{pg.mean_wp_loss.toFixed(1)}%
                </span>
              )}
              <span className="shrink-0 text-text-faint">{g.opponentName ?? "—"}</span>
              <button
                type="button"
                onClick={() => onOpenGame(g)}
                className="shrink-0 rounded-md border border-border px-2 py-0.5 text-text-dim transition hover:border-accent hover:text-text"
              >
                View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WinRateTimeline({
  games,
  perGame,
}: {
  games: GameHistoryEntry[];
  /** Real per-game move-quality from the last analysis (undefined until
   * the model has been run at least once) - lets a clicked bucket show
   * actual accuracy/blunder numbers instead of only the game list. */
  perGame?: PerGameStats[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("game");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sorted = useMemo(() => [...games].sort((a, b) => a.playedAt - b.playedAt), [games]);
  const points = useMemo(() => rollingWinRate(sorted), [sorted]);
  const buckets = useMemo(() => computeBuckets(sorted), [sorted]);
  const perGameById = useMemo(() => new Map((perGame ?? []).map((p) => [p.game_id, p])), [perGame]);
  const overallQuality = useMemo(
    () => ({
      meanWpLoss: average((perGame ?? []).map((p) => p.mean_wp_loss)),
      blunderRate: average((perGame ?? []).map((p) => p.blunder_rate)),
      mistakeRate: average((perGame ?? []).map((p) => p.mistake_rate)),
      matched: perGame?.length ?? 0,
      total: perGame?.length ?? 0,
    }),
    [perGame],
  );

  if (points.length < 3) {
    return (
      <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
        A few more games will start showing a trend here.
      </p>
    );
  }

  function openGame(game: GameHistoryEntry) {
    stashExploreGame(game);
    router.push("/board");
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
  const active = hoverIdx !== null ? points[hoverIdx] : last;
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
  const barW = Math.max(5, Math.min(22, PLOT_W / buckets.length - 4));

  function nearestIndex(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return points.length - 1;
    const localX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xFor(xVal(p)) - localX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  const activeX = xFor(xVal(active));
  const tooltipLeft = activeX > PAD_L + PLOT_W * 0.65;
  const resultLabel = active.result === "win" ? "won" : active.result === "draw" ? "drew" : "lost";
  const baselineY = yFor(50);

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

        {buckets.map((b, i) => {
          const midIdx = Math.floor((b.startIdx + b.endIdx) / 2);
          const cx = xFor(xVal(points[midIdx]));
          const scoreY = yFor(b.score);
          const barY = Math.min(baselineY, scoreY);
          const barH = Math.max(1, Math.abs(scoreY - baselineY));
          const color = b.score >= 50 ? "var(--good)" : "var(--bad)";
          const selected = selectedBucket === i;
          return (
            <g
              key={i}
              onClick={() => setSelectedBucket(selected ? null : i)}
              className="cursor-pointer"
            >
              <rect x={cx - barW / 2 - 3} y={PAD_T} width={barW + 6} height={PLOT_H} fill="transparent" />
              <rect
                x={cx - barW / 2}
                y={barY}
                width={barW}
                height={barH}
                fill={color}
                opacity={selected ? 0.85 : 0.3}
                rx={1.5}
              />
              {selected && (
                <rect
                  x={cx - barW / 2 - 2}
                  y={barY - 2}
                  width={barW + 4}
                  height={barH + 4}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  rx={2}
                />
              )}
            </g>
          );
        })}

        <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} stroke="none" pointerEvents="none" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />

        {hoverIdx === null && (
          <g pointerEvents="none">
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
          </g>
        )}

        <text x={xFor(xVal(first))} y={H - 6} fontSize="10" fill="var(--text-faint)">
          {mode === "game" ? `game ${first.index + 1}` : formatDay(first.playedAt)}
        </text>
        <text x={xFor(xVal(last))} y={H - 6} textAnchor="end" fontSize="10" fill="var(--text-faint)">
          {mode === "game" ? `game ${last.index + 1}` : formatDay(last.playedAt)}
        </text>

        {hoverIdx !== null && (
          <g pointerEvents="none">
            <line x1={activeX} x2={activeX} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="var(--text-faint)" strokeDasharray="3 3" />
            <circle cx={activeX} cy={yFor(active.rate)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
            <g transform={`translate(${tooltipLeft ? activeX - 8 : activeX + 8}, ${Math.max(PAD_T + 2, yFor(active.rate) - 40)})`}>
              <rect
                x={tooltipLeft ? -118 : 0}
                y={0}
                width={118}
                height={36}
                rx={5}
                fill="var(--surface-raised)"
                stroke="var(--border)"
              />
              <text x={tooltipLeft ? -108 : 10} y={14} fontSize="11" fontWeight={600} fill="var(--text)">
                {active.rate.toFixed(0)}% rolling
              </text>
              <text x={tooltipLeft ? -108 : 10} y={28} fontSize="9.5" fill="var(--text-faint)">
                game {active.index + 1} · {formatDay(active.playedAt)} · {resultLabel}
              </text>
            </g>
          </g>
        )}
      </svg>
      </div>

      {selectedBucket !== null && buckets[selectedBucket] && (
        <BucketDetail
          bucket={buckets[selectedBucket]}
          onOpenGame={openGame}
          perGameById={perGameById}
          overall={overallQuality}
        />
      )}

      <p className="text-[11px] text-text-faint">
        Line: rolling win rate over your last {WINDOW} games (win 1, draw ½) — hover to
        inspect a point. Bars: each stretch&apos;s own record (green ≥ 50%, red &lt; 50%) —
        click one for the games, openings, and (once analyzed) real move accuracy behind it;{" "}
        {mode === "game"
          ? "spaced by game count."
          : "spaced by when you actually played, so breaks show as gaps."}
      </p>
    </div>
  );
}
