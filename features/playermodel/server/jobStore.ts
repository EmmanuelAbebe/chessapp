import type { AiProvider } from "@/features/settings/ai-provider-types";

// Maps a job id (the ml service's) to what the poll route needs to save
// the finished profile - which user it belongs to, the gamesHash to
// dedupe against, and the BYO AI key to fill in coaching text once, on
// the final snapshot only. In-memory: fine for this single Next.js dev
// process, same as the ml service's own job store - doesn't survive a
// restart, and wouldn't survive multiple serverless instances either.

type JobMeta = {
  userId: string;
  username: string;
  timeClass: string;
  gamesHash: string;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  savedFinal: boolean;
  createdAt: number;
};

const JOB_TTL_MS = 60 * 60 * 1000;
const jobs = new Map<string, JobMeta>();

function purgeStale() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, meta] of jobs) {
    if (meta.createdAt < cutoff) jobs.delete(id);
  }
}

export function registerJob(
  jobId: string,
  meta: Omit<JobMeta, "createdAt" | "savedFinal">,
): void {
  purgeStale();
  jobs.set(jobId, { ...meta, createdAt: Date.now(), savedFinal: false });
}

export function getJob(jobId: string): JobMeta | undefined {
  return jobs.get(jobId);
}

export function markSaved(jobId: string): void {
  const meta = jobs.get(jobId);
  if (meta) meta.savedFinal = true;
}
