import SectionTitle from "@/components/ui/SectionTitle";
import { STATS } from "../data";

export default function StatisticsSummary() {
  return (
    <section aria-labelledby="statistics-heading">
      <SectionTitle id="statistics-heading">Statistics</SectionTitle>

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
