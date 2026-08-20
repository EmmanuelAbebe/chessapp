"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/account/lib/styles";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateMatch, validatePassword, validateRequired } from "@/lib/validation";

export default function ChangePasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const current = useValidatedField("", (value) =>
    validateRequired(value, "Current password"),
  );
  const next = useValidatedField("", (value) =>
    validatePassword(value, { required: true }),
  );
  const confirm = useValidatedField("", (value) =>
    validateMatch(value, next.value, "Passwords"),
  );
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const isCurrentValid = current.validateNow();
    const isNextValid = next.validateNow();
    const isConfirmValid = confirm.validateNow();
    if (!isCurrentValid || !isNextValid || !isConfirmValid) return;
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
            <PasswordInput
              value={current.value}
              onChange={current.onChange}
              onBlur={current.onBlur}
              error={current.error}
              success={current.isValid ? "Looks good!" : undefined}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">New Password</span>
            <PasswordInput
              value={next.value}
              onChange={next.onChange}
              onBlur={next.onBlur}
              error={next.error}
              success={next.isValid ? "Looks good!" : undefined}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">
              Confirm New Password
            </span>
            <PasswordInput
              value={confirm.value}
              onChange={confirm.onChange}
              onBlur={confirm.onBlur}
              error={confirm.error}
              success={confirm.isValid ? "Passwords match!" : undefined}
            />
          </label>

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
