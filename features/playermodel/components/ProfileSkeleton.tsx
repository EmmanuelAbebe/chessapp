function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-raised ${className ?? ""}`} />;
}

/** Placeholder shapes matching ProfileHero/StyleAxes/WhereYouDiffer's rough
 * layout, shown while the very first analysis is running - a minute of
 * "Analyzing…" as the only button-text change with nothing else on the
 * page moving reads as broken, not busy. */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="rounded-lg border border-border-soft bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Block className="h-3 w-24" />
            <Block className="h-8 w-20" />
          </div>
          <Block className="h-8 w-56" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          <Block className="h-40 w-40 rounded-full" />
          <Block className="h-28 w-28 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5">
        <Block className="h-3 w-20" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Block className="h-3 w-full" />
            <Block className="h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block className="h-48 w-full" />
        <Block className="h-48 w-full" />
      </div>
    </div>
  );
}
