export default function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold tracking-wide text-text-faint">
        {title}
      </h4>
      <div className="p-2">{children}</div>
    </div>
  );
}
