import SettingsSection from "@/features/settings/components/SettingsSection";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-text">Settings</h1>
      <SettingsSection />
    </div>
  );
}
