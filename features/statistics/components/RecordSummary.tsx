import type { RecordSummary, WinLossRecord } from "../lib/summary";

function Bar({ record }: { record: WinLossRecord }) {
  const { games, wins, draws, losses } = record;
  if (games === 0) return null;
  const pct = (n: number) => `${(n / games) * 100}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-raised">
      <div className="h-full bg-emerald-500" style={{ width: pct(wins) }} />
      <div className="h-full bg-text-faint/50" style={{ width: pct(draws) }} />
      <div className="h-full bg-red-400" style={{ width: pct(losses) }} />
    </div>
  );
}

function Row({ label, record }: { label: string; record: WinLossRecord }) {
  if (record.games === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-dim">{label}</span>
        <span className="font-mono text-xs text-text-faint">
          {record.wins}W {record.draws}D {record.losses}L ·{" "}
          <span className="text-text">{record.score.toFixed(0)}%</span>
        </span>
      </div>
      <Bar record={record} />
    </div>
  );
}

export function RecordSummary({ record }: { record: RecordSummary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
          Record
        </h3>
        <span className="text-sm text-text-dim">
          {record.overall.games} game
          {record.overall.games === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <Row label="Overall" record={record.overall} />
        <Row label="As White" record={record.asWhite} />
        <Row label="As Black" record={record.asBlack} />
      </div>
    </section>
  );
}
