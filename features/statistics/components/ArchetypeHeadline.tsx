import type { Archetype } from "../lib/traits";

export function ArchetypeHeadline({ archetype }: { archetype: Archetype }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-text">{archetype.title}</h2>
      <p className="mt-1 text-sm text-text-dim">{archetype.blurb}</p>
    </div>
  );
}
