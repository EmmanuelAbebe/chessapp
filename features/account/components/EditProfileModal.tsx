"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/account/lib/styles";
import type { Profile } from "../types";

export default function EditProfileModal({
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
