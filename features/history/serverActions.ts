"use server";

// DB-backed mirror of useGameHistory's localStorage store, for signed-in
// users - lets game history follow the account across devices/browsers
// instead of staying trapped in one machine's localStorage. Anonymous use
// is unaffected: every action here no-ops (returns empty / does nothing)
// when there's no session, and the localStorage copy remains the source of
// truth on that path.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { GameHistoryEntry } from "./types";

function toEntry(row: {
  id: string;
  source: string;
  playedAt: Date;
  playerSide: string;
  result: string;
  opponentName: string | null;
  timeControl: string | null;
  meta: unknown;
  moves: unknown;
  fingerprint: string;
}): GameHistoryEntry {
  return {
    id: row.id,
    source: row.source as GameHistoryEntry["source"],
    playedAt: row.playedAt.getTime(),
    playerSide: row.playerSide as GameHistoryEntry["playerSide"],
    result: row.result as GameHistoryEntry["result"],
    opponentName: row.opponentName ?? undefined,
    timeControl: row.timeControl ?? undefined,
    meta: (row.meta as GameHistoryEntry["meta"]) ?? undefined,
    moves: row.moves as GameHistoryEntry["moves"],
    fingerprint: row.fingerprint,
  };
}

/** Every game recorded for the signed-in user - `[]` when signed out. */
export async function getGameHistoryServer(): Promise<GameHistoryEntry[]> {
  const userId = (await auth())?.user?.id;
  if (!userId) return [];
  const rows = await prisma.gameRecord.findMany({ where: { userId } });
  return rows.map(toEntry);
}

/** Upserts each entry by (userId, fingerprint) - a re-import that backfills
 * richer meta onto an already-stored game just overwrites that row, same
 * "enrich, don't duplicate" behaviour useGameHistory's own addEntries has.
 * No-ops (returns 0) when signed out. Returns how many were newly created. */
export async function saveGameHistoryServer(entries: GameHistoryEntry[]): Promise<number> {
  const userId = (await auth())?.user?.id;
  if (!userId || entries.length === 0) return 0;

  const existing = new Set(
    (
      await prisma.gameRecord.findMany({
        where: { userId, fingerprint: { in: entries.map((e) => e.fingerprint) } },
        select: { fingerprint: true },
      })
    ).map((r) => r.fingerprint),
  );

  for (const entry of entries) {
    await prisma.gameRecord.upsert({
      where: { userId_fingerprint: { userId, fingerprint: entry.fingerprint } },
      create: {
        userId,
        source: entry.source,
        playedAt: new Date(entry.playedAt),
        playerSide: entry.playerSide,
        result: entry.result,
        opponentName: entry.opponentName,
        timeControl: entry.timeControl,
        meta: entry.meta ?? undefined,
        moves: entry.moves,
        fingerprint: entry.fingerprint,
      },
      update: {
        // Only overwrite meta/playedAt/timeControl - the "backfill" fields -
        // never the identity fields a fingerprint already pins down.
        meta: entry.meta ?? undefined,
        playedAt: new Date(entry.playedAt),
        timeControl: entry.timeControl,
      },
    });
  }
  return entries.filter((e) => !existing.has(e.fingerprint)).length;
}

export async function clearGameHistoryServer(): Promise<void> {
  const userId = (await auth())?.user?.id;
  if (!userId) return;
  await prisma.gameRecord.deleteMany({ where: { userId } });
}
