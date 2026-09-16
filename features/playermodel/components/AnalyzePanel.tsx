"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiSettings } from "react-icons/fi";
import Modal from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { PERF_TYPES } from "@/features/lichess/useLichessFetchOptions";
import type { AnalyzeOptions, AnalyzeStatus } from "../usePlayerProfile";
import type { PlayerProfileData } from "../types";

// Speeds with their own real reference population/skill+style models today
// (ml/config.yaml's `formats`) - picking another speed still runs real
// per-game analysis, but the skill/style/cohort sections end up compared
// against one of these instead of same-speed peers. The server already
// adds a caveat for this; this is just for a clear inline note next to the
// picker itself, before someone runs the analysis.
const SPEEDS_WITH_REFERENCE = ["blitz", "bullet"];
const REFERENCE_NOTE =
  "Only blitz and bullet have their own reference population - other speeds still get real per-game charts, but skill/style comparisons are made against one of those.";

// Chess.com's own per-game time_class values (its API has no "classical" -
// that's a Lichess-only bucket, and Lichess has no "daily").
const CHESSCOM_PERF_TYPES = ["bullet", "blitz", "rapid", "daily"] as const;

// The reference population is built entirely from Lichess data (see
// ml/service/profile.py's provider branch), so a chess.com analysis only
// ever gets its own per-game charts - never skill/style/cohort.
const CHESSCOM_SELF_ONLY_NOTE =
  "Chess.com games only get your own per-game charts (accuracy, complexity, win rate, openings) - skill, style, and cohort comparisons aren't available since the reference population is built from Lichess data.";

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

// A plain "Refreshing…" reads as stuck once a big request runs into
// minutes, not seconds - say how many games and set real expectations.
// Real progress (games actually processed so far) beats a static guess
// once the job has reported any, since chunked analysis means the
// number keeps moving instead of sitting at 0% the whole time.
function loadingCopy(
  verb: "Analyzing" | "Refreshing",
  count: number | null,
  progress?: { processed: number; total: number } | null,
): string {
  if (progress && progress.total > 0) {
    return `${verb} ${progress.processed}/${progress.total} games…`;
  }
  if (count && count > REASONABLE_GAMES) {
    return `${verb} ${count} games… this can take a few minutes`;
  }
  return verb === "Analyzing" ? "Analyzing… (this can take a minute)" : "Refreshing…";
}

export function AnalyzePanel({
  profile,
  status,
  error,
  progress,
  onAnalyze,
}: {
  profile: PlayerProfileData | null;
  status: AnalyzeStatus;
  error: string | null;
  progress?: { processed: number; total: number } | null;
  onAnalyze: (opts?: AnalyzeOptions) => void;
}) {
  const [lichessConnected, setLichessConnected] = useState<boolean | null>(null);
  const [chessComConnected, setChessComConnected] = useState<boolean | null>(null);
  // Blank = let the server default to the size of the user's imported game
  // history; typing a number here overrides that for this analysis only.
  const [maxGamesInput, setMaxGamesInput] = useState("");
  const [timeClass, setTimeClass] = useState<string>("blitz");
  const [source, setSource] = useState<"lichess" | "chesscom">("lichess");
  const [sourceInitialized, setSourceInitialized] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const maxGames = maxGamesInput.trim() ? Number(maxGamesInput) : undefined;
  const [pendingOpts, setPendingOpts] = useState<AnalyzeOptions | null>(null);
  // How many games the in-flight request is actually for, so the loading
  // label can say so - null when unknown (blank input defers to whatever
  // the server sizes it to).
  const [activeCount, setActiveCount] = useState<number | null>(null);

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
    fetch("/api/chesscom/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setChessComConnected(Boolean(d?.username));
      })
      .catch(() => {
        if (!cancelled) setChessComConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Default to whichever account is actually connected - Lichess first if
  // both are - but only once, right after both checks resolve, so it
  // never clobbers a source the user picked by hand.
  useEffect(() => {
    if (sourceInitialized || lichessConnected === null || chessComConnected === null) return;
    setSource(lichessConnected ? "lichess" : "chesscom");
    setSourceInitialized(true);
  }, [sourceInitialized, lichessConnected, chessComConnected]);

  const accountsLoaded = lichessConnected !== null && chessComConnected !== null;
  const anyConnected = Boolean(lichessConnected || chessComConnected);
  const bothConnected = Boolean(lichessConnected && chessComConnected);
  const perfTypes = source === "chesscom" ? CHESSCOM_PERF_TYPES : PERF_TYPES;
  const referenceNote = source === "chesscom" ? CHESSCOM_SELF_ONLY_NOTE : REFERENCE_NOTE;

  function requestAnalyze(opts?: AnalyzeOptions) {
    if (opts?.maxGames && opts.maxGames > REASONABLE_GAMES) {
      setPendingOpts(opts);
      return;
    }
    setActiveCount(opts?.maxGames ?? null);
    onAnalyze(opts);
  }

  const optionsRow = showOptions && (
    <div className="flex flex-col items-end gap-1.5 text-xs text-text-dim">
      {bothConnected && (
        <div className="flex items-center gap-2">
          <label htmlFor="source-select">Source</label>
          <select
            id="source-select"
            value={source}
            onChange={(e) => {
              const next = e.target.value as "lichess" | "chesscom";
              setSource(next);
              if (!CHESSCOM_PERF_TYPES.includes(timeClass as (typeof CHESSCOM_PERF_TYPES)[number]) && next === "chesscom") {
                setTimeClass("blitz");
              }
            }}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-text"
          >
            <option value="lichess" className="bg-surface">
              Lichess
            </option>
            <option value="chesscom" className="bg-surface">
              Chess.com
            </option>
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor="time-class-select">Speed</label>
        <Tooltip text={referenceNote} width="w-64">
          <select
            id="time-class-select"
            value={timeClass}
            onChange={(e) => setTimeClass(e.target.value)}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-text"
          >
            {perfTypes.map((p) => (
              <option key={p} value={p} className="bg-surface">
                {p}
              </option>
            ))}
          </select>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="max-games-input">Games to analyze</label>
        <Tooltip text="How many recent games to analyze. Leave blank to match the size of your imported game history." width="w-56">
          <input
            id="max-games-input"
            type="number"
            min={10}
            value={maxGamesInput}
            onChange={(e) => setMaxGamesInput(e.target.value)}
            placeholder="auto"
            className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-center text-xs text-text placeholder:text-text-faint"
          />
        </Tooltip>
        <span className="text-text-faint">leave blank to match your imported history</span>
      </div>
      {source === "chesscom" ? (
        <span className="max-w-64 text-right text-text-faint">{CHESSCOM_SELF_ONLY_NOTE}</span>
      ) : (
        !SPEEDS_WITH_REFERENCE.includes(timeClass) && (
          <span className="max-w-64 text-right text-text-faint">{REFERENCE_NOTE}</span>
        )
      )}
    </div>
  );

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
            setActiveCount(pendingOpts.maxGames ?? null);
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

  if (accountsLoaded && !anyConnected) {
    return (
      <div className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center">
        <p className="text-sm text-text-dim">
          Connect Lichess or chess.com to see how your style and skill compare to players like you.
        </p>
        <Link
          href="/dashboard/profile"
          className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          Connect an account
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-border-soft bg-surface px-4 py-6 text-center">
        <p className="text-sm text-text-dim">
          {!accountsLoaded
            ? "Checking your account…"
            : `Analyze your recent ${timeClass} games to see your style, skill, and what to train next.`}
        </p>
        {anyConnected && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => requestAnalyze({ maxGames, timeClass, source })}
                disabled={status === "loading"}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {status === "loading" ? loadingCopy("Analyzing", activeCount, progress) : "Analyze my games"}
              </button>
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                aria-label="Analysis options"
                aria-expanded={showOptions}
                className={`rounded-lg border p-2 transition ${
                  showOptions ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"
                }`}
              >
                <FiSettings size={16} />
              </button>
            </div>
            {optionsRow}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        {confirmDialog}
      </div>
    );
  }

  const computedAt = new Date(profile.computed_at);
  const stale = isStale(profile, profile.source.games_analyzed, computedAt);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-text-faint">
        <span>
          Last analyzed {computedAt.toLocaleDateString()} · {profile.source.games_analyzed} games
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            aria-label="Analysis options"
            aria-expanded={showOptions}
            className={`rounded-md border p-1.5 transition ${
              showOptions ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"
            }`}
          >
            <FiSettings size={13} />
          </button>
          <button
            type="button"
            onClick={() => requestAnalyze({ force: true, maxGames, timeClass, source })}
            disabled={status === "loading"}
            className={`rounded-md border px-2.5 py-1 font-medium transition disabled:opacity-50 ${
              stale ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"
            }`}
          >
            {status === "loading" ? loadingCopy("Refreshing", activeCount, progress) : stale ? "Refresh (new games available)" : "Refresh"}
          </button>
        </div>
      </div>
      {showOptions && <div className="flex justify-end">{optionsRow}</div>}
      {error && <p className="text-right text-xs text-bad">{error}</p>}
      {confirmDialog}
    </div>
  );
}
