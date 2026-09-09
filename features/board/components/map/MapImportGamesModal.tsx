"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { matchPlayerSide } from "../../lib/pgn-import";
import {
  importFromLichessUrl,
  importFromPastedText,
  importMyLichessGames,
  isSupportedGamesUrl,
  type ImportBatch,
} from "../../lib/pgn-import-stream";
import type { MoveTreeState } from "../../types";
import { usePlayerIdentity } from "@/features/settings/usePlayerIdentity";
import {
  computeFingerprint,
  createHistoryId,
  extractGameMeta,
  pgnPlayedAt,
  resultForSide,
  type GameHistoryEntry,
} from "@/features/history/types";

type MapImportGamesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tree: MoveTreeState;
  onMerge: (tree: MoveTreeState) => void;
  // Lifted up to MoveTreeMap rather than called here via its own
  // useGameHistory() - that hook isn't a shared singleton, so a second,
  // independent instance in this modal would update its own copy of
  // history/localStorage without the map's own node-stats computation
  // (which reads the SAME data) ever finding out.
  addGames: (entries: GameHistoryEntry[]) => number;
  recordedCount: number;
  onClearHistory: () => void;
};

type Progress = {
  processed: number;
  failed: number;
  matched: number;
  added: number;
  unattributed: number;
};

const EMPTY_PROGRESS: Progress = {
  processed: 0,
  failed: 0,
  matched: 0,
  added: 0,
  unattributed: 0,
};

export function MapImportGamesModal({
  isOpen,
  onClose,
  tree,
  onMerge,
  addGames,
  recordedCount,
  onClearHistory,
}: MapImportGamesModalProps) {
  const [pgnText, setPgnText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Set once we've confirmed the signed-in user has a Lichess OAuth link
  // (via /api/lichess/account) - unlocks the one-click "import my games".
  const [lichessUser, setLichessUser] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  // The same persisted store Settings' Player Identity section reads/
  // writes - editing it here updates it there too, so there's only ever
  // one place this actually lives.
  const { usernames, setUsernames, usernameList } = usePlayerIdentity();

  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Always current inside the batch callback below, which closes over
  // whatever usernameList was at the moment importing started otherwise.
  const usernameListRef = useRef(usernameList);
  usernameListRef.current = usernameList;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/lichess/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.username) setLichessUser(data.username);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
  // `nameOverride` is used by "import my Lichess games", which knows the
  // exact username and must not race the just-issued setUsernames() state
  // update that usernameListRef would otherwise still be a step behind.
  function handleBatch(batch: ImportBatch, nameOverride?: string) {
    onMerge(batch.tree);

    const names = nameOverride
      ? [nameOverride, ...usernameListRef.current]
      : usernameListRef.current;

    const matched: GameHistoryEntry[] = [];
    let unattributed = 0;
    for (const game of batch.parsedGames) {
      const side = matchPlayerSide(game.headers, names);
      if (!side) {
        unattributed += 1;
        continue;
      }
      const gameResult = resultForSide(game.headers.Result ?? "*", side);
      const opponentName = side === "w" ? game.headers.Black : game.headers.White;
      matched.push({
        id: createHistoryId(),
        source: "import",
        playedAt: pgnPlayedAt(game.headers) ?? Date.now(),
        playerSide: side,
        result: gameResult,
        opponentName,
        timeControl: game.headers.TimeControl,
        meta: extractGameMeta(game.headers),
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
      unattributed: prev.unattributed + unattributed,
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

  async function handleImportMine() {
    if (!lichessUser) return;
    // Persist it for future imports too, but match THIS import against
    // `lichessUser` directly (passed into handleBatch) - relying on the
    // state we just set would race the batches that arrive before the
    // re-render.
    if (!usernames.trim()) setUsernames(lichessUser);

    cancelledRef.current = false;
    resetOutcome();
    setIsImporting(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await importMyLichessGames(
        controller.signal,
        {
          initialTree: tree,
          isCancelled: () => cancelledRef.current,
          onBatch: (batch) => handleBatch(batch, lichessUser),
        },
        { max: 200 },
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setUrlError(
          (error as Error).message || "Couldn't import your Lichess games.",
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsImporting(false);
      setIsDone(true);
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

        {lichessUser && (
          <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="text-sm font-medium text-text">
              Connected to Lichess as {lichessUser}
            </p>
            <p className="mt-0.5 text-xs text-text-faint">
              Pull your recent games straight from your account - no export
              URL needed.
            </p>
            <button
              type="button"
              onClick={handleImportMine}
              disabled={isImporting}
              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-text transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
            >
              Import my last 200 games
            </button>
          </div>
        )}

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
            {progress.unattributed > 0 && (
              <>
                {" "}
                <span className="text-amber-500">
                  {progress.unattributed} game
                  {progress.unattributed === 1 ? "" : "s"} skipped - none of
                  your usernames matched their players, so they can&apos;t be
                  counted as yours. Check the Your usernames field above.
                </span>
              </>
            )}
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

        {!isImporting && recordedCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-text-faint">
              {recordedCount} game{recordedCount === 1 ? "" : "s"} in your
              history (drives the Statistics page and these win rates)
            </span>
            {confirmClear ? (
              <span className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory();
                    setConfirmClear(false);
                  }}
                  className="rounded-md bg-red-500/90 px-2 py-1 font-medium text-white transition hover:bg-red-500"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md border border-border px-2 py-1 text-text-dim transition hover:text-text"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="rounded-md border border-border px-2 py-1 text-xs text-text-dim transition hover:border-red-500/50 hover:text-text"
              >
                Clear game history
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
