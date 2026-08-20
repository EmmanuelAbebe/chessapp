"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import PasswordInput from "@/components/ui/PasswordInput";
import TextInput from "@/components/ui/TextInput";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateEmail, validateMatch, validatePassword } from "@/lib/validation";
import SocialAuthButtons from "@/features/auth/components/SocialAuthButtons";

const RegisterPage = () => {
  const email = useValidatedField("", (value) =>
    validateEmail(value, { required: false }),
  );
  const password = useValidatedField("", (value) =>
    validatePassword(value, { required: false }),
  );
  const confirmPassword = useValidatedField("", (value) =>
    validateMatch(value, password.value, "Passwords"),
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    email.validateNow();
    password.validateNow();
    confirmPassword.validateNow();
  }

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-neutral-100 md:text-2xl">
            Create an account
          </h1>

          <SocialAuthButtons />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-xs text-neutral-500">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-neutral-400"
              >
                Email <span className="text-neutral-600">(optional)</span>
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
                className="block mb-2 text-sm font-medium text-neutral-400"
              >
                Password <span className="text-neutral-600">(optional)</span>
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
                className="block mb-2 text-sm font-medium text-neutral-400"
              >
                Confirm password{" "}
                <span className="text-neutral-600">(optional)</span>
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
              className="w-full text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 focus:ring-4 focus:outline-none focus:ring-neutral-700/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
            >
              Create account
            </button>
            <p className="text-sm font-light text-neutral-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-blue-400 hover:underline"
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
