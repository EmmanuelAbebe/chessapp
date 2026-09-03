interface SettingsItemProps {
  item: {
    icon?: React.ReactNode;
    title: string;
    content: React.ReactNode;
  };
}

const SettingsItem = ({ item }: SettingsItemProps) => {
  return (
    <section className="flex w-full items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <p className="text-sm font-semibold text-text">{item.title}</p>
      </div>

      <div className="shrink-0">{item.content}</div>
    </section>
  );
};

export default SettingsItem;
