"use client";

import React from "react";

type MoveNavigationProps = {
  canGoPrevious: boolean;
  canGoNext: boolean;
  canGoEnd: boolean;
  onStart: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEnd: () => void;
};

type NavButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function NavButton({ label, disabled, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}

export function MoveNavigation({
  canGoPrevious,
  canGoNext,
  canGoEnd,
  onStart,
  onPrevious,
  onNext,
  onEnd,
}: MoveNavigationProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <NavButton label="<" disabled={!canGoPrevious} onClick={onPrevious} />
        <NavButton label=">" disabled={!canGoNext} onClick={onNext} />
      </div>
    </div>
  );
}
