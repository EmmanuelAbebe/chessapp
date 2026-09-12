"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import type { AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";

const STALE_AFTER_DAYS = 30;
const STALE_AFTER_NEW_GAMES = 20;
// Not a hard cap (the server will fetch as many as asked, up to its own
// safety backstop) - just the point past which a fetch+analyze can take
// long enough that we warn before running it.
const REASONABLE_GAMES = 300;

function isStale(profile: PlayerProfileData, gamesCount: number, computedAt: Date): boolean {
  const daysOld = (Date.now() - computedAt.getTime()) / 86_400_000;
  return daysOld > STALE_AFTER_DAYS || gamesCount - profile.source.games_analyzed >= STALE_AFTER_NEW_GAMES;
}

export function AnalyzePanel({
  profile,
  status,
  error,
  onAnalyze,
}: {
  profile: PlayerProfileData | null;
  status: AnalyzeStatus;
  error: string | null;
  onAnalyze: (opts?: { force?: boolean; maxGames?: number }) => void;
}) {
  const [lichessConnected, setLichessConnected] = useState<boolean | null>(null);
  // Blank = let the server default to the size of the user's imported game
  // history; typing a number here overrides that for this analysis only.
  const [maxGamesInput, setMaxGamesInput] = useState("");
  const maxGames = maxGamesInput.trim() ? Number(maxGamesInput) : undefined;
  const [pendingOpts, setPendingOpts] = useState<{ force?: boolean; maxGames?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lichess/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setLichessConnected(Boolean(d?.username));
      })
      .catch(() => {
        if (!cancelled) setLichessConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function requestAnalyze(opts?: { force?: boolean; maxGames?: number }) {
    if (opts?.maxGames && opts.maxGames > REASONABLE_GAMES) {
      setPendingOpts(opts);
      return;
    }
    onAnalyze(opts);
  }

  const confirmDialog = pendingOpts && (
    <Modal isOpen onClose={() => setPendingOpts(null)}>
      <h3 className="text-sm font-semibold text-text">Analyze {pendingOpts.maxGames} games?</h3>
      <p className="mt-2 text-sm text-text-dim">
        That's well beyond the {REASONABLE_GAMES} games we'd normally expect - fetching and
        processing that many can take a long time (several minutes or more) and puts real load
        on the analysis service. Continue anyway?
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setPendingOpts(null)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-dim hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onAnalyze(pendingOpts);
            setPendingOpts(null);
          }}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
        >
          Yes, continue
        </button>
      </div>
    </Modal>
  );

  if (lichessConnected === false) {
    return (
      <div className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center">
        <p className="text-sm text-text-dim">
          Connect Lichess to see how your style and skill compare to players like you.
        </p>
        <Link
          href="/dashboard/profile"
          className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          Connect Lichess
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center">
        <p className="text-sm text-text-dim">
          {lichessConnected === null
            ? "Checking your account…"
            : "Analyze your recent blitz games to see your style, skill, and what to train next."}
        </p>
        {lichessConnected && (
          <>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => requestAnalyze({ maxGames })}
                disabled={status === "loading"}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {status === "loading" ? "Analyzing… (this can take a minute)" : "Analyze my games"}
              </button>
              <input
                type="number"
                min={10}
                value={maxGamesInput}
                onChange={(e) => setMaxGamesInput(e.target.value)}
                placeholder="auto"
                title="How many recent games to analyze. Leave blank to match the size of your imported game history."
                className="w-16 rounded-md border border-border bg-transparent px-2 py-2 text-center text-sm text-text placeholder:text-text-faint"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-text-faint">
              Games to analyze — leave blank to match your imported game history.
            </p>
          </>
        )}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        {confirmDialog}
      </div>
    );
  }

  const computedAt = new Date(profile.computed_at);
  const stale = isStale(profile, profile.source.games_analyzed, computedAt);

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-text-faint">
      <span>
        Last analyzed {computedAt.toLocaleDateString()} · {profile.source.games_analyzed} games
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={10}
          value={maxGamesInput}
          onChange={(e) => setMaxGamesInput(e.target.value)}
          placeholder="auto"
          title="How many recent games to analyze on refresh. Leave blank to match the size of your imported game history."
          className="w-14 rounded-md border border-border bg-transparent px-1.5 py-1 text-center text-xs text-text placeholder:text-text-faint"
        />
        <button
          type="button"
          onClick={() => requestAnalyze({ force: true, maxGames })}
          disabled={status === "loading"}
          className={`rounded-md border px-2.5 py-1 font-medium transition disabled:opacity-50 ${
            stale ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"
          }`}
        >
          {status === "loading" ? "Refreshing…" : stale ? "Refresh (new games available)" : "Refresh"}
        </button>
      </div>
      {confirmDialog}
    </div>
  );
}
