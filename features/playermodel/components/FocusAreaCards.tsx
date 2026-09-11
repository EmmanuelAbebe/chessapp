"use client";

import { useRouter } from "next/navigation";
import { stashExploreFen } from "@/features/history/exploreGame";
import type { FocusArea } from "../types";

const CONFIDENCE_LABEL: Record<FocusArea["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function EvidenceRow({ feature, you, cohort }: { feature: string; you: number; cohort: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-faint capitalize">{feature.replaceAll("_", " ")}</span>
      <span className="font-mono text-text-dim">
        you {you} · stronger peers {cohort}
      </span>
    </div>
  );
}

function CoachingBlock({ coaching }: { coaching: FocusArea["coaching"] }) {
  const lines = [
    coaching.what,
    coaching.why,
    coaching.missed,
    coaching.principle,
    coaching.drill,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <p className="font-serif text-[13.5px] leading-relaxed text-text">
      {lines.join(" ")}
    </p>
  );
}

export function FocusAreaCards({ areas }: { areas: FocusArea[] }) {
  const router = useRouter();
  if (areas.length === 0) {
    return (
      <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
        No clear recurring pattern yet — play or import more games, or check back once more
        stronger players with your style are in the reference set.
      </p>
    );
  }

  function openPosition(fen: string) {
    stashExploreFen(fen);
    router.push("/board");
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
        Focus areas
      </h3>
      {areas.map((area) => (
        <details
          key={area.id}
          className="group rounded-lg border border-l-[3px] border-border-soft border-l-bad bg-surface"
          open={area.rank === 1}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <span className="font-medium text-text">{area.title}</span>
              <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[10px] font-semibold text-bad">
                ~{Math.round(area.estimated_rating_gain)} pts
              </span>
            </span>
            <span className="text-[11px] text-text-faint">
              {CONFIDENCE_LABEL[area.confidence]}
            </span>
          </summary>

          <div className="flex flex-col gap-3 border-t border-border-soft px-4 py-3">
            <div className="flex flex-col gap-1">
              {area.evidence.map((e) => (
                <EvidenceRow key={e.feature} feature={e.feature} you={e.you} cohort={e.cohort} />
              ))}
            </div>

            <CoachingBlock coaching={area.coaching} />

            {area.example_positions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
                  See it in your games
                </span>
                <div className="flex flex-wrap gap-2">
                  {area.example_positions.map((pos) => (
                    <button
                      key={`${pos.game_id}-${pos.ply}`}
                      type="button"
                      onClick={() => openPosition(pos.fen)}
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
      ))}
    </div>
  );
}
