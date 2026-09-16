"use client";

import { FiHelpCircle } from "react-icons/fi";
import { Tooltip } from "./Tooltip";

/** A tiny "?" that reveals an explanation on hover/focus instead of
 * always-on prose taking up space next to whatever it's explaining. A
 * thin composition of Tooltip + a standard help-icon trigger - use
 * Tooltip directly when the trigger is something other than this icon
 * (an existing button, a row, a label). */
export function HintIcon({
  text,
  width = "w-48",
}: {
  text: string;
  /** Tailwind width class for the tooltip - widen for a longer explanation. */
  width?: string;
}) {
  return (
    <Tooltip text={text} width={width} className="inline-flex align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="text-text-faint transition hover:text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <FiHelpCircle className="h-3 w-3" />
      </button>
    </Tooltip>
  );
}
