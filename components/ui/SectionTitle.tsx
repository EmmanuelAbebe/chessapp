import type { ReactNode } from "react";

export default function SectionTitle({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="sticky top-14 z-10 border-b border-neutral-800 bg-background pb-3 text-2xl font-bold tracking-tight text-white"
    >
      {children}
    </h2>
  );
}
