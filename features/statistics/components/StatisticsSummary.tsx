import { STATS } from "../data";

export default function StatisticsSummary() {
  return (
    <section>
      <dl className="grid max-w-sm grid-cols-3 gap-4 text-center">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <dd className="text-2xl font-bold">{stat.value}</dd>
            <dt className="text-xs text-text-faint">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
