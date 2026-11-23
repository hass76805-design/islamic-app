// Background Adhan, Pre-Adhan, Dua, Iqamah, Pray-Confirm, Tawasih, Azkar & Salawat Service Worker Extension
// Enables reliable background alerts via Notification Triggers (TimestampTrigger), Periodic Background Sync, and Background Sync.

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

async function readFiredTags() {
  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    const res = await cache.match('/__fired_adhan_tags.json');
    if (!res) return {};
    const parsed = await res.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveFiredTags(tagsMap) {
  try {
    const now = Date.now();
    const cleaned = {};
    for (const [k, ts] of Object.entries(tagsMap || {})) {
      if (typeof ts === 'number' && now - ts < 48 * 60 * 60 * 1000) {
        cleaned[k] = ts;
      }
    }
    const cache = await caches.open(ADHAN_CACHE_META);
    await cache.put(
      '/__fired_adhan_tags.json',
      new Response(JSON.stringify(cleaned), {
        headers: {'Content-Type': 'application/json'},
      }),
    );
  } catch {
    // ignore storage errors
  }
}

async function readDismissedPrayers() {
  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    const res = await cache.match('/__dismissed_prayers.json');
    if (!res) return {};
    const parsed = await res.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveDismissedPrayers(map) {
  try {
    const now = Date.now();
    const cleaned = {};
    for (const [k, ts] of Object.entries(map || {})) {
      if (typeof ts === 'number' && now - ts < 48 * 60 * 60 * 1000) {
        cleaned[k] = ts;
      }
    }
    const cache = await caches.open(ADHAN_CACHE_META);
    await cache.put(
      '/__dismissed_prayers.json',
      new Response(JSON.stringify(cleaned), {
        headers: {'Content-Type': 'application/json'},
      }),
    );
  } catch {
    // ignore storage errors
  }
}

async function dismissPrayerReminder(dateKey, prayerKey) {
  if (!dateKey || !prayerKey) return;
  const dismissKey = `${dateKey}-${prayerKey}`;
  const dismissed = await readDismissedPrayers();
  dismissed[dismissKey] = Date.now();
  await saveDismissedPrayers(dismissed);

  const alerts = await readScheduledAlerts();
  if (Array.isArray(alerts) && alerts.length > 0) {
    const filtered = alerts.filter(
      (item) =>
        !(
          item &&
          item.type === 'prayconfirm' &&
          item.dateKey === dateKey &&
          item.prayerKey === prayerKey
        ),
    );
    await saveScheduledAlerts(filtered);
  }

  try {
    const existing = await self.registration.getNotifications({
      includeTriggered: true,
    });
    for (const n of existing) {
      if (!n.tag) continue;
      if (
        n.tag.startsWith(`prayconfirm-${dateKey}-${prayerKey}`) ||
        n.tag === `adhan-${dateKey}-${prayerKey}` ||
        n.tag === `dua-${dateKey}-${prayerKey}` ||
        n.tag === `iqamah-${dateKey}-${prayerKey}`
      ) {
        n.close();
      }
    }
  } catch {
    // ignore getNotifications failures
  }
}

function buildNotificationOptions(item) {
  const prayerName = item.prayerNameAr || item.prayerName || 'الصلاة';
  const alertType = item.type || 'adhan';
  const actionTitle =
    alertType === 'pre-adhan'
      ? 'قربت الصلاة — فتح المؤذن'
      : alertType === 'tawasih'
        ? 'تشغيل ابتهال النقشبندي'
        : alertType === 'qiyam'
          ? 'تنبيه قيام الليل'
          : alertType === 'post-adhan-dua'
            ? 'سماع دعاء ما بعد الأذان'
            : alertType === 'salawat'
              ? 'استمع: صلِّ على النبي ﷺ'
              : alertType === 'prayconfirm'
                ? 'فتح الأذكار والصلاة'
                : alertType === 'post-prayer-azkar' ||
                    alertType === 'morning-azkar' ||
                    alertType === 'evening-azkar'
                  ? 'تشغيل الأذكار'
                  : 'تشغيل الصوت الآن';

  const actions = [
    {
      action: 'play-adhan',
      title: actionTitle,
    },
  ];

  if (
    item.dateKey &&
    item.prayerKey &&
    (alertType === 'prayconfirm' ||
      alertType === 'adhan' ||
      alertType === 'post-adhan-dua' ||
      alertType === 'iqamah')
  ) {
    actions.push({
      action: 'mark-prayed',
      title: 'صليت ✓',
    });
  }

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
    vibrate: [500, 150, 500, 150, 700, 150, 500],
    actions,
    data: {
      audioUrl: item.audioUrl || '',
      type: alertType,
      prayerNameAr: prayerName,
      voiceId: item.voiceId || '',
      title: item.title || 'البرنامج الإسلامي الذهبي',
      dateKey: item.dateKey || '',
      prayerKey: item.prayerKey || '',
    },
  };
}

async function checkAndFireDueAlerts() {
  const alerts = await readScheduledAlerts();
  if (!Array.isArray(alerts) || alerts.length === 0) return;

  const firedTags = await readFiredTags();
  const dismissedPrayers = await readDismissedPrayers();
  const now = Date.now();
  const remaining = [];
  let firedAny = false;

  for (const item of alerts) {
    if (!item || typeof item.timestamp !== 'number') continue;
    if (
      item.type === 'prayconfirm' &&
      item.dateKey &&
      item.prayerKey &&
      dismissedPrayers[`${item.dateKey}-${item.prayerKey}`]
    ) {
      continue;
    }

    const tag = item.tag || `alert-${item.timestamp}`;
    const elapsed = now - item.timestamp;

    // Fire due alerts within 30-minute background sync catch-up window once
    if (elapsed >= 0 && elapsed <= 30 * 60 * 1000 && !firedTags[tag]) {
      firedTags[tag] = now;
      firedAny = true;
      try {
        await self.registration.showNotification(
          item.title || 'البرنامج الإسلامي الذهبي',
          buildNotificationOptions(item),
        );
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
            title: item.title || 'البرنامج الإسلامي الذهبي',
            dateKey: item.dateKey || '',
            prayerKey: item.prayerKey || '',
          });
        }
      } catch {
        // notification permission might not be granted
      }
    } else if (item.timestamp > now) {
      remaining.push(item);
    }
  }

  if (firedAny) {
    await saveFiredTags(firedTags);
  }
  await saveScheduledAlerts(remaining);
}

let lastWakeupCheckTs = 0;

self.addEventListener('activate', (event) => {
  event.waitUntil(checkAndFireDueAlerts());
});

self.addEventListener('fetch', (event) => {
  const now = Date.now();
  if (now - lastWakeupCheckTs > 15 * 1000) {
    lastWakeupCheckTs = now;
    event.waitUntil(checkAndFireDueAlerts());
  }
});

self.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload) return;

  if (payload.type === 'CHECK_DUE_ADHAN_ALERTS') {
    event.waitUntil(
      (async () => {
        await checkAndFireDueAlerts();
        const dismissed = await readDismissedPrayers();
        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({
            type: 'DISMISSED_PRAYERS_SNAPSHOT',
            dismissed,
          });
        }
      })(),
    );
    return;
  }

  if (payload.type === 'DISMISS_PRAYER_REMINDER') {
    event.waitUntil(dismissPrayerReminder(payload.dateKey, payload.prayerKey));
    return;
  }

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

  const rawAlerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  event.waitUntil(
    (async () => {
      const dismissedPrayers = await readDismissedPrayers();
      const alerts = rawAlerts.filter(
        (item) =>
          !(
            item &&
            item.type === 'prayconfirm' &&
            item.dateKey &&
            item.prayerKey &&
            dismissedPrayers[`${item.dateKey}-${item.prayerKey}`]
          ),
      );
      await saveScheduledAlerts(alerts);
      await checkAndFireDueAlerts();

      // Schedule native TimestampTrigger notifications when browser/installed PWA supports Notification Triggers
      if (typeof self.TimestampTrigger === 'function') {
        try {
          const existing = await self.registration.getNotifications({
            includeTriggered: true,
          });
          for (const n of existing) {
            if (
              n.tag &&
              (n.tag.startsWith('adhan-') ||
                n.tag.startsWith('preadhan-') ||
                n.tag.startsWith('iqamah-') ||
                n.tag.startsWith('dua-') ||
                n.tag.startsWith('prayconfirm-') ||
                n.tag.startsWith('qiyam-') ||
                n.tag.startsWith('tawasih-') ||
                n.tag.startsWith('azkar-') ||
                n.tag.startsWith('kahf-') ||
                n.tag.startsWith('eid-') ||
                n.tag.startsWith('salawat-'))
            ) {
              n.close();
            }
          }
          const firedTags = await readFiredTags();
          const now = Date.now();
          for (const item of alerts) {
            if (item.timestamp > now + 2000 && !firedTags[item.tag]) {
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
          // TimestampTrigger not active on this browser build; periodicSync + sync remain active
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

self.addEventListener('push', (event) => {
  if (!event.data) {
    event.waitUntil(checkAndFireDueAlerts());
    return;
  }
  event.waitUntil(
    (async () => {
      try {
        const data = event.data.json();
        await self.registration.showNotification(
          data.title || 'البرنامج الإسلامي الذهبي',
          buildNotificationOptions(data),
        );
      } catch {
        await checkAndFireDueAlerts();
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'mark-prayed' && data.dateKey && data.prayerKey) {
    event.waitUntil(
      (async () => {
        await dismissPrayerReminder(data.dateKey, data.prayerKey);
        const clientsArr = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of clientsArr) {
          client.postMessage({
            type: 'MARK_PRAYER_CONFIRMED',
            dateKey: data.dateKey,
            prayerKey: data.prayerKey,
          });
        }
      })(),
    );
    return;
  }

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
              title: data.title,
              dateKey: data.dateKey || '',
              prayerKey: data.prayerKey || '',
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
