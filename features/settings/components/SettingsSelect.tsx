"use client";

import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

type Option = string | { id: string; label: string };

interface SelectSetting {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

interface SettingsSelectProps {
  setting: SelectSetting;
  /** Tighter trigger for dense filter bars (default is the settings-page width). */
  compact?: boolean;
}

export default function SettingsSelect({ setting, compact }: SettingsSelectProps) {
  const { label, value, options, onChange } = setting;
  const opts = options.map((o) =>
    typeof o === "string" ? { id: o, label: o } : o,
  );

  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => onChange(String(key))}
      className="relative"
    >
      <Button
        className={`
          flex items-center justify-between gap-3
          rounded-lg border border-border
          bg-surface text-text
          shadow-sm
          outline-none
          transition

          hover:border-accent
          focus-visible:ring-2
          focus-visible:ring-accent
          ${compact ? "min-w-28 px-2.5 py-1.5 text-xs" : "min-w-36 px-3 py-2 text-sm"}
        `}
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
        <ListBox className="max-h-72 overflow-auto outline-none">
          {opts.map((option) => (
            <ListBoxItem
              key={option.id}
              id={option.id}
              textValue={option.label}
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
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
