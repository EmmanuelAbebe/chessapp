"use client";

import type { ReactNode } from "react";
import SettingsToggle from "./SettingsToggle";

interface SettingsGroupProps {
  title: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  children?: ReactNode;
}

export default function SettingsGroup({
  title,
  isSelected,
  onChange,
  children,
}: SettingsGroupProps) {
  return (
    <section className="w-full py-3">
      <div className="flex w-full items-center justify-between gap-4">
        <p className="text-sm font-semibold text-gray-800">{title}</p>

        <div className="shrink-0">
          <SettingsToggle setting={{ label: title, isSelected, onChange }} />
        </div>
      </div>

      {isSelected && children ? (
        <div className="mt-3 flex flex-col items-end gap-3 border-l-2 border-gray-100 pl-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
