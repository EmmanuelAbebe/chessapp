import StatisticsSummary from "@/features/statistics/components/StatisticsSummary";

export default function StatisticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-text">Statistics</h1>
      <StatisticsSummary />
    </div>
  );
}
