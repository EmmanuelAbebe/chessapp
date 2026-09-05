import { mergeGamesIntoTree, splitPgnGames, type ParsedGame } from "./pgn-import";
import type { MoveTreeState } from "../types";

// Only Lichess's own export-games endpoint is supported here (see the
// modal's URL field) - restricting to this exact prefix keeps the
// feature from doubling as a generic cross-origin fetch proxy for
// arbitrary URLs, and keeps failures predictable (this is the one shape
// of response the rest of this file knows how to stream-parse).
const ALLOWED_URL_PREFIX = "https://lichess.org/api/games/";

export function isSupportedGamesUrl(url: string): boolean {
  return url.trim().startsWith(ALLOWED_URL_PREFIX);
}

/** Incrementally extracts complete game blocks out of a PGN text stream
 * as chunks arrive - the same "[Event " boundary splitPgnGames already
 * uses, just applied to a growing buffer instead of one complete string.
 * The last fragment after a push is always held back (it may still be
 * mid-game), and only released once either another "[Event" proves it's
 * finished or the stream ends (flush). */
export class PgnGameSplitter {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const parts = splitPgnGames(this.buffer);
    if (parts.length <= 1) return [];
    this.buffer = parts.pop() ?? "";
    return parts;
  }

  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest ? [rest] : [];
  }
}

/** Reads a Lichess games-export response as it arrives, yielding each
 * complete game's PGN text as soon as it's fully received rather than
 * waiting for the whole (potentially huge) export to finish downloading. */
async function* streamGamesFromUrl(url: string, signal: AbortSignal): AsyncGenerator<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/x-chess-pgn" },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Lichess request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const splitter = new PgnGameSplitter();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const game of splitter.push(decoder.decode(value, { stream: true }))) {
        yield game;
      }
    }
    for (const game of splitter.flush()) {
      yield game;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* gamesFromPastedText(text: string): AsyncGenerator<string> {
  for (const game of splitPgnGames(text)) {
    yield game;
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export type ImportBatch = {
  tree: MoveTreeState;
  parsedGames: ParsedGame[];
  processed: number;
  failed: number;
};

export type IncrementalImportOptions = {
  initialTree: MoveTreeState;
  isCancelled: () => boolean;
  onBatch: (batch: ImportBatch) => void;
  batchSize?: number;
};

/** Drives an import in small batches instead of one big synchronous pass
 * over everything - each batch calls `onBatch` (letting the caller update
 * the map/stats live, batch by batch, as import progresses) and yields a
 * frame to the browser before starting the next one, so a huge dataset
 * doesn't freeze the tab. The same driver powers both a pasted blob
 * (already fully in memory, just chunked for the sake of not blocking)
 * and a live network stream (genuinely incremental - games appear as
 * Lichess sends them, not after the whole export finishes downloading). */
async function runIncrementalImport(
  gameTexts: AsyncGenerator<string>,
  { initialTree, isCancelled, onBatch, batchSize = 15 }: IncrementalImportOptions,
): Promise<{ tree: MoveTreeState; processed: number; failed: number }> {
  let tree = initialTree;
  let processed = 0;
  let failed = 0;
  let pending: string[] = [];

  async function flush() {
    if (pending.length === 0) return;
    const merged = mergeGamesIntoTree(tree, pending.join("\n\n"));
    tree = merged.tree;
    processed += merged.gamesImported;
    failed += merged.gamesFailed;
    pending = [];
    onBatch({ tree, parsedGames: merged.parsedGames, processed, failed });
    await nextFrame();
  }

  for await (const gameText of gameTexts) {
    if (isCancelled()) break;
    pending.push(gameText);
    if (pending.length >= batchSize) await flush();
  }
  if (!isCancelled()) await flush();

  return { tree, processed, failed };
}

export function importFromPastedText(
  text: string,
  options: IncrementalImportOptions,
): Promise<{ tree: MoveTreeState; processed: number; failed: number }> {
  return runIncrementalImport(gamesFromPastedText(text), options);
}

export function importFromLichessUrl(
  url: string,
  signal: AbortSignal,
  options: IncrementalImportOptions,
): Promise<{ tree: MoveTreeState; processed: number; failed: number }> {
  return runIncrementalImport(streamGamesFromUrl(url, signal), options);
}
