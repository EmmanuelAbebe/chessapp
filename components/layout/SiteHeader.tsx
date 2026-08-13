"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaChessBoard, FaHouse, FaUser } from "react-icons/fa6";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: FaHouse },
  { href: "/board", label: "Board", icon: FaChessBoard },
  { href: "/account", label: "Account", icon: FaUser },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-black/10 dark:border-white/10">
      <nav
        aria-label="Primary"
        className="container mx-auto flex items-center gap-3 px-4 py-2 sm:px-6"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Chess AI Coach
        </Link>

        <ul className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-label={link.label}
                  aria-current={isActive ? "page" : undefined}
                  title={link.label}
                  className={`flex items-center justify-center rounded-md p-2 transition ${
                    isActive
                      ? "bg-black/10 text-gray-900 dark:bg-white/10 dark:text-white"
                      : "text-gray-500 hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
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
