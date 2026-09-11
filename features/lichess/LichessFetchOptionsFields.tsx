import Checkbox from "@/components/ui/Checkbox";
import { PERF_TYPES, type LichessFetchOptionsState } from "./useLichessFetchOptions";

const PERF_LABELS: Record<(typeof PERF_TYPES)[number], string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
};

/** A collapsible options row for "import my Lichess games": which time
 * control(s), how many, a date range, and rated-only - reused by
 * GameDataCard and MapImportGamesModal rather than each hard-coding a
 * fixed count/speed. Left at its defaults (empty = every speed, rated
 * only) it behaves exactly like the old one-click "last N games" button. */
export function LichessFetchOptionsFields({
  state,
  idPrefix,
  disabled,
}: {
  state: LichessFetchOptionsState;
  idPrefix: string;
  disabled?: boolean;
}) {
  return (
    <details className="group rounded-lg border border-border-soft">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-text-dim marker:content-none [&::-webkit-details-marker]:hidden">
        Options: time control, count, date range
      </summary>
      <div className="flex flex-col gap-3 border-t border-border-soft p-3">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text">
            Time control
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {PERF_TYPES.map((pt) => (
              <Checkbox
                key={pt}
                id={`${idPrefix}-perf-${pt}`}
                label={PERF_LABELS[pt]}
                checked={state.perfTypes.includes(pt)}
                onChange={() => state.togglePerfType(pt)}
                disabled={disabled}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-text-faint">
            None checked = every time control.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-max`}
              className="mb-1 block text-xs font-medium text-text"
            >
              Max games
            </label>
            <input
              id={`${idPrefix}-max`}
              type="number"
              min={1}
              max={2000}
              value={state.max}
              onChange={(e) => state.setMax(Math.max(1, Number(e.target.value) || 1))}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-1.5 font-mono text-xs text-text focus:border-accent focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex items-end pb-1.5">
            <Checkbox
              id={`${idPrefix}-rated`}
              label="Rated only"
              checked={state.ratedOnly}
              onChange={(e) => state.setRatedOnly(e.target.checked)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-since`}
              className="mb-1 block text-xs font-medium text-text"
            >
              From
            </label>
            <input
              id={`${idPrefix}-since`}
              type="date"
              value={state.sinceDate}
              onChange={(e) => state.setSinceDate(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs text-text focus:border-accent focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-until`}
              className="mb-1 block text-xs font-medium text-text"
            >
              To
            </label>
            <input
              id={`${idPrefix}-until`}
              type="date"
              value={state.untilDate}
              onChange={(e) => state.setUntilDate(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs text-text focus:border-accent focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </details>
  );
}
