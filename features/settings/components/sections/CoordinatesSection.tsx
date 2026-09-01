"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsSelect from "../SettingsSelect";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";
import type { CoordinatesPlacement } from "@/features/board/types";

export default function CoordinatesSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Coordinates">
      <SettingsItem
        item={{
          title: "Show Coordinates",
          content: (
            <SettingsToggle
              setting={{
                label: "Show Coordinates",
                isSelected: settings.showCoordinates,
                onChange: (showCoordinates) => updateSettings({ showCoordinates }),
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
                  settings.coordinatesPlacement === "inside" ? "Inside" : "Outside",
                options: ["Inside", "Outside"],
                onChange: (value) =>
                  updateSettings({
                    coordinatesPlacement: value.toLowerCase() as CoordinatesPlacement,
                  }),
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
