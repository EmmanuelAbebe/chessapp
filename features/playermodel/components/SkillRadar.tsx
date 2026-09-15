import type { Skill } from "../types";
import { HintIcon } from "@/components/ui/HintIcon";

const SUB_LABELS: Record<string, string> = {
  tactical: "Tactical",
  positional: "Positional",
  endgame: "Endgame",
  clock: "Time management",
};

// A plain-language read of each percentile instead of a bare number - the
// same idea as the style axes' descriptive poles, applied to a fixed set
// of categories that don't have a natural opposite pole of their own.
const TIERS: [number, string][] = [
  [85, "Elite"],
  [65, "Strong"],
  [40, "Solid"],
  [20, "Developing"],
  [0, "Weak spot"],
];

function tierFor(pct: number): string {
  return TIERS.find(([min]) => pct >= min)?.[1] ?? TIERS[TIERS.length - 1][1];
}

function tierColor(pct: number): string {
  if (pct >= 65) return "var(--good)";
  if (pct >= 40) return "var(--text-dim)";
  return "var(--bad)";
}

const SIZE = 260;
const CENTER = SIZE / 2;
const R = 80;

function pointFor(index: number, count: number, frac: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    x: CENTER + R * frac * Math.cos(angle),
    y: CENTER + R * frac * Math.sin(angle),
  };
}

/** Percentile of each sub-score among players near your own rating
 * (Skill.sub[*].pct_in_band) - falls back to a plain 0-100 scaling of the
 * raw score when the reference band was too thin to rank against (rare;
 * flagged with an asterisk rather than silently passed off as a real
 * percentile). */
export function SkillRadar({ sub }: { sub: Skill["sub"] }) {
  const entries = Object.entries(sub);
  if (entries.length < 3) return null;
  const count = entries.length;

  const values = entries.map(([, s]) => {
    const estimated = s.pct_in_band == null;
    const pct =
      s.pct_in_band ??
      Math.max(0, Math.min(100, ((s.score - 600) / 1800) * 100));
    return { pct, estimated };
  });

  const dataPts = values.map((v, i) => pointFor(i, count, v.pct / 100));

  return (
    <div className="flex flex-col items-center gap-1 h-100">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-text-faint uppercase">
        Skill breakdown
        <HintIcon
          text={'"Pct." is short for percentile: the share of players near your own rating that you\'re ahead of in that category, from 0 (bottom) to 100 (top). Hover a point for the exact number.'}
          width="w-60"
        />
      </span>
      <svg
        viewBox={`-68 -24 ${SIZE + 136} ${SIZE + 71}`}
        className="block h-full w-full max-w-xl"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <polygon
            key={frac}
            points={entries
              .map((_, i) => {
                const p = pointFor(i, count, frac);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {entries.map((_, i) => {
          const p = pointFor(i, count, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              stroke="var(--border)"
            />
          );
        })}

        <polygon
          points={dataPts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="var(--accent)"
          fillOpacity={0.25}
          stroke="var(--accent)"
          strokeWidth={2}
        />
        {entries.map(([key], i) => {
          const p = dataPts[i];
          const v = values[i];
          const label = SUB_LABELS[key] ?? key;
          const tier = tierFor(v.pct);
          const detail = v.estimated
            ? `${label}: ${tier} (~${v.pct.toFixed(0)}%, estimated - not enough same-rating players yet to rank against)`
            : `${label}: ${tier} - ${v.pct.toFixed(0)}th percentile among players near your rating`;
          return (
            <g key={key} className="group cursor-default">
              <circle cx={p.x} cy={p.y} r={12} fill="transparent">
                <title>{detail}</title>
              </circle>
              <circle
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={tierColor(v.pct)}
                className="pointer-events-none transition-[r] group-hover:[r:5.5px]"
              />
            </g>
          );
        })}

        {entries.map(([key], i) => {
          const lp = pointFor(i, count, 1.32);
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
          const cos = Math.cos(angle);
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          const v = values[i];
          return (
            <g key={key} pointerEvents="none">
              <text
                x={lp.x}
                y={lp.y - 4}
                textAnchor={anchor}
                fontSize="11"
                fill="var(--text)"
              >
                {SUB_LABELS[key] ?? key}
              </text>
              <text
                x={lp.x}
                y={lp.y + 9}
                textAnchor={anchor}
                fontSize="10"
                fontWeight={600}
                fill={tierColor(v.pct)}
              >
                {tierFor(v.pct)}
              </text>
              <text
                x={lp.x}
                y={lp.y + 20}
                textAnchor={anchor}
                fontSize="9"
                fontFamily="var(--font-mono)"
                fill="var(--text-faint)"
              >
                {v.estimated
                  ? `~${v.pct.toFixed(0)}%*`
                  : `${v.pct.toFixed(0)}th pct.`}
              </text>
            </g>
          );
        })}
      </svg>
      {values.some((v) => v.estimated) && (
        <p className="text-[11px] text-text-faint">
          * estimated — not enough same-rating players yet to rank against
        </p>
      )}
    </div>
  );
}
