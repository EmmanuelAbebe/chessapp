"use client";

import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/account/lib/styles";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateEmail, validateRequired } from "@/lib/validation";
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
  const username = useValidatedField(profile.username, (value) =>
    validateRequired(value, "Username"),
  );
  const email = useValidatedField(profile.email, (value) =>
    validateEmail(value, { required: true }),
  );

  function handleSave() {
    const isUsernameValid = username.validateNow();
    const isEmailValid = email.validateNow();
    if (!isUsernameValid || !isEmailValid) return;
    onSave({ username: username.value, email: email.value });
  }

  return (
    <Modal isOpen onClose={onClose}>
      <h2 className="text-xl font-bold text-white">Edit Profile</h2>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-300">Username</span>
          <TextInput
            value={username.value}
            onChange={username.onChange}
            onBlur={username.onBlur}
            error={username.error}
            success={username.isValid ? "Looks good!" : undefined}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-300">Email</span>
          <TextInput
            type="email"
            value={email.value}
            onChange={email.onChange}
            onBlur={email.onBlur}
            error={email.error}
            success={email.isValid ? "Looks good!" : undefined}
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={secondaryButtonClass}>
          Cancel
        </button>
        <button onClick={handleSave} className={primaryButtonClass}>
          Save Changes
        </button>
      </div>
    </Modal>
  );
}
