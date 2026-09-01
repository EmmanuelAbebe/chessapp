"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";

export default function EvaluationSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Evaluation">
      <SettingsItem
        item={{
          title: "Eval Bar",
          content: (
            <SettingsToggle
              setting={{
                label: "Eval Bar",
                isSelected: settings.showEvalBar,
                onChange: (showEvalBar) => updateSettings({ showEvalBar }),
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
                onChange: (showEvalScore) => updateSettings({ showEvalScore }),
              }}
            />
          ),
        }}
      />
    </SettingsCard>
  );
}
