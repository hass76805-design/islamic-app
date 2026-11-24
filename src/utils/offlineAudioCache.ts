import {ReciterId} from '../types';
import {
  ADHAN_VOICES_30,
  EID_TAKBEERAT_VOICES_3,
  FRIDAY_KAHF_VOICES_3,
  getAyahAudioUrl,
  getSurahAudioUrl,
  IQAMAH_VOICES_3,
  POST_ADHAN_DUA,
  POST_PRAYER_AZKAR_AUDIO_URLS,
  PRE_ADHAN_VOICES_3,
  RECITERS_30,
  SALAWAT_AUDIO_TRACKS,
  TAWASIH_NAQSHABANDI,
} from '../data/reciters';
import {AZKAR_CATEGORIES} from '../data/azkar';
import {RAFIQI_WORDS_30} from '../data/rafiqiData';

export const AUDIO_CACHE_NAME = 'alzahabi-offline-audio-v1';
export const IMAGE_CACHE_NAME = 'alzahabi-offline-images-v1';
export const CORE_DATA_CACHE_NAME = 'alzahabi-core-data-v1';
export const OFFLINE_READY_KEY = 'alzahabi_all_offline_ready_v1';

const IDB_NAME = 'alzahabi-offline-json-db';
const IDB_STORE = 'json_cache';
const memoryJsonCache = new Map<string, unknown>();
const inflightJsonLoads = new Map<string, Promise<unknown>>();
let prewarmStarted = false;

function openJsonDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readJsonFromIdb<T>(key: string): Promise<T | null> {
  const db = await openJsonDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve((req.result as T | undefined) ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeJsonToIdb<T>(key: string, data: T): Promise<void> {
  const db = await openJsonDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Loads JSON reliably offline & online using:
 * 1) In-memory cache
 * 2) IndexedDB persistent store
 * 3) CacheStorage (alzahabi-core-data-v1 / any SW cache)
 * 4) Network fetch -> persists into BOTH IndexedDB and CacheStorage
 */
export async function loadOfflineJson<T>(url: string): Promise<T> {
  if (memoryJsonCache.has(url)) {
    return memoryJsonCache.get(url) as T;
  }

  const existingInflight = inflightJsonLoads.get(url);
  if (existingInflight) {
    return existingInflight as Promise<T>;
  }

  const task = (async (): Promise<T> => {
    // 1. Check IndexedDB first (fastest reliable persistent storage across restarts)
    const idbData = await readJsonFromIdb<T>(url);
    if (idbData !== null) {
      memoryJsonCache.set(url, idbData);
      return idbData;
    }

    // 2. Check CacheStorage (Service Worker / core cache bucket)
    if (typeof caches !== 'undefined') {
      try {
        const directMatch = await caches.match(url);
        if (directMatch && directMatch.ok) {
          const parsed = (await directMatch.json()) as T;
          memoryJsonCache.set(url, parsed);
          void writeJsonToIdb(url, parsed);
          return parsed;
        }
      } catch {
        // continue to fetch
      }
    }

    // 3. Network fetch & persist to both IndexedDB and CacheStorage
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`تعذر قراءة البيانات (${url})`);
    }
    const clone = res.clone();
    const data = (await res.json()) as T;
    memoryJsonCache.set(url, data);
    void writeJsonToIdb(url, data);
    if (typeof caches !== 'undefined') {
      caches
        .open(CORE_DATA_CACHE_NAME)
        .then((cache) => cache.put(url, clone))
        .catch(() => {});
    }
    return data;
  })();

  inflightJsonLoads.set(url, task);
  try {
    return await task;
  } finally {
    inflightJsonLoads.delete(url);
  }
}

/**
 * Automatically pre-warms all core written Quran/Tafsir data + all local MP3s
 * + 30 Muezzins + Azkar + Rafiqi ayahs silently on startup when online.
 */
export async function prewarmCoreOfflineTextData(
  preferredReciter: ReciterId = 'alafasy',
): Promise<void> {
  if (
    prewarmStarted ||
    typeof window === 'undefined' ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return;
  }
  prewarmStarted = true;

  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // ignore
    }
  }

  // 1. Immediately cache full Quran & Tafsir JSONs in IndexedDB + CacheStorage
  await Promise.allSettled([
    loadOfflineJson('/data/quran.json'),
    loadOfflineJson('/data/tafsir.json'),
  ]);

  // 2. Immediately cache all 24 bundled local MP3s (Adhan, Iqamah, Dua, Eid, Kahf, Tawasih, Salawat, Sheikh prompt)
  const localAudioAssets = [
    '/audio/adhan-makkah.mp3',
    '/audio/adhan-madinah.mp3',
    '/audio/adhan-alafasy.mp3',
    '/audio/iqamah-makkah.mp3',
    '/audio/iqamah-madinah.mp3',
    '/audio/iqamah-haram.mp3',
    '/audio/pre-chime.mp3',
    '/audio/pre-istighfar.mp3',
    '/audio/pre-takbeer.mp3',
    '/audio/post-adhan-dua.mp3',
    '/audio/tawasih-naqshabandi-1.mp3',
    '/audio/tawasih-naqshabandi-2.mp3',
    '/audio/tawasih-naqshabandi-3.mp3',
    '/audio/salawat-1.mp3',
    '/audio/salawat-2.mp3',
    '/audio/salawat-3.mp3',
    '/audio/salawat-4.mp3',
    '/audio/eid-makkah-1.mp3',
    '/audio/eid-makkah-2.mp3',
    '/audio/eid-jamaa.mp3',
    '/audio/kahf-abdulbasit.mp3',
    '/audio/kahf-alafasy.mp3',
    '/audio/kahf-muaiqly.mp3',
    '/audio/sheikh-start-reading.mp3',
  ];
  await cacheBatchUrls(localAudioAssets, undefined, 4);

  // 3. Quietly background-cache external Muezzins (all 30), Azkar audio, Rafiqi 30 ayahs & core Surahs
  const azkarUrls = AZKAR_CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => item.audioUrl).filter((u): u is string => Boolean(u)),
  );
  const externalMuezzinsAndAzkar = [
    ...ADHAN_VOICES_30.map((a) => a.url),
    ...POST_PRAYER_AZKAR_AUDIO_URLS,
    ...azkarUrls,
    ...RAFIQI_WORDS_30.map((w) =>
      getAyahAudioUrl(preferredReciter, w.surahNumber, w.ayahNumber),
    ),
    ...[1, 2, 3, 4, 5, 6, 7].map((a) => getAyahAudioUrl(preferredReciter, 1, a)),
    ...[1, 18, 36, 55, 56, 67, 112, 113, 114].map((s) =>
      getSurahAudioUrl(preferredReciter, s),
    ),
  ];
  await cacheBatchUrls(externalMuezzinsAndAzkar, undefined, 3);

  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

export async function isAudioCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined' || !url) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const match = await cache.match(url);
    if (match) return true;
    const anyMatch = await caches.match(url);
    return !!anyMatch;
  } catch {
    return false;
  }
}

export async function cacheAssetInBucket(
  bucketName: string,
  url: string,
): Promise<boolean> {
  if (typeof caches === 'undefined' || !url) return false;
  try {
    const cache = await caches.open(bucketName);
    const existing = await cache.match(url);
    if (existing) return true;

    try {
      const corsRes = await fetch(url, {mode: 'cors'});
      if (corsRes.ok) {
        await cache.put(url, corsRes);
        return true;
      }
    } catch {
      // Fallback to opaque no-cors response for cross-origin CDNs without ACAO
    }

    const noCorsRes = await fetch(url, {mode: 'no-cors'});
    await cache.put(url, noCorsRes);
    return true;
  } catch {
    return false;
  }
}

export async function cacheAudioUrl(url: string): Promise<boolean> {
  return cacheAssetInBucket(AUDIO_CACHE_NAME, url);
}

export async function cacheImageUrl(url: string): Promise<boolean> {
  return cacheAssetInBucket(IMAGE_CACHE_NAME, url);
}

export async function removeCachedAudio(url: string): Promise<void> {
  if (typeof caches === 'undefined' || !url) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.delete(url);
  } catch {
    // ignore
  }
}

export async function cacheBatchUrls(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
  concurrency = 4,
): Promise<number> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (uniqueUrls.length === 0) {
    onProgress?.(0, 0);
    return 0;
  }

  let success = 0;
  let completed = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < uniqueUrls.length) {
      const idx = cursor++;
      const url = uniqueUrls[idx];
      const bucket =
        url.endsWith('.json') || url.endsWith('.html')
          ? CORE_DATA_CACHE_NAME
          : AUDIO_CACHE_NAME;
      const ok = await cacheAssetInBucket(bucket, url);
      if (ok) success++;
      completed++;
      onProgress?.(completed, uniqueUrls.length);
    }
  };

  const workers = Array.from(
    {length: Math.min(concurrency, uniqueUrls.length)},
    () => worker(),
  );
  await Promise.all(workers);
  return success;
}

export async function countCachedAudioItems(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export function isOfflinePackageDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFLINE_READY_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Builds the complete all-in-one offline download list:
 * - Full Quran & Tafsir JSONs + 30-day prayer cache
 * - All 24 local audio assets (Adhan, Iqamah, Tawasih, Dua, Eid, Kahf, Salawat)
 * - All 30 Adhan Muezzins + all Azkar audio clips
 * - All 30 Rafiqi ayahs
 * - Core Surahs for ALL 30 Sheikhs + full 114 Surahs for preferred reciter
 */
export function buildFullOfflineDownloadList(
  preferredReciter: ReciterId,
): string[] {
  const coreDataUrls = ['/data/quran.json', '/data/tafsir.json'];

  const localAudioAssets = [
    '/audio/adhan-makkah.mp3',
    '/audio/adhan-madinah.mp3',
    '/audio/adhan-alafasy.mp3',
    '/audio/iqamah-makkah.mp3',
    '/audio/iqamah-madinah.mp3',
    '/audio/iqamah-haram.mp3',
    '/audio/pre-chime.mp3',
    '/audio/pre-istighfar.mp3',
    '/audio/pre-takbeer.mp3',
    '/audio/post-adhan-dua.mp3',
    '/audio/tawasih-naqshabandi-1.mp3',
    '/audio/tawasih-naqshabandi-2.mp3',
    '/audio/tawasih-naqshabandi-3.mp3',
    '/audio/salawat-1.mp3',
    '/audio/salawat-2.mp3',
    '/audio/salawat-3.mp3',
    '/audio/salawat-4.mp3',
    '/audio/eid-makkah-1.mp3',
    '/audio/eid-makkah-2.mp3',
    '/audio/eid-jamaa.mp3',
    '/audio/kahf-abdulbasit.mp3',
    '/audio/kahf-alafasy.mp3',
    '/audio/kahf-muaiqly.mp3',
    '/audio/sheikh-start-reading.mp3',
  ];

  const azkarUrls = AZKAR_CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => item.audioUrl).filter((u): u is string => Boolean(u)),
  );

  const muezzinUrls = [
    ...ADHAN_VOICES_30.map((a) => a.url),
    ...IQAMAH_VOICES_3.map((i) => i.url),
    ...PRE_ADHAN_VOICES_3.map((p) => p.url),
    POST_ADHAN_DUA.audioUrl,
    ...TAWASIH_NAQSHABANDI.map((t) => t.url),
    ...SALAWAT_AUDIO_TRACKS.map((s) => s.url),
    ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
    ...FRIDAY_KAHF_VOICES_3.map((k) => k.url),
    ...POST_PRAYER_AZKAR_AUDIO_URLS,
    ...azkarUrls,
  ];

  const rafiqiUrls = RAFIQI_WORDS_30.map((w) =>
    getAyahAudioUrl(preferredReciter, w.surahNumber, w.ayahNumber),
  );

  const quranFatihaAyahs = [1, 2, 3, 4, 5, 6, 7].map((a) =>
    getAyahAudioUrl(preferredReciter, 1, a),
  );

  // Preferred Sheikh full 114 surahs
  const full114Preferred = Array.from({length: 114}, (_, i) =>
    getSurahAudioUrl(preferredReciter, i + 1),
  );

  // Core popular Surahs across ALL 30 Sheikhs
  const sharedSheikhSurahs = [1, 18, 36, 55, 56, 67, 87, 97, 108, 112, 113, 114];
  const all30SheikhsCore = RECITERS_30.flatMap((reciter) =>
    sharedSheikhSurahs.map((sNum) => getSurahAudioUrl(reciter.id, sNum)),
  );

  return Array.from(
    new Set([
      ...coreDataUrls,
      ...localAudioAssets,
      ...muezzinUrls,
      ...rafiqiUrls,
      ...quranFatihaAyahs,
      ...full114Preferred,
      ...all30SheikhsCore,
    ]),
  );
}

export async function downloadAllOfflinePackage(
  preferredReciter: ReciterId,
  onProgress?: (done: number, total: number, stageLabel: string) => void,
): Promise<{success: number; total: number}> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // ignore
    }
  }

  await Promise.allSettled([
    loadOfflineJson('/data/quran.json'),
    loadOfflineJson('/data/tafsir.json'),
  ]);

  const allUrls = buildFullOfflineDownloadList(preferredReciter);
  const success = await cacheBatchUrls(allUrls, (done, total) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    onProgress?.(
      done,
      total,
      pct < 15
        ? 'تجهيز المصحف والتفسير والقصص...'
        : pct < 45
          ? 'تحميل الأذان والإقامة والتواشيح والدعاء والتكبيرات...'
          : 'تحميل أصوات الـ 30 شيخًا والسور الكاملة...',
    );
  });

  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, '1');
  } catch {
    // ignore
  }

  return {success, total: allUrls.length};
}

export const CONTENT_PACK_VERSION = '2026.11.24.1';

export interface BackgroundOfflineProgress {
  status: 'idle' | 'downloading' | 'paused' | 'completed';
  percent: number;
  done: number;
  total: number;
}

async function registerBackgroundOfflineSync(reg: ServiceWorkerRegistration) {
  const regWithSync = reg as ServiceWorkerRegistration & {
    sync?: {register: (tag: string) => Promise<void>};
    periodicSync?: {
      register: (tag: string, opts: {minInterval: number}) => Promise<void>;
    };
  };
  try {
    await regWithSync.sync?.register('offline-pack-download');
  } catch {
    // ignore unsupported sync
  }
  try {
    await regWithSync.sync?.register('offline-auto-update-check');
  } catch {
    // ignore unsupported sync
  }
  try {
    await regWithSync.periodicSync?.register('offline-auto-update-check', {
      minInterval: 6 * 60 * 60 * 1000,
    });
  } catch {
    // ignore unsupported periodicSync
  }
}

/**
 * Starts the unified full-content download inside the Service Worker so it continues
 * downloading in the background with top OS percentage notifications even if the app closes,
 * and enables automatic background updates when new content is added.
 */
export async function startFullOfflineBackgroundDownload(
  preferredReciter: ReciterId,
  onProgress?: (state: BackgroundOfflineProgress) => void,
): Promise<void> {
  if (typeof window === 'undefined') return;

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // continue even if notification prompt dismissed
    }
  }

  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // ignore
    }
  }

  // Ensure JSONs are in IndexedDB right away
  void Promise.allSettled([
    loadOfflineJson('/data/quran.json'),
    loadOfflineJson('/data/tafsir.json'),
  ]);

  const allUrls = buildFullOfflineDownloadList(preferredReciter);
  onProgress?.({
    status: 'downloading',
    percent: 0,
    done: 0,
    total: allUrls.length,
  });

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const targetSw = reg.active || navigator.serviceWorker.controller;
      if (targetSw) {
        targetSw.postMessage({
          type: 'START_FULL_OFFLINE_DOWNLOAD',
          urls: allUrls,
          contentVersion: CONTENT_PACK_VERSION,
        });
        void registerBackgroundOfflineSync(reg);
        return;
      }
    } catch {
      // fall through to foreground download
    }
  }

  // Fallback if Service Worker is unavailable
  await cacheBatchUrls(allUrls, (done, total) => {
    const percent = total > 0 ? Math.round((done / total) * 100) : 100;
    onProgress?.({
      status: percent >= 100 ? 'completed' : 'downloading',
      percent,
      done,
      total,
    });
  });

  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, '1');
  } catch {
    // ignore
  }

  onProgress?.({
    status: 'completed',
    percent: 100,
    done: allUrls.length,
    total: allUrls.length,
  });
}

export async function pauseFullOfflineBackgroundDownload(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const targetSw = reg.active || navigator.serviceWorker.controller;
    targetSw?.postMessage({type: 'PAUSE_FULL_OFFLINE_DOWNLOAD'});
  } catch {
    // ignore
  }
}

export async function resumeFullOfflineBackgroundDownload(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const targetSw = reg.active || navigator.serviceWorker.controller;
    targetSw?.postMessage({type: 'RESUME_FULL_OFFLINE_DOWNLOAD'});
    void registerBackgroundOfflineSync(reg);
  } catch {
    // ignore
  }
}

/**
 * Syncs manifest + contentVersion with Service Worker so newly published app updates
 * automatically download in the background even when the app is closed or on mobile data.
 */
export async function syncOfflineContentUpdatesInBackground(
  preferredReciter: ReciterId,
): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    void registerBackgroundOfflineSync(reg);
    if (!navigator.onLine) return;
    const targetSw = reg.active || navigator.serviceWorker.controller;
    if (targetSw) {
      targetSw.postMessage({
        type: 'SYNC_FULL_OFFLINE_MANIFEST',
        urls: buildFullOfflineDownloadList(preferredReciter),
        contentVersion: CONTENT_PACK_VERSION,
      });
    }
  } catch {
    // ignore
  }
}

