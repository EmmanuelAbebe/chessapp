"use client";

import Modal from "@/components/ui/Modal";
import SettingsItem from "@/features/settings/components/SettingsItem";
import SettingsGroup from "@/features/settings/components/SettingsGroup";
import SettingsSelect from "@/features/settings/components/SettingsSelect";
import SettingsSubRow from "@/features/settings/components/SettingsSubRow";
import SettingsVolume from "@/features/settings/components/SettingsVolume";
import { useSettings } from "@/features/settings/SettingsContext";
import type { CoordinatesPlacement, Orientation } from "../types";

type BoardSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const pieceSets = [
  "Default",
  "Alpha",
  "Merida",
  "Fantasy",
  "Classic",
  "Neo",
  "Modern",
];
const boardThemes = ["Default", "Wood", "Marble"];
const moveMethods = ["Default", "Click", "Drag"];

export function BoardSettingsModal({
  isOpen,
  onClose,
}: BoardSettingsModalProps) {
  const { settings, updateSettings, updateSound, updateNotifications } =
    useSettings();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md">
        <header className="px-4 pt-3 pb-6">
          <h2 className="text-3xl font-bold text-neutral-100">Settings</h2>
        </header>

        <div className="px-4">
          <SettingsItem
            item={{
              title: "Board Orientation",
              content: (
                <SettingsSelect
                  setting={{
                    label: "Board Orientation",
                    value: settings.orientation === "white" ? "White" : "Black",
                    options: ["White", "Black"],
                    onChange: (value) =>
                      updateSettings({
                        orientation: value.toLowerCase() as Orientation,
                      }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Pieces",
              content: (
                <SettingsSelect
                  setting={{
                    label: "Pieces",
                    value: settings.pieceSet,
                    options: pieceSets,
                    onChange: (value) => updateSettings({ pieceSet: value }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Board",
              content: (
                <SettingsSelect
                  setting={{
                    label: "Board",
                    value: settings.boardTheme,
                    options: boardThemes,
                    onChange: (value) => updateSettings({ boardTheme: value }),
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            title="Coordinates"
            isSelected={settings.showCoordinates}
            onChange={(showCoordinates) => updateSettings({ showCoordinates })}
          >
            <SettingsSelect
              setting={{
                label: "Coordinate Placement",
                value:
                  settings.coordinatesPlacement === "inside"
                    ? "Inside"
                    : "Outside",
                options: ["Inside", "Outside"],
                onChange: (value) =>
                  updateSettings({
                    coordinatesPlacement: value.toLowerCase() as CoordinatesPlacement,
                  }),
              }}
            />
          </SettingsGroup>

          <SettingsItem
            item={{
              title: "Move Method",
              content: (
                <SettingsSelect
                  setting={{
                    label: "Move Method",
                    value: settings.moveMethod,
                    options: moveMethods,
                    onChange: (value) => updateSettings({ moveMethod: value }),
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            title="Eval Bar"
            isSelected={settings.showEvalBar}
            onChange={(showEvalBar) => updateSettings({ showEvalBar })}
          >
            <SettingsSubRow
              label="Show Score"
              isSelected={settings.showEvalScore}
              onChange={(showEvalScore) => updateSettings({ showEvalScore })}
            />
          </SettingsGroup>

          <SettingsItem
            item={{
              title: "Sound",
              content: (
                <SettingsVolume
                  setting={{
                    label: "Sound",
                    value: settings.sound.master,
                    onChange: (master) => updateSound({ master }),
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            title="Notification"
            isSelected={settings.notifications.enabled}
            onChange={(enabled) => updateNotifications({ enabled })}
          />
        </div>

        <div className="px-4 pt-6 pb-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-200 bg-neutral-800 rounded-lg hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-neutral-500"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
