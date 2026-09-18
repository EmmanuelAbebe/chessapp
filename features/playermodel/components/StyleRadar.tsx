"use client";

import { useMemo, useState } from "react";
import type {
  FeatureDelta,
  PhaseAccuracy,
  StyleAxis,
  StyleGroup,
  StyleTrajectoryPoint,
  TraitStability,
} from "../types";
import { HintIcon } from "@/components/ui/HintIcon";
import type { PhaseMix } from "@/features/statistics/lib/traits";

const PAD_X = 70;
const PAD_TOP = 46;
const PAD_BOTTOM = 34;
const SIZE = 260;
const W = PAD_X * 2 + SIZE;
const H = PAD_TOP + SIZE + PAD_BOTTOM;
const CX = PAD_X + SIZE / 2;
const CY = PAD_TOP + SIZE / 2;
const R = SIZE * 0.46;

type Mode = "overall" | "career" | "phase" | "opening" | "complexity";

type Series = {
  id: string;
  label: string;
  values: number[];
  color: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  meta?: string;
};

function poles(label: string): [string, string] {
  const [a, b] = label.split("↔").map((s) => s.trim());
  return [a || label, b || ""];
}

function wrapLabel(text: string, maxLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxLen && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function formatFeatureValue(feature: string, value: number): string {
  if (feature === "mean_think_time") return `${value.toFixed(1)}s`;
  if (feature === "eval_volatility_mean" || feature === "material_swing_mean") return value.toFixed(1);
  return `${Math.round(value * 100)}%`;
}

const PHASE_LABEL: Record<StyleTrajectoryPoint["phase"], string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
};
const PHASE_COLOR: Record<StyleTrajectoryPoint["phase"], string> = {
  opening: "var(--good)",
  middlegame: "var(--accent)",
  endgame: "var(--bad)",
};
const PHASES: StyleTrajectoryPoint["phase"][] = ["opening", "middlegame", "endgame"];

/** Weighted-average of every trajectory bin's vector and feature_deltas,
 * grouped by that bin's own real phase - a real derived per-phase style
 * (and per-phase "why", reusing the fixed feature list every bin already
 * carries), not a new computation on the server: `style_trajectory`
 * already ships vector/phase/n/feature_deltas per 5-move bin, this just
 * folds bins that share a phase into one. */
function phaseSeriesFrom(trajectory: StyleTrajectoryPoint[], nAxes: number) {
  const byPhase = new Map<StyleTrajectoryPoint["phase"], StyleTrajectoryPoint[]>();
  for (const p of trajectory) {
    if (!byPhase.has(p.phase)) byPhase.set(p.phase, []);
    byPhase.get(p.phase)!.push(p);
  }
  return PHASES.filter((ph) => byPhase.has(ph)).map((phase) => {
    const bins = byPhase.get(phase)!;
    const totalN = bins.reduce((s, b) => s + b.n, 0);
    const values = Array.from({ length: nAxes }, (_, ai) => bins.reduce((s, b) => s + b.vector[ai] * b.n, 0) / totalN);
    const deltaMap = new Map<string, { label: string; overall: number; weighted: number }>();
    for (const b of bins) {
      for (const fd of b.feature_deltas) {
        const cur = deltaMap.get(fd.feature) ?? { label: fd.label, overall: fd.overall_value, weighted: 0 };
        cur.weighted += fd.bin_value * b.n;
        deltaMap.set(fd.feature, cur);
      }
    }
    const featureDeltas: FeatureDelta[] = Array.from(deltaMap.entries()).map(([feature, v]) => ({
      feature, label: v.label, bin_value: v.weighted / totalN, overall_value: v.overall,
    }));
    return { phase, values, n: totalN, featureDeltas };
  });
}

function buildPolygon(values: number[], domainAbs: number): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const angle = ((-90 + i * (360 / n)) * Math.PI) / 180;
      const t = Math.min(1, Math.max(0, (v + domainAbs) / (2 * domainAbs)));
      const r = t * R;
      const x = CX + r * Math.cos(angle);
      const y = CY + r * Math.sin(angle);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

function vertexAt(i: number, n: number, v: number, domainAbs: number): [number, number] {
  const angle = ((-90 + i * (360 / n)) * Math.PI) / 180;
  const t = Math.min(1, Math.max(0, (v + domainAbs) / (2 * domainAbs)));
  const r = t * R;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

/** One radar, filterable to five different real slices of the same 5-
 * axis style vector - replaces StyleAxes (diverging bars), StyleCompass
 * (2D PC0/PC3 scatter + trajectory curve) and TraitStability (per-axis
 * stable/changed badges), all fully absorbed rather than shown
 * alongside a single-shape radar. Overall/career are the whole-game
 * style scale (fixed ±3, same as the retired StyleAxes); phase auto-
 * scales to its own real range, same reason StyleCompass's trajectory
 * curve did (per-move-window magnitudes run larger than a whole-game
 * average). Opening and complexity need real per-game data most
 * profiles won't have enough of yet, so those tabs only appear once the
 * server actually returns qualifying groups - never a mock/empty shape. */
export function StyleRadar({
  vector,
  axes,
  trajectory,
  traitStability,
  styleByOpening,
  styleByComplexity,
  phaseMix,
  phaseAccuracy,
}: {
  vector: number[];
  axes: StyleAxis[];
  trajectory?: StyleTrajectoryPoint[];
  traitStability?: TraitStability[];
  styleByOpening?: StyleGroup[];
  styleByComplexity?: StyleGroup[];
  phaseMix?: PhaseMix | null;
  phaseAccuracy?: Partial<Record<StyleTrajectoryPoint["phase"], PhaseAccuracy>>;
}) {
  const [mode, setMode] = useState<Mode>("overall");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [careerIdx, setCareerIdx] = useState(0);

  const nAxes = axes.length;
  const traj = trajectory ?? [];
  const stability = traitStability ?? [];
  const openings = styleByOpening ?? [];
  const complexity = styleByComplexity ?? [];

  const careerPoints = stability[0]?.points ?? [];
  const phaseGroups = useMemo(() => phaseSeriesFrom(traj, nAxes), [traj, nAxes]);

  const availableModes: { id: Mode; label: string }[] = [
    { id: "overall", label: "Overall" },
    ...(careerPoints.length >= 2 ? [{ id: "career" as const, label: "Career" }] : []),
    ...(phaseGroups.length > 0 ? [{ id: "phase" as const, label: "Game phase" }] : []),
    ...(openings.length >= 2 ? [{ id: "opening" as const, label: "Opening" }] : []),
    ...(complexity.length > 0 ? [{ id: "complexity" as const, label: "Complexity" }] : []),
  ];
  const activeMode = availableModes.some((m) => m.id === mode) ? mode : "overall";

  if (nAxes === 0) return null;

  function selectMode(m: Mode) {
    setMode(m);
    setSelected(null);
    setHovered(null);
  }

  let series: Series[] = [];
  let domainAbs = 3;

  if (activeMode === "overall") {
    series = [{ id: "overall", label: "You", values: vector.slice(0, nAxes), color: "var(--accent)", fillOpacity: 0.14, strokeOpacity: 1, strokeWidth: 2.4 }];
  } else if (activeMode === "career") {
    // Showing all N buckets at once (verified on a real 9-bucket profile)
    // is an unreadable tangle - one hue at varying opacity doesn't
    // distinguish 9 overlapping polygons. Instead: always "now" (the
    // last bucket) plus one scrubbable historical bucket, so a career
    // with many buckets is explored two shapes at a time rather than
    // dumped all at once.
    const lastIdx = careerPoints.length - 1;
    const histIdx = Math.min(careerIdx, Math.max(0, lastIdx - 1));
    const valuesAt = (bi: number) => Array.from({ length: nAxes }, (_, ai) => stability[ai]?.points[bi]?.value ?? 0);
    series = [
      {
        id: "hist", label: careerPoints[histIdx]?.date ?? "", meta: careerPoints[histIdx] ? `${careerPoints[histIdx].elo} elo` : undefined,
        values: valuesAt(histIdx), color: "var(--text-faint)", fillOpacity: 0, strokeOpacity: 0.9, strokeWidth: 1.6,
      },
      {
        id: "now", label: `${careerPoints[lastIdx]?.date ?? ""} (now)`, meta: careerPoints[lastIdx] ? `${careerPoints[lastIdx].elo} elo` : undefined,
        values: valuesAt(lastIdx), color: "var(--accent)", fillOpacity: 0.16, strokeOpacity: 1, strokeWidth: 2.4,
      },
    ];
  } else if (activeMode === "phase") {
    series = phaseGroups.map((g) => ({
      id: g.phase, label: PHASE_LABEL[g.phase], meta: `${g.n} moves`,
      values: g.values, color: PHASE_COLOR[g.phase], fillOpacity: 0.1, strokeOpacity: 1, strokeWidth: 2,
    }));
  } else if (activeMode === "opening") {
    // Up to 6 groups (_MAX_OPENING_GROUPS on the server) - exactly the
    // app's categorical chart palette size, so every qualifying opening
    // gets its own real, always-defined color.
    series = openings.map((g, i) => ({
      id: g.key, label: g.label, meta: `${g.n_games} games`,
      values: g.vector.slice(0, nAxes), color: `var(--chart-${(i % 6) + 1})`,
      fillOpacity: 0.1, strokeOpacity: 1, strokeWidth: 2,
    }));
  } else if (activeMode === "complexity") {
    const colors = ["var(--good)", "var(--accent)", "var(--bad)"];
    series = complexity.map((g, i) => ({
      id: g.key, label: g.label, meta: `${g.n_games} games`,
      values: g.vector.slice(0, nAxes), color: colors[i % colors.length],
      fillOpacity: 0.1, strokeOpacity: 1, strokeWidth: 2,
    }));
  }

  // Auto-scaled to whatever's actually visible, not assumed - a narrow
  // subset (one opening, one 5-move window) is far less diverse than a
  // whole-game average, so its real PCA projection can genuinely run
  // much larger than the usual ±3 whole-game range. Never *smaller* than
  // ±3 so a single calm "overall" shape isn't zoomed in past readability.
  domainAbs = Math.max(3, ...series.flatMap((s) => s.values.map(Math.abs))) * 1.15;

  const selectedPhase = activeMode === "phase" ? phaseGroups.find((g) => g.phase === selected) : undefined;
  const selectedOpening = activeMode === "opening" ? openings.find((g) => g.key === selected) : undefined;
  const selectedComplexity = activeMode === "complexity" ? complexity.find((g) => g.key === selected) : undefined;
  const clickable = activeMode === "phase" || activeMode === "opening" || activeMode === "complexity";

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-faint uppercase">
        Your style
        <HintIcon
          text="The same 5 style axes, sliced a different way per filter: your overall style, how it's shifted across your career, how it differs by game phase, by opening played, and by how sharp the game got. Self-referential throughout - no comparison to other players."
          width="w-64"
        />
      </h3>

      <div className="flex flex-wrap gap-1.5">
        {availableModes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectMode(m.id)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              activeMode === m.id
                ? "border-accent bg-accent/15 text-accent"
                : "border-border-soft text-text-faint hover:border-border hover:text-text-dim"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={Array.from({ length: nAxes }, (_, i) => {
              const angle = ((-90 + i * (360 / nAxes)) * Math.PI) / 180;
              return `${(CX + f * R * Math.cos(angle)).toFixed(1)},${(CY + f * R * Math.sin(angle)).toFixed(1)}`;
            }).join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={f === 0.5 ? 1.3 : 1}
            strokeDasharray={f === 0.5 ? "3 3" : undefined}
          />
        ))}
        <text x={CX + 6} y={CY - 0.5 * R + 3} fontSize="8" fill="var(--text-faint)">neutral</text>

        {axes.map((axis, i) => {
          const [, right] = poles(axis.label);
          const angle = ((-90 + i * (360 / nAxes)) * Math.PI) / 180;
          const outer: [number, number] = [CX + R * Math.cos(angle), CY + R * Math.sin(angle)];
          const labelPt: [number, number] = [CX + (R + 30) * Math.cos(angle), CY + (R + 30) * Math.sin(angle)];
          const anchor = Math.abs(labelPt[0] - CX) < 4 ? "middle" : labelPt[0] > CX ? "start" : "end";
          const lines = wrapLabel(right, 12);
          return (
            <g key={axis.id}>
              <line x1={CX} y1={CY} x2={outer[0]} y2={outer[1]} stroke="var(--border)" strokeWidth={1} />
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={labelPt[0]}
                  y={labelPt[1] + li * 9 - ((lines.length - 1) * 4.5)}
                  textAnchor={anchor}
                  fontSize="8.5"
                  fontWeight={600}
                  fill="var(--text-dim)"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {series.map((s) => (
          <g
            key={s.id}
            className={clickable ? "cursor-pointer" : undefined}
            onMouseEnter={() => clickable && setHovered(s.id)}
            onMouseLeave={() => clickable && setHovered(null)}
            onClick={() => clickable && setSelected(selected === s.id ? null : s.id)}
          >
            <path
              d={buildPolygon(s.values, domainAbs)}
              fill={s.color}
              fillOpacity={selected === s.id ? s.fillOpacity + 0.12 : s.fillOpacity}
              stroke={s.color}
              strokeOpacity={s.strokeOpacity}
              strokeWidth={selected === s.id || hovered === s.id ? s.strokeWidth + 1 : s.strokeWidth}
            />
            {clickable &&
              s.values.map((v, ai) => {
                const [x, y] = vertexAt(ai, nAxes, v, domainAbs);
                return <circle key={ai} cx={x} cy={y} r={selected === s.id ? 4 : 2.5} fill={s.color} />;
              })}
          </g>
        ))}

        {activeMode === "overall" && (
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fontWeight={600} fill="var(--accent)">You</text>
        )}
      </svg>

      {activeMode === "career" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-text-faint">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-faint)" }} />
              {series[0]?.label} · {series[0]?.meta}
            </span>
            <span className="text-text-faint">vs.</span>
            <span className="flex items-center gap-1.5 font-medium text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {series[1]?.label} · {series[1]?.meta}
            </span>
          </div>
          {careerPoints.length > 2 && (
            <input
              type="range"
              min={0}
              max={Math.max(0, careerPoints.length - 2)}
              value={careerIdx}
              onChange={(e) => setCareerIdx(Number(e.target.value))}
              className="h-1.5 w-full max-w-xs cursor-pointer accent-accent"
              aria-label="Scrub through your career"
            />
          )}
        </div>
      )}
      {activeMode !== "career" && series.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-faint">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              {s.meta ? ` · ${s.meta}` : ""}
            </span>
          ))}
          {clickable && <span>· click a shape for detail</span>}
        </div>
      )}

      {!selectedPhase && domainAbs > 3.01 && (
        <p className="text-[11px] text-text-faint">
          Scaled to ±{domainAbs.toFixed(1)} here, not the usual ±3 - a narrower slice of games (or a 5-move window)
          is less diverse than a whole-game average, so its real position can run further from center.
        </p>
      )}

      {selectedPhase && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-surface-raised/60 px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text">{PHASE_LABEL[selectedPhase.phase]}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-[11px] text-text-faint transition hover:text-text">
              Close
            </button>
          </div>
          {(phaseMix?.[selectedPhase.phase] !== undefined || phaseAccuracy?.[selectedPhase.phase]) && (
            <div className="flex flex-col gap-1 border-b border-border-soft pb-2">
              {phaseMix?.[selectedPhase.phase] !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-dim">Share of a typical game</span>
                  <span className="font-mono text-text">{Math.round(phaseMix[selectedPhase.phase])}%</span>
                </div>
              )}
              {phaseAccuracy?.[selectedPhase.phase] && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-dim">Accuracy here vs. your overall average</span>
                  <span className="font-mono text-text">
                    {phaseAccuracy[selectedPhase.phase]!.you.toFixed(1)}%
                    <span className="text-text-faint"> vs {phaseAccuracy[selectedPhase.phase]!.your_overall.toFixed(1)}%</span>
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            {selectedPhase.featureDeltas.map((fd) => (
              <div key={fd.feature} className="flex items-center justify-between text-xs">
                <span className="text-text-dim">{fd.label}</span>
                <span className="font-mono text-text">
                  {formatFeatureValue(fd.feature, fd.bin_value)}
                  <span className="text-text-faint"> here · {formatFeatureValue(fd.feature, fd.overall_value)} overall</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedOpening || selectedComplexity) && (
        <div className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-raised/60 px-3 py-2.5">
          <span className="text-xs font-medium text-text">{(selectedOpening ?? selectedComplexity)!.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-faint">{(selectedOpening ?? selectedComplexity)!.n_games} of your games</span>
            <button type="button" onClick={() => setSelected(null)} className="text-[11px] text-text-faint transition hover:text-text">
              Close
            </button>
          </div>
        </div>
      )}

      {activeMode === "career" && stability.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {stability.map((t) => {
            const [left, right] = poles(t.label);
            const towardRight = t.last_value > t.first_value;
            const towardLabel = towardRight ? right : left;
            return (
              <div key={t.axis_id} className="flex items-start gap-2 text-[11px]">
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    t.stable ? "bg-good-soft text-good" : "bg-accent/15 text-accent"
                  }`}
                >
                  {t.stable ? "Stable" : "Changed"}
                </span>
                <span className="text-text-faint">
                  <span className="font-medium text-text-dim">{t.label}</span>
                  {t.stable
                    ? ` — consistent from ${t.first_elo} to ${t.last_elo} rated play.`
                    : ` — moved toward "${towardLabel}" as your rating went from ${t.first_elo} to ${t.last_elo}${
                        t.correlation_with_rating != null
                          ? ` (${Math.abs(t.correlation_with_rating) >= 0.6 ? "strongly" : "loosely"} linked, r=${t.correlation_with_rating.toFixed(2)})`
                          : ""
                      }.`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border-b border-border-soft px-2 py-1.5 text-left font-medium text-text-faint">Axis</th>
              {series.map((s) => (
                <th key={s.id} className="border-b border-border-soft px-2 py-1.5 text-left font-medium" style={{ color: s.color }}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.map((axis, ai) => {
              const [left, right] = poles(axis.label);
              return (
                <tr key={axis.id}>
                  <td className="border-b border-border-soft px-2 py-1.5 text-text-dim">
                    {left} ↔ {right}
                  </td>
                  {series.map((s) => (
                    <td key={s.id} className="border-b border-border-soft px-2 py-1.5 font-mono text-text">
                      {s.values[ai]?.toFixed(2) ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
