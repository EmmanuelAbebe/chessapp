"use client";

import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

interface SelectSetting {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

interface SettingsSelectProps {
  setting: SelectSetting;
}

export default function SettingsSelect({ setting }: SettingsSelectProps) {
  const { label, value, options, onChange } = setting;

  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => onChange(String(key))}
      className="relative"
    >
      <Button
        className="
          flex min-w-36 items-center justify-between gap-3
          rounded-lg border border-border
          bg-surface px-3 py-2
          text-sm text-text
          shadow-sm
          outline-none
          transition

          hover:border-accent
          focus-visible:ring-2
          focus-visible:ring-accent
        "
      >
        <SelectValue />

        <span aria-hidden="true" className="text-xs text-text-faint">
          ▼
        </span>
      </Button>

      <Popover
        className="
          w-(--trigger-width)
          overflow-hidden
          rounded-xl
          border border-border
          bg-surface
          p-1
          shadow-lg
        "
      >
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={option}
              id={option}
              className="
                cursor-pointer
                rounded-lg
                px-3 py-2
                text-sm text-text
                outline-none
                transition

                data-hovered:bg-surface-raised
                data-focused:bg-surface-raised
                data-selected:bg-accent/15
                data-selected:text-accent
                data-selected:font-medium
              "
            >
              {option}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
