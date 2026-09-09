"use client";

import { useEffect, useRef, useState } from "react";
import { FaUserCheck } from "react-icons/fa6";
import { usePlayerIdentity } from "@/features/settings/usePlayerIdentity";
import { useGameHistory } from "./useGameHistory";
import {
  pgnTextToHistory,
  lichessUrlToHistory,
  myLichessGamesToHistory,
  isLichessExportUrl,
} from "./importToHistory";

// One place to manage recorded games - the usernames that attribute
// them, importing more, and clearing the lot. Reused on the Statistics
// page, in general Settings, and in the board settings modal, so those
// don't each reinvent it.

export function GameDataCard({ compact = false }: { compact?: boolean }) {
  const { usernames, setUsernames, usernameList } = usePlayerIdentity();
  const { games, addGames, clearHistory } = useGameHistory();

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [lichessConnected, setLichessConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lichess/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.username) setLichessConnected(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(
    load: () => ReturnType<typeof pgnTextToHistory> | Promise<ReturnType<typeof pgnTextToHistory>>,
  ) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { entries, total, unmatched } = await load();
      const added = addGames(entries);
      const parts = [`${total} game${total === 1 ? "" : "s"} read`];
      if (added) parts.push(`${added} added`);
      if (entries.length - added > 0)
        parts.push(`${entries.length - added} already in history`);
      if (unmatched > 0) parts.push(`${unmatched} not matched to your usernames`);
      setStatus(parts.join(" · "));
      setText("");
    } catch (e) {
      setError((e as Error).message || "Import failed.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function importPasted() {
    const value = text.trim();
    if (!value) return;
    if (isLichessExportUrl(value)) {
      const controller = new AbortController();
      abortRef.current = controller;
      void run(() =>
        lichessUrlToHistory(value, usernameList, controller.signal),
      );
    } else {
      void run(() => pgnTextToHistory(value, usernameList));
    }
  }

  function importMine() {
    const controller = new AbortController();
    abortRef.current = controller;
    void run(() => myLichessGamesToHistory(usernameList, 200, controller.signal));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="game-data-usernames"
          className="flex items-center gap-2 text-sm font-semibold text-text"
        >
          <FaUserCheck className="text-text-dim" />
          Your usernames
        </label>
        <input
          id="game-data-usernames"
          type="text"
          value={usernames}
          onChange={(e) => setUsernames(e.target.value)}
          placeholder="e.g. jonkimura33, MyChessComHandle"
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <p className="text-xs text-text-faint">
          Comma-separated, matched against a PGN&apos;s White/Black names so a
          game counts as yours (not the opponent&apos;s). Stored only in your
          browser.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text">Import games</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          disabled={busy}
          rows={compact ? 3 : 5}
          placeholder={
            "Paste PGN games, or a lichess.org export URL\n(https://lichess.org/api/games/user/yourname?...)"
          }
          className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={importPasted}
            disabled={busy || !text.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-text transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import"}
          </button>
          {lichessConnected && (
            <button
              type="button"
              onClick={importMine}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-dim transition hover:border-accent hover:text-text disabled:opacity-50"
            >
              Import my recent Lichess games
            </button>
          )}
        </div>
        {status && <p className="text-xs text-text-dim">{status}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-[11px] text-text-faint">
          Adds to your recorded games only. To also grow the move-tree map
          from an import, use the Map page.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3">
        <span className="text-xs text-text-faint">
          {games.length} game{games.length === 1 ? "" : "s"} recorded
        </span>
        {games.length > 0 &&
          (confirmClear ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-text-dim">Clear all recorded games?</span>
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                  setStatus(null);
                }}
                className="rounded-md bg-red-500/90 px-2 py-1 font-medium text-white transition hover:bg-red-500"
              >
                Clear
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
          ))}
      </div>
    </div>
  );
}
