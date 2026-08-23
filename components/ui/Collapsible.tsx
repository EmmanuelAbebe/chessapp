"use client";

import { ReactNode, useEffect, useState } from "react";

type CollapsibleProps = {
  visible: boolean;
  /** Tailwind class for the fully-expanded size, e.g. "h-9" or "w-9". */
  expandedClassName: string;
  /** Which CSS dimension expandedClassName controls. */
  axis: "height" | "width";
  className?: string;
  children: ReactNode;
};

// Space grows/shrinks first, opacity fades in only once there's room (and
// fades out before the space collapses back) - two clearly sequenced
// phases rather than everything happening at once.
const SPACE_MS = 200;
const FADE_MS = 150;

export function Collapsible({
  visible,
  expandedClassName,
  axis,
  className = "",
  children,
}: CollapsibleProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Mount in the collapsed state first. A single rAF can land in the
      // same paint as the mount (browser coalesces it), skipping the
      // transition - two nested rAFs guarantee a real painted frame in the
      // collapsed state before flipping to expanded.
      let innerFrame = 0;
      const outerFrame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(outerFrame);
        cancelAnimationFrame(innerFrame);
      };
    }

    setIsVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), SPACE_MS + FADE_MS);
    return () => clearTimeout(timeout);
  }, [visible]);

  if (!shouldRender) return null;

  const collapsedClassName = axis === "height" ? "h-0" : "w-0";
  const showTransition = `${axis} ${SPACE_MS}ms ease-out, opacity ${FADE_MS}ms ease-out ${SPACE_MS}ms`;
  const hideTransition = `opacity ${FADE_MS}ms ease-out, ${axis} ${SPACE_MS}ms ease-out ${FADE_MS}ms`;

  return (
    <div
      className={`overflow-hidden ${isVisible ? expandedClassName : collapsedClassName} ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{ transition: isVisible ? showTransition : hideTransition }}
    >
      {children}
    </div>
  );
}
