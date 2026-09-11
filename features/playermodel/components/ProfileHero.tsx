import type { PlayerProfileData } from "../types";

const SUB_LABELS: Record<string, string> = {
  tactical: "Tactical",
  positional: "Positional",
  endgame: "Endgame",
  clock: "Time management",
};

export function ProfileHero({ profile }: { profile: PlayerProfileData }) {
  const { skill, cohort, source } = profile;
  return (
    <div className="rounded-lg border border-border-soft bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-text-faint uppercase">
            Skill estimate
          </p>
          <p className="font-mono text-3xl font-bold text-text">
            {Math.round(skill.overall)}
          </p>
        </div>
        <p className="max-w-xs text-right text-xs text-text-dim">
          {cohort.description ||
            `Compared against ${cohort.size} players with a similar style, rated ${Math.round(
              cohort.stronger_band[0],
            )}–${Math.round(cohort.stronger_band[1])}.`}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {Object.entries(skill.sub).map(([key, sub]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-text-dim">
              {SUB_LABELS[key] ?? key}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <span
                className="block h-full rounded-full bg-accent/70"
                style={{ width: `${Math.max(4, Math.min(100, ((sub.score - 600) / 1800) * 100))}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-text-faint">
              {Math.round(sub.score)}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-faint">
        Based on {source.games_analyzed} {source.time_class} games
        {source.date_range ? ` (${source.date_range[0]} – ${source.date_range[1]})` : ""} ·
        <span
          title="How many games this estimate rests on: 50+ games is treated as fully confident, and confidence scales down linearly below that. It's not a measure of how accurate the number is, just how much data went into it."
        >
          {" "}
          confidence {Math.round(skill.confidence * 100)}%
        </span>
      </p>
    </div>
  );
}
