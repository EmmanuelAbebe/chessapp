export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-surface p-12 shadow-lg md:min-h-[calc(100dvh-7.5rem)]">
        {children}
      </div>
    </div>
  );
}
