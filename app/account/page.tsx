"use client";

import { useState } from "react";
import { FaUserAlt } from "react-icons/fa";
import SettingsItem from "@/components/ui/settings/SettingsItem";
import SettingsToggle from "@/components/ui/settings/SettingsToggle";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "subscription", label: "Subscription" },
  { id: "statistics", label: "Statistics" },
  { id: "settings", label: "Settings" },
];

const STATS = [
  { label: "Played", value: 150 },
  { label: "Won", value: 80 },
  { label: "Lost", value: 60 },
];

const AccountPage = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row md:items-start md:gap-12 md:py-12">
      <nav
        aria-label="Account sections"
        className="md:sticky md:top-8 md:w-40 md:shrink-0"
      >
        <ul className="flex gap-1 overflow-x-auto text-sm text-gray-500 md:flex-col md:overflow-visible">
          {SECTIONS.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="block rounded-md px-3 py-1.5 whitespace-nowrap transition hover:bg-black/5 hover:text-gray-900 dark:hover:bg-white/10"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <h1 className="text-2xl font-bold">Account</h1>

        <section id="profile" aria-labelledby="profile-heading" className="scroll-mt-20">
          <h2 id="profile-heading" className="text-lg font-semibold">
            Profile
          </h2>

          <div className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <FaUserAlt
              aria-hidden="true"
              className="shrink-0 rounded-full bg-gray-100 p-4 text-gray-400 dark:bg-white/10"
              size={72}
            />

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-500">Username</dt>
              <dd className="font-medium">JohnDoe123</dd>

              <dt className="text-gray-500">Chess rating</dt>
              <dd className="font-medium">1500</dd>

              <dt className="text-gray-500">Member since</dt>
              <dd className="font-medium">January 2023</dd>
            </dl>
          </div>
        </section>

        <section
          id="subscription"
          aria-labelledby="subscription-heading"
          className="scroll-mt-20"
        >
          <h2 id="subscription-heading" className="text-lg font-semibold">
            Subscription
          </h2>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-500">Plan</dt>
            <dd className="font-medium">Premium</dd>

            <dt className="text-gray-500">Renewal date</dt>
            <dd className="font-medium">December 31, 2024</dd>

            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium text-green-600">Active</dd>
          </dl>
        </section>

        <section
          id="statistics"
          aria-labelledby="statistics-heading"
          className="scroll-mt-20"
        >
          <h2 id="statistics-heading" className="text-lg font-semibold">
            Statistics
          </h2>

          <dl className="mt-4 grid max-w-sm grid-cols-3 gap-4 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dd className="text-2xl font-bold">{stat.value}</dd>
                <dt className="text-xs text-gray-500">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section id="settings" aria-labelledby="settings-heading" className="scroll-mt-20">
          <h2 id="settings-heading" className="text-lg font-semibold">
            Settings
          </h2>

          <div className="mt-4 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            <SettingsItem
              item={{
                title: "Notifications",
                content: (
                  <SettingsToggle
                    setting={{
                      label: "Notifications",
                      isSelected: notificationsEnabled,
                      onChange: setNotificationsEnabled,
                    }}
                  />
                ),
              }}
            />

            <SettingsItem
              item={{
                title: "Public profile",
                content: (
                  <SettingsToggle
                    setting={{
                      label: "Public profile",
                      isSelected: publicProfile,
                      onChange: setPublicProfile,
                    }}
                  />
                ),
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountPage;
