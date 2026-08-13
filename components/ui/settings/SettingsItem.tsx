interface SettingsItemProps {
  item: {
    title: string;
    content: React.ReactNode;
  };
}

const SettingsItem = ({ item }: SettingsItemProps) => {
  return (
    <section className="flex w-full items-center justify-between gap-4 py-3">
      <p className="text-sm font-semibold text-gray-800">{item.title}</p>

      <div className="shrink-0">{item.content}</div>
    </section>
  );
};

export default SettingsItem;
