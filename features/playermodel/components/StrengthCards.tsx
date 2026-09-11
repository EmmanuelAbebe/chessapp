import type { Strength } from "../types";

export function StrengthCards({ strengths }: { strengths: Strength[] }) {
  if (strengths.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
        Strengths
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {strengths.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-1 rounded-lg border border-l-[3px] border-border-soft border-l-good bg-surface p-4"
          >
            <span className="text-sm font-medium text-text">{s.title}</span>
            <p className="text-xs text-text-dim">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
