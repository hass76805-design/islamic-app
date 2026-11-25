import {useCallback, useEffect, useRef, useState} from 'react';
import {readAppStateFromIdb, saveAppStateToIdb} from '../utils/offlineDb';

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

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (val: T | ((prev: T) => T)) => void] {
  const dirtyRef = useRef(false);
  const hadLocalItemRef = useRef(false);

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        hadLocalItemRef.current = false;
        return initialValue;
      }
      hadLocalItemRef.current = true;
      const parsed = JSON.parse(item) as T;
      return sanitizeParsedValue(parsed);
    } catch {
      hadLocalItemRef.current = false;
      return initialValue;
    }
  });

  const latestValueRef = useRef(storedValue);
  latestValueRef.current = storedValue;

  // Permanently sync with IndexedDB app_state so data survives cache/localStorage resets
  useEffect(() => {
    let active = true;
    void readAppStateFromIdb<T>(key).then((idbVal) => {
      if (!active || dirtyRef.current) return;
      if (idbVal !== null && !hadLocalItemRef.current) {
        const clean = sanitizeParsedValue(idbVal);
        setStoredValue(clean);
        try {
          window.localStorage.setItem(key, JSON.stringify(clean));
          hadLocalItemRef.current = true;
        } catch {
          // ignore storage quota errors
        }
      } else if (idbVal === null) {
        void saveAppStateToIdb(key, latestValueRef.current);
      }
    });
    return () => {
      active = false;
    };
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      dirtyRef.current = true;
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
          hadLocalItemRef.current = true;
        } catch {
          // ignore storage quota errors
        }
        void saveAppStateToIdb(key, next);
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
