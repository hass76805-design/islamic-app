import {useCallback, useState} from 'react';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeParsedValue<T>(val: T): T {
  if (!val || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeParsedValue(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (!FORBIDDEN_KEYS.has(k)) {
      clean[k] = sanitizeParsedValue(v);
    }
  }
  return clean as T;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      const parsed = JSON.parse(item) as T;
      return sanitizeParsedValue(parsed);
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
