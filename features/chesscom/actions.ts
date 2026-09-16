"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chessComUsernameExists } from "./api";

export type ConnectChessComResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

/** Verifies `username` is a real chess.com account, then saves it
 * (lowercased - chess.com usernames are case-insensitive) as this user's
 * connection. No OAuth: the whole point of chess.com's public API is that
 * this is the entire "connect" flow - a real account check, not a redirect. */
export async function connectChessCom(username: string): Promise<ConnectChessComResult> {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in" };

  const trimmed = username.trim();
  if (!trimmed) return { ok: false, error: "Enter a chess.com username" };

  let exists: boolean;
  try {
    exists = await chessComUsernameExists(trimmed);
  } catch {
    return { ok: false, error: "Could not reach chess.com - try again in a moment" };
  }
  if (!exists) return { ok: false, error: `No chess.com account named "${trimmed}"` };

  const normalized = trimmed.toLowerCase();
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, settings: {}, aiProvider: {}, chessComUsername: normalized },
    update: { chessComUsername: normalized },
  });

  revalidatePath("/dashboard/profile");
  return { ok: true, username: normalized };
}

/** Drops the saved username. Nothing to revoke server-side (no token was
 * ever issued), unlike disconnectLichess. */
export async function disconnectChessCom(): Promise<void> {
  const userId = (await auth())?.user?.id;
  if (!userId) return;

  await prisma.userSettings.updateMany({
    where: { userId },
    data: { chessComUsername: null },
  });

  revalidatePath("/dashboard/profile");
}
