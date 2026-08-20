const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(
  value: string,
  { required = false }: { required?: boolean } = {},
): string | undefined {
  if (!value.trim()) {
    return required ? "Enter your email address." : undefined;
  }
  if (!EMAIL_REGEX.test(value.trim())) {
    return "Enter a valid email address.";
  }
  return undefined;
}

export function validateRequired(
  value: string,
  label: string,
): string | undefined {
  return value.trim() ? undefined : `${label} is required.`;
}

export function validatePassword(
  value: string,
  { required = false, minLength = 8 }: { required?: boolean; minLength?: number } = {},
): string | undefined {
  if (!value) {
    return required ? "Enter a password." : undefined;
  }
  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  return undefined;
}

export function validateMatch(
  value: string,
  other: string,
  label: string,
): string | undefined {
  if (!value && !other) return undefined;
  return value === other ? undefined : `${label} do not match.`;
}
