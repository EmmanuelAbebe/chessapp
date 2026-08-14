"use client";

import SettingsToggle from "./SettingsToggle";

interface SettingsSubRowProps {
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}

export default function SettingsSubRow({
  label,
  isSelected,
  onChange,
}: SettingsSubRowProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <p className="text-xs font-medium text-neutral-400">{label}</p>
      <SettingsToggle setting={{ label, isSelected, onChange }} />
    </div>
  );
}
