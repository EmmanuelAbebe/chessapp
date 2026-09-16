"use client";

import { useRef, useState } from "react";
import { FiHelpCircle } from "react-icons/fi";

const EDGE_MARGIN = 8; // px kept clear of the viewport edge

/** A tiny "?" that reveals an explanation on hover/focus instead of
 * always-on prose taking up space next to whatever it's explaining.
 *
 * The tooltip is centered under the icon by default, but an icon sitting
 * close to the left/right edge of a narrow viewport would otherwise
 * center a fixed-width box straight off-screen. On each hover/focus it
 * re-measures itself and nudges just enough to stay fully on screen -
 * never causes the page (or anything) to scroll, since the tooltip is
 * `position: absolute` + `pointer-events-none` and only ever shifts its
 * own transform, not any container's size. */
export function HintIcon({
  text,
  width = "w-48",
}: {
  text: string;
  /** Tailwind width class for the tooltip - widen for a longer explanation. */
  width?: string;
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
    <span className="group/hint relative inline-flex align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="text-text-faint transition hover:text-text"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={reposition}
        onFocus={reposition}
      >
        <FiHelpCircle className="h-3 w-3" />
      </button>
      <span
        ref={tooltipRef}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shiftPx}px))` }}
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 ${width} rounded-md border border-border bg-surface px-2 py-1 text-[11px] leading-snug font-normal text-text-dim opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}
