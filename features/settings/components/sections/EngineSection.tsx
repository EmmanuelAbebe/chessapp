"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";

export default function EngineSection() {
  const { settings, updateSettings } = useSettings();

  return (
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
  );
}
