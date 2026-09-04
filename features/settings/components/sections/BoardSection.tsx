"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsSelect from "../SettingsSelect";
import SettingsToggle from "../SettingsToggle";
import { pieceSets, boardThemes, moveMethods } from "../../data";
import { useSettings } from "../../SettingsContext";
import type { Orientation } from "@/features/board/types";
import { HiSwitchVertical } from "react-icons/hi";
import { BiTargetLock } from "react-icons/bi";
import {
  FaChessQueen,
  FaChessBoard,
  FaChessKing,
  FaChessKnight,
  FaHighlighter,
} from "react-icons/fa6";
import { IoEllipsisHorizontal } from "react-icons/io5";
import { LuMousePointerClick } from "react-icons/lu";

export default function BoardSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Board">
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
          icon: <BiTargetLock />,
          title: "Show Legal Moves",
          content: (
            <SettingsToggle
              setting={{
                label: "Show Legal Moves",
                isSelected: settings.showLegalMoves,
                onChange: (showLegalMoves) =>
                  updateSettings({ showLegalMoves }),
              }}
            />
          ),
        }}
      />

      <SettingsItem
        item={{
          icon: <FaHighlighter />,
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
          icon: <FaChessKing />,
          title: "Highlight Check",
          content: (
            <SettingsToggle
              setting={{
                label: "Highlight Check",
                isSelected: settings.highlightCheck,
                onChange: (highlightCheck) =>
                  updateSettings({ highlightCheck }),
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
                onChange: (showMoveList) => updateSettings({ showMoveList }),
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
