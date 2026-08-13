"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SettingsItem from "@/components/ui/settings/SettingsItem";
import SettingsGroup from "@/components/ui/settings/SettingsGroup";
import SettingsSelect from "@/components/ui/settings/SettingsSelect";
import SettingsVolume, {
  type VolumeLevel,
} from "@/components/ui/settings/SettingsVolume";
import type { CoordinatesPlacement, Orientation } from "../types";

type BoardSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orientation: Orientation;
  onSetOrientation: (orientation: Orientation) => void;
  showEvalBar: boolean;
  onSetShowEvalBar: (showEvalBar: boolean) => void;
  showCoordinates: boolean;
  onSetShowCoordinates: (showCoordinates: boolean) => void;
  coordinatesPlacement: CoordinatesPlacement;
  onSetCoordinatesPlacement: (placement: CoordinatesPlacement) => void;
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
  orientation,
  onSetOrientation,
  showEvalBar,
  onSetShowEvalBar,
  showCoordinates,
  onSetShowCoordinates,
  coordinatesPlacement,
  onSetCoordinatesPlacement,
}: BoardSettingsModalProps) {
  const [pieceSet, setPieceSet] = useState("Default");
  const [boardTheme, setBoardTheme] = useState("Default");
  const [moveMethod, setMoveMethod] = useState("Default");

  const [soundLevel, setSoundLevel] = useState<VolumeLevel>("full");
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md">
        <header className="px-4 pt-3 pb-6">
          <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        </header>

        <div className="px-4">
          <SettingsItem
            item={{
              title: "Board Orientation",
              content: (
                <SettingsSelect
                  setting={{
                    label: "Board Orientation",
                    value: orientation === "white" ? "White" : "Black",
                    options: ["White", "Black"],
                    onChange: (value) =>
                      onSetOrientation(value.toLowerCase() as Orientation),
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
                    value: pieceSet,
                    options: pieceSets,
                    onChange: setPieceSet,
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
                    value: boardTheme,
                    options: boardThemes,
                    onChange: setBoardTheme,
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            title="Coordinates"
            isSelected={showCoordinates}
            onChange={onSetShowCoordinates}
          >
            <SettingsSelect
              setting={{
                label: "Coordinate Placement",
                value:
                  coordinatesPlacement === "inside" ? "Inside" : "Outside",
                options: ["Inside", "Outside"],
                onChange: (value) =>
                  onSetCoordinatesPlacement(
                    value.toLowerCase() as CoordinatesPlacement,
                  ),
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
                    value: moveMethod,
                    options: moveMethods,
                    onChange: setMoveMethod,
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            title="Eval Bar"
            isSelected={showEvalBar}
            onChange={onSetShowEvalBar}
          />

          <SettingsItem
            item={{
              title: "Sound",
              content: (
                <SettingsVolume
                  setting={{
                    label: "Sound",
                    value: soundLevel,
                    onChange: setSoundLevel,
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            title="Notification"
            isSelected={notificationEnabled}
            onChange={setNotificationEnabled}
          />
        </div>

        <div className="px-4 pt-6 pb-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
