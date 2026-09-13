"use client";

import { useMemo, useState } from "react";
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

// Exact port of the mock's fig.3 divergingChart(): right-aligned labels,
// a filled bar from a centred zero axis, tick marks, value labels just
// outside each bar. Ticks are derived from `scale` (not hard-coded to
// ±2 like the mock) since real z can run much wider depending on panel.
const CHART_W = 440;
const ROW_H = 30;
const PAD_T = 8;
const PAD_L = 150;
const PAD_R = 46;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const ZERO_X = PAD_L + PLOT_W / 2;

function DivergingChart({
  rows,
  neutral,
  expandedId,
  onToggle,
}: {
  rows: Row[];
  neutral?: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const scale = Math.max(2, ...rows.map((r) => Math.abs(r.z)));
  const xFor = (v: number) => ZERO_X + (v / scale) * (PLOT_W / 2);
  const height = rows.length * ROW_H + PAD_T + 10;
  const ticks = [-scale, -scale / 2, 0, scale / 2, scale];

  return (
    <svg viewBox={`0 0 ${CHART_W} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
      <line x1={ZERO_X} x2={ZERO_X} y1={PAD_T} y2={height - 14} stroke="var(--border)" />
      {ticks.map((t) => {
        const x = xFor(t);
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={height - 14} y2={height - 10} stroke="var(--border)" />
            <text x={x} y={height - 1} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
              {t > 0 ? "+" : ""}
              {t.toFixed(1)}
            </text>
          </g>
        );
      })}

      {rows.map((r, i) => {
        const y = PAD_T + i * ROW_H;
        const barY = y + 5;
        const barH = 14;
        const x0 = Math.min(ZERO_X, xFor(r.z));
        const w = Math.abs(xFor(r.z) - ZERO_X);
        const color = neutral ? "var(--accent)" : r.z >= 0 ? "var(--good)" : "var(--bad)";
        const labelX = r.z >= 0 ? xFor(r.z) + 6 : xFor(r.z) - 6;
        const expanded = expandedId === r.id;
        return (
          <g
            key={r.id}
            onClick={() => onToggle(r.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle(r.id)}
          >
            <rect x={0} y={y} width={CHART_W} height={ROW_H} fill={expanded ? "var(--accent-soft)" : "transparent"} />
            <text x={PAD_L - 10} y={y + barH - 1} textAnchor="end" fontSize="11" fill="var(--text)">
              {r.title}
            </text>
            <rect x={x0} y={barY} width={Math.max(w, 1)} height={barH} fill={color} rx={2} opacity={0.9} />
            <text
              x={labelX}
              y={barY + barH - 3}
              textAnchor={r.z >= 0 ? "start" : "end"}
              fontSize="10"
              fontWeight={600}
              fill={color}
            >
              {r.z > 0 ? "+" : ""}
              {r.z.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function EvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-faint">{evidence.label || evidence.feature.replaceAll("_", " ")}</span>
      <span className="font-mono text-text-dim">
        you {evidence.you} · players at your level {evidence.cohort}
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

function DetailPanel({ row, onOpenPosition }: { row: Row; onOpenPosition: (fen: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-text">{row.title}</span>
        {row.confidence && (
          <span className="text-[11px] text-text-faint" title={CONFIDENCE_TITLE[row.confidence]}>
            {CONFIDENCE_LABEL[row.confidence]}
          </span>
        )}
      </div>
      {row.estimatedRatingGain !== undefined && (
        <span className="w-fit rounded-full bg-bad-soft px-2 py-0.5 text-[10px] font-semibold text-bad">
          ~{Math.round(row.estimatedRatingGain)} pts
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
  );
}

/** Strengths + graded focus areas (skill gaps, one shared good/bad scale)
 * and style signature (neutral, just "different") as the mock's fig.3
 * diverging-bar chart, pixel-for-pixel - each row is still clickable, the
 * same reveal-the-detail interaction FocusAreaCards had, just rendered
 * below the chart instead of inline per-card. */
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function openPosition(fen: string) {
    stashExploreFen(fen);
    router.push("/board");
  }

  const skillRows: Row[] = useMemo(
    () =>
      [
        ...focusAreas
          .filter((f) => f.graded)
          .map((f) => ({
            id: f.id, title: f.title, z: f.z, evidence: f.evidence,
            estimatedRatingGain: f.estimated_rating_gain, confidence: f.confidence,
            examplePositions: f.example_positions, coaching: f.coaching,
          })),
        ...strengths.map((s) => ({ id: s.id, title: s.title, z: s.z, evidence: s.evidence, text: s.text })),
      ].sort((a, b) => a.z - b.z),
    [focusAreas, strengths],
  );

  const styleRows: Row[] = useMemo(
    () =>
      signature.map((s) => ({
        id: s.feature,
        title: titleCase(s.feature),
        z: s.z,
        evidence: [{ feature: s.feature, you: s.you, cohort: s.peers }],
        text: s.text,
      })),
    [signature],
  );

  if (skillRows.length === 0 && styleRows.length === 0) {
    return (
      <p className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center text-sm text-text-dim">
        No clear pattern yet — play or import more games, or check back once more players with
        your style are in the reference set.
      </p>
    );
  }

  const expandedRow = [...skillRows, ...styleRows].find((r) => r.id === expandedId) ?? null;

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

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
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
              Skill gaps vs. players at your level
            </span>
            <div className="rounded-lg border border-border-soft bg-surface p-2">
              <DivergingChart rows={skillRows} expandedId={expandedId} onToggle={toggle} />
            </div>
          </div>
        )}
        {styleRows.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wide text-text-faint uppercase">
              Style signature — different, not graded
            </span>
            <div className="rounded-lg border border-border-soft bg-surface p-2">
              <DivergingChart rows={styleRows} neutral expandedId={expandedId} onToggle={toggle} />
            </div>
          </div>
        )}
      </div>

      {expandedRow && <DetailPanel row={expandedRow} onOpenPosition={openPosition} />}
    </div>
  );
}
