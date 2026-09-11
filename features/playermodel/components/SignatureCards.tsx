import type { SignatureItem } from "../types";

/** "What makes you unique" - the biggest deviations from same-skill peers,
 * framed as a fingerprint rather than good/bad. */
export function SignatureCards({ items }: { items: SignatureItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">
        What makes you unique
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.feature}
            className="flex flex-col gap-1 rounded-lg border border-border-soft bg-surface p-4"
          >
            <span className="font-mono text-[11px] text-text-faint">
              {item.you} vs {item.peers} typical
            </span>
            <p className="text-sm text-text">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
