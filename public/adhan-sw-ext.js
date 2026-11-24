// Background Adhan, Pre-Adhan, Dua, Iqamah, Pray-Confirm, Tawasih, Azkar & Salawat Service Worker Extension
// Enables reliable background alerts via Notification Triggers (TimestampTrigger), Periodic Background Sync, and Background Sync.

const ADHAN_CACHE_META = 'al-zahabi-scheduled-alerts-v2';
const OFFLINE_AUDIO_BUCKET = 'alzahabi-offline-audio-v1';
const OFFLINE_CORE_BUCKET = 'alzahabi-core-data-v1';
const OFFLINE_DL_NOTIF_TAG = 'alzahabi-full-offline-download';
const OFFLINE_AUTO_UPDATE_NOTIF_TAG = 'alzahabi-offline-auto-update';
let offlineDownloadRunning = false;
let offlineDownloadPauseRequested = false;
let lastAutoUpdateCheckTs = 0;

async function saveOfflineDlState(state) {
  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    await cache.put(
      '/__offline_download_state.json',
      new Response(JSON.stringify(state || {}), {
        headers: {'Content-Type': 'application/json'},
      }),
    );
  } catch {
    // ignore storage errors
  }
}

async function readOfflineDlState() {
  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    const res = await cache.match('/__offline_download_state.json');
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function broadcastOfflineDownload(payload) {
  try {
    const clientsArr = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clientsArr) {
      client.postMessage(payload);
    }
  } catch {
    // ignore broadcast failures
  }
}

async function showOfflineDownloadNotification(
  title,
  body,
  completed,
  mode = 'downloading',
) {
  try {
    const actions =
      mode === 'downloading'
        ? [{action: 'pause-offline-download', title: 'إيقاف مؤقت ⏸'}]
        : mode === 'paused'
          ? [{action: 'resume-offline-download', title: 'استكمال التحميل ▶'}]
          : [];
    await self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: OFFLINE_DL_NOTIF_TAG,
      renotify: completed,
      requireInteraction: completed || mode === 'paused',
      silent: !completed,
      actions,
      data: {
        type: 'offline-download',
        completed,
        mode,
      },
    });
  } catch {
    // notification permission might not be granted
  }
}

async function isUrlAlreadyCached(url) {
  if (!url) return false;
  try {
    const bucket =
      url.endsWith('.json') || url.endsWith('.html')
        ? OFFLINE_CORE_BUCKET
        : OFFLINE_AUDIO_BUCKET;
    const cache = await caches.open(bucket);
    const existing = await cache.match(url);
    return !!existing;
  } catch {
    return false;
  }
}

async function cacheOneOfflineUrl(url, forceRefresh = false) {
  if (!url) return false;
  const bucket =
    url.endsWith('.json') || url.endsWith('.html')
      ? OFFLINE_CORE_BUCKET
      : OFFLINE_AUDIO_BUCKET;
  try {
    const cache = await caches.open(bucket);
    if (!forceRefresh) {
      const existing = await cache.match(url);
      if (existing) return true;
    }

    try {
      const corsRes = await fetch(url, {
        mode: 'cors',
        cache: forceRefresh ? 'no-store' : 'default',
      });
      if (corsRes.ok) {
        await cache.put(url, corsRes);
        return true;
      }
    } catch {
      // Fallback to opaque no-cors response for external CDNs
    }

    const noCorsRes = await fetch(url, {
      mode: 'no-cors',
      cache: forceRefresh ? 'no-store' : 'default',
    });
    await cache.put(url, noCorsRes);
    return true;
  } catch {
    return false;
  }
}

async function runFullOfflineDownload(
  urls,
  resumeFromIndex = 0,
  contentVersion = '',
) {
  if (offlineDownloadRunning) return;
  const cleanUrls = Array.isArray(urls)
    ? Array.from(new Set(urls.filter(Boolean)))
    : [];
  const total = cleanUrls.length;
  if (total === 0) return;

  offlineDownloadRunning = true;
  offlineDownloadPauseRequested = false;

  const prevState = await readOfflineDlState();
  const effectiveVersion =
    contentVersion || (prevState && prevState.contentVersion) || '';

  let completed = Math.min(total, Math.max(0, resumeFromIndex));
  let cursor = completed;
  let lastNotifiedPercent = -1;

  const initialPercent = Math.round((completed / total) * 100);
  await saveOfflineDlState({
    status: 'downloading',
    urls: cleanUrls,
    done: completed,
    total,
    percent: initialPercent,
    contentVersion: effectiveVersion,
    autoUpdateEnabled: true,
    updatedAt: Date.now(),
  });

  await showOfflineDownloadNotification(
    `جاري تحميل محتوى التطبيق (${initialPercent}%)`,
    `تم تحميل ${initialPercent}% — يستمر التحميل في الخلفية حتى لو أغلقت التطبيق`,
    false,
    'downloading',
  );
  await broadcastOfflineDownload({
    type: 'OFFLINE_DOWNLOAD_PROGRESS',
    status: 'downloading',
    done: completed,
    total,
    percent: initialPercent,
  });

  const concurrency = 5;
  const worker = async () => {
    while (cursor < total && !offlineDownloadPauseRequested) {
      const idx = cursor++;
      await cacheOneOfflineUrl(cleanUrls[idx], false);
      if (offlineDownloadPauseRequested) {
        // Already cached item counted; exit cleanly without overwriting paused state
        completed++;
        break;
      }
      completed++;
      const percent = Math.min(99, Math.round((completed / total) * 100));

      const shouldNotify =
        percent !== lastNotifiedPercent &&
        (percent % 5 === 0 || completed === 1 || completed === total);
      if (shouldNotify && !offlineDownloadPauseRequested) {
        lastNotifiedPercent = percent;
        await saveOfflineDlState({
          status: 'downloading',
          urls: cleanUrls,
          done: completed,
          total,
          percent,
          contentVersion: effectiveVersion,
          autoUpdateEnabled: true,
          updatedAt: Date.now(),
        });
        await broadcastOfflineDownload({
          type: 'OFFLINE_DOWNLOAD_PROGRESS',
          status: 'downloading',
          done: completed,
          total,
          percent,
        });
        await showOfflineDownloadNotification(
          `جاري تحميل محتوى التطبيق (${percent}%)`,
          `تم تحميل ${percent}% (${completed} من ${total}) — يستمر التحميل حتى لو أغلقت التطبيق`,
          false,
          'downloading',
        );
      }
    }
  };

  try {
    await Promise.all(
      Array.from(
        {length: Math.min(concurrency, Math.max(1, total - completed))},
        () => worker(),
      ),
    );

    if (offlineDownloadPauseRequested && completed < total) {
      const pausedPercent = Math.min(99, Math.round((completed / total) * 100));
      await saveOfflineDlState({
        status: 'paused',
        urls: cleanUrls,
        done: completed,
        total,
        percent: pausedPercent,
        contentVersion: effectiveVersion,
        autoUpdateEnabled: true,
        updatedAt: Date.now(),
      });
      await broadcastOfflineDownload({
        type: 'OFFLINE_DOWNLOAD_PAUSED',
        status: 'paused',
        done: completed,
        total,
        percent: pausedPercent,
      });
      await showOfflineDownloadNotification(
        `تم إيقاف التحميل مؤقتًا (${pausedPercent}%)`,
        `محفوظ ${completed} من ${total} ملف — يمكنك استكمال التحميل وقت ما تشاء`,
        false,
        'paused',
      );
      return;
    }

    await saveOfflineDlState({
      status: 'completed',
      urls: cleanUrls,
      done: total,
      total,
      percent: 100,
      contentVersion: effectiveVersion,
      autoUpdateEnabled: true,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type: 'OFFLINE_DOWNLOAD_COMPLETE',
      status: 'completed',
      done: total,
      total,
      percent: 100,
    });
    await showOfflineDownloadNotification(
      'تم تحميل المحتوى كامل ✓ (100%)',
      'تم تحميل محتوي التطبيق كلو — يعمل الآن بدون نت ويتحدث تلقائيًا',
      true,
      'completed',
    );
  } finally {
    offlineDownloadRunning = false;
  }
}

async function pauseActiveOfflineDownload() {
  offlineDownloadPauseRequested = true;
  if (offlineDownloadRunning) {
    // Active worker loop will save 'paused' state on next tick
    return;
  }
  const state = await readOfflineDlState();
  if (state && state.status === 'downloading') {
    const done = typeof state.done === 'number' ? state.done : 0;
    const total = typeof state.total === 'number' ? state.total : 0;
    const percent = total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0;
    await saveOfflineDlState({
      ...state,
      status: 'paused',
      percent,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type: 'OFFLINE_DOWNLOAD_PAUSED',
      status: 'paused',
      done,
      total,
      percent,
    });
    await showOfflineDownloadNotification(
      `تم إيقاف التحميل مؤقتًا (${percent}%)`,
      `محفوظ ${done} من ${total} ملف — يمكنك استكمال التحميل وقت ما تشاء`,
      false,
      'paused',
    );
  }
}

async function resumeSavedOfflineDownload() {
  if (offlineDownloadRunning) return;
  const state = await readOfflineDlState();
  if (
    state &&
    Array.isArray(state.urls) &&
    state.urls.length > 0 &&
    (state.status === 'paused' || state.status === 'downloading')
  ) {
    const doneIdx = typeof state.done === 'number' ? state.done : 0;
    await runFullOfflineDownload(
      state.urls,
      doneIdx,
      state.contentVersion || '',
    );
  }
}

async function resumePendingOfflineDownloadIfNeeded() {
  if (offlineDownloadRunning || offlineDownloadPauseRequested) return;
  const state = await readOfflineDlState();
  if (
    state &&
    state.status === 'downloading' &&
    Array.isArray(state.urls) &&
    state.urls.length > 0 &&
    typeof state.done === 'number' &&
    state.done < state.urls.length
  ) {
    await runFullOfflineDownload(
      state.urls,
      state.done,
      state.contentVersion || '',
    );
  }
}

/**
 * Checks for new developer updates / added content in background (works on Wi-Fi or Mobile Data
 * even when the app is closed). Only downloads new or updated files quietly in the background.
 */
async function checkForAppContentUpdatesInBackground(
  clientUrls = null,
  clientVersion = '',
) {
  if (offlineDownloadRunning) return;
  const state = await readOfflineDlState();
  if (!state || (!state.autoUpdateEnabled && state.status !== 'completed')) {
    return;
  }
  if (state.status === 'paused') return;

  try {
    // Ask Service Worker to check for updated app bundle / SW script in background
    if (self.registration && typeof self.registration.update === 'function') {
      self.registration.update().catch(() => {});
    }

    let manifestAssets = [];
    let serverVersion = clientVersion || '';
    try {
      const mRes = await fetch(`/offline-content-manifest.json?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (mRes.ok) {
        const mJson = await mRes.json();
        if (mJson && typeof mJson.contentVersion === 'string') {
          serverVersion = mJson.contentVersion;
        }
        if (mJson && Array.isArray(mJson.assets)) {
          manifestAssets = mJson.assets.filter(Boolean);
        }
      }
    } catch {
      // ignore if offline right now
    }

    const combinedUrls = Array.from(
      new Set([
        ...(Array.isArray(state.urls) ? state.urls : []),
        ...(Array.isArray(clientUrls) ? clientUrls : []),
        ...manifestAssets,
      ]),
    );

    const versionChanged =
      Boolean(serverVersion) && serverVersion !== (state.contentVersion || '');

    // Find any URLs that are NOT yet cached (new content added in app update!)
    const missingUrls = [];
    for (const u of combinedUrls) {
      const cached = await isUrlAlreadyCached(u);
      if (!cached) {
        missingUrls.push(u);
      }
    }

    // If app contentVersion changed, also refresh core data JSONs & manifest assets
    const refreshUrls = versionChanged
      ? Array.from(new Set(['/data/quran.json', '/data/tafsir.json', ...manifestAssets]))
      : [];

    const toFetch = Array.from(new Set([...refreshUrls, ...missingUrls]));
    if (toFetch.length === 0 && !versionChanged) {
      return;
    }

    let updatedCount = 0;
    for (const u of toFetch) {
      const force = refreshUrls.includes(u);
      const ok = await cacheOneOfflineUrl(u, force);
      if (ok) updatedCount++;
    }

    await saveOfflineDlState({
      ...state,
      status: 'completed',
      urls: combinedUrls,
      done: combinedUrls.length,
      total: combinedUrls.length,
      percent: 100,
      contentVersion: serverVersion || state.contentVersion || '',
      autoUpdateEnabled: true,
      updatedAt: Date.now(),
    });

    if (updatedCount > 0 || versionChanged) {
      await broadcastOfflineDownload({
        type: 'OFFLINE_AUTO_UPDATE_APPLIED',
        updatedCount,
        contentVersion: serverVersion || state.contentVersion || '',
      });
      try {
        await self.registration.showNotification(
          'تم تحديث محتوى التطبيق تلقائيًا ✓',
          {
            body: 'تم تحميل التحديثات والإضافات الجديدة في الخلفية — التطبيق محدّث ويعمل بدون نت',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'ar',
            tag: OFFLINE_AUTO_UPDATE_NOTIF_TAG,
            silent: true,
            data: {type: 'offline-download', completed: true},
          },
        );
      } catch {
        // ignore notification errors
      }
    }
  } catch {
    // ignore background check failures when offline
  }
}

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
  event.waitUntil(
    Promise.all([
      checkAndFireDueAlerts(),
      resumePendingOfflineDownloadIfNeeded(),
      checkForAppContentUpdatesInBackground(),
    ]),
  );
});

self.addEventListener('fetch', () => {
  const now = Date.now();
  if (now - lastWakeupCheckTs > 15 * 1000) {
    lastWakeupCheckTs = now;
    checkAndFireDueAlerts().catch(() => {});
  }
  if (now - lastAutoUpdateCheckTs > 30 * 60 * 1000) {
    lastAutoUpdateCheckTs = now;
    checkForAppContentUpdatesInBackground().catch(() => {});
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

  if (payload.type === 'START_FULL_OFFLINE_DOWNLOAD') {
    const urls = Array.isArray(payload.urls) ? payload.urls : [];
    const contentVersion =
      typeof payload.contentVersion === 'string' ? payload.contentVersion : '';
    event.waitUntil(runFullOfflineDownload(urls, 0, contentVersion));
    return;
  }

  if (payload.type === 'PAUSE_FULL_OFFLINE_DOWNLOAD') {
    event.waitUntil(pauseActiveOfflineDownload());
    return;
  }

  if (payload.type === 'RESUME_FULL_OFFLINE_DOWNLOAD') {
    event.waitUntil(resumeSavedOfflineDownload());
    return;
  }

  if (payload.type === 'SYNC_FULL_OFFLINE_MANIFEST') {
    const urls = Array.isArray(payload.urls) ? payload.urls : null;
    const contentVersion =
      typeof payload.contentVersion === 'string' ? payload.contentVersion : '';
    event.waitUntil(checkForAppContentUpdatesInBackground(urls, contentVersion));
    return;
  }

  if (payload.type === 'GET_OFFLINE_DOWNLOAD_STATE') {
    event.waitUntil(
      (async () => {
        const state = await readOfflineDlState();
        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({
            type: 'OFFLINE_DOWNLOAD_STATE_SNAPSHOT',
            state,
          });
        }
      })(),
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
    event.waitUntil(
      Promise.all([
        checkAndFireDueAlerts(),
        resumePendingOfflineDownloadIfNeeded(),
        checkForAppContentUpdatesInBackground(),
      ]),
    );
  } else if (event.tag === 'offline-auto-update-check') {
    event.waitUntil(
      Promise.all([
        resumePendingOfflineDownloadIfNeeded(),
        checkForAppContentUpdatesInBackground(),
      ]),
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'adhan-background-check') {
    event.waitUntil(
      Promise.all([
        checkAndFireDueAlerts(),
        resumePendingOfflineDownloadIfNeeded(),
      ]),
    );
  } else if (event.tag === 'offline-pack-download') {
    event.waitUntil(resumePendingOfflineDownloadIfNeeded());
  } else if (event.tag === 'offline-auto-update-check') {
    event.waitUntil(checkForAppContentUpdatesInBackground());
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

  if (event.action === 'pause-offline-download') {
    event.waitUntil(pauseActiveOfflineDownload());
    return;
  }

  if (event.action === 'resume-offline-download') {
    event.waitUntil(resumeSavedOfflineDownload());
    return;
  }

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

  if (data.type === 'offline-download') {
    event.waitUntil(
      self.clients
        .matchAll({type: 'window', includeUncontrolled: true})
        .then((clientsArr) => {
          for (const client of clientsArr) {
            if ('focus' in client) return client.focus();
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow('/');
          }
        }),
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
