"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SettingsItem from "@/components/ui/settings/SettingsItem";
import SettingsSelect from "@/components/ui/settings/SettingsSelect";
import SettingsToggle from "@/components/ui/settings/SettingsToggle";
import SettingsVolume, {
  type VolumeLevel,
} from "@/components/ui/settings/SettingsVolume";
import type { Orientation } from "../types";

type BoardSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orientation: Orientation;
  onSetOrientation: (orientation: Orientation) => void;
  showEvalBar: boolean;
  onSetShowEvalBar: (showEvalBar: boolean) => void;
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
}: BoardSettingsModalProps) {
  const [pieceSet, setPieceSet] = useState("Default");
  const [boardTheme, setBoardTheme] = useState("Default");
  const [moveMethod, setMoveMethod] = useState("Default");

  const [coordinatesEnabled, setCoordinatesEnabled] = useState(true);
  const [soundLevel, setSoundLevel] = useState<VolumeLevel>("full");
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  const settings = [
    {
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
    },
    {
      title: "Eval Bar",
      content: (
        <SettingsToggle
          setting={{
            label: "Eval Bar",
            isSelected: showEvalBar,
            onChange: onSetShowEvalBar,
          }}
        />
      ),
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
      title: "Coordinates",
      content: (
        <SettingsToggle
          setting={{
            label: "Coordinates",
            isSelected: coordinatesEnabled,
            onChange: (isSelected) => setCoordinatesEnabled(isSelected),
          }}
        />
      ),
    },

    {
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
    },
    {
      title: "Notification",
      content: (
        <SettingsToggle
          setting={{
            label: "Notifications",
            isSelected: notificationEnabled,
            onChange: (isSelected) => setNotificationEnabled(isSelected),
          }}
        />
      ),
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md">
        <header className="px-4 pt-3 pb-6">
          <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        </header>

        <div className="px-4">
          {settings.map((item) => (
            <SettingsItem key={item.title} item={item} />
          ))}
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
