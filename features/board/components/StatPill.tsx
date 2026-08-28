import { HUB_COLOR } from "../lib/move-tree-map-helpers";

export function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-22 flex-row gap-2 py-0.5">
      <span className="font-mono text-[0.62rem] tracking-wide text-text-faint uppercase">
        {label}
      </span>
      <span
        className="font-mono text-[0.62rem] [font-variant-numeric:tabular-nums]"
        style={accent ? { color: HUB_COLOR } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
