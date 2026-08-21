"use client";

import { IoVolumeHigh, IoVolumeLow, IoVolumeMedium, IoVolumeMute } from "react-icons/io5";

/** Volume as a percentage, 0-100. */
export type VolumeLevel = number;

function levelLabel(value: VolumeLevel): string {
  if (value <= 0) return "Off";
  if (value >= 100) return "Max";
  return `${value}%`;
}

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

  const Icon =
    value <= 0
      ? IoVolumeMute
      : value < 34
        ? IoVolumeLow
        : value < 67
          ? IoVolumeMedium
          : IoVolumeHigh;

  return (
    <div className="flex items-center gap-3">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-faint" />

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={levelLabel(value)}
        className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-surface-raised accent-accent"
      />

      <span className="w-12 shrink-0 text-xs text-text-faint">
        {levelLabel(value)}
      </span>
    </div>
  );
}
