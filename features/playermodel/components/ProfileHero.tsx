import type { PlayerProfileData } from "../types";
import { SkillRadar } from "./SkillRadar";
import { ConfidenceGauge } from "./ConfidenceGauge";

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

      <div className="mt-4 flex flex-wrap items-center justify-center gap-8">
        <SkillRadar sub={skill.sub} />
        <ConfidenceGauge confidence={skill.confidence} gamesAnalyzed={source.games_analyzed} />
      </div>

      <p className="mt-3 text-xs text-text-faint">
        {source.games_analyzed} {source.time_class} games
        {source.date_range ? ` · ${source.date_range[0]} – ${source.date_range[1]}` : ""}
      </p>
    </div>
  );
}
