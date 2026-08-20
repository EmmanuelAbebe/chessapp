import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — CoachMeChess",
  description: "Sign in or create a CoachMeChess account.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}
