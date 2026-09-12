import type {} from "react/canary";
import { ViewTransition } from "react";
import { auth } from "@/auth";
import { getPlayerProfile } from "@/features/playermodel/data";
import { StatisticsPageClient } from "@/features/statistics/components/StatisticsPageClient";

export default async function StatisticsPage() {
  const session = await auth(); // non-null: DashboardLayout already redirected otherwise
  const profileRow = await getPlayerProfile(session!.user.id);

  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <StatisticsPageClient initialProfile={profileRow?.data ?? null} />
    </ViewTransition>
  );
}
