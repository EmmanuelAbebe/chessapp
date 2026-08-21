"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/ui/PasswordInput";
import TextInput from "@/components/ui/TextInput";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateEmail, validateMatch, validatePassword } from "@/lib/validation";
import SocialAuthButtons from "@/features/auth/components/SocialAuthButtons";

const RegisterPage = () => {
  const router = useRouter();
  const email = useValidatedField("", (value) =>
    validateEmail(value, { required: false }),
  );
  const password = useValidatedField("", (value) =>
    validatePassword(value, { required: false }),
  );
  const confirmPassword = useValidatedField("", (value) =>
    validateMatch(value, password.value, "Passwords"),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const isEmailValid = email.validateNow();
    const isPasswordValid = password.validateNow();
    const isConfirmValid = confirmPassword.validateNow();
    if (!isEmailValid || !isPasswordValid || !isConfirmValid) return;

    setIsSubmitting(true);
    setTimeout(() => router.push("/dashboard"), 600);
  }

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
            Create an account
          </h1>

          <SocialAuthButtons />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-raised" />
            <span className="text-xs text-text-faint">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-surface-raised" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-text-dim"
              >
                Email <span className="text-text-faint">(optional)</span>
              </label>
              <TextInput
                type="email"
                name="email"
                id="email"
                value={email.value}
                onChange={email.onChange}
                onBlur={email.onBlur}
                error={email.error}
                success={email.isValid ? "Looks good!" : undefined}
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-text-dim"
              >
                Password <span className="text-text-faint">(optional)</span>
              </label>
              <PasswordInput
                name="password"
                id="password"
                value={password.value}
                onChange={password.onChange}
                onBlur={password.onBlur}
                error={password.error}
                success={password.isValid ? "Looks good!" : undefined}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block mb-2 text-sm font-medium text-text-dim"
              >
                Confirm password{" "}
                <span className="text-text-faint">(optional)</span>
              </label>
              <PasswordInput
                name="confirm-password"
                id="confirm-password"
                value={confirmPassword.value}
                onChange={confirmPassword.onChange}
                onBlur={confirmPassword.onBlur}
                error={confirmPassword.error}
                success={confirmPassword.isValid ? "Passwords match!" : undefined}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-text bg-surface-raised transition hover:brightness-110 border border-border focus:ring-4 focus:outline-none focus:ring-border/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
            <p className="text-sm font-light text-text-dim">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-accent hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
