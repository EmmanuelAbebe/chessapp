"use client";

import { FiHelpCircle } from "react-icons/fi";

/** A tiny "?" that reveals an explanation on hover/focus instead of
 * always-on prose taking up space next to whatever it's explaining. */
export function HintIcon({
  text,
  width = "w-48",
}: {
  text: string;
  /** Tailwind width class for the tooltip - widen for a longer explanation. */
  width?: string;
}) {
  return (
    <span className="group/hint relative inline-flex align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="text-text-faint transition hover:text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <FiHelpCircle className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 ${width} -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-[11px] leading-snug font-normal text-text-dim opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}
