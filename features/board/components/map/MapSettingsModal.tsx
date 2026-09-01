"use client";

import Modal from "@/components/ui/Modal";
import SettingsItem from "@/features/settings/components/SettingsItem";
import SettingsToggle from "@/features/settings/components/SettingsToggle";
import {
  MAP_COLOR_DEFAULTS,
  MAP_COLOR_GROUPS,
  MAP_COLOR_LABELS,
  type MapColorKey,
  type MapColorOverrides,
} from "../../lib/map/move-tree-map-helpers";

// The map's gear-icon settings modal: the four floating-panel toggles plus
// the live color-tuning grid.
//
// NOTE: the color-tuning grid below is temporary debug/exploration
// scaffolding - see the `project_map_color_tool_revert_todo` memory. Once a
// palette is settled on, remove the "Map colors" block (and the
// mapColors/setMapColor/resetMapColors props) rather than carrying it
// forward indefinitely.
export function MapSettingsModal({
  isOpen,
  onClose,
  showStatsPanel,
  setShowStatsPanel,
  showCompactionPanel,
  setShowCompactionPanel,
  showRingsTogglePanel,
  setShowRingsTogglePanel,
  showMoveListPanel,
  setShowMoveListPanel,
  mapColors,
  setMapColor,
  resetMapColors,
}: {
  isOpen: boolean;
  onClose: () => void;
  showStatsPanel: boolean;
  setShowStatsPanel: (show: boolean) => void;
  showCompactionPanel: boolean;
  setShowCompactionPanel: (show: boolean) => void;
  showRingsTogglePanel: boolean;
  setShowRingsTogglePanel: (show: boolean) => void;
  showMoveListPanel: boolean;
  setShowMoveListPanel: (show: boolean) => void;
  mapColors: MapColorOverrides;
  setMapColor: (key: MapColorKey, value: string) => void;
  resetMapColors: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-sm">
        <header className="px-4 pt-3 pb-6">
          <h2 className="text-xl font-bold text-text">Map settings</h2>
        </header>

        <div className="px-4">
          <SettingsItem
            item={{
              title: "Map details",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Map details",
                    isSelected: showStatsPanel,
                    onChange: setShowStatsPanel,
                  }}
                />
              ),
            }}
          />
          <SettingsItem
            item={{
              title: "Compaction & ply limit sliders",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Compaction & ply limit sliders",
                    isSelected: showCompactionPanel,
                    onChange: setShowCompactionPanel,
                  }}
                />
              ),
            }}
          />
          <SettingsItem
            item={{
              title: "Depth rings toggle",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Depth rings toggle",
                    isSelected: showRingsTogglePanel,
                    onChange: setShowRingsTogglePanel,
                  }}
                />
              ),
            }}
          />
          <SettingsItem
            item={{
              title: "Move list",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Move list",
                    isSelected: showMoveListPanel,
                    onChange: setShowMoveListPanel,
                  }}
                />
              ),
            }}
          />

          {/* A live color-tuning tool, not a toggle for a floating panel
              like the items above - every swatch repaints the canvas on the
              very next frame, so trying out a palette needs no extra
              confirm step. */}
          <div className="mt-2 border-t border-border-soft pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Map colors</h3>
              <button
                type="button"
                onClick={resetMapColors}
                className="text-xs text-text-faint underline-offset-2 transition hover:text-text hover:underline"
              >
                Reset to theme
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {MAP_COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 text-[0.68rem] font-semibold tracking-wide text-text-faint uppercase">
                    {group.title}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs text-text-dim">
                        <input
                          type="color"
                          value={mapColors[key] ?? MAP_COLOR_DEFAULTS[key]}
                          onChange={(e) => setMapColor(key, e.target.value)}
                          className="h-6 w-6 shrink-0 cursor-pointer rounded border border-border-soft bg-transparent p-0"
                        />
                        <span className="truncate">{MAP_COLOR_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end px-4 pt-6 pb-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-surface-raised px-4 py-2 text-sm font-medium text-text transition hover:brightness-110 focus:ring-2 focus:ring-border focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
