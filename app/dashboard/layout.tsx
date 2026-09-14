import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/features/auth/actions";
import { secondaryButtonClass } from "@/features/account/lib/styles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
      <div className="min-w-0 pt-6 pb-12 flex-1 md:min-h-[calc(100dvh-4rem)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="text-sm text-text-faint">
            Signed in as {session.user.email}
          </span>
          <form action={signOutAction}>
            <button type="submit" className={secondaryButtonClass}>
              Sign out
            </button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
