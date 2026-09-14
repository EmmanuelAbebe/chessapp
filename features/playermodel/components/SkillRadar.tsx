import type { Skill } from "../types";

const SUB_LABELS: Record<string, string> = {
  tactical: "Tactical",
  positional: "Positional",
  endgame: "Endgame",
  clock: "Time management",
};

const SIZE = 220;
const CENTER = SIZE / 2;
const R = 66;

function pointFor(index: number, count: number, frac: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return { x: CENTER + R * frac * Math.cos(angle), y: CENTER + R * frac * Math.sin(angle) };
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
    const pct = s.pct_in_band ?? Math.max(0, Math.min(100, ((s.score - 600) / 1800) * 100));
    return { pct, estimated };
  });

  const dataPts = values.map((v, i) => pointFor(i, count, v.pct / 100));

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`-56 -20 ${SIZE + 112} ${SIZE + 40}`} className="w-full max-w-sm">
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <polygon
            key={frac}
            points={entries.map((_, i) => { const p = pointFor(i, count, frac); return `${p.x},${p.y}`; }).join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {entries.map((_, i) => {
          const p = pointFor(i, count, 1);
          return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--border)" />;
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
          const detail = v.estimated
            ? `${label}: ~${v.pct.toFixed(0)}% (estimated - not enough same-rating players yet to rank against)`
            : `${label}: ${v.pct.toFixed(0)}th percentile among players near your rating`;
          return (
            <g key={key} className="cursor-default">
              <circle cx={p.x} cy={p.y} r={10} fill="transparent">
                <title>{detail}</title>
              </circle>
              <circle
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill="var(--accent)"
                className="pointer-events-none transition-[r]"
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
              <text x={lp.x} y={lp.y - 4} textAnchor={anchor} fontSize="11" fill="var(--text)">
                {SUB_LABELS[key] ?? key}
              </text>
              <text x={lp.x} y={lp.y + 9} textAnchor={anchor} fontSize="10" fill="var(--text-faint)">
                {v.estimated ? `~${v.pct.toFixed(0)}%*` : `${v.pct.toFixed(0)}th pct.`}
              </text>
            </g>
          );
        })}
      </svg>
      {values.some((v) => v.estimated) && (
        <p className="text-[11px] text-text-faint">* estimated — not enough same-rating players yet to rank against</p>
      )}
    </div>
  );
}
