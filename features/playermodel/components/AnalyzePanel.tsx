"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";

const STALE_AFTER_DAYS = 30;
const STALE_AFTER_NEW_GAMES = 20;

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
  onAnalyze: (opts?: { force?: boolean }) => void;
}) {
  const [lichessConnected, setLichessConnected] = useState<boolean | null>(null);

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
          <button
            type="button"
            onClick={() => onAnalyze()}
            disabled={status === "loading"}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {status === "loading" ? "Analyzing… (this can take a minute)" : "Analyze my games"}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
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
      <button
        type="button"
        onClick={() => onAnalyze({ force: true })}
        disabled={status === "loading"}
        className={`rounded-md border px-2.5 py-1 font-medium transition disabled:opacity-50 ${
          stale ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"
        }`}
      >
        {status === "loading" ? "Refreshing…" : stale ? "Refresh (new games available)" : "Refresh"}
      </button>
    </div>
  );
}
