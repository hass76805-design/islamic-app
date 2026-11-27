// Background Adhan, Pre-Adhan, Dua, Iqamah, Pray-Confirm, Tawasih, Azkar & Salawat Service Worker Extension
// Enables reliable background alerts via Notification Triggers (TimestampTrigger), Periodic Background Sync, and Background Sync.

const ADHAN_CACHE_META = 'al-zahabi-scheduled-alerts-v2';
const OFFLINE_AUDIO_BUCKET = 'audio-cache-v1';
const OFFLINE_LEGACY_AUDIO_BUCKET = 'alzahabi-offline-audio-v1';
const OFFLINE_CORE_BUCKET = 'alzahabi-core-data-v1';
const OFFLINE_DL_NOTIF_TAG = 'alzahabi-full-offline-download';
const OFFLINE_AUTO_UPDATE_NOTIF_TAG = 'alzahabi-offline-auto-update';
const TOTAL_PACKAGE_MB = 850;

const OFFLINE_IDB_NAME = 'alzahabi-offline-json-db';
const OFFLINE_IDB_VERSION = 4;

let offlineDownloadRunning = false;
let offlineDownloadPauseRequested = false;
let offlineDownloadCancelRequested = false;
let offlineNetworkInterrupted = false;
let lastAutoUpdateCheckTs = 0;

function openOfflineIdbInSw() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(OFFLINE_IDB_NAME, OFFLINE_IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('json_cache')) {
          db.createObjectStore('json_cache');
        }
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs');
        }
        if (!db.objectStoreNames.contains('voice_history')) {
          db.createObjectStore('voice_history', {keyPath: 'id'});
        }
        if (!db.objectStoreNames.contains('offline_meta')) {
          db.createObjectStore('offline_meta');
        }
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
        if (!db.objectStoreNames.contains('downloads')) {
          db.createObjectStore('downloads', {keyPath: 'id'});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function swIdbRead(storeName, key) {
  const db = await openOfflineIdbInSw();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function swIdbWrite(storeName, key, value) {
  const db = await openOfflineIdbInSw();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function saveSwAudioBlobToIdb(url, blob) {
  if (!url || !blob || blob.size === 0) return;
  await swIdbWrite('audio_blobs', url, blob);
}

async function saveSwJsonToIdb(url, data) {
  if (!url || data === undefined || data === null) return;
  await swIdbWrite('json_cache', url, data);
}

async function swFetchWithTimeout(url, init = {}, timeoutMs = 15000) {
  if (typeof AbortController === 'undefined') {
    return fetch(url, init);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...init, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}

function computeMbStats(
  done,
  total,
  completedAll,
  targetTotalMb = TOTAL_PACKAGE_MB,
) {
  const safeTotalMb =
    typeof targetTotalMb === 'number' && targetTotalMb > 0
      ? targetTotalMb
      : TOTAL_PACKAGE_MB;
  if (completedAll && total > 0 && done >= total) {
    return {
      percent: 100,
      downloadedMb: safeTotalMb,
      remainingMb: 0,
      totalMb: safeTotalMb,
    };
  }
  const ratio = total > 0 ? Math.min(0.999, Math.max(0, done / total)) : 0;
  const downloadedMb = Math.min(
    Math.max(0, safeTotalMb - 1),
    Math.max(0, Math.round(ratio * safeTotalMb)),
  );
  const remainingMb = Math.max(1, safeTotalMb - downloadedMb);
  const percent = Math.min(99, Math.max(0, Math.round(ratio * 100)));
  return {
    percent,
    downloadedMb,
    remainingMb,
    totalMb: safeTotalMb,
  };
}

async function saveOfflineDlState(state) {
  const payload = {
    ...(state || {}),
    storageEngine: 'IndexedDB+CacheStorage',
    updatedAt: Date.now(),
  };
  // Primary permanent IndexedDB persistence
  await swIdbWrite('offline_meta', 'offline_download_state', payload);
  if (Array.isArray(payload.sections) && payload.sections.length > 0 && payload.status === 'completed') {
    const existing = await swIdbRead('offline_meta', 'downloaded_sections');
    const merged = Array.from(
      new Set([...(Array.isArray(existing) ? existing : []), ...payload.sections]),
    );
    await swIdbWrite('offline_meta', 'downloaded_sections', merged);
  }
  if (payload.status === 'completed') {
    await swIdbWrite('offline_meta', 'offline_ready_flag', true);
  } else if (payload.status === 'idle') {
    await swIdbWrite('offline_meta', 'offline_ready_flag', false);
  }

  try {
    const cache = await caches.open(ADHAN_CACHE_META);
    await cache.put(
      '/__offline_download_state.json',
      new Response(JSON.stringify(payload), {
        headers: {'Content-Type': 'application/json'},
      }),
    );
  } catch {
    // ignore storage errors
  }
}

async function readOfflineDlState() {
  try {
    const fromIdb = await swIdbRead('offline_meta', 'offline_download_state');
    if (fromIdb && typeof fromIdb === 'object') {
      return fromIdb;
    }
  } catch {
    // fallback to CacheStorage
  }
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

async function closeOfflineDownloadNotification() {
  try {
    const existing = await self.registration.getNotifications({
      tag: OFFLINE_DL_NOTIF_TAG,
    });
    for (const n of existing) {
      n.close();
    }
  } catch {
    // ignore
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
      mode === 'downloading' || mode === 'updating'
        ? [
            {action: 'pause-offline-download', title: 'إيقاف مؤقت ⏸'},
            {action: 'cancel-offline-download', title: 'إلغاء ✕'},
          ]
        : mode === 'paused' || mode === 'offline_paused'
          ? [
              {action: 'resume-offline-download', title: 'استئناف ▶'},
              {action: 'cancel-offline-download', title: 'إلغاء ✕'},
            ]
          : [];
    await self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: OFFLINE_DL_NOTIF_TAG,
      renotify: completed || mode === 'offline_paused',
      requireInteraction:
        completed || mode === 'paused' || mode === 'offline_paused',
      silent: !completed && mode !== 'offline_paused',
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
    if (url.endsWith('.json')) {
      const jsonHit = await swIdbRead('json_cache', url);
      if (jsonHit !== null) return true;
    } else {
      const blobHit = await swIdbRead('audio_blobs', url);
      if (blobHit && blobHit.size > 0) return true;
    }
  } catch {
    // fallback to CacheStorage
  }
  try {
    const bucket =
      url.endsWith('.json') || url.endsWith('.html')
        ? OFFLINE_CORE_BUCKET
        : OFFLINE_AUDIO_BUCKET;
    const cache = await caches.open(bucket);
    const existing =
      (await cache.match(url)) ||
      (bucket === OFFLINE_AUDIO_BUCKET
        ? await caches.open(OFFLINE_LEGACY_AUDIO_BUCKET).then((c) => c.match(url))
        : null);
    return !!existing;
  } catch {
    return false;
  }
}

async function cacheOneOfflineUrl(url, forceRefresh = false) {
  if (!url) return {ok: false, offline: false};
  const bucket =
    url.endsWith('.json') || url.endsWith('.html')
      ? OFFLINE_CORE_BUCKET
      : OFFLINE_AUDIO_BUCKET;
  try {
    const cache = await caches.open(bucket);
    if (!forceRefresh) {
      if (url.endsWith('.json')) {
        const jsonIdb = await swIdbRead('json_cache', url);
        if (jsonIdb !== null) return {ok: true, fromCache: true};
      }
      const existing = await cache.match(url);
      if (existing) {
        if (url.endsWith('.json') && existing.ok) {
          try {
            const parsed = await existing.clone().json();
            await saveSwJsonToIdb(url, parsed);
          } catch {
            // ignore
          }
        } else if (bucket === OFFLINE_AUDIO_BUCKET && existing.type !== 'opaque') {
          try {
            const existingBlob = await swIdbRead('audio_blobs', url);
            if (!existingBlob) {
              const b = await existing.clone().blob();
              if (b && b.size > 0) await saveSwAudioBlobToIdb(url, b);
            }
          } catch {
            // ignore
          }
        }
        return {ok: true, fromCache: true};
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {ok: false, offline: true};
    }

    const isSameOrigin =
      url.startsWith('/') || url.startsWith(self.location.origin);

    if (isSameOrigin) {
      const res = await swFetchWithTimeout(
        url,
        {cache: forceRefresh ? 'no-store' : 'default'},
        15000,
      );
      if (res.ok) {
        if (url.endsWith('.json')) {
          try {
            const parsed = await res.clone().json();
            await saveSwJsonToIdb(url, parsed);
          } catch {
            // ignore
          }
        } else if (bucket === OFFLINE_AUDIO_BUCKET) {
          try {
            const b = await res.clone().blob();
            if (b && b.size > 0) await saveSwAudioBlobToIdb(url, b);
          } catch {
            // ignore
          }
        }
        await cache.put(url, res);
        return {ok: true, fromCache: false};
      }
      return {ok: false, offline: false};
    }

    try {
      const corsRes = await swFetchWithTimeout(
        url,
        {
          mode: 'cors',
          cache: forceRefresh ? 'no-store' : 'default',
        },
        15000,
      );
      if (corsRes.ok) {
        if (bucket === OFFLINE_AUDIO_BUCKET) {
          try {
            const b = await corsRes.clone().blob();
            if (b && b.size > 0) await saveSwAudioBlobToIdb(url, b);
          } catch {
            // ignore
          }
        }
        await cache.put(url, corsRes);
        return {ok: true, fromCache: false};
      }
      if (corsRes.status === 404 || corsRes.status === 410) {
        return {ok: false, offline: false};
      }
    } catch {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {ok: false, offline: true};
      }
    }

    // Fallback to opaque no-cors response for external audio CDNs without ACAO.
    // Note: no-cors fetch ONLY throws when network/DNS is unreachable (offline).
    try {
      const noCorsRes = await swFetchWithTimeout(
        url,
        {
          mode: 'no-cors',
          cache: forceRefresh ? 'no-store' : 'default',
        },
        15000,
      );
      await cache.put(url, noCorsRes);
      return {ok: true, fromCache: false};
    } catch {
      return {ok: false, offline: true};
    }
  } catch {
    return {
      ok: false,
      offline: typeof navigator !== 'undefined' && navigator.onLine === false,
    };
  }
}

async function runFullOfflineDownload(
  urls,
  contentVersion = '',
  mode = 'full',
  targetTotalMb = TOTAL_PACKAGE_MB,
  sections = null,
  activeSectionId = undefined,
) {
  if (offlineDownloadRunning) return;
  const cleanUrls = Array.isArray(urls)
    ? Array.from(new Set(urls.filter(Boolean)))
    : [];
  const total = cleanUrls.length;
  if (total === 0) return;
  const safeTotalMb =
    typeof targetTotalMb === 'number' && targetTotalMb > 0
      ? targetTotalMb
      : TOTAL_PACKAGE_MB;

  offlineDownloadRunning = true;
  offlineDownloadPauseRequested = false;
  offlineDownloadCancelRequested = false;
  offlineNetworkInterrupted = false;

  const prevState = await readOfflineDlState();
  const effectiveVersion =
    contentVersion || (prevState && prevState.contentVersion) || '';
  const effectiveSections = Array.isArray(sections)
    ? sections
    : prevState && Array.isArray(prevState.sections)
      ? prevState.sections
      : [];
  const effectiveActiveSectionId =
    activeSectionId || (prevState && prevState.activeSectionId) || undefined;

  // Scan what is already cached so resume ALWAYS continues from exact stopped position
  let alreadyCachedCount = 0;
  const pendingUrls = [];
  for (let i = 0; i < cleanUrls.length; i += 40) {
    const chunk = cleanUrls.slice(i, i + 40);
    const results = await Promise.all(
      chunk.map((u) => isUrlAlreadyCached(u)),
    );
    for (let j = 0; j < chunk.length; j++) {
      if (results[j]) {
        alreadyCachedCount++;
      } else {
        pendingUrls.push(chunk[j]);
      }
    }
  }

  let completed = alreadyCachedCount;
  let cursor = 0;
  let consecutiveNetFailures = 0;
  let lastNotifiedPercent = -1;

  // If 100% of items are already verified cached, complete cleanly right away
  if (pendingUrls.length === 0) {
    const doneStats = computeMbStats(total, total, true, safeTotalMb);
    await saveOfflineDlState({
      status: 'completed',
      mode,
      activeSectionId: effectiveActiveSectionId,
      sections: effectiveSections,
      urls: cleanUrls,
      done: total,
      total,
      ...doneStats,
      contentVersion: effectiveVersion,
      autoUpdateEnabled: true,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type:
        mode === 'updating'
          ? 'OFFLINE_AUTO_UPDATE_APPLIED'
          : 'OFFLINE_DOWNLOAD_COMPLETE',
      status: 'completed',
      mode,
      activeSectionId: effectiveActiveSectionId,
      sections: effectiveSections,
      done: total,
      total,
      ...doneStats,
      contentVersion: effectiveVersion,
    });
    await showOfflineDownloadNotification(
      'تم تحميل المحتوى بالكامل ✓ (100%)',
      `تم تحميل ${safeTotalMb} من ${safeTotalMb} ميجا — يعمل الآن بدون إنترنت بالكامل`,
      true,
      'completed',
    );
    offlineDownloadRunning = false;
    return;
  }

  const initStats = computeMbStats(completed, total, false, safeTotalMb);
  await saveOfflineDlState({
    status: 'downloading',
    mode,
    activeSectionId: effectiveActiveSectionId,
    sections: effectiveSections,
    urls: cleanUrls,
    done: completed,
    total,
    ...initStats,
    contentVersion: effectiveVersion,
    autoUpdateEnabled: true,
    updatedAt: Date.now(),
  });

  const initTitle =
    mode === 'updating'
      ? `جاري تحديث محتوى التطبيق (${initStats.percent}%)`
      : `جاري تحميل المحتوى (${initStats.percent}%)`;
  const initBody = `تم تحميل ${initStats.downloadedMb} ميجا من ${safeTotalMb} ميجا — باقي ${initStats.remainingMb} ميجا`;

  await showOfflineDownloadNotification(initTitle, initBody, false, mode);
  await broadcastOfflineDownload({
    type: 'OFFLINE_DOWNLOAD_PROGRESS',
    status: 'downloading',
    mode,
    activeSectionId: effectiveActiveSectionId,
    sections: effectiveSections,
    done: completed,
    total,
    ...initStats,
  });

  const concurrency = 4;
  const worker = async () => {
    while (
      cursor < pendingUrls.length &&
      !offlineDownloadPauseRequested &&
      !offlineDownloadCancelRequested &&
      !offlineNetworkInterrupted
    ) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        offlineNetworkInterrupted = true;
        break;
      }

      const idx = cursor++;
      const url = pendingUrls[idx];
      let res = await cacheOneOfflineUrl(url, false);

      if (
        !res.ok &&
        !res.offline &&
        !offlineDownloadPauseRequested &&
        !offlineDownloadCancelRequested &&
        !offlineNetworkInterrupted
      ) {
        await new Promise((r) => setTimeout(r, 250));
        res = await cacheOneOfflineUrl(url, false);
      }

      if (offlineDownloadCancelRequested) {
        break;
      }

      if (!res.ok) {
        if (
          res.offline ||
          (typeof navigator !== 'undefined' && navigator.onLine === false)
        ) {
          offlineNetworkInterrupted = true;
          break;
        }
        consecutiveNetFailures++;
        if (consecutiveNetFailures >= 3) {
          offlineNetworkInterrupted = true;
          break;
        }
        continue;
      }

      consecutiveNetFailures = 0;
      completed++;

      if (offlineDownloadPauseRequested || offlineDownloadCancelRequested) {
        break;
      }

      const stats = computeMbStats(completed, total, false, safeTotalMb);
      const shouldNotify =
        stats.percent !== lastNotifiedPercent &&
        (stats.percent % 2 === 0 || completed === 1);

      if (shouldNotify) {
        lastNotifiedPercent = stats.percent;
        await saveOfflineDlState({
          status: 'downloading',
          mode,
          activeSectionId: effectiveActiveSectionId,
          sections: effectiveSections,
          urls: cleanUrls,
          done: completed,
          total,
          ...stats,
          contentVersion: effectiveVersion,
          autoUpdateEnabled: true,
          updatedAt: Date.now(),
        });
        await broadcastOfflineDownload({
          type: 'OFFLINE_DOWNLOAD_PROGRESS',
          status: 'downloading',
          mode,
          activeSectionId: effectiveActiveSectionId,
          sections: effectiveSections,
          done: completed,
          total,
          ...stats,
        });
        await showOfflineDownloadNotification(
          mode === 'updating'
            ? `جاري تحديث محتوى التطبيق (${stats.percent}%)`
            : `جاري تحميل المحتوى (${stats.percent}%)`,
          `تم تحميل ${stats.downloadedMb} ميجا من ${safeTotalMb} ميجا — باقي ${stats.remainingMb} ميجا`,
          false,
          mode,
        );
      }
    }
  };

  try {
    await Promise.all(
      Array.from(
        {length: Math.min(concurrency, pendingUrls.length)},
        () => worker(),
      ),
    );

    if (offlineDownloadCancelRequested) {
      await saveOfflineDlState({
        status: 'idle',
        activeSectionId: effectiveActiveSectionId,
        sections: effectiveSections,
        done: 0,
        total: 0,
        percent: 0,
        downloadedMb: 0,
        remainingMb: safeTotalMb,
        totalMb: safeTotalMb,
        contentVersion: effectiveVersion,
        autoUpdateEnabled: false,
        updatedAt: Date.now(),
      });
      await closeOfflineDownloadNotification();
      await broadcastOfflineDownload({
        type: 'OFFLINE_DOWNLOAD_CANCELLED',
        status: 'idle',
        activeSectionId: effectiveActiveSectionId,
        sections: effectiveSections,
        done: 0,
        total: 0,
        percent: 0,
        downloadedMb: 0,
        remainingMb: safeTotalMb,
        totalMb: safeTotalMb,
      });
      return;
    }

    if (offlineDownloadPauseRequested) {
      const pauseStats = computeMbStats(completed, total, false, safeTotalMb);
      await saveOfflineDlState({
        status: 'paused',
        pauseReason: 'user',
        mode,
        activeSectionId: effectiveActiveSectionId,
        sections: effectiveSections,
        urls: cleanUrls,
        done: completed,
        total,
        ...pauseStats,
        contentVersion: effectiveVersion,
        autoUpdateEnabled: true,
        updatedAt: Date.now(),
      });
      await broadcastOfflineDownload({
        type: 'OFFLINE_DOWNLOAD_PAUSED',
        status: 'paused',
        pauseReason: 'user',
        mode,
        activeSectionId: effectiveActiveSectionId,
        sections: effectiveSections,
        done: completed,
        total,
        ...pauseStats,
      });
      await showOfflineDownloadNotification(
        `التحميل متوقف مؤقتًا — باقي ${pauseStats.remainingMb} ميجا`,
        `تم تحميل ${pauseStats.downloadedMb} ميجا من ${safeTotalMb} ميجا (${pauseStats.percent}%) — اضغط استئناف للمتابعة`,
        false,
        'paused',
      );
      return;
    }

    if (offlineNetworkInterrupted || completed < total) {
      const offStats = computeMbStats(completed, total, false, safeTotalMb);
      await saveOfflineDlState({
        status: 'paused',
        pauseReason: 'offline',
        mode,
        activeSectionId: effectiveActiveSectionId,
        sections: effectiveSections,
        urls: cleanUrls,
        done: completed,
        total,
        ...offStats,
        contentVersion: effectiveVersion,
        autoUpdateEnabled: true,
        updatedAt: Date.now(),
      });
      await broadcastOfflineDownload({
        type: 'OFFLINE_DOWNLOAD_PAUSED',
        status: 'paused',
        pauseReason: 'offline',
        mode,
        activeSectionId: effectiveActiveSectionId,
        sections: effectiveSections,
        done: completed,
        total,
        ...offStats,
      });
      await showOfflineDownloadNotification(
        `التحميل متوقف — باقي ${offStats.remainingMb} ميجا`,
        `تم تحميل ${offStats.downloadedMb} من ${safeTotalMb} ميجا — سيكمل التحميل تلقائيًا فور عودة الإنترنت`,
        false,
        'offline_paused',
      );
      return;
    }

    const doneStats = computeMbStats(total, total, true, safeTotalMb);
    await saveOfflineDlState({
      status: 'completed',
      mode: 'full',
      activeSectionId: effectiveActiveSectionId,
      sections: effectiveSections,
      urls: cleanUrls,
      done: total,
      total,
      ...doneStats,
      contentVersion: effectiveVersion,
      autoUpdateEnabled: true,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type:
        mode === 'updating'
          ? 'OFFLINE_AUTO_UPDATE_APPLIED'
          : 'OFFLINE_DOWNLOAD_COMPLETE',
      status: 'completed',
      mode: 'full',
      activeSectionId: effectiveActiveSectionId,
      sections: effectiveSections,
      done: total,
      total,
      ...doneStats,
      contentVersion: effectiveVersion,
    });
    await showOfflineDownloadNotification(
      mode === 'updating'
        ? 'تم تحديث محتوى التطبيق تلقائيًا ✓ (100%)'
        : 'تم تحميل المحتوى بالكامل ✓ (100%)',
      `تم تحميل ${safeTotalMb} ميجا من ${safeTotalMb} ميجا — يعمل الآن بدون إنترنت بالكامل`,
      true,
      'completed',
    );
  } finally {
    offlineDownloadRunning = false;
    offlineDownloadPauseRequested = false;
    offlineDownloadCancelRequested = false;
    offlineNetworkInterrupted = false;
  }
}

async function pauseActiveOfflineDownload() {
  offlineDownloadPauseRequested = true;
  if (offlineDownloadRunning) {
    return;
  }
  const state = await readOfflineDlState();
  if (state && (state.status === 'downloading' || state.status === 'paused')) {
    const done = typeof state.done === 'number' ? state.done : 0;
    const total = typeof state.total === 'number' ? state.total : 0;
    const targetMb =
      typeof state.totalMb === 'number' && state.totalMb > 0
        ? state.totalMb
        : TOTAL_PACKAGE_MB;
    const stats = computeMbStats(done, total, false, targetMb);
    await saveOfflineDlState({
      ...state,
      status: 'paused',
      pauseReason: 'user',
      ...stats,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type: 'OFFLINE_DOWNLOAD_PAUSED',
      status: 'paused',
      pauseReason: 'user',
      mode: state.mode || 'full',
      sections: state.sections || [],
      done,
      total,
      ...stats,
    });
    await showOfflineDownloadNotification(
      `التحميل متوقف مؤقتًا — باقي ${stats.remainingMb} ميجا`,
      `تم تحميل ${stats.downloadedMb} ميجا من ${targetMb} ميجا (${stats.percent}%) — اضغط استئناف للمتابعة`,
      false,
      'paused',
    );
  }
}

async function cancelActiveOfflineDownload() {
  offlineDownloadCancelRequested = true;
  if (offlineDownloadRunning) {
    return;
  }
  const prevState = await readOfflineDlState();
  const targetMb =
    prevState && typeof prevState.totalMb === 'number' && prevState.totalMb > 0
      ? prevState.totalMb
      : TOTAL_PACKAGE_MB;
  await saveOfflineDlState({
    status: 'idle',
    done: 0,
    total: 0,
    percent: 0,
    downloadedMb: 0,
    remainingMb: targetMb,
    totalMb: targetMb,
    sections: (prevState && prevState.sections) || [],
    contentVersion: (prevState && prevState.contentVersion) || '',
    autoUpdateEnabled: false,
    updatedAt: Date.now(),
  });
  await closeOfflineDownloadNotification();
  await broadcastOfflineDownload({
    type: 'OFFLINE_DOWNLOAD_CANCELLED',
    status: 'idle',
    done: 0,
    total: 0,
    percent: 0,
    downloadedMb: 0,
    remainingMb: targetMb,
    totalMb: targetMb,
  });
}

async function resumeSavedOfflineDownload(autoFromNetwork = false) {
  if (offlineDownloadRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const state = await readOfflineDlState();
  if (!state || !Array.isArray(state.urls) || state.urls.length === 0) return;

  if (
    autoFromNetwork &&
    state.status === 'paused' &&
    state.pauseReason === 'user'
  ) {
    return;
  }

  if (state.status === 'paused' || state.status === 'downloading') {
    await runFullOfflineDownload(
      state.urls,
      state.contentVersion || '',
      state.mode || 'full',
      state.totalMb || TOTAL_PACKAGE_MB,
      state.sections || null,
      state.activeSectionId,
    );
  }
}

async function handleNetworkOfflineInSw() {
  if (offlineDownloadRunning) {
    offlineNetworkInterrupted = true;
    return;
  }
  const state = await readOfflineDlState();
  if (state && state.status === 'downloading') {
    const done = typeof state.done === 'number' ? state.done : 0;
    const total = typeof state.total === 'number' ? state.total : 0;
    const targetMb =
      typeof state.totalMb === 'number' && state.totalMb > 0
        ? state.totalMb
        : TOTAL_PACKAGE_MB;
    const stats = computeMbStats(done, total, false, targetMb);
    await saveOfflineDlState({
      ...state,
      status: 'paused',
      pauseReason: 'offline',
      ...stats,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type: 'OFFLINE_DOWNLOAD_PAUSED',
      status: 'paused',
      pauseReason: 'offline',
      mode: state.mode || 'full',
      sections: state.sections || [],
      done,
      total,
      ...stats,
    });
    await showOfflineDownloadNotification(
      `التحميل متوقف — باقي ${stats.remainingMb} ميجا`,
      `تم تحميل ${stats.downloadedMb} من ${targetMb} ميجا — سيكمل التحميل تلقائيًا فور عودة الإنترنت`,
      false,
      'offline_paused',
    );
  }
}

async function resumePendingOfflineDownloadIfNeeded() {
  await resumeSavedOfflineDownload(true);
}

/**
 * Checks for new developer updates / added content in background (works on Wi-Fi or Mobile Data
 * even when the app is closed). Downloads new/updated files with pausable single-bar progress.
 */
async function checkForAppContentUpdatesInBackground(
  clientUrls = null,
  clientVersion = '',
) {
  if (offlineDownloadRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const state = await readOfflineDlState();
  if (!state) return;

  // If an incomplete download stopped because network went off, auto-resume it first!
  if (
    (state.status === 'paused' && state.pauseReason === 'offline') ||
    state.status === 'downloading'
  ) {
    await resumeSavedOfflineDownload(true);
    return;
  }

  if (state.status !== 'completed' || !state.autoUpdateEnabled) {
    return;
  }

  try {
    if (self.registration && typeof self.registration.update === 'function') {
      self.registration.update().catch(() => {});
    }

    let manifestAssets = [];
    let serverVersion = clientVersion || '';
    try {
      const mRes = await fetch(
        `/offline-content-manifest.json?ts=${Date.now()}`,
        {cache: 'no-store'},
      );
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
      return;
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

    // If app contentVersion changed, refresh core data JSONs & manifest assets
    if (versionChanged) {
      const refreshUrls = Array.from(
        new Set(['/data/quran.json', '/data/tafsir.json', ...manifestAssets]),
      );
      for (const u of refreshUrls) {
        if (offlineDownloadPauseRequested || offlineDownloadCancelRequested) {
          break;
        }
        await cacheOneOfflineUrl(u, true);
      }
    }

    // Check if any newly added URLs are not cached yet
    const missingUrls = [];
    for (const u of combinedUrls) {
      const cached = await isUrlAlreadyCached(u);
      if (!cached) {
        missingUrls.push(u);
      }
    }

    if (missingUrls.length === 0 && !versionChanged) {
      return;
    }

    if (missingUrls.length > 0) {
      // Run using unified download engine so user can pause/cancel and see single progress bar!
      await runFullOfflineDownload(
        combinedUrls,
        serverVersion || state.contentVersion || '',
        'updating',
      );
      return;
    }

    // Version bumped & all files refreshed cleanly
    const doneStats = computeMbStats(combinedUrls.length, combinedUrls.length, true);
    await saveOfflineDlState({
      ...state,
      status: 'completed',
      mode: 'full',
      urls: combinedUrls,
      done: combinedUrls.length,
      total: combinedUrls.length,
      ...doneStats,
      contentVersion: serverVersion || state.contentVersion || '',
      autoUpdateEnabled: true,
      updatedAt: Date.now(),
    });
    await broadcastOfflineDownload({
      type: 'OFFLINE_AUTO_UPDATE_APPLIED',
      status: 'completed',
      done: combinedUrls.length,
      total: combinedUrls.length,
      ...doneStats,
      contentVersion: serverVersion || state.contentVersion || '',
    });
    try {
      await self.registration.showNotification(
        'تم تحديث محتوى التطبيق تلقائيًا ✓',
        {
          body: 'تم تحميل التحديثات الجديدة في الخلفية — التطبيق محدّث ويعمل بدون نت',
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
      // ignore
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
    await syncNativeTimestampTriggers(remaining);
  }
  await saveScheduledAlerts(remaining);
}

async function syncNativeTimestampTriggers(alerts) {
  if (typeof self.TimestampTrigger !== 'function') return;
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
    const dismissedPrayers = await readDismissedPrayers();
    const now = Date.now();
    const upcomingSorted = (Array.isArray(alerts) ? alerts : [])
      .filter(
        (item) =>
          item &&
          typeof item.timestamp === 'number' &&
          item.timestamp > now + 2000 &&
          !firedTags[item.tag] &&
          !(
            item.type === 'prayconfirm' &&
            item.dateKey &&
            item.prayerKey &&
            dismissedPrayers[`${item.dateKey}-${item.prayerKey}`]
          ),
      )
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 80);

    for (const item of upcomingSorted) {
      await self.registration.showNotification(
        item.title || 'البرنامج الإسلامي الذهبي',
        {
          ...buildNotificationOptions(item),
          showTrigger: new self.TimestampTrigger(item.timestamp),
        },
      );
    }
  } catch {
    // TimestampTrigger not active on this browser build; periodicSync + sync remain active
  }
}

const PRECACHE_CACHE_NAME = 'tasbih-precache-v2';
const CORE_PRECACHE_URLS = ['/', '/index.html', '/offline.html'];

async function ensureCoreNavigationPrecacheInSw() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    const precache = await caches.open(PRECACHE_CACHE_NAME);
    const shellCache = await caches.open('alzahabi-app-shell-v1');
    await Promise.allSettled(
      CORE_PRECACHE_URLS.map(async (u) => {
        try {
          const res = await swFetchWithTimeout(u, {cache: 'reload'}, 8000);
          if (res && res.ok) {
            await precache.put(u, res.clone());
            await shellCache.put(u, res);
          }
        } catch {
          // ignore individual error
        }
      }),
    );
  } catch {
    // ignore
  }
}

async function prewarmEssentialOfflineShellInSw() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await ensureCoreNavigationPrecacheInSw();

  const shellUrls = [
    '/manifest.webmanifest',
    '/fonts/fonts.css',
    '/icon.svg',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-1024x1024.png',
    '/assets/aistudio/IMG-20261120-WA4940_5880b328.jpg',
  ];
  const coreUrls = ['/data/quran.json', '/data/tafsir.json'];
  const essentialAudioUrls = [
    '/audio/splash-alafasy.mp3',
    '/audio/azan.mp3',
    '/audio/adhan-makkah.mp3',
    '/audio/adhan-madinah.mp3',
    '/audio/adhan-alafasy.mp3',
    '/audio/iqamah-makkah.mp3',
    '/audio/iqamah-madinah.mp3',
    '/audio/iqamah-haram.mp3',
    '/audio/pre-chime.mp3',
    '/audio/pre-beep-soft.mp3',
    '/audio/pre-beep-double.mp3',
    '/audio/post-adhan-dua.mp3',
    '/audio/salawat-1.mp3',
    '/audio/salawat-2.mp3',
    '/audio/salawat-3.mp3',
  ];
  try {
    const shellCache = await caches.open('alzahabi-app-shell-v1');
    for (const u of shellUrls) {
      try {
        const hit = await shellCache.match(u);
        if (!hit) {
          const res = await swFetchWithTimeout(u, {}, 10000);
          if (res.ok) await shellCache.put(u, res);
        }
      } catch {
        // ignore single asset error
      }
    }
  } catch {
    // ignore
  }
  for (const u of [...coreUrls, ...essentialAudioUrls]) {
    try {
      await cacheOneOfflineUrl(u, false);
    } catch {
      // ignore
    }
  }
}

let lastWakeupCheckTs = 0;

self.addEventListener('install', (event) => {
  event.waitUntil(ensureCoreNavigationPrecacheInSw());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients && self.clients.claim ? self.clients.claim() : Promise.resolve(),
      prewarmEssentialOfflineShellInSw(),
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
    const targetTotalMb =
      typeof payload.totalMb === 'number' && payload.totalMb > 0
        ? payload.totalMb
        : TOTAL_PACKAGE_MB;
    const sections = Array.isArray(payload.sections) ? payload.sections : null;
    const activeSectionId =
      typeof payload.activeSectionId === 'string'
        ? payload.activeSectionId
        : undefined;
    event.waitUntil(
      runFullOfflineDownload(
        urls,
        contentVersion,
        'full',
        targetTotalMb,
        sections,
        activeSectionId,
      ),
    );
    return;
  }

  if (payload.type === 'PAUSE_FULL_OFFLINE_DOWNLOAD') {
    event.waitUntil(pauseActiveOfflineDownload());
    return;
  }

  if (payload.type === 'RESUME_FULL_OFFLINE_DOWNLOAD') {
    event.waitUntil(resumeSavedOfflineDownload(false));
    return;
  }

  if (payload.type === 'CANCEL_FULL_OFFLINE_DOWNLOAD') {
    event.waitUntil(cancelActiveOfflineDownload());
    return;
  }

  if (payload.type === 'NETWORK_OFFLINE_INTERRUPTED') {
    event.waitUntil(handleNetworkOfflineInSw());
    return;
  }

  if (payload.type === 'NETWORK_RESTORED_AUTO_RESUME') {
    event.waitUntil(
      Promise.all([
        resumeSavedOfflineDownload(true),
        checkForAppContentUpdatesInBackground(),
      ]),
    );
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
      await syncNativeTimestampTriggers(alerts);
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
  const data = event.notification.data || {};

  if (event.action === 'pause-offline-download') {
    event.waitUntil(pauseActiveOfflineDownload());
    return;
  }

  if (event.action === 'resume-offline-download') {
    event.waitUntil(resumeSavedOfflineDownload(false));
    return;
  }

  if (event.action === 'cancel-offline-download') {
    event.notification.close();
    event.waitUntil(cancelActiveOfflineDownload());
    return;
  }

  event.notification.close();

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
              fromNotificationClick: true,
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
