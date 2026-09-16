import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LichessNotConnectedError } from "@/features/lichess/api";
import { ChessComNotConnectedError } from "@/features/chesscom/api";
import { fetchGamesForSource, resolveMaxGames, type GamesSource } from "@/features/playermodel/server/shared";
import { registerJob } from "@/features/playermodel/server/jobStore";
import type { AiProvider } from "@/features/settings/ai-provider-types";

export const dynamic = "force-dynamic";

type PostBody = {
  timeClass?: string;
  force?: boolean;
  maxGames?: number;
  /** Which connected account to pull games from - defaults to "lichess". */
  source?: GamesSource;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
};

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

  if (!body.force) {
    const existing = await prisma.playerProfile.findUnique({ where: { userId } });
    if (existing && existing.gamesHash === gamesHash) {
      return Response.json({ done: true, profile: existing.data });
    }
  }

  const serviceUrl = process.env.PLAYERMODEL_SERVICE_URL;
  if (!serviceUrl) return new Response("Player-model service not configured (PLAYERMODEL_SERVICE_URL missing)", { status: 503 });

  const serviceRes = await fetch(`${serviceUrl.replace(/\/$/, "")}/profile/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.PLAYERMODEL_SERVICE_TOKEN ? { "X-Service-Token": process.env.PLAYERMODEL_SERVICE_TOKEN } : {}) },
    // `provider` here is the games' site of origin, as the ml service's
    // ProfileRequest schema names it - unrelated to body.provider, which
    // is the AI provider used for coaching text (see PostBody above and
    // registerJob's call below).
    body: JSON.stringify({ games_pgn: pgn, username, time_class: timeClass, provider: source }),
  });
  if (!serviceRes.ok) {
    const detail = await serviceRes.text().catch(() => "");
    return new Response(detail || "Player-model service error", { status: serviceRes.status });
  }
  const { job_id: jobId } = (await serviceRes.json()) as { job_id: string };

  registerJob(jobId, { userId, username, timeClass, gamesHash, provider: body.provider, apiKey: body.apiKey, model: body.model });

  return Response.json({ done: false, jobId });
}
