// Dedicated Offline Background Muezzin Service Worker Module (adhan-sw.js)
// Handles /adhan-sounds/* CacheFirst offline caching, IndexedDB snooze/alert state, and TimestampTrigger alarms.

(function initMuezzinBackgroundSw(swSelf) {
  const MUEZZIN_SOUND_CACHE = 'adhan-sounds-v1';
  const MUEZZIN_ALERT_CACHE = 'al-zahabi-scheduled-alerts-v2';
  const MUEZZIN_SOUND_ASSETS = [
    '/adhan.js',
    '/adhan-sounds/makkah.mp3',
    '/adhan-sounds/ahmed-naina.mp3',
    '/adhan-sounds/khalid-aljalil.mp3',
    '/adhan-sounds/mishary-alafasy.mp3',
    '/adhan-sounds/egyptian.mp3',
  ];

  async function prewarmMuezzinAssets() {
    try {
      const cache = await caches.open(MUEZZIN_SOUND_CACHE);
      await Promise.allSettled(
        MUEZZIN_SOUND_ASSETS.map(async (url) => {
          const hit = await cache.match(url);
          if (hit) return;
          const res = await fetch(url);
          if (res && res.ok) {
            await cache.put(url, res);
          }
        }),
      );
    } catch {
      // ignore offline prewarm errors
    }
  }

  async function appendSnoozedAlert(alertItem) {
    if (!alertItem || typeof alertItem.timestamp !== 'number') return;
    try {
      const cache = await caches.open(MUEZZIN_ALERT_CACHE);
      const existingRes = await cache.match('/__scheduled_alerts.json');
      const existing = existingRes ? await existingRes.json() : [];
      const list = Array.isArray(existing) ? existing : [];
      list.push(alertItem);
      await cache.put(
        '/__scheduled_alerts.json',
        new Response(JSON.stringify(list), {
          headers: {'Content-Type': 'application/json'},
        }),
      );
      if (typeof swSelf.TimestampTrigger === 'function') {
        await swSelf.registration.showNotification(
          alertItem.title || 'تذكير مؤجل للصلاة',
          {
            body: alertItem.body || 'انتهت مدة التأجيل (5 دقائق) — حان وقت الصلاة',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'ar',
            tag: alertItem.tag || `snooze-${alertItem.timestamp}`,
            requireInteraction: true,
            vibrate: [500, 150, 500, 150, 700],
            showTrigger: new swSelf.TimestampTrigger(alertItem.timestamp),
            data: {
              audioUrl: alertItem.audioUrl || '/adhan-sounds/makkah.mp3',
              type: 'adhan',
              prayerNameAr: alertItem.prayerNameAr || 'الصلاة',
              voiceId: alertItem.voiceId || 'muezzin-makkah',
              title: alertItem.title || 'تذكير مؤجل للصلاة',
            },
          },
        );
      }
    } catch {
      // ignore SW storage errors
    }
  }

  swSelf.addEventListener('install', (event) => {
    event.waitUntil(prewarmMuezzinAssets());
  });

  swSelf.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'PREWARM_MUEZZIN_SOUNDS') {
      event.waitUntil(prewarmMuezzinAssets());
    } else if (data.type === 'MUEZZIN_SNOOZE_5MIN' && data.alert) {
      event.waitUntil(appendSnoozedAlert(data.alert));
    }
  });
})(self);
