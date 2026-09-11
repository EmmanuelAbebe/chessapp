"use client";

import { useState } from "react";

export const PERF_TYPES = ["bullet", "blitz", "rapid", "classical"] as const;
export type PerfType = (typeof PERF_TYPES)[number];

/** The selective-fetch controls for "import my Lichess games" - which
 * speed(s), how many, and a date range - shared by GameDataCard and
 * MapImportGamesModal so both get the same options instead of each
 * hard-coding "last 200 games, any speed, ever". */
export function useLichessFetchOptions(defaultMax: number) {
  const [perfTypes, setPerfTypes] = useState<PerfType[]>([]);
  const [max, setMax] = useState(defaultMax);
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [ratedOnly, setRatedOnly] = useState(true);

  function togglePerfType(pt: PerfType) {
    setPerfTypes((prev) =>
      prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt],
    );
  }

  const query = {
    max,
    perfType: perfTypes.length > 0 ? perfTypes.join(",") : undefined,
    since: sinceDate ? new Date(`${sinceDate}T00:00:00`).getTime() : undefined,
    // end-of-day, so "until 2024-06-01" includes games played that day
    until: untilDate ? new Date(`${untilDate}T23:59:59`).getTime() : undefined,
    rated: ratedOnly ? true : undefined,
  };

  return {
    perfTypes, togglePerfType,
    max, setMax,
    sinceDate, setSinceDate,
    untilDate, setUntilDate,
    ratedOnly, setRatedOnly,
    query,
  };
}

export type LichessFetchOptionsState = ReturnType<typeof useLichessFetchOptions>;
