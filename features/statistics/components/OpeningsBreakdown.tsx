import type { OpeningLine } from "../lib/summary";

export function OpeningsBreakdown({
  lines,
  side,
}: {
  lines: OpeningLine[];
  /** Which side these openings are for - just changes the heading. */
  side: "all" | "w" | "b";
}) {
  if (lines.length === 0) return null;
  const max = Math.max(...lines.map((l) => l.games));
  const heading =
    side === "w"
      ? "Your openings as White"
      : side === "b"
        ? "Your openings as Black"
        : "Most-played openings";

  return (
    <div className="w-full">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-faint uppercase">
        {heading}
      </h3>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-text">{line.label}</span>
              <span className="shrink-0 font-mono text-xs text-text-faint">
                {line.games} · {line.score.toFixed(0)}%
              </span>
            </div>
            {line.sample && (
              <span className="truncate font-mono text-[11px] text-text-faint">
                {line.sample}
              </span>
            )}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(line.games / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
