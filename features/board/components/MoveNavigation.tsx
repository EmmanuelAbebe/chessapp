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
  onStart: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEnd: () => void;
};

type NavButtonProps = {
  icon: IconType;
  label: string;
  onClick: () => void;
};

function NavButton({ icon: Icon, label, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

export function MoveNavigation({
  canGoPrevious,
  canGoNext,
  onStart,
  onPrevious,
  onNext,
  onEnd,
}: MoveNavigationProps) {
  if (!canGoPrevious && !canGoNext) return null;

  return (
    <div className="flex shrink-0">
      {canGoPrevious && (
        <>
          <NavButton icon={FaAnglesLeft} label="Go to start" onClick={onStart} />
          <NavButton
            icon={FaChevronLeft}
            label="Previous move"
            onClick={onPrevious}
          />
        </>
      )}
      {canGoNext && (
        <>
          <NavButton
            icon={FaChevronRight}
            label="Next move"
            onClick={onNext}
          />
          <NavButton icon={FaAnglesRight} label="Go to end" onClick={onEnd} />
        </>
      )}
    </div>
  );
}
