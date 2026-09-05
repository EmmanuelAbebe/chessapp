"use client";

import { useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { matchPlayerSide } from "../../lib/pgn-import";
import {
  importFromLichessUrl,
  importFromPastedText,
  isSupportedGamesUrl,
  type ImportBatch,
} from "../../lib/pgn-import-stream";
import type { MoveTreeState } from "../../types";
import { usePlayerIdentity } from "@/features/settings/usePlayerIdentity";
import { useGameHistory } from "@/features/history/useGameHistory";
import {
  computeFingerprint,
  createHistoryId,
  resultForSide,
  type GameHistoryEntry,
} from "@/features/history/types";

type MapImportGamesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: MoveTreeState;
  onMerge: (tree: MoveTreeState) => void;
};

type Progress = { processed: number; failed: number; matched: number; added: number };

const EMPTY_PROGRESS: Progress = { processed: 0, failed: 0, matched: 0, added: 0 };

export function MapImportGamesModal({
  isOpen,
  onClose,
  tree,
  onMerge,
}: MapImportGamesModalProps) {
  const [pgnText, setPgnText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  // The same persisted store Settings' Player Identity section reads/
  // writes - editing it here updates it there too, so there's only ever
  // one place this actually lives.
  const { usernames, setUsernames, usernameList } = usePlayerIdentity();
  const { addGames } = useGameHistory();

  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Always current inside the batch callback below, which closes over
  // whatever usernameList was at the moment importing started otherwise.
  const usernameListRef = useRef(usernameList);
  usernameListRef.current = usernameList;

  function resetOutcome() {
    setIsDone(false);
    setProgress(EMPTY_PROGRESS);
    setUrlError(null);
  }

  function handleClose() {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    setPgnText("");
    setSourceUrl("");
    resetOutcome();
    setIsImporting(false);
    onClose();
  }

  // Called once per batch as the import runs - both the map (via onMerge)
  // and the Statistics history (via addGames) update right here, so they
  // visibly grow while a large import is still in progress instead of
  // jumping to their final state only once everything finishes.
  function handleBatch(batch: ImportBatch) {
    onMerge(batch.tree);

    const matched: GameHistoryEntry[] = [];
    for (const game of batch.parsedGames) {
      const side = matchPlayerSide(game.headers, usernameListRef.current);
      if (!side) continue;
      const gameResult = resultForSide(game.headers.Result ?? "*", side);
      const opponentName = side === "w" ? game.headers.Black : game.headers.White;
      matched.push({
        id: createHistoryId(),
        source: "import",
        playedAt: Date.now(),
        playerSide: side,
        result: gameResult,
        opponentName,
        timeControl: game.headers.TimeControl,
        moves: game.moves,
        fingerprint: computeFingerprint({
          playerSide: side,
          opponentName,
          result: gameResult,
          moves: game.moves,
        }),
      });
    }
    const added = addGames(matched);

    setProgress((prev) => ({
      processed: batch.processed,
      failed: batch.failed,
      matched: prev.matched + matched.length,
      added: prev.added + added,
    }));
  }

  async function handleImport() {
    const url = sourceUrl.trim();
    if (url && !isSupportedGamesUrl(url)) {
      setUrlError("Only a lichess.org games-export URL is supported here.");
      return;
    }

    cancelledRef.current = false;
    resetOutcome();
    setIsImporting(true);

    try {
      if (url) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        await importFromLichessUrl(url, controller.signal, {
          initialTree: tree,
          isCancelled: () => cancelledRef.current,
          onBatch: handleBatch,
        });
      } else {
        await importFromPastedText(pgnText, {
          initialTree: tree,
          isCancelled: () => cancelledRef.current,
          onBatch: handleBatch,
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setUrlError(
          url
            ? "Couldn't fetch that URL - check it's a public lichess.org games export."
            : "Something went wrong partway through the import.",
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsImporting(false);
      setIsDone(true);
      setPgnText("");
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }

  const canImport = !isImporting && (pgnText.trim() || sourceUrl.trim());

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="w-full max-w-md">
        <h2 className="text-xl font-bold text-text">Import games</h2>
        <p className="mt-1 text-xs text-text-faint">
          Paste one or many PGN games at once, or fetch a lichess.org
          export directly by URL. Shared openings merge into the same
          branch; each game only forks off where it actually diverges.
        </p>

        <div className="mt-4">
          <label
            htmlFor="map-import-usernames"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Your usernames
          </label>
          <input
            id="map-import-usernames"
            type="text"
            value={usernames}
            onChange={(e) => setUsernames(e.target.value)}
            placeholder="e.g. jonkimura33, MyChessComHandle"
            autoComplete="off"
            disabled={isImporting}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-text-faint">
            Comma-separated - matched against each game's White/Black names
            so it counts as yours on the Statistics page. Same as the
            Settings page; stored only in your browser.
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="map-import-url"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Lichess export URL
          </label>
          <input
            id="map-import-url"
            type="text"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
              setUrlError(null);
            }}
            placeholder="https://lichess.org/api/games/user/yourname?..."
            autoComplete="off"
            disabled={isImporting}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-text-faint">
            Games stream in and are merged as they arrive - no need to
            download the file yourself first.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-text-faint">
          <div className="h-px flex-1 bg-border" />
          or paste PGN directly
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-2">
          <textarea
            id="map-import-pgn"
            value={pgnText}
            onChange={(e) => {
              setPgnText(e.target.value);
              resetOutcome();
            }}
            placeholder={'[Event "..."]\n[White "..."]\n[Black "..."]\n\n1. e4 e5 2. Nf3 ...\n\n[Event "..."]\n...'}
            rows={8}
            disabled={isImporting}
            className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>

        {urlError && <p className="mt-2 text-xs text-red-400">{urlError}</p>}

        {(isImporting || isDone) && !urlError && (
          <p className="mt-2 text-xs text-text-dim">
            {isImporting ? "Importing... " : ""}
            {progress.processed} game{progress.processed === 1 ? "" : "s"}{" "}
            processed
            {progress.failed > 0
              ? ` (${progress.failed} couldn't be parsed)`
              : ""}
            . {progress.matched} matched your username;{" "}
            {progress.added} new game{progress.added === 1 ? "" : "s"} added
            to your stats
            {progress.matched > progress.added
              ? ` (${progress.matched - progress.added} already there).`
              : "."}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          {isImporting ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-dim transition hover:border-accent hover:text-text"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleImport}
                disabled={!canImport}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              >
                {sourceUrl.trim() ? "Fetch & Import" : "Import"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-dim transition hover:border-accent hover:text-text"
              >
                {isDone ? "Done" : "Cancel"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
