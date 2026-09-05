"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import Checkbox from "@/components/ui/Checkbox";
import PasswordInput from "@/components/ui/PasswordInput";
import TextInput from "@/components/ui/TextInput";
import { useValidatedField } from "@/lib/hooks/useValidatedField";
import { validateEmail, validateRequired } from "@/lib/validation";
import SocialAuthButtons from "@/features/auth/components/SocialAuthButtons";

const LoginPage = () => {
  const email = useValidatedField("", (value) =>
    validateEmail(value, { required: true }),
  );
  const password = useValidatedField("", (value) =>
    validateRequired(value, "Password"),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const isEmailValid = email.validateNow();
    const isPasswordValid = password.validateNow();
    if (!isEmailValid || !isPasswordValid) return;

    setIsSubmitting(true);
    setFormError(null);
    const result = await signIn("credentials", {
      email: email.value,
      password: password.value,
      redirect: false,
    });
    setIsSubmitting(false);

    if (result?.error) {
      setFormError("Invalid email or password.");
      return;
    }
    // A hard navigation, not router.push: the global nav's links into
    // /dashboard/* get prefetched while logged out, and Next's client
    // router can reuse that stale (unauthenticated) RSC response right
    // after sign-in otherwise, bouncing back to /login despite the
    // fresh session cookie already being set.
    window.location.href = "/dashboard";
  }

  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
            Sign in to your account
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
                Email
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
                Password
              </label>
              <PasswordInput
                name="password"
                id="password"
                value={password.value}
                onChange={password.onChange}
                onBlur={password.onBlur}
                error={password.error}
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-center justify-between">
              <Checkbox id="remember" label="Remember me" />
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-accent hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            {formError && <p className="text-sm text-bad">{formError}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-text bg-surface-raised transition hover:brightness-110 border border-border focus:ring-4 focus:outline-none focus:ring-border/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-sm font-light text-text-dim">
              Don’t have an account yet?{" "}
              <Link
                href="/register"
                className="font-medium text-accent hover:underline"
              >
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
