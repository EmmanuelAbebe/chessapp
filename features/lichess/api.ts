import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const LICHESS_ORIGIN = "https://lichess.org";

/** Thrown when the signed-in user has no usable Lichess OAuth link -
 * either they've never signed in with Lichess, the link was removed, or
 * the stored token has expired (Lichess tokens last ~1 year and can't be
 * refreshed, so the fix is always "sign in with Lichess again"). */
export class LichessNotConnectedError extends Error {
  constructor(message = "No Lichess account is linked to this user") {
    super(message);
    this.name = "LichessNotConnectedError";
  }
}

type LichessLink = {
  token: string;
  /** Lichess user id (lowercased username) - usable directly as the
   * `user` path segment in game-export URLs, which are case-insensitive. */
  username: string;
  scope: string | null;
};

/** The stored Lichess OAuth account row for a user, or null. Auth.js
 * persists this via the Prisma adapter even under the JWT session
 * strategy, so the access token is available server-side here. */
export async function getLichessAccount(userId: string) {
  return prisma.account.findFirst({
    where: { userId, provider: "lichess" },
    select: {
      access_token: true,
      scope: true,
      expires_at: true,
      providerAccountId: true,
    },
  });
}

/** Resolves the current session's Lichess token, or throws
 * LichessNotConnectedError. */
export async function requireLichessLink(): Promise<LichessLink> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new LichessNotConnectedError("Not signed in");

  const account = await getLichessAccount(userId);
  if (!account?.access_token) throw new LichessNotConnectedError();

  if (account.expires_at && account.expires_at * 1000 <= Date.now()) {
    throw new LichessNotConnectedError("Lichess token expired - sign in again");
  }

  return {
    token: account.access_token,
    username: account.providerAccountId,
    scope: account.scope,
  };
}

/** Fetch the Lichess API as the current user. `path` is relative to
 * https://lichess.org (e.g. "/api/account/playing"). The OAuth token is
 * attached server-side and never leaves this process. */
export async function lichessFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { token } = await requireLichessLink();
  return fetch(`${LICHESS_ORIGIN}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
}
