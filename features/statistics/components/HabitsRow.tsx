import type { Habits } from "../lib/summary";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border-soft bg-surface px-3 py-2 text-center">
      <span className="font-mono text-base text-text">{value}</span>
      <span className="mt-0.5 text-[11px] text-text-faint">{label}</span>
    </div>
  );
}

export function HabitsRow({
  habits,
  movesCount,
}: {
  habits: Habits;
  /** Total of the player's own moves in the current selection. */
  movesCount?: number;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      <Stat
        label="avg. game length"
        value={`${Math.round(habits.avgLength / 2)} moves`}
      />
      {movesCount !== undefined && (
        <Stat label="your moves" value={movesCount.toLocaleString()} />
      )}
      <Stat label="decisive" value={`${habits.decisiveRate.toFixed(0)}%`} />
      {habits.timePressureRate !== null && (
        <Stat
          label="moves in time trouble"
          value={`${habits.timePressureRate.toFixed(0)}%`}
        />
      )}
    </div>
  );
}
