"use client";

import Modal from "@/components/ui/Modal";
import SettingsItem from "@/features/settings/components/SettingsItem";
import SettingsGroup from "@/features/settings/components/SettingsGroup";
import SettingsSelect from "@/features/settings/components/SettingsSelect";
import SettingsSubRow from "@/features/settings/components/SettingsSubRow";
import SettingsToggle from "@/features/settings/components/SettingsToggle";
import SettingsVolume from "@/features/settings/components/SettingsVolume";
import { useSettings } from "@/features/settings/SettingsContext";
import { pieceSets, boardThemes, moveMethods } from "@/features/settings/data";
import type { CoordinatesPlacement, Orientation } from "../types";
import {
  FaChessBoard,
  FaChessKnight,
  FaChessQueen,
  FaGear,
} from "react-icons/fa6";
import { TbMathXy } from "react-icons/tb";
import { LuMousePointerClick } from "react-icons/lu";
import { IoEllipse, IoEllipsisHorizontal } from "react-icons/io5";
import { FiBell, FiCpu, FiVolume2 } from "react-icons/fi";
import { HiSwitchVertical } from "react-icons/hi";
import { GrConfigure } from "react-icons/gr";

type BoardSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function BoardSettingsModal({
  isOpen,
  onClose,
}: BoardSettingsModalProps) {
  const { settings, updateSettings, updateSound, updateNotifications } =
    useSettings();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md">
        <header className="p-3 flex items-center-safe gap-3">
          <GrConfigure className="mb-2 h-6 w-6 text-text-faint" />
          <h2 className="text-xl font-bold text-text">Settings</h2>
        </header>

        <div className="px-4">
          <SettingsItem
            item={{
              icon: <HiSwitchVertical />,
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
              icon: <FaChessQueen />,
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
              icon: <FaChessBoard />,
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
            item={{
              icon: <TbMathXy />,
              title: "Coordinates",
              isSelected: settings.showCoordinates,
              onChange: (showCoordinates) =>
                updateSettings({ showCoordinates }),
              children: (
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
                        coordinatesPlacement:
                          value.toLowerCase() as CoordinatesPlacement,
                      }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              icon: <LuMousePointerClick />,
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

          <SettingsItem
            item={{
              icon: <FaChessKnight />,
              title: "Figurine Notation",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Figurine Notation",
                    isSelected: settings.showFigurineNotation,
                    onChange: (showFigurineNotation) =>
                      updateSettings({ showFigurineNotation }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              icon: <IoEllipsisHorizontal />,
              title: "Move List",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Move List",
                    isSelected: settings.showMoveList,
                    onChange: (showMoveList) =>
                      updateSettings({ showMoveList }),
                  }}
                />
              ),
            }}
          />

          <SettingsGroup
            item={{
              icon: <IoEllipse />,
              title: "Eval Bar",
              isSelected: settings.showEvalBar,
              onChange: (showEvalBar) => updateSettings({ showEvalBar }),
              children: (
                <SettingsSubRow
                  label="Show Score"
                  isSelected={settings.showEvalScore}
                  onChange={(showEvalScore) =>
                    updateSettings({ showEvalScore })
                  }
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              icon: <FiCpu />,
              title: "Engine",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Move Suggestions",
                    isSelected: settings.showEngineSuggestions,
                    onChange: (showEngineSuggestions) =>
                      updateSettings({ showEngineSuggestions }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              icon: <FiVolume2 />,
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
            item={{
              icon: <FiBell />,
              title: "Notification",
              isSelected: settings.notifications.enabled,
              onChange: (enabled) => updateNotifications({ enabled }),
            }}
          />
        </div>

        <div className="px-4 pt-6 pb-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text bg-surface-raised rounded-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-border"
          >
            Close
          </button>
        </div>

        <div
          className="flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 transition px-4 py-2"
          onClick={() => {
            window.location.href = "dashboard/settings";
          }}
        >
          <FaGear className="h-4 w-4 shrink-0 text-text-faint" />
          <span className="px-4 py-2 text-sm text-text-faint">
            open full settings
          </span>
        </div>
      </div>
    </Modal>
  );
}
