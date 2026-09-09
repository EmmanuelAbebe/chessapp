import type { GameHistoryEntry } from "./types";
import { lookupOpeningName } from "@/features/statistics/lib/openings-book";

// Derived groupings for a recorded game - the speed category and the
// broad opening family - used by the games-list filters and by the
// stats openings breakdown, so both read the same rules.

export type TimeCategory = {
  key: string;
  name: string;
  /** One-line "what is this" for the hover hint. */
  blurb: string;
};

export const TIME_CATEGORIES: TimeCategory[] = [
  {
    key: "ultrabullet",
    name: "UltraBullet",
    blurb: "Lightning chess - about 15 seconds for the whole game each.",
  },
  {
    key: "bullet",
    name: "Bullet",
    blurb: "Very fast - under 3 minutes each for the whole game.",
  },
  {
    key: "blitz",
    name: "Blitz",
    blurb: "Fast - roughly 3 to 8 minutes each.",
  },
  {
    key: "rapid",
    name: "Rapid",
    blurb: "Moderate pace - roughly 8 to 25 minutes each.",
  },
  {
    key: "classical",
    name: "Classical",
    blurb: "Slow - 25 minutes or more each; time to think.",
  },
  {
    key: "correspondence",
    name: "Correspondence",
    blurb: "Days per move, played over a long stretch.",
  },
  {
    key: "engine",
    name: "vs Stockfish",
    blurb: "A local game against the built-in engine.",
  },
];

const byKey = (key: string) =>
  TIME_CATEGORIES.find((c) => c.key === key) ?? null;

/** Lichess-style speed category from a PGN `TimeControl` ("60+0",
 * "180+2", "1/259200", "-"). Estimate = base + 40*increment seconds. */
export function timeControlCategory(
  tc: string | undefined,
  source?: GameHistoryEntry["source"],
): TimeCategory | null {
  if (source === "live") return byKey("engine");
  if (!tc || tc === "-") return null;
  if (tc.includes("/")) return byKey("correspondence");
  const m = tc.match(/^(\d+)\+(\d+)/);
  if (!m) return null;
  const est = Number(m[1]) + 40 * Number(m[2]);
  if (est < 30) return byKey("ultrabullet");
  if (est < 180) return byKey("bullet");
  if (est < 480) return byKey("blitz");
  if (est < 1500) return byKey("rapid");
  return byKey("classical");
}

export function timeCategoryLabel(game: GameHistoryEntry): string {
  return (
    timeControlCategory(game.timeControl, game.source)?.name ??
    game.timeControl ??
    "import"
  );
}

/** The broad opening family - the PGN's own `Opening` tag (lichess
 * supplies one) trimmed to before the first ":" or ",", else the
 * built-in book, else "Other". */
export function openingFamilyOf(
  game: Pick<GameHistoryEntry, "meta" | "moves">,
): string {
  const header = game.meta?.opening?.trim();
  if (header) return header.split(":")[0].split(",")[0].trim();
  return lookupOpeningName(game.moves) ?? "Other";
}
