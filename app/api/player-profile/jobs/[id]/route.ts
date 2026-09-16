import { auth } from "@/auth";
import { fillCoaching, saveProfile } from "@/features/playermodel/server/shared";
import { getJob, markSaved } from "@/features/playermodel/server/jobStore";

export const dynamic = "force-dynamic";

/** Polls a job started by POST /api/player-profile/jobs. Returns the ml
 * service's status verbatim (status/games_processed/games_total/profile/
 * error) - `profile` is a real partial snapshot once enough of the
 * request has been folded in, not just a percentage. On the first poll
 * that reports "done", saves the final profile (with coaching text
 * filled in) exactly like the single-shot route does, then never saves
 * again for this job. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Not signed in", { status: 401 });

  const { id } = await params;
  const meta = getJob(id);
  if (!meta || meta.userId !== userId) {
    return new Response("Job not found", { status: 404 });
  }

  const serviceUrl = process.env.PLAYERMODEL_SERVICE_URL;
  if (!serviceUrl) {
    return new Response(
      "Player-model service not configured (PLAYERMODEL_SERVICE_URL missing)",
      { status: 503 },
    );
  }

  const serviceRes = await fetch(`${serviceUrl.replace(/\/$/, "")}/profile/jobs/${id}`, {
    headers: process.env.PLAYERMODEL_SERVICE_TOKEN
      ? { "X-Service-Token": process.env.PLAYERMODEL_SERVICE_TOKEN }
      : {},
  });
  if (!serviceRes.ok) {
    const detail = await serviceRes.text().catch(() => "");
    return new Response(detail || "Player-model service error", { status: serviceRes.status });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (await serviceRes.json()) as Record<string, any>;

  if (status.status === "done" && status.profile && !meta.savedFinal) {
    status.profile.critical_lessons = await fillCoaching(
      status.profile.critical_lessons ?? [],
      meta.provider, meta.apiKey, meta.model,
    );
    await saveProfile(meta.userId, status.profile, meta.gamesHash);
    markSaved(id);
  }

  return Response.json(status);
}
