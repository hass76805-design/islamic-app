import {ReciterId} from '../types';
import {
  ADHAN_VOICES_30,
  EID_TAKBEERAT_VOICES_3,
  FRIDAY_KAHF_VOICES_3,
  getAyahAudioUrl,
  IQAMAH_VOICES_3,
  POST_ADHAN_DUA,
  POST_PRAYER_AZKAR_AUDIO_URLS,
  PRE_ADHAN_VOICES_3,
  SALAWAT_AUDIO_TRACKS,
  TAWASIH_NAQSHABANDI,
} from '../data/reciters';
import {AZKAR_CATEGORIES} from '../data/azkar';
import {RAFIQI_WORDS_30} from '../data/rafiqiData';
import {
  CORE_LOCAL_AUDIO_ASSETS,
  getAllAppSections,
  normalizeLegacySectionId,
  OfflineSectionId,
} from '../data/appSections';
import {
  INITIAL_QURAN_SEED,
  INITIAL_TAFSIR_SEED,
} from '../data/initialSeedData';
import {
  prewarmRafiqiSheikhVoicesOffline,
  prewarmStartupDuaVoiceOffline,
} from './rafiqiVoice';
import {
  ensureInitialOfflineSeedData,
  idbRead,
  idbWrite,
  readAudioBlobFromIdb,
  readOfflineMetaFromIdb,
  requestPersistentStorage,
  saveAudioBlobToIdb,
  saveOfflineMetaToIdb,
  SEED_QURAN_KEY,
  SEED_TAFSIR_KEY,
  STORE_JSON_CACHE,
} from './offlineDb';

export type {OfflineSectionId};

export const AUDIO_CACHE_NAME = 'alzahabi-offline-audio-v1';
export const IMAGE_CACHE_NAME = 'alzahabi-offline-images-v1';
export const CORE_DATA_CACHE_NAME = 'alzahabi-core-data-v1';
export const OFFLINE_READY_KEY = 'alzahabi_all_offline_ready_v1';
export const DOWNLOADED_SECTIONS_KEY = 'alzahabi_downloaded_sections_v1';

export const OFFLINE_META_STATE_KEY = 'offline_download_state';
export const OFFLINE_META_SECTIONS_KEY = 'downloaded_sections';
export const OFFLINE_META_READY_KEY = 'offline_ready_flag';

export interface OfflineSectionOption {
  id: OfflineSectionId;
  labelAr: string;
  descAr: string;
  estimatedMb: number;
  estimatedMinutes: number;
}

export function getAvailableOfflineSections(): OfflineSectionOption[] {
  return getAllAppSections().map((sec) => ({
    id: sec.id,
    labelAr: sec.labelAr,
    descAr: sec.descAr,
    estimatedMb: sec.estimatedMb,
    estimatedMinutes: sec.estimatedMinutes,
  }));
}

export function getAllOfflineSectionIds(): OfflineSectionId[] {
  return getAllAppSections().map((sec) => sec.id);
}

export const OFFLINE_SECTION_OPTIONS: OfflineSectionOption[] =
  getAvailableOfflineSections();

const memoryJsonCache = new Map<string, unknown>();
const inflightJsonLoads = new Map<string, Promise<unknown>>();
const objectUrlCache = new Map<string, string>();
let prewarmStarted = false;
let idbHydrationStarted = false;
let quranLoadedFromSeedOnly = false;

export function isQuranShowingInitialSeedOnly(): boolean {
  return quranLoadedFromSeedOnly;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(url, init);
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...init, signal: controller.signal});
  } finally {
    window.clearTimeout(timer);
  }
}

export function estimateOfflineSelection(sections: OfflineSectionId[]): {
  totalMb: number;
  estimatedMinutes: number;
  selectedOptions: OfflineSectionOption[];
} {
  const unique = Array.from(new Set(sections));
  const available = getAvailableOfflineSections();
  const selectedOptions = available.filter((opt) => unique.includes(opt.id));
  const totalMb = selectedOptions.reduce((sum, o) => sum + o.estimatedMb, 0);
  const estimatedMinutes = selectedOptions.reduce(
    (sum, o) => sum + o.estimatedMinutes,
    0,
  );
  return {totalMb, estimatedMinutes, selectedOptions};
}

function normalizeSectionList(rawList: unknown): OfflineSectionId[] {
  if (!Array.isArray(rawList)) return [];
  const normalized = rawList
    .map((id) => (typeof id === 'string' ? normalizeLegacySectionId(id) : null))
    .filter((id): id is OfflineSectionId => id !== null);
  return Array.from(new Set(normalized));
}

const downloadedSectionsSubscribers = new Set<
  (sections: OfflineSectionId[]) => void
>();

function notifyDownloadedSectionsChanged(sections: OfflineSectionId[]) {
  for (const listener of downloadedSectionsSubscribers) {
    listener(sections);
  }
}

export function subscribeDownloadedSections(
  listener: (sections: OfflineSectionId[]) => void,
): () => void {
  initSwProgressBridge();
  downloadedSectionsSubscribers.add(listener);
  listener(getDownloadedOfflineSections());
  return () => {
    downloadedSectionsSubscribers.delete(listener);
  };
}

export function getDownloadedOfflineSections(): OfflineSectionId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DOWNLOADED_SECTIONS_KEY);
    if (raw) {
      return normalizeSectionList(JSON.parse(raw) as unknown);
    }
  } catch {
    // ignore
  }
  return [];
}

export function isSectionDownloadedOffline(sectionId: OfflineSectionId): boolean {
  return getDownloadedOfflineSections().includes(sectionId);
}

export async function saveDownloadedOfflineSections(
  sections: OfflineSectionId[],
): Promise<void> {
  const clean = Array.from(new Set(sections));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        DOWNLOADED_SECTIONS_KEY,
        JSON.stringify(clean),
      );
    } catch {
      // ignore
    }
  }
  await saveOfflineMetaToIdb(OFFLINE_META_SECTIONS_KEY, clean);
  notifyDownloadedSectionsChanged(clean);
}

/**
 * Resolves any audio URL to a local IndexedDB Blob ObjectURL when cached,
 * or checks CacheStorage, falling back seamlessly to original URL.
 */
export async function resolveOfflinePlayableUrl(url: string): Promise<string> {
  if (!url) return url;
  if (objectUrlCache.has(url)) {
    return objectUrlCache.get(url)!;
  }

  try {
    const idbBlob = await readAudioBlobFromIdb(url);
    if (idbBlob && idbBlob.size > 0) {
      const objUrl = URL.createObjectURL(idbBlob);
      objectUrlCache.set(url, objUrl);
      return objUrl;
    }
  } catch {
    // continue to CacheStorage
  }

  if (typeof caches !== 'undefined') {
    try {
      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      const cached = (await audioCache.match(url)) || (await caches.match(url));
      if (cached && cached.type !== 'opaque' && cached.ok) {
        const blob = await cached.clone().blob();
        if (blob && blob.size > 0) {
          void saveAudioBlobToIdb(url, blob);
          const objUrl = URL.createObjectURL(blob);
          objectUrlCache.set(url, objUrl);
          return objUrl;
        }
      }
    } catch {
      // ignore CacheStorage error
    }
  }

  return url;
}

/**
 * Loads JSON reliably offline & online using:
 * 1) In-memory cache (full dataset only)
 * 2) IndexedDB persistent store (json_cache)
 * 3) CacheStorage (alzahabi-core-data-v1 / any SW cache) -> persisted to IndexedDB
 * 4) Network fetch (if online) -> persisted permanently to BOTH IndexedDB and CacheStorage
 * 5) Built-in Initial Seed Data (stored in IndexedDB json_cache) so offline launch NEVER fails
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
    // 1. Check IndexedDB first (permanent storage across restarts)
    const idbData = await idbRead<T>(STORE_JSON_CACHE, url);
    if (idbData !== null) {
      if (url === '/data/quran.json') quranLoadedFromSeedOnly = false;
      memoryJsonCache.set(url, idbData);
      return idbData;
    }

    // 2. Check CacheStorage (Service Worker / core cache bucket)
    if (typeof caches !== 'undefined') {
      try {
        const coreCache = await caches.open(CORE_DATA_CACHE_NAME);
        const directMatch =
          (await coreCache.match(url)) || (await caches.match(url));
        if (directMatch && directMatch.ok) {
          const parsed = (await directMatch.json()) as T;
          if (url === '/data/quran.json') quranLoadedFromSeedOnly = false;
          memoryJsonCache.set(url, parsed);
          await idbWrite(STORE_JSON_CACHE, url, parsed);
          return parsed;
        }
      } catch {
        // continue to fetch or seed
      }
    }

    // 3. Network fetch when online -> persist permanently into IndexedDB & CacheStorage
    const isOnline =
      typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    if (isOnline) {
      try {
        const res = await fetchWithTimeout(url, {}, 12000);
        if (res.ok) {
          const clone = res.clone();
          const data = (await res.json()) as T;
          if (url === '/data/quran.json') quranLoadedFromSeedOnly = false;
          memoryJsonCache.set(url, data);
          await idbWrite(STORE_JSON_CACHE, url, data);
          if (typeof caches !== 'undefined') {
            try {
              const cache = await caches.open(CORE_DATA_CACHE_NAME);
              await cache.put(url, clone);
            } catch {
              // ignore cache put error
            }
          }
          return data;
        }
      } catch {
        // Fall back seamlessly to built-in seed data below
      }
    }

    // 4. Built-in Initial Seed Data fallback (never throws or blocks offline open)
    await ensureInitialOfflineSeedData();
    if (url === '/data/quran.json') {
      quranLoadedFromSeedOnly = true;
      const seededQ = await idbRead<T>(STORE_JSON_CACHE, SEED_QURAN_KEY);
      if (seededQ !== null) return seededQ;
      return INITIAL_QURAN_SEED as unknown as T;
    }
    if (url === '/data/tafsir.json') {
      const seededT = await idbRead<T>(STORE_JSON_CACHE, SEED_TAFSIR_KEY);
      if (seededT !== null) return seededT;
      return INITIAL_TAFSIR_SEED as unknown as T;
    }

    throw new Error(`تعذر قراءة البيانات (${url})`);
  })();

  inflightJsonLoads.set(url, task);
  try {
    return await task;
  } finally {
    inflightJsonLoads.delete(url);
  }
}

/**
 * Automatically pre-warms all core written Quran/Tafsir data + local MP3s silently when online.
 */
export async function prewarmCoreOfflineTextData(
  preferredReciter: ReciterId = 'alafasy',
): Promise<void> {
  await ensureInitialOfflineSeedData();
  if (
    prewarmStarted ||
    typeof window === 'undefined' ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return;
  }
  prewarmStarted = true;

  await requestPersistentStorage();

  await Promise.allSettled([
    loadOfflineJson('/data/quran.json'),
    loadOfflineJson('/data/tafsir.json'),
    cacheAssetInBucket('alzahabi-app-shell-v1', '/'),
    cacheAssetInBucket('alzahabi-app-shell-v1', '/index.html'),
    cacheAssetInBucket('alzahabi-app-shell-v1', '/offline.html'),
    cacheAssetInBucket('alzahabi-app-shell-v1', '/manifest.webmanifest'),
    cacheAssetInBucket(IMAGE_CACHE_NAME, '/pwa-192x192.png'),
    cacheAssetInBucket(IMAGE_CACHE_NAME, '/pwa-512x512.png'),
    cacheAssetInBucket(
      IMAGE_CACHE_NAME,
      '/assets/aistudio/IMG-20261120-WA4940_5880b328.jpg',
    ),
    prewarmStartupDuaVoiceOffline(),
  ]);

  await cacheBatchUrls(CORE_LOCAL_AUDIO_ASSETS, undefined, 4);

  const azkarUrls = AZKAR_CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => item.audioUrl).filter((u): u is string => Boolean(u)),
  );
  const externalMuezzinsAndAzkar = [
    ...ADHAN_VOICES_30.map((a) => a.url),
    ...IQAMAH_VOICES_3.map((i) => i.url),
    ...PRE_ADHAN_VOICES_3.map((p) => p.url),
    POST_ADHAN_DUA.audioUrl,
    ...TAWASIH_NAQSHABANDI.map((t) => t.url),
    ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
    ...FRIDAY_KAHF_VOICES_3.map((k) => k.url),
    ...SALAWAT_AUDIO_TRACKS.map((s) => s.url),
    ...POST_PRAYER_AZKAR_AUDIO_URLS,
    ...azkarUrls,
    ...RAFIQI_WORDS_30.map((w) =>
      getAyahAudioUrl(preferredReciter, w.surahNumber, w.ayahNumber),
    ),
    ...[1, 2, 3, 4, 5, 6, 7].map((a) => getAyahAudioUrl(preferredReciter, 1, a)),
  ];
  await cacheBatchUrls(externalMuezzinsAndAzkar, undefined, 3);
}

export async function isAudioCached(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const idbBlob = await readAudioBlobFromIdb(url);
    if (idbBlob && idbBlob.size > 0) return true;
  } catch {
    // check CacheStorage
  }
  if (typeof caches === 'undefined') return false;
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
  if (!url) return false;
  try {
    // Check IndexedDB first for JSON & audio so existing permanent copies are verified
    if (url.endsWith('.json')) {
      const existingJson = await idbRead(STORE_JSON_CACHE, url);
      if (existingJson !== null) {
        return true;
      }
    } else if (bucketName === AUDIO_CACHE_NAME) {
      const existingBlob = await readAudioBlobFromIdb(url);
      if (existingBlob && existingBlob.size > 0) {
        return true;
      }
    }

    if (typeof caches !== 'undefined') {
      const cache = await caches.open(bucketName);
      const existing = await cache.match(url);
      if (existing) {
        if (bucketName === AUDIO_CACHE_NAME && existing.type !== 'opaque') {
          try {
            const blob = await existing.clone().blob();
            if (blob.size > 0) await saveAudioBlobToIdb(url, blob);
          } catch {
            // ignore
          }
        } else if (url.endsWith('.json') && existing.ok) {
          try {
            const parsed = await existing.clone().json();
            await idbWrite(STORE_JSON_CACHE, url, parsed);
          } catch {
            // ignore
          }
        }
        return true;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    const isSameOrigin =
      url.startsWith('/') ||
      (typeof window !== 'undefined' && url.startsWith(window.location.origin));

    if (isSameOrigin) {
      const res = await fetchWithTimeout(url, {}, 15000);
      if (res.ok) {
        if (url.endsWith('.json')) {
          try {
            const parsed = await res.clone().json();
            await idbWrite(STORE_JSON_CACHE, url, parsed);
          } catch {
            // ignore
          }
        } else if (bucketName === AUDIO_CACHE_NAME) {
          try {
            const blob = await res.clone().blob();
            if (blob.size > 0) await saveAudioBlobToIdb(url, blob);
          } catch {
            // ignore
          }
        }
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(bucketName);
          await cache.put(url, res);
        }
        return true;
      }
      return false;
    }

    try {
      const corsRes = await fetchWithTimeout(url, {mode: 'cors'}, 15000);
      if (corsRes.ok) {
        if (bucketName === AUDIO_CACHE_NAME) {
          try {
            const blob = await corsRes.clone().blob();
            if (blob.size > 0) await saveAudioBlobToIdb(url, blob);
          } catch {
            // ignore
          }
        }
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(bucketName);
          await cache.put(url, corsRes);
        }
        return true;
      }
      if (corsRes.status === 404 || corsRes.status === 410) {
        return false;
      }
    } catch {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return false;
      }
    }

    if (typeof caches !== 'undefined') {
      try {
        const noCorsRes = await fetchWithTimeout(url, {mode: 'no-cors'}, 15000);
        const cache = await caches.open(bucketName);
        await cache.put(url, noCorsRes);
        return true;
      } catch {
        return false;
      }
    }
    return false;
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
    return (
      window.localStorage.getItem(OFFLINE_READY_KEY) === '1' &&
      window.localStorage.getItem('alzahabi_full_850_dl_done_v1') === '1'
    );
  } catch {
    return false;
  }
}

export function buildOfflineUrlsForSections(
  sections: OfflineSectionId[],
  preferredReciter: ReciterId,
): string[] {
  const active = new Set(sections);
  const urls: string[] = [
    '/data/quran.json',
    '/data/tafsir.json',
    '/offline.html',
    ...CORE_LOCAL_AUDIO_ASSETS,
  ];

  for (const sec of getAllAppSections()) {
    if (active.has(sec.id) && sec.getOfflineUrls) {
      urls.push(...sec.getOfflineUrls(preferredReciter));
    }
  }

  return Array.from(new Set(urls.filter(Boolean)));
}

export function buildFullOfflineDownloadList(
  preferredReciter: ReciterId,
): string[] {
  return buildOfflineUrlsForSections(
    getAllOfflineSectionIds(),
    preferredReciter,
  );
}

export const CONTENT_PACK_VERSION = '2026.11.25.2';
export const TOTAL_PACKAGE_MB = getAllAppSections().reduce(
  (sum, sec) => sum + sec.estimatedMb,
  0,
);
export const FULL_850_DONE_KEY = 'alzahabi_full_850_dl_done_v1';

export interface BackgroundOfflineProgress {
  status: 'idle' | 'downloading' | 'paused' | 'completed';
  pauseReason?: 'user' | 'offline';
  mode?: 'full' | 'updating';
  activeSectionId?: OfflineSectionId;
  sections?: OfflineSectionId[];
  percent: number;
  done: number;
  total: number;
  downloadedMb: number;
  remainingMb: number;
  totalMb: number;
}

export function computeMbProgress(
  done: number,
  total: number,
  completedAll: boolean,
  targetTotalMb = TOTAL_PACKAGE_MB,
): Pick<
  BackgroundOfflineProgress,
  'percent' | 'downloadedMb' | 'remainingMb' | 'totalMb'
> {
  const safeTotalMb = Math.max(1, targetTotalMb || TOTAL_PACKAGE_MB);
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

let sharedOfflineProgress: BackgroundOfflineProgress = (() => {
  const doneAlready =
    typeof window !== 'undefined' &&
    window.localStorage.getItem(OFFLINE_READY_KEY) === '1' &&
    window.localStorage.getItem(FULL_850_DONE_KEY) === '1';
  const savedSections = getDownloadedOfflineSections();
  const savedMb =
    savedSections.length > 0
      ? estimateOfflineSelection(savedSections).totalMb
      : TOTAL_PACKAGE_MB;
  return doneAlready
    ? {
        status: 'completed',
        mode: 'full',
        sections: savedSections,
        percent: 100,
        done: 1,
        total: 1,
        downloadedMb: savedMb,
        remainingMb: 0,
        totalMb: savedMb,
      }
    : {
        status: 'idle',
        mode: 'full',
        sections: savedSections,
        percent: 0,
        done: 0,
        total: 0,
        downloadedMb: 0,
        remainingMb: savedMb,
        totalMb: savedMb,
      };
})();

const progressSubscribers = new Set<
  (state: BackgroundOfflineProgress) => void
>();
let swBridgeInitialized = false;
let currentActiveSectionId: OfflineSectionId | undefined;

// Fallback non-SW runner controls (if SW is unavailable in current context)
let fallbackRunning = false;
let fallbackPauseRequested = false;
let fallbackCancelRequested = false;
let fallbackUrls: string[] = [];
let fallbackTotalMb = TOTAL_PACKAGE_MB;
let fallbackSections: OfflineSectionId[] = getAllOfflineSectionIds();

function persistCompletedFlag(
  isCompleted: boolean,
  sections?: OfflineSectionId[],
) {
  if (typeof window === 'undefined') return;
  try {
    if (isCompleted) {
      window.localStorage.setItem(OFFLINE_READY_KEY, '1');
      window.localStorage.setItem(FULL_850_DONE_KEY, '1');
      void saveOfflineMetaToIdb(OFFLINE_META_READY_KEY, true);
      if (sections && sections.length > 0) {
        const merged = Array.from(
          new Set([...getDownloadedOfflineSections(), ...sections]),
        );
        void saveDownloadedOfflineSections(merged);
        void saveSectionManifestsToIdb(merged);
      }
    } else {
      window.localStorage.removeItem(OFFLINE_READY_KEY);
      window.localStorage.removeItem(FULL_850_DONE_KEY);
      void saveOfflineMetaToIdb(OFFLINE_META_READY_KEY, false);
    }
  } catch {
    // ignore storage failures
  }
}

async function saveSectionManifestsToIdb(sections: OfflineSectionId[]) {
  const allDefs = getAllAppSections();
  await Promise.all(
    sections.map((id) => {
      const def = allDefs.find((d) => d.id === id);
      if (!def) return Promise.resolve(false);
      return saveOfflineMetaToIdb(`section_manifest:${id}`, {
        id: def.id,
        labelAr: def.labelAr,
        estimatedMb: def.estimatedMb,
        savedAt: Date.now(),
        version: CONTENT_PACK_VERSION,
      });
    }),
  );
}

function persistStateSnapshotToIdb(state: BackgroundOfflineProgress) {
  void saveOfflineMetaToIdb(OFFLINE_META_STATE_KEY, {
    ...state,
    contentVersion: CONTENT_PACK_VERSION,
    storageEngine: 'IndexedDB+CacheStorage',
    updatedAt: Date.now(),
  });
}

function setSharedOfflineProgress(next: BackgroundOfflineProgress) {
  const withSection: BackgroundOfflineProgress = {
    ...next,
    activeSectionId: next.activeSectionId ?? currentActiveSectionId,
  };
  sharedOfflineProgress = withSection;
  if (withSection.status === 'completed' && withSection.percent === 100) {
    currentActiveSectionId = undefined;
    persistCompletedFlag(true, withSection.sections);
    persistStateSnapshotToIdb(withSection);
  } else if (withSection.status === 'idle') {
    currentActiveSectionId = undefined;
    persistCompletedFlag(false);
    persistStateSnapshotToIdb(withSection);
  } else if (withSection.status === 'paused') {
    persistStateSnapshotToIdb(withSection);
  }
  for (const listener of progressSubscribers) {
    listener(withSection);
  }
}

export function getCurrentOfflineProgress(): BackgroundOfflineProgress {
  return sharedOfflineProgress;
}

function normalizeSwPayloadToProgress(data: {
  status?: string;
  pauseReason?: 'user' | 'offline';
  mode?: 'full' | 'updating';
  activeSectionId?: OfflineSectionId;
  sections?: OfflineSectionId[];
  done?: number;
  total?: number;
  percent?: number;
  downloadedMb?: number;
  remainingMb?: number;
  totalMb?: number;
}): BackgroundOfflineProgress {
  const status =
    data.status === 'downloading' ||
    data.status === 'paused' ||
    data.status === 'completed'
      ? data.status
      : 'idle';
  const done = typeof data.done === 'number' ? data.done : 0;
  const total = typeof data.total === 'number' ? data.total : 0;
  const targetTotalMb =
    typeof data.totalMb === 'number' && data.totalMb > 0
      ? data.totalMb
      : TOTAL_PACKAGE_MB;
  const isCompleted = status === 'completed';
  const computed = computeMbProgress(done, total, isCompleted, targetTotalMb);
  const cleanSections = Array.isArray(data.sections)
    ? normalizeSectionList(data.sections)
    : sharedOfflineProgress.sections;
  return {
    status,
    pauseReason: data.pauseReason,
    mode: data.mode || 'full',
    activeSectionId: data.activeSectionId,
    sections: cleanSections,
    done,
    total,
    percent:
      typeof data.percent === 'number' ? data.percent : computed.percent,
    downloadedMb:
      typeof data.downloadedMb === 'number'
        ? data.downloadedMb
        : computed.downloadedMb,
    remainingMb:
      typeof data.remainingMb === 'number'
        ? data.remainingMb
        : computed.remainingMb,
    totalMb: targetTotalMb,
  };
}

/**
 * Hydrates authoritative offline download progress & saved section list permanently
 * from IndexedDB (STORE_OFFLINE_META) on cold boot — guarantees completion state
 * and content availability even when localStorage was wiped or app restarted offline.
 */
export async function hydrateOfflineStateFromIdb(): Promise<void> {
  await ensureInitialOfflineSeedData();
  const [savedState, savedSectionsRaw, savedReadyFlag] = await Promise.all([
    readOfflineMetaFromIdb<BackgroundOfflineProgress>(OFFLINE_META_STATE_KEY),
    readOfflineMetaFromIdb<unknown>(OFFLINE_META_SECTIONS_KEY),
    readOfflineMetaFromIdb<boolean>(OFFLINE_META_READY_KEY),
  ]);

  const savedSections = normalizeSectionList(savedSectionsRaw);
  if (savedSections.length > 0 && typeof window !== 'undefined') {
    try {
      const merged = Array.from(
        new Set([...getDownloadedOfflineSections(), ...savedSections]),
      );
      window.localStorage.setItem(
        DOWNLOADED_SECTIONS_KEY,
        JSON.stringify(merged),
      );
      notifyDownloadedSectionsChanged(merged);
    } catch {
      // ignore
    }
  } else if (savedSections.length > 0) {
    notifyDownloadedSectionsChanged(savedSections);
  }

  if (savedState && savedState.status) {
    // If browser restarted while downloading, reflect paused state safely
    const normalized = normalizeSwPayloadToProgress({
      ...savedState,
      status:
        savedState.status === 'downloading' && !fallbackRunning
          ? 'paused'
          : savedState.status,
      pauseReason:
        savedState.status === 'downloading' && !fallbackRunning
          ? navigator.onLine
            ? 'user'
            : 'offline'
          : savedState.pauseReason,
      sections:
        savedSections.length > 0 ? savedSections : savedState.sections,
    });
    sharedOfflineProgress = normalized;
    if (normalized.status === 'completed' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(OFFLINE_READY_KEY, '1');
        window.localStorage.setItem(FULL_850_DONE_KEY, '1');
      } catch {
        // ignore
      }
    }
    for (const listener of progressSubscribers) {
      listener(normalized);
    }
  } else if (savedReadyFlag === true) {
    const savedMb =
      savedSections.length > 0
        ? estimateOfflineSelection(savedSections).totalMb
        : TOTAL_PACKAGE_MB;
    const restored: BackgroundOfflineProgress = {
      status: 'completed',
      mode: 'full',
      sections: savedSections,
      percent: 100,
      done: 1,
      total: 1,
      downloadedMb: savedMb,
      remainingMb: 0,
      totalMb: savedMb,
    };
    sharedOfflineProgress = restored;
    for (const listener of progressSubscribers) {
      listener(restored);
    }
  }
}

function initSwProgressBridge() {
  if (swBridgeInitialized || typeof navigator === 'undefined') return;
  swBridgeInitialized = true;

  void hydrateOfflineStateFromIdb();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as
        | {
            type?: string;
            status?: string;
            pauseReason?: 'user' | 'offline';
            mode?: 'full' | 'updating';
            activeSectionId?: OfflineSectionId;
            sections?: OfflineSectionId[];
            done?: number;
            total?: number;
            percent?: number;
            downloadedMb?: number;
            remainingMb?: number;
            totalMb?: number;
            state?: {
              status?: string;
              pauseReason?: 'user' | 'offline';
              mode?: 'full' | 'updating';
              activeSectionId?: OfflineSectionId;
              sections?: OfflineSectionId[];
              done?: number;
              total?: number;
              percent?: number;
              downloadedMb?: number;
              remainingMb?: number;
              totalMb?: number;
            } | null;
          }
        | undefined;
      if (!data) return;

      if (
        data.type === 'OFFLINE_DOWNLOAD_PROGRESS' ||
        data.type === 'OFFLINE_DOWNLOAD_PAUSED' ||
        data.type === 'OFFLINE_DOWNLOAD_COMPLETE' ||
        data.type === 'OFFLINE_AUTO_UPDATE_APPLIED' ||
        data.type === 'OFFLINE_DOWNLOAD_CANCELLED'
      ) {
        const mapped = normalizeSwPayloadToProgress({
          ...data,
          status:
            data.type === 'OFFLINE_DOWNLOAD_PROGRESS'
              ? 'downloading'
              : data.type === 'OFFLINE_DOWNLOAD_PAUSED'
                ? 'paused'
                : data.type === 'OFFLINE_DOWNLOAD_CANCELLED'
                  ? 'idle'
                  : 'completed',
        });
        setSharedOfflineProgress(mapped);
      } else if (
        data.type === 'OFFLINE_DOWNLOAD_STATE_SNAPSHOT' &&
        data.state
      ) {
        setSharedOfflineProgress(normalizeSwPayloadToProgress(data.state));
      }
    });

    navigator.serviceWorker.ready
      .then((reg) => {
        const target = reg.active || navigator.serviceWorker.controller;
        target?.postMessage({type: 'GET_OFFLINE_DOWNLOAD_STATE'});
      })
      .catch(() => {});
  }
}

export function subscribeOfflineDownloadState(
  listener: (state: BackgroundOfflineProgress) => void,
): () => void {
  initSwProgressBridge();
  progressSubscribers.add(listener);
  listener(sharedOfflineProgress);
  return () => {
    progressSubscribers.delete(listener);
  };
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

async function isUrlCachedLocally(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    if (url.endsWith('.json')) {
      const jsonVal = await idbRead(STORE_JSON_CACHE, url);
      if (jsonVal !== null) return true;
    } else {
      const idbBlob = await readAudioBlobFromIdb(url);
      if (idbBlob && idbBlob.size > 0) return true;
    }
  } catch {
    // ignore
  }
  if (typeof caches === 'undefined') return false;
  try {
    const bucket =
      url.endsWith('.json') || url.endsWith('.html')
        ? CORE_DATA_CACHE_NAME
        : AUDIO_CACHE_NAME;
    const cache = await caches.open(bucket);
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}

async function runFallbackOfflineDownload(
  urls: string[],
  targetTotalMb = TOTAL_PACKAGE_MB,
  sections: OfflineSectionId[] = getAllOfflineSectionIds(),
) {
  if (fallbackRunning) return;
  fallbackRunning = true;
  fallbackPauseRequested = false;
  fallbackCancelRequested = false;
  fallbackTotalMb = targetTotalMb;
  fallbackSections = sections;
  fallbackUrls = Array.from(new Set(urls.filter(Boolean)));
  const total = fallbackUrls.length;
  if (total === 0) {
    fallbackRunning = false;
    return;
  }

  let cachedCount = 0;
  const pending: string[] = [];
  for (const u of fallbackUrls) {
    if (await isUrlCachedLocally(u)) {
      cachedCount++;
    } else {
      pending.push(u);
    }
  }

  let done = cachedCount;
  let cursor = 0;
  let offlineInterrupted = false;
  let consecutiveFailures = 0;

  if (pending.length === 0) {
    await Promise.allSettled([
      loadOfflineJson('/data/quran.json'),
      loadOfflineJson('/data/tafsir.json'),
    ]);
    setSharedOfflineProgress({
      status: 'completed',
      mode: 'full',
      activeSectionId: currentActiveSectionId,
      sections,
      done: total,
      total,
      percent: 100,
      downloadedMb: targetTotalMb,
      remainingMb: 0,
      totalMb: targetTotalMb,
    });
    fallbackRunning = false;
    return;
  }

  setSharedOfflineProgress({
    status: 'downloading',
    mode: 'full',
    activeSectionId: currentActiveSectionId,
    sections,
    done,
    total,
    ...computeMbProgress(done, total, false, targetTotalMb),
  });

  const worker = async () => {
    while (
      cursor < pending.length &&
      !fallbackPauseRequested &&
      !fallbackCancelRequested &&
      !offlineInterrupted
    ) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineInterrupted = true;
        break;
      }
      const url = pending[cursor++];
      const bucket =
        url.endsWith('.json') || url.endsWith('.html')
          ? CORE_DATA_CACHE_NAME
          : AUDIO_CACHE_NAME;
      const ok = await cacheAssetInBucket(bucket, url);
      if (fallbackCancelRequested) break;
      if (!ok) {
        consecutiveFailures++;
        if (!navigator.onLine || consecutiveFailures >= 3) {
          offlineInterrupted = true;
          break;
        }
        continue;
      }
      consecutiveFailures = 0;
      done++;
      if (!fallbackPauseRequested && !fallbackCancelRequested) {
        setSharedOfflineProgress({
          status: 'downloading',
          mode: 'full',
          activeSectionId: currentActiveSectionId,
          sections,
          done,
          total,
          ...computeMbProgress(done, total, false, targetTotalMb),
        });
      }
    }
  };

  try {
    await Promise.all(
      Array.from({length: Math.min(4, Math.max(1, pending.length))}, () =>
        worker(),
      ),
    );

    if (fallbackCancelRequested) {
      setSharedOfflineProgress({
        status: 'idle',
        mode: 'full',
        activeSectionId: currentActiveSectionId,
        sections,
        done: 0,
        total: 0,
        percent: 0,
        downloadedMb: 0,
        remainingMb: targetTotalMb,
        totalMb: targetTotalMb,
      });
      return;
    }

    if (fallbackPauseRequested) {
      setSharedOfflineProgress({
        status: 'paused',
        pauseReason: 'user',
        mode: 'full',
        activeSectionId: currentActiveSectionId,
        sections,
        done,
        total,
        ...computeMbProgress(done, total, false, targetTotalMb),
      });
      return;
    }

    if (offlineInterrupted || done < total) {
      setSharedOfflineProgress({
        status: 'paused',
        pauseReason: 'offline',
        mode: 'full',
        activeSectionId: currentActiveSectionId,
        sections,
        done,
        total,
        ...computeMbProgress(done, total, false, targetTotalMb),
      });
      return;
    }

    // Guarantee JSON files are permanently stored inside IndexedDB json_cache
    await Promise.allSettled([
      loadOfflineJson('/data/quran.json'),
      loadOfflineJson('/data/tafsir.json'),
    ]);

    setSharedOfflineProgress({
      status: 'completed',
      mode: 'full',
      activeSectionId: currentActiveSectionId,
      sections,
      done: total,
      total,
      percent: 100,
      downloadedMb: targetTotalMb,
      remainingMb: 0,
      totalMb: targetTotalMb,
    });
  } finally {
    fallbackRunning = false;
  }
}

const BUILTIN_EMBEDDED_SECTIONS = new Set<OfflineSectionId>([
  'stories',
  'books',
  'seerah',
  'prayer_guide',
  'fiqh',
  'dreams',
  'who_is_allah',
  'duas',
  'tasbih',
  'qibla',
  'calendar',
  'tracker',
]);

export function isSectionBuiltInOfflineText(sectionId: OfflineSectionId): boolean {
  return BUILTIN_EMBEDDED_SECTIONS.has(sectionId);
}

export async function downloadSingleSectionOffline(
  sectionId: OfflineSectionId,
  preferredReciter: ReciterId,
  forceRefresh = false,
): Promise<void> {
  if (typeof window === 'undefined') return;
  initSwProgressBridge();
  await requestPersistentStorage();

  const secDef = getAllAppSections().find((s) => s.id === sectionId);
  if (!secDef) return;

  // Embedded/built-in sections (Stories, Books, Seerah, Fiqh, Dreams, Duas, Qibla, etc.)
  // save their persistent snapshot & manifest directly into IndexedDB even offline.
  if (isSectionBuiltInOfflineText(sectionId)) {
    currentActiveSectionId = sectionId;
    await idbWrite(STORE_JSON_CACHE, `section_snapshot:${sectionId}`, {
      id: secDef.id,
      labelAr: secDef.labelAr,
      descAr: secDef.descAr,
      savedOfflineAt: Date.now(),
      version: CONTENT_PACK_VERSION,
      builtInReady: true,
    });
    const merged = Array.from(
      new Set([...getDownloadedOfflineSections(), sectionId]),
    );
    await saveDownloadedOfflineSections(merged);
    await saveSectionManifestsToIdb(merged);
    setSharedOfflineProgress({
      status: 'completed',
      mode: forceRefresh ? 'updating' : 'full',
      activeSectionId: sectionId,
      sections: [sectionId],
      done: 1,
      total: 1,
      percent: 100,
      downloadedMb: secDef.estimatedMb,
      remainingMb: 0,
      totalMb: secDef.estimatedMb,
    });
    return;
  }

  await startFullOfflineBackgroundDownload(
    preferredReciter,
    [sectionId],
    sectionId,
    forceRefresh,
  );
}

export async function startFullOfflineBackgroundDownload(
  preferredReciter: ReciterId,
  sections: OfflineSectionId[] = getAllOfflineSectionIds(),
  singleSectionId?: OfflineSectionId,
  forceRefresh = false,
): Promise<void> {
  if (typeof window === 'undefined') return;
  initSwProgressBridge();

  await requestPersistentStorage();

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // continue even if notification prompt dismissed
    }
  }

  const activeSections: OfflineSectionId[] =
    sections.length > 0 ? sections : getAllOfflineSectionIds();
  currentActiveSectionId =
    singleSectionId || (activeSections.length === 1 ? activeSections[0] : undefined);
  const {totalMb} = estimateOfflineSelection(activeSections);
  const allUrls = buildOfflineUrlsForSections(activeSections, preferredReciter);

  if (forceRefresh && typeof navigator !== 'undefined' && navigator.onLine && typeof caches !== 'undefined') {
    try {
      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      const coreCache = await caches.open(CORE_DATA_CACHE_NAME);
      const secSpecificUrls =
        singleSectionId
          ? getAllAppSections()
              .find((s) => s.id === singleSectionId)
              ?.getOfflineUrls?.(preferredReciter) || []
          : allUrls;
      for (const u of secSpecificUrls) {
        if (u.endsWith('.json')) {
          await coreCache.delete(u);
        } else {
          await audioCache.delete(u);
        }
      }
    } catch {
      // ignore refresh clear errors
    }
  }

  // If completely offline when user triggers download, check what is already stored permanently in IndexedDB
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    let cachedCount = 0;
    for (const u of allUrls) {
      if (await isUrlCachedLocally(u)) {
        cachedCount++;
      }
    }
    if (cachedCount >= allUrls.length && allUrls.length > 0) {
      const merged = Array.from(
        new Set([...getDownloadedOfflineSections(), ...activeSections]),
      );
      await saveDownloadedOfflineSections(merged);
      await saveSectionManifestsToIdb(merged);
      setSharedOfflineProgress({
        status: 'completed',
        mode: 'full',
        activeSectionId: currentActiveSectionId,
        sections: activeSections,
        done: allUrls.length,
        total: allUrls.length,
        percent: 100,
        downloadedMb: totalMb,
        remainingMb: 0,
        totalMb,
      });
      return;
    }
    const pausedStats = computeMbProgress(
      cachedCount,
      allUrls.length,
      false,
      totalMb,
    );
    fallbackUrls = allUrls;
    fallbackTotalMb = totalMb;
    fallbackSections = activeSections;
    setSharedOfflineProgress({
      status: 'paused',
      pauseReason: 'offline',
      mode: 'full',
      activeSectionId: currentActiveSectionId,
      sections: activeSections,
      done: cachedCount,
      total: allUrls.length,
      ...pausedStats,
    });
    return;
  }

  // Pre-hydrate full Quran & Tafsir JSONs into IndexedDB when needed (never mark section complete prematurely!)
  if (
    activeSections.includes('quran') ||
    activeSections.includes('hifz') ||
    activeSections.includes('voice_test')
  ) {
    await Promise.allSettled([
      loadOfflineJson('/data/quran.json'),
      loadOfflineJson('/data/tafsir.json'),
    ]);
  }
  if (activeSections.includes('rafiqi')) {
    void prewarmRafiqiSheikhVoicesOffline();
  }

  const startState: BackgroundOfflineProgress = {
    status: 'downloading',
    mode: forceRefresh ? 'updating' : 'full',
    activeSectionId: currentActiveSectionId,
    sections: activeSections,
    done: 0,
    total: allUrls.length,
    ...computeMbProgress(0, allUrls.length, false, totalMb),
  };
  setSharedOfflineProgress(startState);
  persistStateSnapshotToIdb(startState);

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const targetSw = reg.active || navigator.serviceWorker.controller;
      if (targetSw) {
        targetSw.postMessage({
          type: 'START_FULL_OFFLINE_DOWNLOAD',
          urls: allUrls,
          sections: activeSections,
          activeSectionId: currentActiveSectionId,
          totalMb,
          contentVersion: CONTENT_PACK_VERSION,
        });
        void registerBackgroundOfflineSync(reg);
        return;
      }
    } catch {
      // fall through
    }
  }

  await runFallbackOfflineDownload(allUrls, totalMb, activeSections);
}

export async function pauseFullOfflineBackgroundDownload(): Promise<void> {
  fallbackPauseRequested = true;
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const targetSw = reg.active || navigator.serviceWorker.controller;
      if (targetSw) {
        targetSw.postMessage({type: 'PAUSE_FULL_OFFLINE_DOWNLOAD'});
        return;
      }
    } catch {
      // fall through
    }
  }
  if (!fallbackRunning && sharedOfflineProgress.status === 'downloading') {
    setSharedOfflineProgress({
      ...sharedOfflineProgress,
      status: 'paused',
      pauseReason: 'user',
    });
  }
}

export async function resumeFullOfflineBackgroundDownload(
  preferredReciter?: ReciterId,
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setSharedOfflineProgress({
      ...sharedOfflineProgress,
      status: 'paused',
      pauseReason: 'offline',
    });
    return;
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const targetSw = reg.active || navigator.serviceWorker.controller;
      if (targetSw) {
        targetSw.postMessage({type: 'RESUME_FULL_OFFLINE_DOWNLOAD'});
        void registerBackgroundOfflineSync(reg);
        return;
      }
    } catch {
      // fall through
    }
  }
  if (fallbackUrls.length > 0) {
    await runFallbackOfflineDownload(
      fallbackUrls,
      fallbackTotalMb,
      fallbackSections,
    );
  } else if (preferredReciter) {
    await startFullOfflineBackgroundDownload(preferredReciter, fallbackSections);
  }
}

export async function cancelFullOfflineBackgroundDownload(): Promise<void> {
  fallbackCancelRequested = true;
  fallbackUrls = [];
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const targetSw = reg.active || navigator.serviceWorker.controller;
      if (targetSw) {
        targetSw.postMessage({type: 'CANCEL_FULL_OFFLINE_DOWNLOAD'});
        return;
      }
    } catch {
      // fall through
    }
  }
  setSharedOfflineProgress({
    status: 'idle',
    mode: 'full',
    done: 0,
    total: 0,
    percent: 0,
    downloadedMb: 0,
    remainingMb: fallbackTotalMb,
    totalMb: fallbackTotalMb,
  });
}

export async function notifyNetworkOfflineToSw(): Promise<void> {
  if (fallbackRunning) {
    setSharedOfflineProgress({
      ...sharedOfflineProgress,
      status: 'paused',
      pauseReason: 'offline',
    });
  }
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const targetSw = reg.active || navigator.serviceWorker.controller;
    targetSw?.postMessage({type: 'NETWORK_OFFLINE_INTERRUPTED'});
  } catch {
    // ignore
  }
}

export async function notifyNetworkOnlineAutoResumeToSw(): Promise<void> {
  if (
    !fallbackRunning &&
    sharedOfflineProgress.status === 'paused' &&
    sharedOfflineProgress.pauseReason === 'offline' &&
    fallbackUrls.length > 0
  ) {
    void runFallbackOfflineDownload(
      fallbackUrls,
      fallbackTotalMb,
      fallbackSections,
    );
  }
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    void registerBackgroundOfflineSync(reg);
    const targetSw = reg.active || navigator.serviceWorker.controller;
    targetSw?.postMessage({type: 'NETWORK_RESTORED_AUTO_RESUME'});
  } catch {
    // ignore
  }
}

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
    const activeSections = getDownloadedOfflineSections();
    const urls =
      activeSections.length > 0
        ? buildOfflineUrlsForSections(activeSections, preferredReciter)
        : buildFullOfflineDownloadList(preferredReciter);
    if (targetSw) {
      targetSw.postMessage({
        type: 'SYNC_FULL_OFFLINE_MANIFEST',
        urls,
        sections: activeSections,
        contentVersion: CONTENT_PACK_VERSION,
      });
    }
  } catch {
    // ignore
  }
}
