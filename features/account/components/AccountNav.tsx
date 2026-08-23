"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "../data";

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function AccountNav() {
  const pathname = usePathname();
  const activeIndex = SECTIONS.findIndex((section) => section.href === pathname);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);

  useLayoutEffect(() => {
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    setHighlight(
      el
        ? {
            top: el.offsetTop,
            left: el.offsetLeft,
            width: el.offsetWidth,
            height: el.offsetHeight,
          }
        : null,
    );
  }, [activeIndex]);

  return (
    <nav
      aria-label="Dashboard sections"
      className="md:sticky md:top-14 md:z-10 md:w-40 md:shrink-0"
    >
      <ul className="relative flex gap-1 overflow-x-auto text-sm md:flex-col md:overflow-visible">
        {highlight && (
          <div
            aria-hidden="true"
            className="absolute z-0 rounded-l-md border border-r-0 border-white/10 bg-surface shadow-lg transition-[top,left,width,height] duration-200 ease-out md:-mr-px"
            style={{
              top: highlight.top,
              left: highlight.left,
              width: highlight.width,
              height: highlight.height,
            }}
          />
        )}

        {SECTIONS.map((section, index) => {
          const isActive = pathname === section.href;
          const Icon = section.icon;
          return (
            <li key={section.href} className="shrink-0">
              <Link
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={section.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative z-10 flex items-center gap-2 rounded-l-md px-4 py-3 whitespace-nowrap transition-colors duration-200 ease-out ${
                  isActive
                    ? "font-semibold text-text"
                    : "text-text-faint hover:text-text"
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
