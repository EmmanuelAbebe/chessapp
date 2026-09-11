import type {} from "react/canary";
import { ViewTransition } from "react";
import { auth } from "@/auth";
import { getPlayerProfile } from "@/features/playermodel/data";
import { PlayerModelSection } from "@/features/playermodel/components/PlayerModelSection";
import StatisticsSummary from "@/features/statistics/components/StatisticsSummary";

export default async function StatisticsPage() {
  const session = await auth(); // non-null: DashboardLayout already redirected otherwise
  const profileRow = await getPlayerProfile(session!.user.id);

  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="mb-6 text-xl font-bold text-text">Statistics</h1>
          <PlayerModelSection initialProfile={profileRow?.data ?? null} />
        </div>

        <div className="border-t border-border-soft pt-6">
          <h2 className="mb-6 text-lg font-bold text-text">The numbers</h2>
          <StatisticsSummary />
        </div>
      </div>
    </ViewTransition>
  );
}
