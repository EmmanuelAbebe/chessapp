"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsSelect from "../SettingsSelect";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";
import type { CoordinatesPlacement } from "@/features/board/types";
import { TbMathXy } from "react-icons/tb";
import { GiConvergenceTarget } from "react-icons/gi";

export default function CoordinatesSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Coordinates">
      <SettingsItem
        item={{
          icon: <TbMathXy />,
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
          icon: <GiConvergenceTarget />,
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
  );
}
