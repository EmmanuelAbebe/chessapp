"use client";

import { useState, type ChangeEvent } from "react";

export function useValidatedField(
  initialValue: string,
  validate: (value: string) => string | undefined,
) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>(undefined);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
    if (error) setError(validate(event.target.value));
  }

  function onBlur() {
    setError(validate(value));
  }

  function validateNow(): boolean {
    const result = validate(value);
    setError(result);
    return !result;
  }

  return { value, error, onChange, onBlur, validateNow, setValue };
}
