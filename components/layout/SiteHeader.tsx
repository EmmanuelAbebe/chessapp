"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaChessBoard, FaPlus, FaUser } from "react-icons/fa6";

const NAV_LINKS = [
  { href: "/board", label: "Board", icon: FaChessBoard },
  { href: "/dashboard", label: "Dashboard", icon: FaUser },
];

export function SiteHeader() {
  const pathname = usePathname();
  const visibleLinks = NAV_LINKS.filter(
    (link) => pathname !== link.href && !pathname.startsWith(`${link.href}/`),
  );

  const [isDialOpen, setIsDialOpen] = useState(false);
  const dialRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click/tap and on Escape - standard menu-dismissal
  // behavior, needed since the dial has no backdrop of its own.
  useEffect(() => {
    if (!isDialOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (dialRef.current && !dialRef.current.contains(event.target as Node)) {
        setIsDialOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsDialOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDialOpen]);

  // Selecting a link navigates - collapse the dial once the route changes.
  useEffect(() => {
    setIsDialOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full bg-transparent">
      <nav
        aria-label="Primary"
        className="container mx-auto flex h-14 items-center gap-3 px-4 sm:px-6"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          CoachMeChess
        </Link>

        <ul className="hidden items-center gap-1 sm:flex">
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

        <div ref={dialRef} className="relative sm:hidden">
          <ul className="absolute top-full right-0 mt-2 flex flex-col items-end gap-2">
            {visibleLinks.map((link, index) => {
              const Icon = link.icon;

              return (
                <li
                  key={link.href}
                  className={`flex items-center gap-2 transition-all duration-200 ease-out ${
                    isDialOpen
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-2 opacity-0"
                  }`}
                  style={{
                    transitionDelay: isDialOpen ? `${index * 40}ms` : "0ms",
                  }}
                >
                  <span className="rounded-md border border-white/10 bg-surface px-2 py-1 text-xs text-text-dim shadow-lg">
                    {link.label}
                  </span>
                  <Link
                    href={link.href}
                    aria-label={link.label}
                    tabIndex={isDialOpen ? 0 : -1}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface text-text-dim shadow-lg transition hover:text-text"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => setIsDialOpen((open) => !open)}
            aria-label={isDialOpen ? "Close menu" : "Open menu"}
            aria-expanded={isDialOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface text-text-dim shadow-lg transition hover:text-text"
          >
            <FaPlus
              className={`h-4 w-4 transition-transform duration-200 ease-out ${
                isDialOpen ? "rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </nav>
    </header>
  );
}
