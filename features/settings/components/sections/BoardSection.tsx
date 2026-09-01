"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsSelect from "../SettingsSelect";
import SettingsToggle from "../SettingsToggle";
import { pieceSets, boardThemes, moveMethods } from "../../data";
import { useSettings } from "../../SettingsContext";
import type { Orientation } from "@/features/board/types";

export default function BoardSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Board">
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

      <SettingsItem
        item={{
          title: "Show Legal Moves",
          content: (
            <SettingsToggle
              setting={{
                label: "Show Legal Moves",
                isSelected: settings.showLegalMoves,
                onChange: (showLegalMoves) => updateSettings({ showLegalMoves }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          title: "Highlight Last Move",
          content: (
            <SettingsToggle
              setting={{
                label: "Highlight Last Move",
                isSelected: settings.highlightLastMove,
                onChange: (highlightLastMove) =>
                  updateSettings({ highlightLastMove }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          title: "Highlight Check",
          content: (
            <SettingsToggle
              setting={{
                label: "Highlight Check",
                isSelected: settings.highlightCheck,
                onChange: (highlightCheck) => updateSettings({ highlightCheck }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
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
          title: "Move List",
          content: (
            <SettingsToggle
              setting={{
                label: "Move List",
                isSelected: settings.showMoveList,
                onChange: (showMoveList) => updateSettings({ showMoveList }),
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
