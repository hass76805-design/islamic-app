import React from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import {initAppProtection} from './utils/appProtection';

try {
  initAppProtection();
} catch {
  // Never block boot if event listeners fail on constrained WebViews
}

interface BootWindow extends Window {
  __ALZAHABI_BOOT_OK__?: () => void;
}

class AppErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean}
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(): {hasError: boolean} {
    return {hasError: true};
  }

  componentDidCatch() {
    // Render dark-gold recovery UI instead of blank screen
  }

  handleRecover = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(
              (k) =>
                !k.includes('audio') && !k.includes('alzahabi-core-data'),
            )
            .map((k) => caches.delete(k)),
        );
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
    } catch {
      // ignore cleanup failures
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="flex h-dvh w-full flex-col items-center justify-center bg-[#000000] px-6 text-center text-white"
        >
          <img
            src="/pwa-192x192.png"
            alt="البرنامج الإسلامي الذهبي"
            className="h-24 w-24 rounded-3xl border-2 border-[#C9A227] object-cover"
          />
          <h1 className="mt-4 text-xl font-extrabold text-[#FCE38A]">
            البرنامج الإسلامي الذهبي
          </h1>
          <p className="mt-2 max-w-xs text-sm text-zinc-300">
            حدث تعثّر مؤقت أثناء الفتح، اضغط لإعادة تشغيل التطبيق بسلاسة.
          </p>
          <button
            type="button"
            onClick={() => void this.handleRecover()}
            className="mt-5 min-h-[46px] rounded-2xl bg-[#C9A227] px-6 py-2.5 text-sm font-extrabold text-black"
          >
            إعادة فتح التطبيق
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    try {
      if (navigator.onLine && !sessionStorage.getItem('alzahabi_preload_retry')) {
        sessionStorage.setItem('alzahabi_preload_retry', '1');
        window.location.reload();
      }
    } catch {
      // ignore
    }
  });
}

try {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registration.update().catch(() => {});
      window.setInterval(() => {
        registration.update().catch(() => {});
      }, 30 * 60 * 1000);
    },
  });
} catch {
  // Never block app boot if SW registration fails
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.update().catch(() => {});
    })
    .catch(() => {});
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
  (window as BootWindow).__ALZAHABI_BOOT_OK__?.();
  try {
    sessionStorage.removeItem('alzahabi_boot_retry');
    sessionStorage.removeItem('alzahabi_preload_retry');
  } catch {
    // ignore
  }
}
