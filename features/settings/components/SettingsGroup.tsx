"use client";

import type { ReactNode } from "react";
import SettingsToggle from "./SettingsToggle";

interface SettingsGroupProps {
  item: {
    icon?: ReactNode;
    title: string;
    isSelected: boolean;
    onChange: (isSelected: boolean) => void;
    children?: ReactNode;
  };
}

export default function SettingsGroup({ item }: SettingsGroupProps) {
  const { icon, title, isSelected, onChange, children } = item;

  return (
    <section className="w-full py-3">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon}
          <p className="text-sm font-semibold text-text">{title}</p>
        </div>

        <div className="shrink-0">
          <SettingsToggle setting={{ label: title, isSelected, onChange }} />
        </div>
      </div>

      {isSelected && children ? (
        <div className="mt-3 flex flex-col items-end gap-3 border-l-2 border-border-soft pl-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
