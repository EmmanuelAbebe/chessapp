import { STATS } from "../data";

export default function StatisticsSummary() {
  return (
    <section aria-labelledby="statistics-heading">
      <h2
        id="statistics-heading"
        className="border-b border-neutral-800 pb-3 text-2xl font-bold tracking-tight text-white"
      >
        Statistics
      </h2>

      <dl className="mt-4 grid max-w-sm grid-cols-3 gap-4 text-center">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <dd className="text-2xl font-bold">{stat.value}</dd>
            <dt className="text-xs text-neutral-500">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
