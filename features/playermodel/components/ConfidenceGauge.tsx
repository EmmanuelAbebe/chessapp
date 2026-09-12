const W = 214;
const H = 122;
const CX = W / 2;
const CY = 100;
const R = 78;

function angleFor(t: number): number {
  return Math.PI - t * Math.PI;
}

function arcPoint(angle: number, radius: number) {
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arcPath(t0: number, t1: number): string {
  const a0 = angleFor(t0);
  const a1 = angleFor(t1);
  const p0 = arcPoint(a0, R);
  const p1 = arcPoint(a1, R);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

/** How many games skill.confidence actually rests on, as a dial instead of
 * a bare "78%" in a caption - confidence here means "how much data went
 * into this," not "how accurate the estimate is." */
export function ConfidenceGauge({ confidence, gamesAnalyzed }: { confidence: number; gamesAnalyzed: number }) {
  const value = Math.max(0, Math.min(1, confidence));
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[180px]">
        <path d={arcPath(0, 1)} stroke="var(--surface-raised)" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arcPath(0, value)} stroke="var(--accent)" strokeWidth={14} fill="none" strokeLinecap="round" />
        {[0, 0.5, 1].map((t) => {
          const p = arcPoint(angleFor(t), R + 16);
          return (
            <text key={t} x={p.x} y={p.y + 3} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
              {Math.round(t * 100)}
            </text>
          );
        })}
        <text x={CX} y={CY - 20} textAnchor="middle" fontSize="24" fontWeight={700} fill="var(--text)">
          {Math.round(value * 100)}%
        </text>
        <text x={CX} y={CY - 2} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
          confidence
        </text>
      </svg>
      <p
        className="text-center text-[10px] text-text-faint"
        title="How many games this estimate rests on: 50+ is treated as fully confident, scaling down linearly below that. It's not a measure of how accurate the number is, just how much data went into it."
      >
        {gamesAnalyzed} games analyzed
      </p>
    </div>
  );
}
