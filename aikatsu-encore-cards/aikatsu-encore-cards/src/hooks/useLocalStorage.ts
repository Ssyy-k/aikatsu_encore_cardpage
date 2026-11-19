import { useEffect, useState } from 'react';

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간 부족 / 사생활 보호 모드 — 무시 */
  }
}

export function useLocalStorageState<T>(key: string, fallback: T, validate?: (v: T) => T) {
  const [value, setValue] = useState<T>(() => {
    const v = readStorage(key, fallback);
    return validate ? validate(v) : v;
  });
  useEffect(() => writeStorage(key, value), [key, value]);
  return [value, setValue] as const;
}
