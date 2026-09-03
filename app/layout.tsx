import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SettingsProvider } from "@/features/settings/SettingsContext";
import "./globals.css";

// The AI Coach's commentary is set in this rather than the app's system
// sans - chess annotation has long set analysis prose in a book serif
// while notation/UI stays sans or mono, and it reads as a voice rather
// than another status line. Self-hosted via next/font (no runtime request
// to Google, no layout shift) - exposed as --font-source-serif and mapped
// to the `font-serif` utility in globals.css's @theme block.
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

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
    <html lang="en" className={sourceSerif4.variable}>
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
