"use client";

import React from "react";
import type { IconType } from "react-icons";
import {
  FaAnglesLeft,
  FaAnglesRight,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa6";

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
  icon: IconType;
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function NavButton({ icon: Icon, label, disabled, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <Icon className="h-3 w-3" />
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
    <div className="flex shrink-0">
      <NavButton
        icon={FaAnglesLeft}
        label="Go to start"
        disabled={!canGoPrevious}
        onClick={onStart}
      />
      <NavButton
        icon={FaChevronLeft}
        label="Previous move"
        disabled={!canGoPrevious}
        onClick={onPrevious}
      />
      <NavButton
        icon={FaChevronRight}
        label="Next move"
        disabled={!canGoNext}
        onClick={onNext}
      />
      <NavButton
        icon={FaAnglesRight}
        label="Go to end"
        disabled={!canGoEnd}
        onClick={onEnd}
      />
    </div>
  );
}
