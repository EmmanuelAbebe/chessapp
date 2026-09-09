import type { ParsedMove } from "../board/lib/pgn-import";

export type GameResult = "win" | "loss" | "draw";

/** The bits of a PGN's headers worth keeping for the game-detail view -
 * everything else in a lichess/chess.com export is either already
 * captured on the entry itself or not interesting. All optional; a live
 * game against Stockfish has none of it. */
export type GameMeta = {
  event?: string;
  site?: string;
  round?: string;
  /** PGN Date / UTCDate, "YYYY.MM.DD". */
  date?: string;
  /** PGN UTCTime, "HH:MM:SS". */
  time?: string;
  whiteName?: string;
  blackName?: string;
  whiteElo?: string;
  blackElo?: string;
  eco?: string;
  opening?: string;
  termination?: string;
  /** A clickable link to the game, derived from Site / Link when it's a
   * URL (lichess puts the game URL in Site; chess.com uses Link). */
  gameUrl?: string;
};

export type GameHistoryEntry = {
  id: string;
  source: "import" | "live";
  playedAt: number;
  playerSide: "w" | "b";
  result: GameResult;
  opponentName?: string;
  timeControl?: string;
  meta?: GameMeta;
  moves: ParsedMove[];
  // Identifies "the same game" regardless of when/how it was added, so
  // useGameHistory can skip re-adding one already in history - the exact
  // move sequence plus who played it, not a header field some PGN
  // sources omit, so it works uniformly for imports and live games alike.
  fingerprint: string;
};

export function createHistoryId(): string {
  return `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Pull the game-detail fields out of a PGN's raw headers. Safe on a
 * partial/odd header set - everything's optional and missing/"?" values
 * are dropped. */
export function extractGameMeta(headers: Record<string, string>): GameMeta {
  const val = (key: string): string | undefined => {
    const v = headers[key]?.trim();
    return v && v !== "?" && v !== "????.??.??" ? v : undefined;
  };
  const site = val("Site");
  const link = val("Link");
  // Lichess puts the game URL in Site; chess.com uses Link. Fall back to
  // a GameId header (some exports carry that instead of a URL Site), and
  // normalise a protocol-less "lichess.org/<id>".
  const gameId = val("GameId") ?? val("LichessId");
  let url = [site, link].find((s) => s?.startsWith("http"));
  if (!url && gameId && /^[a-z0-9]{8,12}$/i.test(gameId)) {
    url = `https://lichess.org/${gameId}`;
  }
  if (!url && site && /^lichess\.org\/[a-z0-9]{8}/i.test(site)) {
    url = `https://${site}`;
  }

  const meta: GameMeta = {
    event: val("Event"),
    site,
    round: val("Round"),
    date: val("UTCDate") ?? val("Date"),
    time: val("UTCTime") ?? val("Time"),
    whiteName: val("White"),
    blackName: val("Black"),
    whiteElo: val("WhiteElo"),
    blackElo: val("BlackElo"),
    eco: val("ECO"),
    opening: val("Opening"),
    termination: val("Termination"),
    gameUrl: url,
  };
  // Strip empty keys so a game with no useful headers stores `{}` we can
  // treat as "nothing to show".
  for (const k of Object.keys(meta) as (keyof GameMeta)[]) {
    if (meta[k] === undefined) delete meta[k];
  }
  return meta;
}

/** When the game was actually played, from the PGN's Date/UTCDate (+
 * UTCTime/Time), as a UTC millisecond timestamp - or null if there's no
 * usable date. Used to sort/label game history by when games happened,
 * not when they were imported. */
export function pgnPlayedAt(
  headersOrMeta: Record<string, string> | GameMeta | undefined,
): number | null {
  if (!headersOrMeta) return null;
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const v = (headersOrMeta as Record<string, string>)[key]?.trim?.();
      if (v && v !== "?" && v !== "????.??.??") return v;
    }
    return undefined;
  };
  // GameMeta stores the already-picked values under `date` / `time`.
  const date = pick("date", "UTCDate", "Date");
  const time = pick("time", "UTCTime", "Time");
  const dm = date?.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (!dm) return null;
  const [, y, mo, d] = dm;
  const tm = time?.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  const ts = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    tm ? Number(tm[1]) : 0,
    tm ? Number(tm[2]) : 0,
    tm ? Number(tm[3]) : 0,
  );
  return Number.isNaN(ts) ? null : ts;
}

/** A stable id for "this exact game, played by this side" - two entries
 * built from the same moves/side/opponent/result always produce the same
 * fingerprint, which is what lets a duplicate import (an accidental
 * double-paste, or re-importing a game already recorded) get skipped
 * instead of silently double-counting it in every stat. Deliberately not
 * based on any PGN header (GameId, Site, ...) since not every source
 * includes one, and a live game has none at all. */
export function computeFingerprint(
  entry: Pick<GameHistoryEntry, "playerSide" | "opponentName" | "result" | "moves">,
): string {
  const content = `${entry.playerSide}|${entry.opponentName ?? ""}|${entry.result}|${entry.moves
    .map((move) => move.uci)
    .join(",")}`;

  // A plain djb2 string hash - this only needs to be a stable, cheap
  // "are these two move sequences the same" check, not cryptographic.
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/** "1-0"/"0-1"/"1/2-1/2" (or anything else, treated as a draw) from the
 * player's own side's point of view. */
export function resultForSide(pgnResult: string, side: "w" | "b"): GameResult {
  if (pgnResult === "1-0") return side === "w" ? "win" : "loss";
  if (pgnResult === "0-1") return side === "b" ? "win" : "loss";
  return "draw";
}
