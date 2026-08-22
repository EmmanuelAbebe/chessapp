"use client";

import { usePathname } from "next/navigation";
import AccountNav from "@/features/account/components/AccountNav";
import { SECTIONS } from "@/features/account/data";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFirstSectionActive = pathname === SECTIONS[0].href;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6 md:flex-row md:items-start">
      <AccountNav />
      <div
        className={`min-w-0 flex-1 rounded-2xl border border-white/10 bg-surface p-4 shadow-lg md:min-h-[calc(100dvh-7.5rem)] ${
          isFirstSectionActive ? "rounded-tl-none" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
