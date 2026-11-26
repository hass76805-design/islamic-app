import {useEffect, useRef} from 'react';

interface BackEntry {
  id: number;
  onBack: () => void;
}

const backStack: BackEntry[] = [];
let nextEntryId = 1;
let ignorePopCount = 0;
let initialized = false;
let rootBackHandler: (() => boolean) | null = null;

function ensureInitialized() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Ensure there is always a base entry so pressing Back from a subpage returns smoothly
  try {
    const currentState = window.history.state as Record<string, unknown> | null;
    if (!currentState || !currentState.__alzahabiBase) {
      window.history.replaceState({__alzahabiBase: true}, '');
    }
  } catch {
    // ignore restricted history environments
  }

  window.addEventListener('popstate', () => {
    if (ignorePopCount > 0) {
      ignorePopCount -= 1;
      return;
    }

    const top = backStack.pop();
    if (top) {
      top.onBack();
      return;
    }

    if (rootBackHandler) {
      rootBackHandler();
    }
  });
}

export function setRootBackHandler(handler: (() => boolean) | null) {
  ensureInitialized();
  rootBackHandler = handler;
}

export function pushNavigationState(tag: string) {
  ensureInitialized();
  if (typeof window === 'undefined') return;
  try {
    window.history.pushState({__alzahabiNav: tag, t: Date.now()}, '');
  } catch {
    // ignore
  }
}

export function popHistoryEntrySilently() {
  ensureInitialized();
  if (typeof window === 'undefined') return;
  try {
    const st = window.history.state as {__alzahabiNav?: string} | null;
    if (st && st.__alzahabiNav) {
      ignorePopCount += 1;
      window.history.back();
      window.setTimeout(() => {
        if (ignorePopCount > 0) ignorePopCount -= 1;
      }, 300);
    }
  } catch {
    // ignore
  }
}

export function registerBackHandler(onBack: () => void): () => void {
  ensureInitialized();
  const id = nextEntryId++;
  backStack.push({id, onBack});
  try {
    window.history.pushState({__alzahabiModal: id}, '');
  } catch {
    // ignore
  }

  return () => {
    const idx = backStack.findIndex((item) => item.id === id);
    if (idx !== -1) {
      backStack.splice(idx, 1);
      // Clean up the orphaned history entry created when modal opened
      try {
        const st = window.history.state as {__alzahabiModal?: number} | null;
        if (st?.__alzahabiModal === id) {
          ignorePopCount += 1;
          window.history.back();
          window.setTimeout(() => {
            if (ignorePopCount > 0) ignorePopCount -= 1;
          }, 300);
        }
      } catch {
        // ignore
      }
    }
  };
}

export function useHardwareBack(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    return registerBackHandler(() => {
      onCloseRef.current();
    });
  }, [isOpen]);
}
