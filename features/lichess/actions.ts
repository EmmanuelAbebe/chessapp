"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Unlinks the Lichess account from the signed-in user: revokes the token
 * on Lichess's side, then deletes the stored row so the API helpers and
 * "import my games" stop working until they connect again. */
export async function disconnectLichess() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  const account = await prisma.account.findFirst({
    where: { userId, provider: "lichess" },
    select: { access_token: true },
  });

  if (account?.access_token) {
    try {
      await fetch("https://lichess.org/api/token", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${account.access_token}` },
      });
    } catch {
      // Best-effort - still drop our copy even if the revoke call fails.
    }
  }

  await prisma.account.deleteMany({ where: { userId, provider: "lichess" } });

  revalidatePath("/dashboard/profile");
}
