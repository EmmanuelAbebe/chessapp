import type { StyleAxis } from "../types";

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

const SCALE = 3; // axis values are drawn on a fixed -3..+3 range
const TICKS = [-3, -1.5, 0, 1.5, 3];

function tickLeft(t: number): number {
  return ((t + SCALE) / (SCALE * 2)) * 100;
}

/** Each PC axis as a filled diverging bar from centre, now with an actual
 * scale (tick marks at -3/0/+3) and the numeric value spelled out - the
 * previous version was just a bare bar: no ticks, no number, and (once
 * this card went full-width) stretched edge to edge for very little
 * information per row. A 2-col grid plus a capped bar width fixes the
 * "too wide" side of that; the ticks/value fix the "not scaled, no
 * labels" side. */
export function StyleAxes({ axes }: { axes: StyleAxis[] }) {
  if (axes.length === 0) return null;
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border-soft bg-surface p-5">
      <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
        Your style
      </h3>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {axes.map((axis) => {
          const [left, right] = poles(axis.label);
          const clamped = Math.max(-SCALE, Math.min(SCALE, axis.value));
          const fillPct = (Math.abs(clamped) / SCALE) * 50;
          const fromCenter = clamped >= 0;
          return (
            <div key={axis.id} className="flex max-w-sm flex-col gap-1">
              <div className="flex justify-between text-[11px] text-text-faint">
                <span className={!fromCenter ? "font-medium text-text" : undefined}>{left}</span>
                <span className={fromCenter ? "font-medium text-text" : undefined}>{right}</span>
              </div>

              <div className="flex items-start gap-2">
                <div className="flex-1">
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
                  <div className="relative mt-1 h-3">
                    {TICKS.map((t) => (
                      <div
                        key={t}
                        className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5"
                        style={{ left: `${tickLeft(t)}%` }}
                      >
                        <div className="h-1 w-px bg-border" />
                        <span className="font-mono text-[9px] text-text-faint">
                          {t === 0 ? "0" : t > 0 ? `+${t}` : t}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <span className="w-10 shrink-0 pt-[1px] text-right font-mono text-xs font-semibold text-accent">
                  {clamped > 0 ? "+" : ""}
                  {clamped.toFixed(1)}
                </span>
              </div>

              {axis.blurb && <p className="text-[11px] text-text-dim">{axis.blurb}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
