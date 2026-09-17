"use client";

import { useRouter } from "next/navigation";
import { stashExploreFen } from "@/features/history/exploreGame";
import { HintIcon } from "@/components/ui/HintIcon";
import type { Coaching, SituationalGap } from "../types";

function CoachingBlock({ coaching }: { coaching?: Coaching }) {
  if (!coaching) return null;
  const lines = [coaching.what, coaching.why, coaching.missed, coaching.principle, coaching.drill].filter(Boolean);
  if (lines.length === 0) return null;
  return <p className="font-serif text-sm leading-relaxed text-text">{lines.join(" ")}</p>;
}

/** A deterministic, always-available one-line explanation from data
 * already on every gap - no LLM key required, unlike `coaching` below
 * (which only ever fills for critical_lessons, and only when the viewer
 * has a BYO AI key configured). Every row gets at least this. */
function baselineSummary(gap: SituationalGap, kind: "lesson" | "strength"): string {
  const pct = Math.round(gap.share_of_moves * 100);
  if (kind === "lesson") {
    return `Costs you the most total ground here: it happens in ${pct}% of your moves and averages ${gap.your_wp_loss.toFixed(1)}% win-probability lost each time.`;
  }
  return `One of your steadiest situations - you lose only ${gap.your_wp_loss.toFixed(1)}% here, on average, whenever it comes up (${pct}% of your moves).`;
}

/** One situational gap as a plain (not diverging) horizontal bar - there's
 * no "other side" to diverge from here, every number is this player's own
 * win-probability lost vs. Stockfish's best move, nothing compared to
 * anyone else. Bar length is `value` (impact for lessons, wp_loss for
 * strong situations) relative to `max` across the whole list it's in, so
 * the biggest lever/strongest area always reads as the fullest bar. */
function GapRow({
  gap,
  kind,
  value,
  max,
  color,
  onOpenPosition,
}: {
  gap: SituationalGap;
  kind: "lesson" | "strength";
  value: number;
  max: number;
  color: string;
  onOpenPosition: (fen: string) => void;
}) {
  const fillPct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  // Lessons keep the leading "-" (it correctly reads as "this is what's
  // being lost"); a strength showing "-3.3%" under a "you're doing well"
  // heading reads as a bad number, so it drops the sign and leans on its
  // own "only X% lost" wording instead (see baselineSummary above).
  const readout =
    kind === "lesson"
      ? `−${gap.your_wp_loss.toFixed(1)}% · in ${Math.round(gap.share_of_moves * 100)}% of your moves`
      : `${gap.your_wp_loss.toFixed(1)}% lost · in ${Math.round(gap.share_of_moves * 100)}% of your moves`;

  const summary = (
    <div className="flex cursor-pointer flex-col gap-1 px-3 py-2.5 transition hover:bg-surface-raised/60">
      <span className="text-xs text-text sm:hidden">{gap.label}</span>
      <div className="flex items-center gap-3">
        <span className="hidden shrink-0 truncate text-xs text-text sm:inline sm:w-44">{gap.label}</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-surface-raised">
          <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${fillPct}%`, background: color }} />
        </div>
        <span className="w-36 shrink-0 text-right font-mono text-xs text-text-dim">{readout}</span>
      </div>
    </div>
  );

  return (
    <details className="group">
      <summary className="list-none marker:content-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      <div className="flex flex-col gap-3 border-t border-border-soft bg-surface-raised/40 px-3 py-3">
        <p className="text-xs text-text-dim">{baselineSummary(gap, kind)}</p>
        <CoachingBlock coaching={gap.coaching} />
        {gap.example_positions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
              See it in your games
            </span>
            <div className="flex flex-wrap gap-2">
              {gap.example_positions.map((pos) => (
                <button
                  key={`${pos.game_id}-${pos.ply}`}
                  type="button"
                  onClick={() => onOpenPosition(pos.fen)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-text-dim transition hover:border-accent hover:text-text"
                >
                  {pos.seed || `move ${Math.ceil(pos.ply / 2)}`} · −{pos.wp_loss.toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function GapList({
  gaps,
  kind,
  metric,
  color,
  emptyMessage,
  onOpenPosition,
}: {
  gaps: SituationalGap[];
  kind: "lesson" | "strength";
  metric: (g: SituationalGap) => number;
  color: string;
  emptyMessage: string;
  onOpenPosition: (fen: string) => void;
}) {
  if (gaps.length === 0) {
    return (
      <div className="rounded-lg border border-border-soft bg-surface px-3 py-6 text-center text-xs text-text-dim">
        {emptyMessage}
      </div>
    );
  }
  const max = Math.max(...gaps.map(metric));
  return (
    <div className="divide-y divide-border-soft rounded-lg border border-border-soft bg-surface">
      {gaps.map((g) => (
        <GapRow key={g.id} gap={g} kind={kind} value={metric(g)} max={max} color={color} onOpenPosition={onOpenPosition} />
      ))}
    </div>
  );
}

/** Self-referential coaching: every number here is this player's own
 * moves scored only against Stockfish's own best move - no peer
 * comparison, no reference population. `lessons` are the situations
 * costing the most total win-probability (biggest levers first);
 * `strong` are the situations already closest to optimal play. */
export function CriticalLessons({
  lessons,
  strong,
}: {
  lessons: SituationalGap[];
  strong: SituationalGap[];
}) {
  const router = useRouter();
  function openPosition(fen: string) {
    stashExploreFen(fen);
    router.push("/board");
  }

  if (lessons.length === 0 && strong.length === 0) {
    return (
      <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
        No clear pattern yet — play or import more games so each situation (tactical positions, time
        pressure, defending, ...) has enough moves to be worth ranking.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Critical lessons
        <HintIcon
          text="Every number here is your own moves scored only against Stockfish's own best move - no comparison to other players. Critical lessons are the situations costing you the most total win-probability; strong situations are where you're already closest to optimal."
          width="w-64"
        />
      </h3>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
          Biggest levers to close the gap
        </span>
        <GapList
          gaps={lessons}
          kind="lesson"
          metric={(g) => g.impact}
          color="var(--bad)"
          onOpenPosition={openPosition}
          emptyMessage="No standout lever yet — losses are spread evenly across situations."
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
          Where you're already solid
        </span>
        <GapList
          gaps={strong}
          kind="strength"
          metric={(g) => g.your_wp_loss}
          color="var(--good)"
          onOpenPosition={openPosition}
          emptyMessage="Not enough moves yet in any one situation to call out a strength."
        />
      </div>
    </div>
  );
}
