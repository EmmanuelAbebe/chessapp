import {
  parseGame,
  matchPlayerSide,
  splitPgnGames,
} from "@/features/board/lib/pgn-import";
import {
  computeFingerprint,
  createHistoryId,
  extractGameMeta,
  pgnPlayedAt,
  resultForSide,
  type GameHistoryEntry,
} from "./types";

// History-only import (no move-tree merge) - for the Statistics /
// Settings "manage games" surfaces, which live outside the (game) route
// group and only care about the recorded-games list. The Map page's own
// importer is the one that also grows the shared move tree.

export type HistoryImportResult = {
  entries: GameHistoryEntry[];
  /** Games parsed. */
  total: number;
  /** Games parsed but not attributed (no saved username matched). */
  unmatched: number;
};

function toEntry(
  headers: Record<string, string>,
  moves: ReturnType<typeof parseGame>["moves"],
  usernames: string[],
): GameHistoryEntry | null {
  const side = matchPlayerSide(headers, usernames);
  if (!side) return null;
  const result = resultForSide(headers.Result ?? "*", side);
  const opponentName = side === "w" ? headers.Black : headers.White;
  return {
    id: createHistoryId(),
    source: "import",
    playedAt: pgnPlayedAt(headers) ?? Date.now(),
    playerSide: side,
    result,
    opponentName,
    timeControl: headers.TimeControl,
    meta: extractGameMeta(headers),
    moves,
    fingerprint: computeFingerprint({
      playerSide: side,
      opponentName,
      result,
      moves,
    }),
  };
}

/** Parse a block of one or many PGN games into history entries. */
export function pgnTextToHistory(
  text: string,
  usernames: string[],
): HistoryImportResult {
  let total = 0;
  let unmatched = 0;
  const entries: GameHistoryEntry[] = [];
  for (const pgn of splitPgnGames(text)) {
    let parsed;
    try {
      parsed = parseGame(pgn);
    } catch {
      continue;
    }
    total += 1;
    const entry = toEntry(parsed.headers, parsed.moves, usernames);
    if (entry) entries.push(entry);
    else unmatched += 1;
  }
  return { entries, total, unmatched };
}

const LICHESS_PREFIX = "https://lichess.org/api/games/";

export function isLichessExportUrl(url: string): boolean {
  return url.trim().startsWith(LICHESS_PREFIX);
}

/** Fetch a lichess games-export URL and parse it into history entries.
 * Not streamed (unlike the Map importer) - fine for a settings-page
 * import; a very large archive is better done from the Map page. */
export async function lichessUrlToHistory(
  url: string,
  usernames: string[],
  signal?: AbortSignal,
): Promise<HistoryImportResult> {
  const res = await fetch(url.trim(), {
    headers: { Accept: "application/x-chess-pgn" },
    signal,
  });
  if (!res.ok) throw new Error(`Lichess request failed: ${res.status}`);
  return pgnTextToHistory(await res.text(), usernames);
}

export type LichessImportQuery = {
  max?: number;
  since?: number;
  until?: number;
  rated?: boolean;
  /** Comma-separated Lichess perf types, e.g. "blitz" or "blitz,rapid".
   * Omitted (or empty) means every speed. */
  perfType?: string;
};

/** Fetch the signed-in user's own recent games via the internal route
 * (token applied server-side) into history entries. */
export async function myLichessGamesToHistory(
  usernames: string[],
  query: LichessImportQuery | number = 200,
  signal?: AbortSignal,
): Promise<HistoryImportResult> {
  // A bare number is still accepted as just `max`, so existing callers
  // (`myLichessGamesToHistory(usernames, 200, signal)`) don't need to change.
  const { max = 200, since, until, rated, perfType } =
    typeof query === "number" ? { max: query } : query;

  const params = new URLSearchParams({ max: String(max) });
  if (since) params.set("since", String(since));
  if (until) params.set("until", String(until));
  if (rated !== undefined) params.set("rated", String(rated));
  if (perfType) params.set("perfType", perfType);

  const res = await fetch(`/api/lichess/games?${params.toString()}`, {
    headers: { Accept: "application/x-chess-pgn" },
    signal,
  });
  if (res.status === 401) {
    throw new Error("Sign in with Lichess to import your own games.");
  }
  if (!res.ok) throw new Error(`Lichess request failed: ${res.status}`);
  return pgnTextToHistory(await res.text(), usernames);
}
