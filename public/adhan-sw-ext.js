// Background Adhan & Islamic Alerts extension imported into the Workbox Service Worker.
// Enables scheduled real-time mobile notifications with official app logo, action buttons, and instant audio playback.

const ADHAN_CACHE_META = 'al-zahabi-scheduled-alerts-v2';

async function saveScheduledAlerts(alerts) {
  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    await cache.put(
      '/__scheduled_alerts.json',
      new Response(JSON.stringify(alerts || []), {
        headers: {'Content-Type': 'application/json'},
      }),
    );
  } catch {
    // ignore storage errors
  }
}

async function readScheduledAlerts() {
  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    const res = await cache.match('/__scheduled_alerts.json');
    if (!res) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function buildNotificationOptions(item) {
  const prayerName = item.prayerNameAr || item.prayerName || 'الصلاة';
  return {
    body: item.body || 'حان الآن موعد الصلاة — البرنامج الإسلامي الذهبي',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    image: '/pwa-512x512.png',
    dir: 'rtl',
    lang: 'ar',
    tag: item.tag || 'al-zahabi-adhan',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 120, 300, 120, 450],
    actions: [
      {
        action: 'play-adhan',
        title: item.type === 'pre-adhan' ? 'فتح المؤذن' : 'تشغيل الصوت الآن',
      },
    ],
    data: {
      audioUrl: item.audioUrl || '',
      type: item.type || 'adhan',
      prayerNameAr: prayerName,
      voiceId: item.voiceId || '',
    },
  };
}

async function checkAndFireDueAlerts() {
  const alerts = await readScheduledAlerts();
  if (!Array.isArray(alerts) || alerts.length === 0) return;

  const now = Date.now();
  const remaining = [];

  for (const item of alerts) {
    // Fire if within 5 minutes window around trigger time
    if (now >= item.timestamp && now - item.timestamp <= 5 * 60 * 1000) {
      try {
        await self.registration.showNotification(
          item.title || 'البرنامج الإسلامي الذهبي',
          buildNotificationOptions(item),
        );
        // Also notify any open/background window clients immediately
        const clientsArr = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of clientsArr) {
          client.postMessage({
            type: 'PLAY_ADHAN_FROM_NOTIFICATION',
            audioUrl: item.audioUrl || '',
            alertType: item.type || 'adhan',
            prayerNameAr: item.prayerNameAr || item.prayerName || 'الصلاة',
            voiceId: item.voiceId || '',
          });
        }
      } catch {
        // notification permission might not be granted
      }
    } else if (item.timestamp > now) {
      remaining.push(item);
    }
  }

  await saveScheduledAlerts(remaining);
}

self.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload) return;

  if (payload.type === 'TEST_ADHAN_NOTIFICATION') {
    const testItem = payload.payload || payload;
    event.waitUntil(
      self.registration.showNotification(
        testItem.title || 'البرنامج الإسلامي الذهبي — تنبيه تجريبي',
        buildNotificationOptions(testItem),
      ),
    );
    return;
  }

  if (payload.type !== 'SCHEDULE_ADHAN_ALERTS') return;

  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  event.waitUntil(
    (async () => {
      await saveScheduledAlerts(alerts);

      // Use native TimestampTrigger when supported by browser (Android Chrome / Installed PWA)
      if (typeof self.TimestampTrigger === 'function') {
        try {
          const existing = await self.registration.getNotifications({
            includeTriggered: true,
          });
          for (const n of existing) {
            n.close();
          }
          const now = Date.now();
          for (const item of alerts) {
            if (item.timestamp > now + 2000) {
              await self.registration.showNotification(
                item.title || 'البرنامج الإسلامي الذهبي',
                {
                  ...buildNotificationOptions(item),
                  showTrigger: new self.TimestampTrigger(item.timestamp),
                },
              );
            }
          }
        } catch {
          // TimestampTrigger not active on this browser build
        }
      }
    })(),
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'adhan-background-check') {
    event.waitUntil(checkAndFireDueAlerts());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'adhan-background-check') {
    event.waitUntil(checkAndFireDueAlerts());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.audioUrl
    ? `/?playAlert=${encodeURIComponent(data.audioUrl)}&alertType=${encodeURIComponent(
        data.type || 'adhan',
      )}&prayer=${encodeURIComponent(data.prayerNameAr || 'الصلاة')}&voiceId=${encodeURIComponent(
        data.voiceId || '',
      )}`
    : '/?openMuezzin=1';

  event.waitUntil(
    self.clients
      .matchAll({type: 'window', includeUncontrolled: true})
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if ('focus' in client) {
            client.postMessage({
              type: 'PLAY_ADHAN_FROM_NOTIFICATION',
              audioUrl: data.audioUrl,
              alertType: data.type,
              prayerNameAr: data.prayerNameAr,
              voiceId: data.voiceId,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
