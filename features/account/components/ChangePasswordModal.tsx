"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/account/lib/styles";

export default function ChangePasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
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
            <PasswordInput
              className={inputClass}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">New Password</span>
            <PasswordInput
              className={inputClass}
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">
              Confirm New Password
            </span>
            <PasswordInput
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
