import type { OpeningsBreakdown as Breakdown, OpeningLine } from "../lib/summary";

type Row = OpeningLine & { key: string };

/** A bar per opening family instead of a donut - matches the bar-based
 * language the rest of the page converged on, and scales past ~6 entries
 * without a forced "top 5 + other" grouping (a pie chart's usual limit;
 * this now defaults to 8 named rows precisely because bars handle more
 * of them without becoming unreadable). */
export function OpeningsBreakdown({
  breakdown,
  side,
}: {
  breakdown: Breakdown;
  side: "all" | "w" | "b";
}) {
  const rows: Row[] = breakdown.lines.map((line) => ({ key: line.label, ...line }));
  if (breakdown.other) {
    rows.push({ key: "__other__", label: "Other openings", ...breakdown.other });
  }

  const total = breakdown.total;
  if (rows.length === 0 || total === 0) return null;

  const heading =
    side === "w" ? "Your openings as White" : side === "b" ? "Your openings as Black" : "Your openings";
  const maxGames = Math.max(...rows.map((r) => r.games));

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">{heading}</h3>
        <span className="font-mono text-xs text-text-faint">{total} games</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const share = (r.games / total) * 100;
          const barPct = (r.games / maxGames) * 100;
          const scoreColor = r.score >= 55 ? "var(--good)" : r.score <= 45 ? "var(--bad)" : "var(--text-dim)";
          return (
            <div key={r.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-text sm:w-48">{r.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${barPct}%` }} />
                </div>
                <span
                  className="w-12 shrink-0 text-right font-mono text-xs font-semibold"
                  style={{ color: scoreColor }}
                >
                  {r.score.toFixed(0)}%
                </span>
              </div>
              <p className="font-mono text-[11px] text-text-faint">
                {r.games} game{r.games === 1 ? "" : "s"} ({share.toFixed(0)}%) ·{" "}
                <span className="text-good">{r.wins}W</span> {r.draws}D{" "}
                <span className="text-bad">{r.losses}L</span>
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-faint">
        Bar length is share of these games; the % on the right is win-rate (win 1, draw ½).
        Family names come from the PGN&apos;s own opening tag where present.
      </p>
    </div>
  );
}
