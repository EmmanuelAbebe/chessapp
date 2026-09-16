import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LichessNotConnectedError } from "@/features/lichess/api";
import { ChessComNotConnectedError } from "@/features/chesscom/api";
import { fetchGamesForSource, fillCoaching, resolveMaxGames, saveProfile, type GamesSource } from "@/features/playermodel/server/shared";
import type { AiProvider } from "@/features/settings/ai-provider-types";

export const dynamic = "force-dynamic";

type PostBody = {
  timeClass?: string;
  force?: boolean;
  /** How many games to fetch/analyze. Omit to default to the size of the
   * user's own imported game history (features/history) - if they imported
   * 100 games, the profile analyzes ~100 too, instead of a fixed number
   * unrelated to what they actually brought in. */
  maxGames?: number;
  /** Which connected account to pull games from - defaults to "lichess". */
  source?: GamesSource;
  // Same BYO-key pattern as /api/coach - used only in-memory, for this one
  // request, to phrase each focus area's coaching text. Never persisted;
  // the stored PlayerProfile.data keeps whatever coaching text (or null)
  // resulted, same as any other field.
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
};

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Not signed in", { status: 401 });

  const row = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!row) return new Response("No profile yet", { status: 404 });
  return Response.json(row.data);
}

/** Single-shot analysis - blocks until the whole request is done. Fine
 * for the common case (tens to a couple hundred games, done in seconds
 * to low minutes). For anything large enough to want progress or partial
 * results, the client uses /api/player-profile/jobs instead. */
export async function POST(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Not signed in", { status: 401 });

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const timeClass = body.timeClass ?? "blitz";
  const source: GamesSource = body.source === "chesscom" ? "chesscom" : "lichess";

  const maxGames = await resolveMaxGames(userId, body.maxGames);

  let pgn: string;
  let username: string;
  try {
    ({ pgn, username } = await fetchGamesForSource(source, timeClass, maxGames));
  } catch (err) {
    if (err instanceof LichessNotConnectedError || err instanceof ChessComNotConnectedError) {
      return new Response(err.message, { status: 400 });
    }
    return new Response(`Could not fetch games from ${source}: ${(err as Error).message}`, { status: 502 });
  }

  const gamesHash = createHash("sha1").update(pgn).digest("hex");

  const existing = await prisma.playerProfile.findUnique({ where: { userId } });
  if (existing && existing.gamesHash === gamesHash && !body.force) {
    return Response.json(existing.data);
  }

  const serviceUrl = process.env.PLAYERMODEL_SERVICE_URL;
  if (!serviceUrl) {
    return new Response(
      "Player-model service not configured (PLAYERMODEL_SERVICE_URL missing)",
      { status: 503 },
    );
  }

  const serviceRes = await fetch(`${serviceUrl.replace(/\/$/, "")}/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PLAYERMODEL_SERVICE_TOKEN
        ? { "X-Service-Token": process.env.PLAYERMODEL_SERVICE_TOKEN }
        : {}),
    },
    // `provider` here is the games' site of origin, as the ml service's
    // ProfileRequest schema names it - unrelated to body.provider, which
    // is the AI provider used below for coaching text.
    body: JSON.stringify({ games_pgn: pgn, username, time_class: timeClass, provider: source }),
  });

  if (!serviceRes.ok) {
    const detail = await serviceRes.text().catch(() => "");
    return new Response(detail || "Player-model service error", { status: serviceRes.status });
  }

  const profile = await serviceRes.json();
  profile.focus_areas = await fillCoaching(
    profile.focus_areas ?? [],
    body.provider,
    body.apiKey,
    body.model,
  );

  await saveProfile(userId, profile, gamesHash);

  return Response.json(profile);
}
