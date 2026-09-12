"use client";

import { useRouter } from "next/navigation";
import { stashExploreFen } from "@/features/history/exploreGame";
import type { Coaching, Evidence, ExamplePosition, FocusArea, SignatureItem, Strength } from "../types";

const CONFIDENCE_LABEL: Record<FocusArea["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CONFIDENCE_TITLE: Record<FocusArea["confidence"], string> = {
  high: "Based on 150+ stronger players who share your style — a reliable comparison.",
  medium: "Based on 40-150 stronger players who share your style — a reasonable comparison, but expect it to sharpen as the reference pool grows.",
  low: "Based on fewer than 40 stronger players who share your style — treat this as a hint, not a verdict, until more data comes in.",
};

type Row = {
  id: string;
  title: string;
  z: number;
  evidence: Evidence[];
  text?: string;
  estimatedRatingGain?: number;
  confidence?: FocusArea["confidence"];
  examplePositions?: ExamplePosition[];
  coaching?: Coaching;
};

function titleCase(feature: string): string {
  return feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function EvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-faint">{evidence.label || evidence.feature.replaceAll("_", " ")}</span>
      <span className="font-mono text-text-dim">
        you {evidence.you} · {evidence.cohort != null ? `players at your level ${evidence.cohort}` : ""}
      </span>
    </div>
  );
}

function CoachingBlock({ coaching }: { coaching?: Coaching }) {
  if (!coaching) return null;
  const lines = [coaching.what, coaching.why, coaching.missed, coaching.principle, coaching.drill].filter(Boolean);
  if (lines.length === 0) return null;
  return <p className="font-serif text-[13.5px] leading-relaxed text-text">{lines.join(" ")}</p>;
}

function DivergingRow({
  row,
  scale,
  neutral,
  onOpenPosition,
}: {
  row: Row;
  scale: number;
  neutral?: boolean;
  onOpenPosition: (fen: string) => void;
}) {
  const clamped = Math.max(-scale, Math.min(scale, row.z));
  const fillPct = (Math.abs(clamped) / scale) * 50;
  const positive = clamped >= 0;
  const color = neutral ? "var(--accent)" : positive ? "var(--good)" : "var(--bad)";
  const hasDetail = Boolean(
    row.text || row.coaching || (row.examplePositions && row.examplePositions.length > 0) || row.evidence.length,
  );

  const summary = (
    <div className="flex cursor-pointer items-center gap-3 px-3 py-2">
      <span className="w-32 shrink-0 truncate text-xs text-text sm:w-40">{row.title}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-surface-raised">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className="absolute inset-y-0 rounded-sm"
          style={
            positive
              ? { left: "50%", width: `${fillPct}%`, background: color }
              : { right: "50%", width: `${fillPct}%`, background: color }
          }
        />
      </div>
      {row.estimatedRatingGain !== undefined && (
        <span className="hidden shrink-0 rounded-full bg-bad-soft px-2 py-0.5 text-[10px] font-semibold text-bad sm:inline">
          ~{Math.round(row.estimatedRatingGain)} pts
        </span>
      )}
      <span
        className="w-12 shrink-0 text-right font-mono text-xs font-semibold"
        style={{ color }}
      >
        {clamped > 0 ? "+" : ""}
        {clamped.toFixed(1)}
      </span>
    </div>
  );

  if (!hasDetail) {
    return <div className="rounded-md border border-border-soft bg-surface">{summary}</div>;
  }

  return (
    <details className="group rounded-md border border-border-soft bg-surface">
      <summary className="list-none marker:content-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      <div className="flex flex-col gap-3 border-t border-border-soft px-3 py-3">
        {row.confidence && (
          <span className="text-[11px] text-text-faint" title={CONFIDENCE_TITLE[row.confidence]}>
            {CONFIDENCE_LABEL[row.confidence]}
          </span>
        )}
        <div className="flex flex-col gap-1">
          {row.evidence.map((e) => (
            <EvidenceRow key={e.feature} evidence={e} />
          ))}
        </div>
        {row.text && <p className="text-xs text-text-dim">{row.text}</p>}
        <CoachingBlock coaching={row.coaching} />
        {row.examplePositions && row.examplePositions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
              See it in your games
            </span>
            <div className="flex flex-wrap gap-2">
              {row.examplePositions.map((pos) => (
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

/** Strengths + graded focus areas (skill gaps, one shared good/bad scale)
 * and style signature (neutral, just "different") as diverging bars, each
 * expandable in place - the same click-reveal detail FocusAreaCards had,
 * without three separate card lists saying overlapping things. */
export function WhereYouDiffer({
  strengths,
  focusAreas,
  signature,
}: {
  strengths: Strength[];
  focusAreas: FocusArea[];
  signature: SignatureItem[];
}) {
  const router = useRouter();
  function openPosition(fen: string) {
    stashExploreFen(fen);
    router.push("/board");
  }

  const skillRows: Row[] = [
    ...focusAreas
      .filter((f) => f.graded)
      .map((f) => ({
        id: f.id, title: f.title, z: f.z, evidence: f.evidence,
        estimatedRatingGain: f.estimated_rating_gain, confidence: f.confidence,
        examplePositions: f.example_positions, coaching: f.coaching,
      })),
    ...strengths.map((s) => ({ id: s.id, title: s.title, z: s.z, evidence: s.evidence, text: s.text })),
  ].sort((a, b) => a.z - b.z);

  const styleRows: Row[] = signature.map((s) => ({
    id: s.feature,
    title: titleCase(s.feature),
    z: s.z,
    evidence: [{ feature: s.feature, you: s.you, cohort: s.peers }],
    text: s.text,
  }));

  if (skillRows.length === 0 && styleRows.length === 0) {
    return (
      <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
        No clear pattern yet — play or import more games, or check back once more players with
        your style are in the reference set.
      </p>
    );
  }

  const skillScale = Math.max(2, ...skillRows.map((r) => Math.abs(r.z)));
  const styleScale = Math.max(2, ...styleRows.map((r) => Math.abs(r.z)));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
          Where you differ
        </h3>
        <p className="mt-1 text-xs text-text-dim">
          Skill gaps (green = better, red = worse than players at your level) and style
          signature (how you differ, not graded) — click a row for the detail.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {skillRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
              Skill gaps vs. players at your level
            </span>
            {skillRows.map((row) => (
              <DivergingRow key={row.id} row={row} scale={skillScale} onOpenPosition={openPosition} />
            ))}
          </div>
        )}
        {styleRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
              Style signature — different, not graded
            </span>
            {styleRows.map((row) => (
              <DivergingRow key={row.id} row={row} scale={styleScale} neutral onOpenPosition={openPosition} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
