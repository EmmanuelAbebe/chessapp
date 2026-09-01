"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsSelect from "../SettingsSelect";
import { themeShades } from "../../data";
import { useSettings } from "../../SettingsContext";

export default function AppearanceSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Appearance">
      <SettingsItem
        item={{
          title: "Theme",
          content: (
            <SettingsSelect
              setting={{
                label: "Theme",
                value:
                  themeShades.find((shade) => shade.value === settings.themeShade)
                    ?.label ?? "Charcoal",
                options: themeShades.map((shade) => shade.label),
                onChange: (label) => {
                  const match = themeShades.find((shade) => shade.label === label);
                  if (match) updateSettings({ themeShade: match.value });
                },
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
