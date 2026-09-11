import type { StyleAxis } from "../types";

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

export function StyleAxes({ axes }: { axes: StyleAxis[] }) {
  if (axes.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5">
      <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
        Your style
      </h3>
      <div className="flex flex-col gap-3">
        {axes.map((axis) => {
          const [left, right] = poles(axis.label);
          const clamped = Math.max(-3, Math.min(3, axis.value));
          const percent = ((clamped + 3) / 6) * 100;
          return (
            <div key={axis.id} className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] text-text-faint">
                <span>{left}</span>
                <span>{right}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-surface-raised">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent"
                  style={{ left: `calc(${percent}% - 5px)` }}
                />
              </div>
              {axis.blurb && <p className="text-[11px] text-text-dim">{axis.blurb}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
