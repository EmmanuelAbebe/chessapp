"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Tweens a fixed-length array of numbers toward `targets` whenever they
 * change, instead of snapping - so a chart driven by async data (a fresh
 * analysis coming back) can visibly animate from the old reading to the
 * new one. Starts from all-zero on mount, so the first render is a reveal
 * growing into place rather than a static change. Respects
 * prefers-reduced-motion by snapping instead of animating. */
export function useAnimatedNumbers(targets: number[], duration = DURATION_MS): number[] {
  const [displayed, setDisplayed] = useState<number[]>(() => targets.map(() => 0));
  const fromRef = useRef<number[]>(targets.map(() => 0));
  const rafRef = useRef<number | null>(null);
  const key = targets.join(",");

  useEffect(() => {
    const from = fromRef.current;
    const to = targets;
    const unchanged = from.length === to.length && from.every((v, i) => v === to[i]);
    if (unchanged || prefersReducedMotion()) {
      setDisplayed(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setDisplayed(from.map((f, i) => f + ((to[i] ?? f) - f) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);

  return displayed;
}
