import type { PhaseMix } from "../lib/traits";
import type { PhaseAccuracy } from "@/features/playermodel/types";

const PHASES: { key: keyof PhaseMix; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

const W = 460;
const H = 260;
const PAD = 56;
const PLOT = W - PAD * 2;
const PLOT_H = H - PAD - 34;

/** Where your games go (move-share, always available) against where you
 * actually lose accuracy vs. players at your level (from "Your playing
 * style" above) - plotted as one point per phase instead of two bars, so
 * the two axes read as a relationship (a phase can dominate your move
 * count without being where you're weakest) rather than two lists you
 * have to cross-reference by eye. */
export function PhaseQuadrantChart({
  mix,
  accuracy,
}: {
  mix: PhaseMix;
  accuracy?: Partial<Record<"opening" | "middlegame" | "endgame", PhaseAccuracy>>;
}) {
  const hasAnyAccuracy = Boolean(accuracy && Object.keys(accuracy).length > 0);

  const deltas = PHASES.map(({ key }) => {
    const acc = accuracy?.[key];
    return acc ? acc.you - acc.peers : null;
  });
  const maxAbsDelta = Math.max(2, ...deltas.filter((d): d is number => d !== null).map((d) => Math.abs(d)));

  const xFor = (share: number) => PAD + (share / 100) * PLOT;
  const yFor = (delta: number) => PAD - 20 + PLOT_H / 2 - (delta / maxAbsDelta) * (PLOT_H / 2);
  const zeroY = yFor(0);
  const equalShareX = xFor(100 / 3);

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Phase mix{hasAnyAccuracy ? " & accuracy" : ""}
      </h3>
      <p className="mb-3 text-[11px] text-text-faint">
        Across = how much of each game you spend in that phase. Up/down ={" "}
        {hasAnyAccuracy
          ? "your move-quality gap vs. players at your level there — above the line is worse than typical, below is better."
          : "your accuracy gap vs. players at your level, once you've analyzed your games above."}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {/* guides */}
        <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} stroke="var(--border)" />
        <text x={W - PAD} y={zeroY - 5} textAnchor="end" fontSize="9" fill="var(--text-faint)">
          typical for your rating
        </text>
        <line
          x1={equalShareX}
          x2={equalShareX}
          y1={PAD - 20}
          y2={PAD - 20 + PLOT_H}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <text x={equalShareX} y={PAD - 24} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
          equal thirds
        </text>

        {/* x axis ticks */}
        {[0, 25, 50, 75, 100].map((v) => (
          <text key={v} x={xFor(v)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
            {v}%
          </text>
        ))}

        {PHASES.map(({ key, label }) => {
          const share = mix[key];
          const delta = deltas[PHASES.findIndex((p) => p.key === key)];
          const cx = xFor(share);
          const cy = delta !== null ? yFor(delta) : zeroY;
          const color = delta === null ? "var(--text-faint)" : delta > 0 ? "var(--bad)" : "var(--good)";
          return (
            <g key={key}>
              <circle cx={cx} cy={cy} r={7} fill={color} opacity={delta === null ? 0.4 : 0.9} />
              <text x={cx} y={cy - 12} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="var(--text)">
                {label}
              </text>
              <text x={cx} y={cy + 20} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
                {share.toFixed(0)}% of moves
                {delta !== null ? ` · ${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : " · pending"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
