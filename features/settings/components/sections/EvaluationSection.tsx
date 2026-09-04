"use client";

import SettingsCard from "../SettingsCard";
import SettingsItem from "../SettingsItem";
import SettingsToggle from "../SettingsToggle";
import { useSettings } from "../../SettingsContext";
import { IoEllipse } from "react-icons/io5";
import { BiSolidTachometer } from "react-icons/bi";
import { IoMdThermometer } from "react-icons/io";

export default function EvaluationSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsCard title="Evaluation">
      <SettingsItem
        item={{
          icon: <IoMdThermometer />,
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
          icon: <BiSolidTachometer />,
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
