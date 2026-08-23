import type {} from "react/canary";
import { ViewTransition } from "react";
import SettingsSection from "@/features/settings/components/SettingsSection";

export default function SettingsPage() {
  return (
    <ViewTransition enter="nav-forward" exit="nav-forward" default="none">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-text">Settings</h1>
        <SettingsSection />
      </div>
    </ViewTransition>
  );
}
