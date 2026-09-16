"use client";

import { useRef, useState, type ReactNode } from "react";

const EDGE_MARGIN = 8; // px kept clear of the viewport edge

/** A custom hover/focus tooltip for any trigger content - the browser's
 * native `title` attribute has an unavoidable ~1s delay, doesn't respect
 * the app's theme, and can't be styled or positioned. Use this instead
 * of `title=` anywhere a tooltip is actually needed; native `title`
 * should only remain where a custom one genuinely can't apply.
 *
 * Centered under/over the trigger by default, but re-measures on each
 * hover/focus and nudges itself to stay on screen near a viewport edge -
 * never by resizing anything or causing scroll (see HintIcon, the first
 * caller to need this, which now composes it). */
export function Tooltip({
  text,
  children,
  width = "w-48",
  className = "inline-flex",
}: {
  text: string;
  children: ReactNode;
  /** Tailwind width class for the tooltip - widen for a longer explanation. */
  width?: string;
  /** Layout classes for the wrapping element (display, width, etc.) -
   * defaults to inline-flex; pass e.g. "flex w-full" for a block-level
   * trigger like a full-width row. */
  className?: string;
}) {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [shiftPx, setShiftPx] = useState(0);

  function reposition() {
    const el = tooltipRef.current;
    if (!el || typeof window === "undefined") return;
    el.style.transform = "translateX(-50%)"; // reset to natural centered position before measuring
    const rect = el.getBoundingClientRect();
    if (rect.left < EDGE_MARGIN) {
      setShiftPx(EDGE_MARGIN - rect.left);
    } else if (rect.right > window.innerWidth - EDGE_MARGIN) {
      setShiftPx(window.innerWidth - EDGE_MARGIN - rect.right);
    } else {
      setShiftPx(0);
    }
  }

  return (
    <span className={`group/tip relative ${className}`} onMouseEnter={reposition} onFocus={reposition}>
      {children}
      <span
        ref={tooltipRef}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shiftPx}px))` }}
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 ${width} rounded-md border border-border bg-surface px-2 py-1 text-[11px] leading-snug font-normal text-text-dim opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}
