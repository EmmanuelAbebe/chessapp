import type { PlayerProfileData } from "../types";
import { SkillRadar } from "./SkillRadar";
import { HintIcon } from "@/components/ui/HintIcon";

export function ProfileHero({ profile }: { profile: PlayerProfileData }) {
  const { skill, cohort, source } = profile;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-text-faint uppercase">
            Skill estimate
          </p>
          <div className="flex items-baseline gap-2">
            <p className="font-mono text-3xl font-bold text-text">
              {Math.round(skill.overall)}
            </p>
            <span className="flex items-center gap-1 text-[11px] text-text-faint">
              {Math.round(Math.max(0, Math.min(1, skill.confidence)) * 100)}% confidence
              <HintIcon
                text="How many games this rests on: 50+ is treated as fully confident, scaling down linearly below that. Not a measure of how accurate the number is, just how much data went into it."
                width="w-56"
              />
            </span>
          </div>
        </div>
        <p className="max-w-xs text-right text-xs text-text-dim">
          {cohort.description ||
            `Compared against ${cohort.size} players with a similar style, rated ${Math.round(
              cohort.stronger_band[0],
            )}–${Math.round(cohort.stronger_band[1])}.`}
        </p>
      </div>

      <div className="flex justify-center">
        <SkillRadar sub={skill.sub} />
      </div>

      <p className="text-xs text-text-faint">
        {source.games_analyzed} {source.time_class} games
        {source.date_range ? ` · ${source.date_range[0]} – ${source.date_range[1]}` : ""}
      </p>
    </div>
  );
}
