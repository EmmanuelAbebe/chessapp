"use client";

import { useState } from "react";
import type { TraitResult } from "../lib/traits";

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 100;
const GRID_RINGS = [0.25, 0.5, 0.75, 1];

function pointFor(index: number, count: number, fraction: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    x: CENTER + RADIUS * fraction * Math.cos(angle),
    y: CENTER + RADIUS * fraction * Math.sin(angle),
  };
}

/** A hand-rolled SVG radar chart - no charting library, matching the
 * hyperbolic move-tree map's own custom-visualization precedent. Each
 * vertex carries a native `<title>` tooltip (hover) and click-to-expand
 * detail card below (the exact "show your work" method string every
 * trait computes alongside its score) rather than a floating tooltip -
 * simpler than replicating the map's canvas hit-testing/positioning math
 * for something that doesn't need to pan or zoom. Colors are plain CSS
 * variables, so it re-themes itself automatically, Paper included. */
export function TraitRadarChart({ traits }: { traits: TraitResult[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const count = traits.length;

  if (count < 3) {
    return (
      <p className="text-center text-xs text-text-faint">
        Not enough data yet for a profile - a few more games will fill this
        in.
      </p>
    );
  }

  const dataPoints = traits.map((trait, index) => pointFor(index, count, trait.score / 100));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const selected = traits.find((t) => t.key === selectedKey) ?? null;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Padded beyond the SIZE×SIZE geometry so a label near the edge
          (anchored toward center, but still real text width) never clips
          against the viewBox itself. */}
      <svg viewBox={`-30 -20 ${SIZE + 60} ${SIZE + 40}`} className="w-full max-w-xs">
        {GRID_RINGS.map((fraction) => (
          <polygon
            key={fraction}
            points={traits
              .map((_, index) => {
                const p = pointFor(index, count, fraction);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        {traits.map((trait, index) => {
          const axisEnd = pointFor(index, count, 1);
          return (
            <line
              key={trait.key}
              x1={CENTER}
              y1={CENTER}
              x2={axisEnd.x}
              y2={axisEnd.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="var(--accent)"
          fillOpacity={0.25}
          stroke="var(--accent)"
          strokeWidth={2}
        />

        {traits.map((trait, index) => {
          const labelPoint = pointFor(index, count, 1.16);
          // A label on the left/right side would otherwise center on its
          // anchor point and clip past the viewBox edge (long labels like
          // "Repertoire Breadth" especially) - anchoring toward the
          // chart's center instead keeps every label inside the box
          // regardless of length. Top/bottom axes stay centered.
          const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
          const cos = Math.cos(angle);
          const textAnchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          return (
            <text
              key={`label-${trait.key}`}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="fill-text-dim text-[9px]"
            >
              {trait.label}
            </text>
          );
        })}

        {dataPoints.map((point, index) => {
          const trait = traits[index];
          const isSelected = trait.key === selectedKey;
          return (
            <g key={trait.key}>
              {/* Generous invisible hit area - the visible dot below is
                  small enough that clicking exactly on it would be
                  fiddly otherwise. */}
              <circle
                cx={point.x}
                cy={point.y}
                r={12}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => setSelectedKey(isSelected ? null : trait.key)}
              >
                <title>{`${trait.label}: ${trait.score.toFixed(0)}`}</title>
              </circle>
              <circle
                cx={point.x}
                cy={point.y}
                r={isSelected ? 5 : 4}
                fill="var(--accent)"
                className="pointer-events-none transition-[r] duration-150"
              />
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-xs">
          <p className="font-semibold text-text">
            {selected.label}: {selected.score.toFixed(0)}/100
          </p>
          <p className="mt-1 text-text-dim">{selected.method}</p>
        </div>
      )}
    </div>
  );
}
