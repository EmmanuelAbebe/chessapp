import AccountNav from "@/features/account/components/AccountNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6 md:flex-row md:items-start">
      <AccountNav />
      <div className="min-w-0 flex-1 border border-white/10 bg-surface p-4 shadow-lg rounded-2xl rounded-tl-none">
        {children}
      </div>
    </div>
  );
}
