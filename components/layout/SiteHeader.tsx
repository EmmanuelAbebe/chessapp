"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaChessBoard, FaHouse, FaPlus } from "react-icons/fa6";
import { SECTIONS } from "@/features/account/data";

const DESKTOP_QUERY = "(min-width: 640px)"; // Tailwind's `sm` breakpoint

// Flattens dashboard sub-sections in directly (rather than a single
// generic "Dashboard" link) so jumping straight to e.g. Settings is one
// click instead of a Board -> Dashboard -> Settings detour.
const DIAL_LINKS = [
  { href: "/", label: "Home", icon: FaHouse },
  { href: "/board", label: "Board", icon: FaChessBoard },
  ...SECTIONS,
];

export function SiteHeader() {
  const pathname = usePathname();

  const [isDesktop, setIsDesktop] = useState(false);
  const [isDialOpen, setIsDialOpen] = useState(false);
  const dialRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) =>
      setIsDesktop(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Desktop has no trigger to toggle - the dial is always open there.
  const isOpen = isDesktop || isDialOpen;

  // Close on outside click/tap and on Escape - standard menu-dismissal
  // behavior, needed since the dial has no backdrop of its own. Only
  // relevant on mobile, where the dial is actually toggleable.
  useEffect(() => {
    if (isDesktop || !isDialOpen) return;

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
  }, [isDesktop, isDialOpen]);

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
        {/* Trigger icon is a placeholder for a logo mark that doesn't exist
            yet - swap FaPlus for the real logo once it's built. Hidden on
            desktop, where the dial is permanently open and toggling it
            would do nothing. */}
        <div ref={dialRef} className="relative">
          <ul className="absolute top-full left-0 mt-2 flex flex-col items-start gap-2">
            {DIAL_LINKS.map((link, index) => {
              const Icon = link.icon;

              return (
                <li
                  key={link.href}
                  className={`flex items-center gap-2 transition-all duration-200 ease-out ${
                    isOpen
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-2 opacity-0"
                  }`}
                  style={{
                    transitionDelay: isOpen ? `${index * 40}ms` : "0ms",
                  }}
                >
                  <Link
                    href={link.href}
                    aria-label={link.label}
                    tabIndex={isOpen ? 0 : -1}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface text-text-dim shadow-lg transition hover:text-text"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                  <span className="rounded-md border border-white/10 bg-surface px-2 py-1 text-xs text-text-dim shadow-lg">
                    {link.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => setIsDialOpen((open) => !open)}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface text-text-dim shadow-lg transition hover:text-text sm:hidden"
          >
            <FaPlus
              className={`h-4 w-4 transition-transform duration-200 ease-out ${
                isOpen ? "rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </nav>
    </header>
  );
}
