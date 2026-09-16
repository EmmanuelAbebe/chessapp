function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-raised ${className ?? ""}`} />;
}

/** Placeholder shapes matching StyleAxes/ComplexityByMove/CriticalLessons'
 * rough layout, shown while the very first analysis is running - a minute
 * of "Analyzing…" as the only button-text change with nothing else on the
 * page moving reads as broken, not busy. */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5">
        <Block className="h-3 w-20" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Block className="h-3 w-full" />
            <Block className="h-3 w-full" />
          </div>
        ))}
      </div>

      <Block className="h-40 w-full" />

      <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5">
        <Block className="h-3 w-32" />
        {[0, 1, 2].map((i) => (
          <Block key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
