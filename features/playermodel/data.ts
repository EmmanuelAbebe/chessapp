import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlayerProfileData } from "./types";

export type PlayerProfileRow = {
  data: PlayerProfileData;
  computedAt: Date;
  gamesCount: number;
};

/** The signed-in user's stored profile, or null if none has been computed
 * yet. Used by /dashboard/statistics for the first paint (no client
 * round-trip needed); features/playermodel/usePlayerProfile.ts re-fetches
 * client-side for the Analyze/Refresh flow. */
export async function getPlayerProfile(userId: string): Promise<PlayerProfileRow | null> {
  const row = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!row) return null;
  return {
    data: row.data as unknown as PlayerProfileData,
    computedAt: row.computedAt,
    gamesCount: row.gamesCount,
  };
}
