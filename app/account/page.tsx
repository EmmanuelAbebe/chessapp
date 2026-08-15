"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";
import { FaCreditCard, FaDownload, FaKey, FaPen } from "react-icons/fa6";
import Modal from "@/components/ui/Modal";
import SettingsItem from "@/components/ui/settings/SettingsItem";
import SettingsSelect from "@/components/ui/settings/SettingsSelect";
import SettingsToggle from "@/components/ui/settings/SettingsToggle";
import SettingsVolume from "@/components/ui/settings/SettingsVolume";
import { useSettings } from "@/features/settings/SettingsContext";
import type { CoordinatesPlacement, Orientation } from "@/features/board/types";
import type { ThemeShade } from "@/features/settings/types";

const primaryButtonClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700";
const inputClass =
  "block w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";

type Profile = { username: string; email: string };

const PLANS = [
  {
    name: "Free",
    price: "$0/mo",
    features: ["Unlimited games", "Basic move analysis"],
  },
  {
    name: "Premium",
    price: "$9.99/mo",
    features: ["Everything in Free", "Full AI coaching", "Unlimited analysis"],
  },
  {
    name: "Pro",
    price: "$19.99/mo",
    features: [
      "Everything in Premium",
      "Priority support",
      "Advanced statistics",
    ],
  },
];

const INVOICES = [
  { id: "inv_003", date: "Nov 30, 2024", amount: "$9.99", status: "Paid" },
  { id: "inv_002", date: "Oct 31, 2024", amount: "$9.99", status: "Paid" },
  { id: "inv_001", date: "Sep 30, 2024", amount: "$9.99", status: "Paid" },
];

function EditProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Profile) => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);

  return (
    <Modal isOpen onClose={onClose}>
      <h2 className="text-xl font-bold text-white">Edit Profile</h2>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-300">Username</span>
          <input
            className={inputClass}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-300">Email</span>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={secondaryButtonClass}>
          Cancel
        </button>
        <button
          onClick={() => onSave({ username, email })}
          disabled={!username.trim() || !email.trim()}
          className={primaryButtonClass}
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!current || !next || !confirm) {
      setError("Fill in all fields.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setError(null);
    setSuccess(true);
  }

  return (
    <Modal isOpen onClose={onClose}>
      <h2 className="text-xl font-bold text-white">Change Password</h2>

      {success ? (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-green-400">
            Your password has been updated.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className={primaryButtonClass}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">
              Current Password
            </span>
            <input
              type="password"
              className={inputClass}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">New Password</span>
            <input
              type="password"
              className={inputClass}
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">
              Confirm New Password
            </span>
            <input
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button type="submit" className={primaryButtonClass}>
              Update Password
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function UpgradePlanModal({
  currentPlan,
  onClose,
  onSelect,
}: {
  currentPlan: string;
  onClose: () => void;
  onSelect: (plan: string) => void;
}) {
  const [selected, setSelected] = useState(currentPlan);

  return (
    <Modal isOpen onClose={onClose}>
      <h2 className="text-xl font-bold text-white">Choose a Plan</h2>

      <div className="mt-6 flex flex-col gap-3">
        {PLANS.map((planOption) => {
          const isSelected = selected === planOption.name;

          return (
            <button
              key={planOption.name}
              type="button"
              onClick={() => setSelected(planOption.name)}
              className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  {planOption.name}
                </span>
                <span className="text-sm text-neutral-400">
                  {planOption.price}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5 text-xs text-neutral-500">
                {planOption.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={secondaryButtonClass}>
          Cancel
        </button>
        <button
          onClick={() => onSelect(selected)}
          className={primaryButtonClass}
        >
          Confirm Plan
        </button>
      </div>
    </Modal>
  );
}

const pieceSets = [
  "Default",
  "Alpha",
  "Merida",
  "Fantasy",
  "Classic",
  "Neo",
  "Modern",
];
const boardThemes = ["Default", "Wood", "Marble"];
const moveMethods = ["Default", "Click", "Drag"];
const themeShades: { value: ThemeShade; label: string }[] = [
  { value: "midnight", label: "Midnight" },
  { value: "charcoal", label: "Charcoal" },
  { value: "slate", label: "Slate" },
];

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold tracking-wide text-neutral-500">
        {title}
      </h4>
      <div className="p-2">{children}</div>
    </div>
  );
}

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "subscription", label: "Subscription" },
  { id: "statistics", label: "Statistics" },
  { id: "settings", label: "Settings" },
];

const SECTION_IDS = SECTIONS.map((section) => section.id);

function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0]);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top
            ? entry
            : closest,
        );
        setActiveId(topMost.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}

const STATS = [
  { label: "Played", value: 150 },
  { label: "Won", value: 80 },
  { label: "Lost", value: 60 },
];

const AccountPage = () => {
  const [publicProfile, setPublicProfile] = useState(true);
  const { settings, updateSettings, updateSound, updateNotifications } =
    useSettings();
  const activeSection = useActiveSection(SECTION_IDS);

  const [profile, setProfile] = useState<Profile>({
    username: "JohnDoe123",
    email: "johndoe@example.com",
  });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const [plan, setPlan] = useState("Premium");
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "Active" | "Canceled"
  >("Active");
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isCancelConfirming, setIsCancelConfirming] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row md:items-start md:gap-12 md:py-12">
      <nav
        aria-label="Account sections"
        className="md:sticky md:top-8 md:w-40 md:shrink-0"
      >
        <ul className="flex gap-1 overflow-x-auto text-sm md:flex-col md:overflow-visible">
          {SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`block rounded-l-md border-r-2 px-3 py-1.5 whitespace-nowrap transition ${
                    isActive
                      ? "border-blue-400 font-medium text-white"
                      : "border-transparent text-neutral-500 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {section.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-16">
        {/* <h1 className="text-2xl font-bold">Account</h1> */}

        <section
          id="profile"
          aria-labelledby="profile-heading"
          className="scroll-mt-20"
        >
          <h2
            id="profile-heading"
            className="border-b border-neutral-800 pb-3 text-2xl font-bold tracking-tight text-white"
          >
            Profile
          </h2>

          <div className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <FaUserAlt
              aria-hidden="true"
              className="shrink-0 rounded-full bg-white/10 p-4 text-neutral-500"
              size={72}
            />

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-neutral-500">Username</dt>
              <dd className="font-medium">{profile.username}</dd>

              <dt className="text-neutral-500">Email</dt>
              <dd className="font-medium">{profile.email}</dd>

              <dt className="text-neutral-500">Chess rating</dt>
              <dd className="font-medium">1500</dd>

              <dt className="text-neutral-500">Member since</dt>
              <dd className="font-medium">January 2023</dd>
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setIsEditProfileOpen(true)}
              className={secondaryButtonClass}
            >
              <FaPen aria-hidden="true" className="mr-2 inline h-3 w-3" />
              Edit Profile
            </button>
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className={secondaryButtonClass}
            >
              <FaKey aria-hidden="true" className="mr-2 inline h-3 w-3" />
              Change Password
            </button>
          </div>

          {isEditProfileOpen && (
            <EditProfileModal
              profile={profile}
              onClose={() => setIsEditProfileOpen(false)}
              onSave={(next) => {
                setProfile(next);
                setIsEditProfileOpen(false);
              }}
            />
          )}

          {isChangePasswordOpen && (
            <ChangePasswordModal
              onClose={() => setIsChangePasswordOpen(false)}
            />
          )}
        </section>

        <section
          id="subscription"
          aria-labelledby="subscription-heading"
          className="scroll-mt-20"
        >
          <h2
            id="subscription-heading"
            className="border-b border-neutral-800 pb-3 text-2xl font-bold tracking-tight text-white"
          >
            Subscription
          </h2>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-neutral-500">Plan</dt>
            <dd className="font-medium">{plan}</dd>

            <dt className="text-neutral-500">Renewal date</dt>
            <dd className="font-medium">December 31, 2024</dd>

            <dt className="text-neutral-500">Status</dt>
            <dd
              className={`font-medium ${
                subscriptionStatus === "Active"
                  ? "text-green-400"
                  : "text-neutral-500"
              }`}
            >
              {subscriptionStatus}
            </dd>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setIsUpgradeOpen(true)}
              className={primaryButtonClass}
            >
              {plan === "Free" ? "Upgrade Plan" : "Change Plan"}
            </button>

            {subscriptionStatus === "Active" ? (
              isCancelConfirming ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-400">
                    Cancel your subscription?
                  </span>
                  <button
                    onClick={() => {
                      setSubscriptionStatus("Canceled");
                      setIsCancelConfirming(false);
                    }}
                    className="font-medium text-red-400 hover:underline"
                  >
                    Yes, cancel
                  </button>
                  <button
                    onClick={() => setIsCancelConfirming(false)}
                    className="font-medium text-neutral-400 hover:underline"
                  >
                    Keep plan
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCancelConfirming(true)}
                  className="text-sm font-medium text-red-400 hover:underline"
                >
                  Cancel Subscription
                </button>
              )
            ) : (
              <button
                onClick={() => setSubscriptionStatus("Active")}
                className="text-sm font-medium text-blue-400 hover:underline"
              >
                Reactivate Subscription
              </button>
            )}
          </div>

          {isUpgradeOpen && (
            <UpgradePlanModal
              currentPlan={plan}
              onClose={() => setIsUpgradeOpen(false)}
              onSelect={(next) => {
                setPlan(next);
                setIsUpgradeOpen(false);
              }}
            />
          )}

          <div className="mt-8 flex flex-col gap-3">
            <h3 className="text-sm font-semibold tracking-wide text-neutral-500">
              Billing
            </h3>

            <div className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3">
              <FaCreditCard
                aria-hidden="true"
                className="shrink-0 text-neutral-500"
                size={20}
              />
              <div>
                <p className="text-sm font-medium">Visa •••• 4242</p>
                <p className="text-xs text-neutral-500">Expires 08/2027</p>
              </div>
            </div>

            <div className="flex flex-col">
              {INVOICES.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{plan} Plan</p>
                    <p className="text-xs text-neutral-500">{invoice.date}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-green-400">
                      {invoice.status}
                    </span>
                    <span className="font-medium">{invoice.amount}</span>
                    <button
                      aria-label={`Download invoice from ${invoice.date}`}
                      className="text-neutral-500 hover:text-white"
                    >
                      <FaDownload size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="statistics"
          aria-labelledby="statistics-heading"
          className="scroll-mt-20"
        >
          <h2
            id="statistics-heading"
            className="border-b border-neutral-800 pb-3 text-2xl font-bold tracking-tight text-white"
          >
            Statistics
          </h2>

          <dl className="mt-4 grid max-w-sm grid-cols-3 gap-4 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dd className="text-2xl font-bold">{stat.value}</dd>
                <dt className="text-xs text-neutral-500">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="settings"
          aria-labelledby="settings-heading"
          className="scroll-mt-20"
        >
          <h2
            id="settings-heading"
            className="border-b border-neutral-800 pb-3 text-2xl font-bold tracking-tight text-white"
          >
            Settings
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            These are the full app settings — the gear icon on the board is a
            quick shortcut to the board-related ones below, and both stay in
            sync.
          </p>

          <div className="mt-4 flex flex-col gap-6">
            <SettingsCard title="Appearance">
              <SettingsItem
                item={{
                  title: "Theme",
                  content: (
                    <SettingsSelect
                      setting={{
                        label: "Theme",
                        value:
                          themeShades.find(
                            (shade) => shade.value === settings.themeShade,
                          )?.label ?? "Charcoal",
                        options: themeShades.map((shade) => shade.label),
                        onChange: (label) => {
                          const match = themeShades.find(
                            (shade) => shade.label === label,
                          );
                          if (match)
                            updateSettings({ themeShade: match.value });
                        },
                      }}
                    />
                  ),
                }}
              />
            </SettingsCard>

            <SettingsCard title="Board">
              <SettingsItem
                item={{
                  title: "Board Orientation",
                  content: (
                    <SettingsSelect
                      setting={{
                        label: "Board Orientation",
                        value:
                          settings.orientation === "white" ? "White" : "Black",
                        options: ["White", "Black"],
                        onChange: (value) =>
                          updateSettings({
                            orientation: value.toLowerCase() as Orientation,
                          }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Pieces",
                  content: (
                    <SettingsSelect
                      setting={{
                        label: "Pieces",
                        value: settings.pieceSet,
                        options: pieceSets,
                        onChange: (value) =>
                          updateSettings({ pieceSet: value }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Board",
                  content: (
                    <SettingsSelect
                      setting={{
                        label: "Board",
                        value: settings.boardTheme,
                        options: boardThemes,
                        onChange: (value) =>
                          updateSettings({ boardTheme: value }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Move Method",
                  content: (
                    <SettingsSelect
                      setting={{
                        label: "Move Method",
                        value: settings.moveMethod,
                        options: moveMethods,
                        onChange: (value) =>
                          updateSettings({ moveMethod: value }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Show Legal Moves",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Show Legal Moves",
                        isSelected: settings.showLegalMoves,
                        onChange: (showLegalMoves) =>
                          updateSettings({ showLegalMoves }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Highlight Last Move",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Highlight Last Move",
                        isSelected: settings.highlightLastMove,
                        onChange: (highlightLastMove) =>
                          updateSettings({ highlightLastMove }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Highlight Check",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Highlight Check",
                        isSelected: settings.highlightCheck,
                        onChange: (highlightCheck) =>
                          updateSettings({ highlightCheck }),
                      }}
                    />
                  ),
                }}
              />
            </SettingsCard>

            <SettingsCard title="Coordinates">
              <SettingsItem
                item={{
                  title: "Show Coordinates",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Show Coordinates",
                        isSelected: settings.showCoordinates,
                        onChange: (showCoordinates) =>
                          updateSettings({ showCoordinates }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Placement",
                  content: (
                    <SettingsSelect
                      setting={{
                        label: "Coordinate Placement",
                        value:
                          settings.coordinatesPlacement === "inside"
                            ? "Inside"
                            : "Outside",
                        options: ["Inside", "Outside"],
                        onChange: (value) =>
                          updateSettings({
                            coordinatesPlacement:
                              value.toLowerCase() as CoordinatesPlacement,
                          }),
                      }}
                    />
                  ),
                }}
              />
            </SettingsCard>

            <SettingsCard title="Evaluation">
              <SettingsItem
                item={{
                  title: "Eval Bar",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Eval Bar",
                        isSelected: settings.showEvalBar,
                        onChange: (showEvalBar) =>
                          updateSettings({ showEvalBar }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Eval Score",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Eval Score",
                        isSelected: settings.showEvalScore,
                        onChange: (showEvalScore) =>
                          updateSettings({ showEvalScore }),
                      }}
                    />
                  ),
                }}
              />
            </SettingsCard>

            <SettingsCard title="Sound">
              <SettingsItem
                item={{
                  title: "Master Volume",
                  content: (
                    <SettingsVolume
                      setting={{
                        label: "Master Volume",
                        value: settings.sound.master,
                        onChange: (master) => updateSound({ master }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Piece Movement",
                  content: (
                    <SettingsVolume
                      setting={{
                        label: "Piece Movement",
                        value: settings.sound.pieceMove,
                        onChange: (pieceMove) => updateSound({ pieceMove }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Capture",
                  content: (
                    <SettingsVolume
                      setting={{
                        label: "Capture",
                        value: settings.sound.capture,
                        onChange: (capture) => updateSound({ capture }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Check",
                  content: (
                    <SettingsVolume
                      setting={{
                        label: "Check",
                        value: settings.sound.check,
                        onChange: (check) => updateSound({ check }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "AI Voice",
                  content: (
                    <SettingsVolume
                      setting={{
                        label: "AI Voice",
                        value: settings.sound.aiVoice,
                        onChange: (aiVoice) => updateSound({ aiVoice }),
                      }}
                    />
                  ),
                }}
              />
            </SettingsCard>

            <SettingsCard title="Notifications">
              <SettingsItem
                item={{
                  title: "Notifications",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Notifications",
                        isSelected: settings.notifications.enabled,
                        onChange: (enabled) => updateNotifications({ enabled }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Your Turn",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Your Turn",
                        isSelected: settings.notifications.yourTurn,
                        onChange: (yourTurn) =>
                          updateNotifications({ yourTurn }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Game Result",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Game Result",
                        isSelected: settings.notifications.gameResult,
                        onChange: (gameResult) =>
                          updateNotifications({ gameResult }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Coaching Insights",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Coaching Insights",
                        isSelected: settings.notifications.coachingInsights,
                        onChange: (coachingInsights) =>
                          updateNotifications({ coachingInsights }),
                      }}
                    />
                  ),
                }}
              />

              <SettingsItem
                item={{
                  title: "Notification Sound",
                  content: (
                    <SettingsToggle
                      setting={{
                        label: "Notification Sound",
                        isSelected: settings.notifications.sound,
                        onChange: (sound) => updateNotifications({ sound }),
                      }}
                    />
                  ),
                }}
              />
            </SettingsCard>

            <SettingsCard title="Account">
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
            </SettingsCard>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountPage;
