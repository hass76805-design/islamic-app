import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import {initAppProtection} from './utils/appProtection';

initAppProtection();

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    registration.update().catch(() => {});
    window.setInterval(() => {
      registration.update().catch(() => {});
    }, 30 * 60 * 1000);
  },
  onNeedRefresh() {
    // Automatically apply cache update seamlessly in the background
    void updateSW(true);
  },
});

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.update().catch(() => {});
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
