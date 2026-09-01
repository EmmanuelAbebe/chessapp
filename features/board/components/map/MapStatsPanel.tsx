"use client";

import { K_MAX, K_MIN } from "../../hooks/map/useMoveTreeCanvas";
import { StatPill } from "./StatPill";

// Bottom-left: the optional compaction/ply-limit/rings panel above the
// static hint text, both anchored to the same corner as a group.
export function MapStatsPanel({
  showStatsPanel,
  showCompactionPanel,
  showRingsTogglePanel,
  totalNodes,
  focusPly,
  widestFork,
  k,
  setK,
  maxDisplayPly,
  setMaxDisplayPly,
  maxPly,
  showRings,
  setShowRings,
}: {
  showStatsPanel: boolean;
  showCompactionPanel: boolean;
  showRingsTogglePanel: boolean;
  totalNodes: number;
  focusPly: number;
  widestFork: number;
  k: number;
  setK: (k: number) => void;
  maxDisplayPly: number | null;
  setMaxDisplayPly: (ply: number | null) => void;
  maxPly: number;
  showRings: boolean;
  setShowRings: (show: boolean) => void;
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[min(80vw,260px)] flex-col gap-2">
      {(showStatsPanel || showCompactionPanel || showRingsTogglePanel) && (
        <div className="pointer-events-auto flex flex-col gap-2 py-3">
          {showStatsPanel && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <StatPill label="Nodes" value={String(totalNodes)} />
                <StatPill label="Focus ply" value={String(focusPly)} />
                <StatPill
                  label="Widest fork"
                  value={widestFork >= 3 ? `${widestFork}-way` : "—"}
                  accent
                />
              </div>
            </div>
          )}
          {showCompactionPanel && (
            <div className="flex items-center gap-2 text-sm text-text-dim">
              <label
                htmlFor="map-compaction"
                className="whitespace-nowrap font-mono text-[0.70rem] tracking-wide text-text-faint uppercase"
              >
                Compaction
              </label>
              <input
                id="map-compaction"
                type="range"
                min={K_MIN * 1000}
                max={K_MAX * 1000}
                value={k * 1000}
                onChange={(e) => setK(Number(e.target.value) / 1000)}
                className="flex-1 accent-accent h-1 bg-border appearance-none cursor-pointer"
              />
              <p className="text-xs text-soft">{k.toFixed(2)}x</p>
            </div>
          )}
          {showCompactionPanel && (
            <div className="flex items-center gap-2 text-sm text-text-dim">
              <label
                htmlFor="map-max-ply"
                className="whitespace-nowrap font-mono text-[0.70rem] tracking-wide text-text-faint uppercase"
              >
                Plies shown
              </label>
              <input
                id="map-max-ply"
                type="range"
                min={1}
                max={Math.max(1, maxPly)}
                value={maxDisplayPly ?? Math.max(1, maxPly)}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setMaxDisplayPly(next >= maxPly ? null : next);
                }}
                className="flex-1 accent-accent h-1 bg-border appearance-none cursor-pointer"
              />
              <p className="text-xs text-soft">{maxDisplayPly === null ? "all" : maxDisplayPly}</p>
            </div>
          )}
          {showRingsTogglePanel && (
            <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-text-dim">
              <input
                type="checkbox"
                checked={showRings}
                onChange={(e) => setShowRings(e.target.checked)}
                className="accent-accent"
              />
              depth rings
            </label>
          )}
        </div>
      )}

      <div className="max-w-[60ch] text-[0.74rem] text-text-faint">
        <b className="text-text-dim">Click</b> a node to go to that move ·{" "}
        <b className="text-text-dim">click a ring</b> to see every move on it ·{" "}
        <b className="text-text-dim">scroll</b> to change compaction
      </div>
    </div>
  );
}
