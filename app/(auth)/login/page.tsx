"use client";

import SocialAuthButtons from "@/features/auth/components/SocialAuthButtons";

const LoginPage = () => {
  return (
    <div className="flex w-full max-w-132.5 flex-col items-center justify-center px-6 py-8 lg:py-0">
      <div className="w-full rounded-lg border border-border-soft bg-surface shadow-lg md:mt-0 sm:max-w-md xl:p-0">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-text md:text-2xl">
            Sign in to your account
          </h1>
          <p className="text-sm text-text-faint">
            Sign in with Google to continue.
          </p>

          <SocialAuthButtons />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
