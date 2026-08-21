"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";
import SettingsItem from "./SettingsItem";
import SettingsSelect from "./SettingsSelect";
import SettingsToggle from "./SettingsToggle";
import SettingsVolume from "./SettingsVolume";
import { pieceSets, boardThemes, moveMethods, themeShades } from "../data";
import { useSettings } from "../SettingsContext";
import type { CoordinatesPlacement, Orientation } from "@/features/board/types";

export default function SettingsSection() {
  const [publicProfile, setPublicProfile] = useState(true);
  const { settings, updateSettings, updateSound, updateNotifications } =
    useSettings();

  return (
    <section>
      <p className="text-sm text-text-faint">
        These are the full app settings — the gear icon on the board is a
        quick shortcut to the board-related ones below, and both stay in
        sync.
      </p>

      <div className="mt-4 flex flex-col gap-6">
        <SettingsCard title="Appearance">
          <SettingsItem
            item={{
              title: "Theme",
              content: (
                <SettingsSelect
                  setting={{
                    label: "Theme",
                    value:
                      themeShades.find(
                        (shade) => shade.value === settings.themeShade,
                      )?.label ?? "Charcoal",
                    options: themeShades.map((shade) => shade.label),
                    onChange: (label) => {
                      const match = themeShades.find(
                        (shade) => shade.label === label,
                      );
                      if (match) updateSettings({ themeShade: match.value });
                    },
                  }}
                />
              ),
            }}
          />
        </SettingsCard>

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
                    onChange: (showLegalMoves) =>
                      updateSettings({ showLegalMoves }),
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
                    onChange: (highlightCheck) =>
                      updateSettings({ highlightCheck }),
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
                    onChange: (showMoveList) =>
                      updateSettings({ showMoveList }),
                  }}
                />
              ),
            }}
          />
        </SettingsCard>

        <SettingsCard title="Coordinates">
          <SettingsItem
            item={{
              title: "Show Coordinates",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Show Coordinates",
                    isSelected: settings.showCoordinates,
                    onChange: (showCoordinates) =>
                      updateSettings({ showCoordinates }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Placement",
              content: (
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
        </SettingsCard>

        <SettingsCard title="Evaluation">
          <SettingsItem
            item={{
              title: "Eval Bar",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Eval Bar",
                    isSelected: settings.showEvalBar,
                    onChange: (showEvalBar) =>
                      updateSettings({ showEvalBar }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Eval Score",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Eval Score",
                    isSelected: settings.showEvalScore,
                    onChange: (showEvalScore) =>
                      updateSettings({ showEvalScore }),
                  }}
                />
              ),
            }}
          />
        </SettingsCard>

        <SettingsCard title="Engine">
          <SettingsItem
            item={{
              title: "Move Suggestions",
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
        </SettingsCard>

        <SettingsCard title="Sound">
          <SettingsItem
            item={{
              title: "Master Volume",
              content: (
                <SettingsVolume
                  setting={{
                    label: "Master Volume",
                    value: settings.sound.master,
                    onChange: (master) => updateSound({ master }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Piece Movement",
              content: (
                <SettingsVolume
                  setting={{
                    label: "Piece Movement",
                    value: settings.sound.pieceMove,
                    onChange: (pieceMove) => updateSound({ pieceMove }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Capture",
              content: (
                <SettingsVolume
                  setting={{
                    label: "Capture",
                    value: settings.sound.capture,
                    onChange: (capture) => updateSound({ capture }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Check",
              content: (
                <SettingsVolume
                  setting={{
                    label: "Check",
                    value: settings.sound.check,
                    onChange: (check) => updateSound({ check }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "AI Voice",
              content: (
                <SettingsVolume
                  setting={{
                    label: "AI Voice",
                    value: settings.sound.aiVoice,
                    onChange: (aiVoice) => updateSound({ aiVoice }),
                  }}
                />
              ),
            }}
          />
        </SettingsCard>

        <SettingsCard title="Notifications">
          <SettingsItem
            item={{
              title: "Notifications",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Notifications",
                    isSelected: settings.notifications.enabled,
                    onChange: (enabled) => updateNotifications({ enabled }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Your Turn",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Your Turn",
                    isSelected: settings.notifications.yourTurn,
                    onChange: (yourTurn) => updateNotifications({ yourTurn }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Game Result",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Game Result",
                    isSelected: settings.notifications.gameResult,
                    onChange: (gameResult) =>
                      updateNotifications({ gameResult }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Coaching Insights",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Coaching Insights",
                    isSelected: settings.notifications.coachingInsights,
                    onChange: (coachingInsights) =>
                      updateNotifications({ coachingInsights }),
                  }}
                />
              ),
            }}
          />

          <SettingsItem
            item={{
              title: "Notification Sound",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Notification Sound",
                    isSelected: settings.notifications.sound,
                    onChange: (sound) => updateNotifications({ sound }),
                  }}
                />
              ),
            }}
          />
        </SettingsCard>

        <SettingsCard title="Account">
          <SettingsItem
            item={{
              title: "Public profile",
              content: (
                <SettingsToggle
                  setting={{
                    label: "Public profile",
                    isSelected: publicProfile,
                    onChange: setPublicProfile,
                  }}
                />
              ),
            }}
          />
        </SettingsCard>
      </div>
    </section>
  );
}
