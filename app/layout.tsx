import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SettingsProvider } from "@/features/settings/SettingsContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoachMeChess",
  description: "A chess coach that studies your games and teaches what to train next.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SettingsProvider>
          <div className="flex min-h-screen flex-col font-sans">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-neutral-100 focus:px-4 focus:py-2 focus:text-neutral-900 focus:shadow-lg"
            >
              Skip to content
            </a>

            <SiteHeader />

            <main id="main-content" className="flex w-full flex-1 flex-col">
              {children}
            </main>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
