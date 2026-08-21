import { SOCIAL_PROVIDERS } from "../data";

export default function SocialAuthButtons() {
  return (
    <div className="flex flex-col gap-3">
      {SOCIAL_PROVIDERS.map(({ name, Icon, className }) => (
        <button
          key={name}
          type="button"
          className={`flex w-full items-center justify-center gap-3 rounded-lg px-5 py-2.5 text-sm font-medium transition ${className}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          Continue with {name}
        </button>
      ))}
      <p className="text-center text-xs text-neutral-600">
        Not connected yet — preview only
      </p>
    </div>
  );
}
