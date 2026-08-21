"use client";

import { Switch } from "react-aria-components";

interface ToggleSetting {
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}

interface SettingsToggleProps {
  setting: ToggleSetting;
}

export default function SettingsToggle({ setting }: SettingsToggleProps) {
  const { label, isSelected, onChange } = setting;

  return (
    <Switch
      aria-label={label}
      isSelected={isSelected}
      onChange={onChange}
      className="group inline-flex cursor-pointer items-center"
    >
      <div
        className="
          flex h-6 w-11 items-center
          rounded-full
          bg-surface-raised
          p-0.5
          transition

          group-data-selected:bg-accent
          group-data-focus-visible:ring-2
          group-data-focus-visible:ring-accent
          group-data-focus-visible:ring-offset-2
        "
      >
        <span
          className="
            h-5 w-5
            rounded-full
            bg-white
            shadow-sm
            transition-transform

            group-data-selected:translate-x-5
          "
        />
      </div>
    </Switch>
  );
}
