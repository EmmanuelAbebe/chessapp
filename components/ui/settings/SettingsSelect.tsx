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
          rounded-lg border border-neutral-700
          bg-neutral-900 px-3 py-2
          text-sm text-neutral-200
          shadow-sm
          outline-none
          transition

          hover:border-neutral-600
          focus-visible:ring-2
          focus-visible:ring-blue-500
        "
      >
        <SelectValue />

        <span aria-hidden="true" className="text-xs text-neutral-500">
          ▼
        </span>
      </Button>

      <Popover
        className="
          w-(--trigger-width)
          overflow-hidden
          rounded-xl
          border border-neutral-700
          bg-neutral-900
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
                text-sm text-neutral-300
                outline-none
                transition

                data-hovered:bg-neutral-800
                data-focused:bg-neutral-800
                data-selected:bg-blue-500/15
                data-selected:text-blue-400
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
