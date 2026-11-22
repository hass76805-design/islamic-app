/**
 * Client-side runtime protection for «البرنامج الإسلامي الذهبي».
 * Prevents casual inspection, source-copying, and DevTools shortcuts
 * while preserving normal interactive typing, search inputs, and app copy buttons.
 */
let protectionActive = false;

export function initAppProtection(): void {
  if (protectionActive || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  protectionActive = true;

  const isEditableTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      el.isContentEditable ||
      Boolean(el.closest('[data-allow-copy="true"]'))
    );
  };

  // Disable right-click context menu on app UI (keep normal menu inside text inputs)
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    },
    {capture: true},
  );

  // Block drag-and-drop copying of images or elements
  document.addEventListener(
    'dragstart',
    (e) => {
      e.preventDefault();
    },
    {capture: true},
  );

  // Prevent arbitrary DOM copy/cut outside input fields
  document.addEventListener(
    'copy',
    (e) => {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    },
    {capture: true},
  );

  document.addEventListener(
    'cut',
    (e) => {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    },
    {capture: true},
  );

  // Block browser DevTools & view-source / save-page keyboard shortcuts
  window.addEventListener(
    'keydown',
    (e) => {
      const key = e.key?.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+Shift+I / J / C  and Cmd+Option+I / J / C
      if ((mod && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
          (e.metaKey && e.altKey && (key === 'i' || key === 'j' || key === 'c'))) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // View source / Save page (Ctrl+U / Ctrl+S) & Browser Zoom shortcuts (Ctrl + +/-/0)
      if (mod && (key === 'u' || key === 's' || key === '+' || key === '-' || key === '=' || key === '0')) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    {capture: true},
  );

  // Disable pinch zoom (multi-touch) and double-tap zoom completely
  let lastTouchEndAt = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    {passive: false},
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    {passive: false},
  );

  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEndAt <= 300) {
        const target = e.target as HTMLElement | null;
        if (!isEditableTarget(target)) {
          e.preventDefault();
        }
      }
      lastTouchEndAt = now;
    },
    {passive: false},
  );

  // Disable Safari pinch gesture events
  const blockGesture = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', blockGesture, {passive: false});
  document.addEventListener('gesturechange', blockGesture, {passive: false});
  document.addEventListener('gestureend', blockGesture, {passive: false});

  // Disable Ctrl/Meta + mouse wheel zoom
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    },
    {passive: false},
  );
}
