import {ReciterId} from '../types';
import {
  ADHAN_VOICES_30,
  EID_TAKBEERAT_VOICES_3,
  FRIDAY_KAHF_VOICES_3,
  getAyahAudioUrl,
  getSurahAudioUrl,
  IQAMAH_VOICES_3,
  POST_PRAYER_AZKAR_AUDIO_URLS,
  PRE_ADHAN_VOICES_3,
  TAWASIH_NAQSHABANDI,
} from '../data/reciters';
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

    // 2. Check CacheStorage (Service Worker / downloadAllOfflinePackage bucket)
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
      throw new Error(`تعذر تحميل البيانات (${url})`);
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
 * Automatically pre-warms all core written Quran/Tafsir data + local Adhan/Naqshabandi files
 * silently when online so opening Mushaf/Details/Stories/Seerah/Bukhari offline always works.
 */
export async function prewarmCoreOfflineTextData(): Promise<void> {
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

  // Always cache Quran & Tafsir JSONs in IndexedDB + CacheStorage
  await Promise.allSettled([
    loadOfflineJson('/data/quran.json'),
    loadOfflineJson('/data/tafsir.json'),
  ]);

  // Also quietly cache bundled local MP3s (Adhan, Iqamah, Naqshabandi Tawasih)
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
    '/audio/tawasih-naqshabandi-1.mp3',
    '/audio/tawasih-naqshabandi-2.mp3',
    '/audio/tawasih-naqshabandi-3.mp3',
  ];
  await cacheBatchUrls(localAudioAssets, undefined, 3);
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
 * Downloads the complete essential offline pack once ("تحميل الكل للجهاز"):
 * - Full Quran & Tafsir JSONs (IndexedDB + CacheStorage)
 * - All local + 30 Muezzins Adhan, Iqamah, Pre-Adhan, Naqshabandi Tawasih, Eid & Kahf
 * - Post-prayer Azkar audio clips
 * - All 30 Rafiqi word ayahs for the preferred reciter
 * - Core short surahs (Al-Fatihah + Juz Amma highlights) for instant offline recitation
 */
export async function downloadAllOfflinePackage(
  preferredReciter: ReciterId,
  onProgress?: (done: number, total: number, stageLabel: string) => void,
): Promise<{success: number; total: number}> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // ignore storage persist permission failures
    }
  }

  // Persist JSONs directly into IndexedDB as well as CacheStorage
  await Promise.allSettled([
    loadOfflineJson('/data/quran.json'),
    loadOfflineJson('/data/tafsir.json'),
  ]);

  const coreDataUrls = ['/data/quran.json', '/data/tafsir.json'];

  const muezzinUrls = [
    ...ADHAN_VOICES_30.map((a) => a.url),
    ...IQAMAH_VOICES_3.map((i) => i.url),
    ...PRE_ADHAN_VOICES_3.map((p) => p.url),
    ...TAWASIH_NAQSHABANDI.map((t) => t.url),
    ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
    ...FRIDAY_KAHF_VOICES_3.map((k) => k.url),
    ...POST_PRAYER_AZKAR_AUDIO_URLS,
  ];

  const rafiqiUrls = RAFIQI_WORDS_30.map((w) =>
    getAyahAudioUrl(preferredReciter, w.surahNumber, w.ayahNumber),
  );

  const quranFatihaAyahs = [1, 2, 3, 4, 5, 6, 7].map((a) =>
    getAyahAudioUrl(preferredReciter, 1, a),
  );

  const coreShortSurahs = [1, 18, 36, 55, 56, 67, 93, 94, 97, 108, 112, 113, 114].map(
    (sNum) => getSurahAudioUrl(preferredReciter, sNum),
  );

  const allUrls = Array.from(
    new Set([
      ...coreDataUrls,
      ...muezzinUrls,
      ...rafiqiUrls,
      ...quranFatihaAyahs,
      ...coreShortSurahs,
    ]),
  );

  const stageForIndex = (done: number): string => {
    if (done <= coreDataUrls.length) return 'تجهيز المصحف والتفسير بدون نت...';
    if (done <= coreDataUrls.length + muezzinUrls.length)
      return 'تحميل المؤذنين والتواشيح والإقامة...';
    if (done <= coreDataUrls.length + muezzinUrls.length + rafiqiUrls.length)
      return 'تحميل آيات رفيقي الـ 30...';
    return 'تحميل السور المختارة بصوت الشيخ...';
  };

  const success = await cacheBatchUrls(allUrls, (done, total) => {
    onProgress?.(done, total, stageForIndex(done));
  });

  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, '1');
  } catch {
    // ignore
  }

  return {success, total: allUrls.length};
}
