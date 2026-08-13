"use client";

import type { IconType } from "react-icons";
import { IoVolumeHigh, IoVolumeLow, IoVolumeMedium, IoVolumeMute } from "react-icons/io5";

export type VolumeLevel = "off" | "low" | "medium" | "full";

const levels: { value: VolumeLevel; label: string; icon: IconType }[] = [
  { value: "off", label: "Off", icon: IoVolumeMute },
  { value: "low", label: "Low", icon: IoVolumeLow },
  { value: "medium", label: "Medium", icon: IoVolumeMedium },
  { value: "full", label: "Full", icon: IoVolumeHigh },
];

interface VolumeSetting {
  label: string;
  value: VolumeLevel;
  onChange: (value: VolumeLevel) => void;
}

interface SettingsVolumeProps {
  setting: VolumeSetting;
}

export default function SettingsVolume({ setting }: SettingsVolumeProps) {
  const { label, value, onChange } = setting;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-sm"
    >
      {levels.map(({ value: level, label: levelLabel, icon: Icon }) => {
        const isSelected = value === level;

        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={levelLabel}
            title={levelLabel}
            onClick={() => onChange(level)}
            className={`
              flex h-7 w-7 items-center justify-center rounded-md
              outline-none transition
              focus-visible:ring-2 focus-visible:ring-blue-500
              ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
              }
            `}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
