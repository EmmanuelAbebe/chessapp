import type { PhaseMix } from "../lib/traits";
import type { PhaseAccuracy } from "@/features/playermodel/types";

const PHASES: { key: keyof PhaseMix; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

const W = 860;
const ROW_H = 56;
const PAD_T = 10;
const PAD_L = 4;
const SHARE_X = 100;
const SHARE_W = 420;
const GAP = 24;
const GAP_W = 240;
const GAP_X0 = SHARE_X + SHARE_W + GAP;
const GAP_ZERO = GAP_X0 + GAP_W / 2;
const H = PHASES.length * ROW_H + PAD_T + 10;

/** Exact port of the mock's fig.4: a move-share bar next to an accuracy-
 * gap line-and-dot marker on a zero-centred scale, one row per phase. */
export function PhaseBreakdownChart({
  mix,
  accuracy,
}: {
  mix: PhaseMix;
  accuracy?: Partial<Record<"opening" | "middlegame" | "endgame", PhaseAccuracy>>;
}) {
  const hasAccuracy = Boolean(accuracy && Object.keys(accuracy).length > 0);
  const deltas = PHASES.map(({ key }) => {
    const acc = accuracy?.[key];
    return acc ? acc.you - acc.peers : null;
  });
  const maxGap = Math.max(1, ...deltas.filter((d): d is number => d !== null).map((d) => Math.abs(d)));
  const gapXFor = (v: number) => GAP_ZERO + (v / maxGap) * (GAP_W / 2);

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Phase mix{hasAccuracy ? " & accuracy" : ""}
      </h3>
      <p className="mb-3 text-[11px] text-text-faint">
        Move share: how much of each game you spend in that phase. Accuracy gap vs. peers:{" "}
        {hasAccuracy
          ? "your move-quality gap vs. players at your level there — green is better than typical, red is worse."
          : "analyze your games above to see this axis."}
      </p>
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ minWidth: 480 }}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <text x={SHARE_X} y={PAD_T + 2} fontSize="9" fontWeight={600} fill="var(--text-faint)">
          move share
        </text>
        <text x={GAP_X0} y={PAD_T + 2} fontSize="9" fontWeight={600} fill="var(--text-faint)">
          accuracy gap vs. peers (wp_loss)
        </text>
        <line x1={GAP_ZERO} x2={GAP_ZERO} y1={PAD_T + 10} y2={H - 6} stroke="var(--border)" />

        {PHASES.map(({ key, label }, i) => {
          const y = PAD_T + 14 + i * ROW_H;
          const share = mix[key];
          const delta = deltas[i];
          const barW = (share / 100) * SHARE_W;

          const gx = delta !== null ? gapXFor(delta) : GAP_ZERO;
          const color = delta === null ? "var(--text-faint)" : delta <= 0 ? "var(--good)" : "var(--bad)";
          const lx = delta !== null && delta >= 0 ? gx + 10 : gx - 10;

          return (
            <g key={key}>
              <text x={PAD_L} y={y + 14} fontSize="12" fontWeight={600} fill="var(--text)">
                {label}
              </text>

              <rect x={SHARE_X} y={y} width={SHARE_W} height={22} fill="var(--surface-raised)" rx={3} />
              <rect x={SHARE_X} y={y} width={barW} height={22} fill="var(--accent)" rx={3} opacity={0.9} />
              <text x={SHARE_X + SHARE_W + 8} y={y + 16} fontSize="11" fill="var(--text-dim)">
                {share.toFixed(0)}%
              </text>

              <line
                x1={GAP_ZERO}
                x2={gx}
                y1={y + 11}
                y2={y + 11}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={delta === null ? 0.5 : 1}
              />
              <circle cx={gx} cy={y + 11} r={5.5} fill={color} opacity={delta === null ? 0.5 : 1} />
              <text
                x={lx}
                y={y + 15}
                textAnchor={delta !== null && delta >= 0 ? "start" : "end"}
                fontSize="11"
                fontWeight={600}
                fill={color}
              >
                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "pending"}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
