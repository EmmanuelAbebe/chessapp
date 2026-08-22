"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "../data";

export default function AccountNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard sections"
      className="md:sticky md:top-14 md:w-40 md:shrink-0"
    >
      <ul className="flex gap-1 overflow-x-auto text-sm md:flex-col md:overflow-visible">
        {SECTIONS.map((section) => {
          const isActive = pathname === section.href;
          const Icon = section.icon;
          return (
            <li key={section.href} className="shrink-0">
              <Link
                href={section.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-l-md whitespace-nowrap transition ${
                  isActive
                    ? "border border-r-0 border-white/10 bg-surface px-4 py-3 font-semibold text-text shadow-lg md:-mr-px"
                    : "px-3 py-1.5 text-text-faint hover:bg-surface-raised hover:text-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
