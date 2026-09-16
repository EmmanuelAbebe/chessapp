import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CHESSCOM_ORIGIN = "https://api.chess.com/pub";
// Chess.com's public API has no hard requirement for one, but their own
// docs recommend it and it's cheap insurance against being rate-limited
// as an unidentified client.
const USER_AGENT = "CoachMeChess/1.0 (+https://github.com/EmmanuelAbebe/chessapp)";

/** Thrown when the signed-in user has no chess.com username saved - either
 * they've never connected one, or they disconnected it. Unlike Lichess
 * there's no token to expire: chess.com's game-archive API is public, so
 * "connected" just means "we have a verified username on file". */
export class ChessComNotConnectedError extends Error {
  constructor(message = "No chess.com account is linked to this user") {
    super(message);
    this.name = "ChessComNotConnectedError";
  }
}

/** The saved username for a user, or null. Stored on UserSettings, not an
 * Account row - see prisma/schema.prisma's comment on chessComUsername. */
export async function getChessComUsername(userId: string): Promise<string | null> {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { chessComUsername: true },
  });
  return row?.chessComUsername ?? null;
}

/** Resolves the current session's chess.com username, or throws
 * ChessComNotConnectedError. */
export async function requireChessComUsername(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new ChessComNotConnectedError("Not signed in");

  const username = await getChessComUsername(userId);
  if (!username) throw new ChessComNotConnectedError();
  return username;
}

/** Fetch the chess.com public API. `path` is relative to
 * https://api.chess.com/pub (e.g. "/player/hikaru"). No auth token - the
 * whole API is public - but every call goes through here so the
 * User-Agent stays consistent. */
export async function chessComFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${CHESSCOM_ORIGIN}${path}`, {
    ...init,
    headers: { ...init.headers, "User-Agent": USER_AGENT },
  });
}

/** True if `username` is a real chess.com account - used to validate
 * before saving a connection, the same "does this exist" check Lichess's
 * OAuth flow gets for free by construction. */
export async function chessComUsernameExists(username: string): Promise<boolean> {
  const res = await chessComFetch(`/player/${encodeURIComponent(username.trim().toLowerCase())}`);
  return res.ok;
}

export type ChessComProfile = {
  username: string;
  title: string | null;
  url: string;
  avatar: string | null;
};

/** The public profile chess.com has on file for `username`, or null if it
 * doesn't exist / the API call failed. */
export async function fetchChessComProfile(username: string): Promise<ChessComProfile | null> {
  const res = await chessComFetch(`/player/${encodeURIComponent(username)}`);
  if (!res.ok) return null;
  const p = await res.json();
  return {
    username: p.username as string,
    title: (p.title as string | undefined) ?? null,
    url: (p.url as string | undefined) ?? `https://www.chess.com/member/${p.username}`,
    avatar: (p.avatar as string | undefined) ?? null,
  };
}
