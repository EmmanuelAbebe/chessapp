import AccountNav from "@/features/account/components/AccountNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row md:items-start md:gap-12 md:py-12">
      <AccountNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
