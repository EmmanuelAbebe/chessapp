"use client";

import { useState, type ChangeEvent } from "react";

export function useValidatedField(
  initialValue: string,
  validate: (value: string) => string | undefined,
) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
    if (error) setError(validate(event.target.value));
  }

  function onBlur() {
    setTouched(true);
    setError(validate(value));
  }

  function validateNow(): boolean {
    setTouched(true);
    const result = validate(value);
    setError(result);
    return !result;
  }

  const isValid = touched && !error && value.trim() !== "";

  return { value, error, isValid, onChange, onBlur, validateNow, setValue };
}
