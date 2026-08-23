import type {} from "react/canary";
import { ViewTransition } from "react";
import StatisticsSummary from "@/features/statistics/components/StatisticsSummary";

export default function StatisticsPage() {
  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-text">Statistics</h1>
        <StatisticsSummary />
      </div>
    </ViewTransition>
  );
}
