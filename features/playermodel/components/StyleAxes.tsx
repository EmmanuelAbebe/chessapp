import type { StyleAxis } from "../types";

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

const SCALE = 3; // axis values are drawn on a fixed -3..+3 range
const W = 100; // percent-based inner coordinate system

/** Each PC axis as a filled diverging bar from centre - the same visual
 * grammar as "Where you differ"'s style-signature bars, just applied to
 * the raw axis position instead of a peer deviation. A thin track+dot
 * reads as a slider; a filled bar reads as a value, which this is. */
export function StyleAxes({ axes }: { axes: StyleAxis[] }) {
  if (axes.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5">
      <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
        Your style
      </h3>
      <div className="flex flex-col gap-4">
        {axes.map((axis) => {
          const [left, right] = poles(axis.label);
          const clamped = Math.max(-SCALE, Math.min(SCALE, axis.value));
          const fillPct = (Math.abs(clamped) / SCALE) * (W / 2);
          const fromCenter = clamped >= 0;
          return (
            <div key={axis.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-text-faint">
                <span className={!fromCenter ? "font-medium text-text" : undefined}>{left}</span>
                <span className={fromCenter ? "font-medium text-text" : undefined}>{right}</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-sm bg-surface-raised">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div
                  className="absolute inset-y-0 rounded-sm bg-accent/80"
                  style={
                    fromCenter
                      ? { left: "50%", width: `${fillPct}%` }
                      : { right: "50%", width: `${fillPct}%` }
                  }
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
