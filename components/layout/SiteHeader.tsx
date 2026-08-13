"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/account", label: "Account" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-black/10 dark:border-white/10">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Chess AI Coach
        </Link>

        <ul className="flex items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 transition hover:bg-black/5 dark:hover:bg-white/10 ${
                    isActive ? "font-medium underline underline-offset-4" : "opacity-80"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
