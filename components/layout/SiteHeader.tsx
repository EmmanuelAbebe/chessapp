"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaChessBoard, FaUser } from "react-icons/fa6";

const NAV_LINKS = [
  { href: "/board", label: "Board", icon: FaChessBoard },
  { href: "/dashboard", label: "Dashboard", icon: FaUser },
];

export function SiteHeader() {
  const pathname = usePathname();
  const visibleLinks = NAV_LINKS.filter((link) => link.href !== pathname);

  return (
    <header className="sticky top-0 z-40 w-full bg-transparent">
      <nav
        aria-label="Primary"
        className="container mx-auto flex h-14 items-center gap-3 px-4 sm:px-6"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          CoachMeChess
        </Link>

        <ul className="flex items-center gap-1">
          {visibleLinks.map((link) => {
            const Icon = link.icon;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-label={link.label}
                  title={link.label}
                  className="flex items-center justify-center rounded-md p-2 text-text-dim transition hover:bg-white/10 hover:text-text"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
