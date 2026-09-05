"use client";

import { useState } from "react";
import { FaUserAlt } from "react-icons/fa";
import { FaKey, FaPen } from "react-icons/fa6";
import { secondaryButtonClass } from "@/features/account/lib/styles";
import type { Profile } from "../types";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";

export default function ProfileSection({
  initialProfile,
  memberSince,
}: {
  initialProfile: Profile;
  memberSince: string;
}) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  return (
    <section>
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <FaUserAlt
          aria-hidden="true"
          className="shrink-0 rounded-full bg-white/10 p-4 text-text-faint"
          size={72}
        />

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-text-faint">Username</dt>
          <dd className="font-medium">{profile.username}</dd>

          <dt className="text-text-faint">Email</dt>
          <dd className="font-medium">{profile.email}</dd>

          <dt className="text-text-faint">Chess rating</dt>
          <dd className="font-medium text-text-faint">Coming soon</dd>

          <dt className="text-text-faint">Member since</dt>
          <dd className="font-medium">{memberSince}</dd>
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
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </section>
  );
}
