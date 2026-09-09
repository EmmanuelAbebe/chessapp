"use client";

import { useMemo, useState } from "react";
import type { OpeningsBreakdown as Breakdown } from "../lib/summary";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
// The raw theme var, not the Tailwind `--color-*` alias (that one is
// `@theme inline` - inlined into utilities, not emitted at runtime).
const OTHER_COLOR = "var(--text-faint)";

const SIZE = 168;
const R = 62;
const THICK = 24;
const C = 2 * Math.PI * R;
const GAP_PX = 3;

type Slice = {
  key: string;
  label: string;
  sample?: string;
  color: string;
  games: number;
  score: number;
};

export function OpeningsBreakdown({
  breakdown,
  side,
}: {
  breakdown: Breakdown;
  side: "all" | "w" | "b";
}) {
  const [active, setActive] = useState<string | null>(null);

  const slices: Slice[] = useMemo(() => {
    const named = breakdown.lines.map((line, i) => ({
      key: line.label,
      label: line.label,
      sample: line.sample || undefined,
      color: CHART_COLORS[i % CHART_COLORS.length],
      games: line.games,
      score: line.score,
    }));
    if (breakdown.other) {
      named.push({
        key: "__other__",
        label: "Other openings",
        sample: undefined,
        color: OTHER_COLOR,
        games: breakdown.other.games,
        score: breakdown.other.score,
      });
    }
    return named;
  }, [breakdown]);

  const total = breakdown.total;
  if (slices.length === 0 || total === 0) return null;

  const heading =
    side === "w"
      ? "Your openings as White"
      : side === "b"
        ? "Your openings as Black"
        : "Your openings";

  // Cumulative arc offsets for the donut ring.
  let acc = 0;
  const arcs = slices.map((s) => {
    const start = acc;
    const len = (s.games / total) * C;
    acc += len;
    return { s, start, len };
  });

  return (
    <div className="w-full">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-text-faint uppercase">
        {heading}
      </h3>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${heading}: ${slices
            .map((s) => `${s.label} ${((s.games / total) * 100).toFixed(0)}%`)
            .join(", ")}`}
          className="shrink-0"
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ s, start, len }) => {
              const dim = active !== null && active !== s.key;
              const on = active === s.key;
              const dash = Math.max(0.5, len - GAP_PX);
              return (
                <circle
                  key={s.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-start}
                  className="cursor-default transition-[opacity,stroke-width] duration-150"
                  // `stroke` as a CSS property, not the SVG attribute:
                  // var() in a presentation *attribute* isn't resolved by
                  // older Safari / some mobile webviews, which left the
                  // slices uncoloured on some devices.
                  style={{
                    stroke: s.color,
                    strokeWidth: on ? THICK + 4 : THICK,
                    opacity: dim ? 0.3 : 1,
                  }}
                  onMouseEnter={() => setActive(s.key)}
                  onMouseLeave={() => setActive(null)}
                >
                  <title>
                    {s.label}: {s.games} game{s.games === 1 ? "" : "s"} (
                    {((s.games / total) * 100).toFixed(0)}%), {s.score.toFixed(0)}
                    % score
                  </title>
                </circle>
              );
            })}
          </g>
          <text
            x={SIZE / 2}
            y={SIZE / 2 - 4}
            textAnchor="middle"
            className="text-lg font-semibold"
            style={{ fill: "var(--text)", fontVariantNumeric: "tabular-nums" }}
          >
            {total}
          </text>
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 12}
            textAnchor="middle"
            className="text-[10px] uppercase tracking-wide"
            style={{ fill: "var(--text-faint)" }}
          >
            games
          </text>
        </svg>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {slices.map((s) => {
            const pct = (s.games / total) * 100;
            const dim = active !== null && active !== s.key;
            return (
              <li
                key={s.key}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                className={`flex items-baseline gap-2 rounded px-1 py-0.5 text-sm transition-opacity ${
                  dim ? "opacity-40" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: s.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-text">{s.label}</span>
                  {s.sample && (
                    <span className="ml-2 font-mono text-[11px] text-text-faint">
                      {s.sample}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs text-text-faint">
                  {s.games} · {pct.toFixed(0)}% · {s.score.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-2 text-[11px] text-text-faint">
        Share of games · win-rate score. Family names from the PGN&apos;s own
        opening tag where present.
      </p>
    </div>
  );
}
