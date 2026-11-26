import {
  INITIAL_QURAN_SEED,
  INITIAL_SEED_VERSION,
  INITIAL_TAFSIR_SEED,
} from '../data/initialSeedData';
import {KhatmaPlan} from '../types';

export const OFFLINE_DB_NAME = 'alzahabi-offline-json-db';
export const OFFLINE_DB_VERSION = 4;

export const STORE_JSON_CACHE = 'json_cache';
export const STORE_AUDIO_BLOBS = 'audio_blobs';
export const STORE_VOICE_HISTORY = 'voice_history';
export const STORE_OFFLINE_META = 'offline_meta';
export const STORE_APP_STATE = 'app_state';
export const STORE_DOWNLOADS = 'downloads';

export const SEED_QURAN_KEY = 'seed:/data/quran.json';
export const SEED_TAFSIR_KEY = 'seed:/data/tafsir.json';
export const SEED_MARKER_KEY = 'initial_seed_manifest';
export const KHATMA_IDB_KEY = 'alzahabi_khatma_state_v1';
export const LAST_READ_IDB_KEY = 'alzahabi_last_read_state_v1';

export interface StoredDownloadRecord {
  id: string;
  title: string;
  url: string;
  size: number;
  downloaded: boolean;
  progress: number;
  sectionId?: string;
  updatedAt?: number;
}

export interface StoredVoiceWordResult {
  raw: string;
  isMatch: boolean;
  spokenWord: string | null;
  hint: string | null;
}

export interface StoredVoiceAyahResult {
  ayahId: number;
  ayahNumber: number;
  ayahText: string;
  page: number;
  wordResults: StoredVoiceWordResult[];
  correctCount: number;
  wrongCount: number;
  isAyahCorrect: boolean;
}

export interface VoiceHistoryRecord {
  id: string;
  createdAt: number;
  surahNumber: number;
  surahName: string;
  pageLabel: string;
  accuracyPercent: number;
  totalCorrectWords: number;
  totalWrongWords: number;
  selectedReciter: string;
  recognizedText: string;
  audioBlob: Blob | null;
  evaluatedAyahs: StoredVoiceAyahResult[];
}

let cachedDbPromise: Promise<IDBDatabase | null> | null = null;
let initialSeedPromise: Promise<void> | null = null;

export function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_JSON_CACHE)) {
          db.createObjectStore(STORE_JSON_CACHE);
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_BLOBS)) {
          db.createObjectStore(STORE_AUDIO_BLOBS);
        }
        if (!db.objectStoreNames.contains(STORE_VOICE_HISTORY)) {
          db.createObjectStore(STORE_VOICE_HISTORY, {keyPath: 'id'});
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_META)) {
          db.createObjectStore(STORE_OFFLINE_META);
        }
        if (!db.objectStoreNames.contains(STORE_APP_STATE)) {
          db.createObjectStore(STORE_APP_STATE);
        }
        if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
          db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'id'});
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          cachedDbPromise = null;
        };
        db.onclose = () => {
          cachedDbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });

  return cachedDbPromise;
}

export async function idbRead<T>(
  storeName: string,
  key: string,
): Promise<T | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
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

export async function idbWrite<T>(
  storeName: string,
  key: string,
  value: T,
): Promise<boolean> {
  const db = await openOfflineDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbDelete(
  storeName: string,
  key: string,
): Promise<boolean> {
  const db = await openOfflineDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbCount(storeName: string): Promise<number> {
  const db = await openOfflineDb();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(0);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(Number(req.result) || 0);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export async function saveDownloadRecord(
  record: StoredDownloadRecord,
): Promise<boolean> {
  const db = await openOfflineDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(STORE_DOWNLOADS, 'readwrite');
      const store = tx.objectStore(STORE_DOWNLOADS);
      store.put({...record, updatedAt: record.updatedAt ?? Date.now()});
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getDownloadRecord(
  id: string,
): Promise<StoredDownloadRecord | null> {
  if (!id) return null;
  return idbRead<StoredDownloadRecord>(STORE_DOWNLOADS, id);
}

export async function listDownloadRecords(): Promise<StoredDownloadRecord[]> {
  const db = await openOfflineDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        resolve([]);
        return;
      }
      const tx = db.transaction(STORE_DOWNLOADS, 'readonly');
      const store = tx.objectStore(STORE_DOWNLOADS);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? (req.result as StoredDownloadRecord[]) : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteDownloadRecord(id: string): Promise<boolean> {
  if (!id) return false;
  return idbDelete(STORE_DOWNLOADS, id);
}

export async function clearAllDownloadRecords(): Promise<boolean> {
  const db = await openOfflineDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(STORE_DOWNLOADS, 'readwrite');
      const store = tx.objectStore(STORE_DOWNLOADS);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function saveAudioBlobToIdb(
  url: string,
  blob: Blob,
): Promise<boolean> {
  if (!url || !blob || blob.size === 0) return false;
  return idbWrite(STORE_AUDIO_BLOBS, url, blob);
}

export async function readAudioBlobFromIdb(url: string): Promise<Blob | null> {
  if (!url) return null;
  return idbRead<Blob>(STORE_AUDIO_BLOBS, url);
}

export async function countAudioBlobsInIdb(): Promise<number> {
  return idbCount(STORE_AUDIO_BLOBS);
}

export async function saveAppStateToIdb<T>(
  key: string,
  value: T,
): Promise<boolean> {
  if (!key) return false;
  return idbWrite(STORE_APP_STATE, key, value);
}

export async function readAppStateFromIdb<T>(key: string): Promise<T | null> {
  if (!key) return null;
  return idbRead<T>(STORE_APP_STATE, key);
}

export async function saveKhatmaToIdb(khatma: KhatmaPlan): Promise<boolean> {
  return saveAppStateToIdb(KHATMA_IDB_KEY, khatma);
}

export async function readKhatmaFromIdb(): Promise<KhatmaPlan | null> {
  return readAppStateFromIdb<KhatmaPlan>(KHATMA_IDB_KEY);
}

export async function saveLastReadToIdb(pos: {
  surahNumber: number;
  ayahNumber: number;
  page: number;
  updatedAt: number;
}): Promise<boolean> {
  return saveAppStateToIdb(LAST_READ_IDB_KEY, pos);
}

export async function readLastReadFromIdb(): Promise<{
  surahNumber: number;
  ayahNumber: number;
  page: number;
  updatedAt: number;
} | null> {
  return readAppStateFromIdb(LAST_READ_IDB_KEY);
}

export async function saveOfflineMetaToIdb<T>(
  key: string,
  value: T,
): Promise<boolean> {
  if (!key) return false;
  return idbWrite(STORE_OFFLINE_META, key, value);
}

export async function readOfflineMetaFromIdb<T>(
  key: string,
): Promise<T | null> {
  if (!key) return null;
  return idbRead<T>(STORE_OFFLINE_META, key);
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Ensures permanent Initial Seed Data exists inside IndexedDB on first open
 * so core Surahs, Tafsir, Azkar/Prayer defaults, and metadata are immediately available
 * completely offline even before the user runs any manual download.
 */
export async function ensureInitialOfflineSeedData(): Promise<void> {
  if (initialSeedPromise) return initialSeedPromise;
  initialSeedPromise = (async () => {
    try {
      const existingMarker = await idbRead<{version?: string}>(
        STORE_OFFLINE_META,
        SEED_MARKER_KEY,
      );
      if (existingMarker?.version === INITIAL_SEED_VERSION) {
        return;
      }
      await Promise.all([
        idbWrite(STORE_JSON_CACHE, SEED_QURAN_KEY, INITIAL_QURAN_SEED),
        idbWrite(STORE_JSON_CACHE, SEED_TAFSIR_KEY, INITIAL_TAFSIR_SEED),
        idbWrite(STORE_OFFLINE_META, SEED_MARKER_KEY, {
          version: INITIAL_SEED_VERSION,
          seededAt: Date.now(),
          surahsCount: INITIAL_QURAN_SEED.length,
          tafsirCount: Object.keys(INITIAL_TAFSIR_SEED).length,
        }),
      ]);
    } catch {
      // ignore IndexedDB unavailable
    }
  })();
  return initialSeedPromise;
}

export async function saveVoiceHistoryRecord(
  record: VoiceHistoryRecord,
): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VOICE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_VOICE_HISTORY);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listVoiceHistoryRecords(): Promise<VoiceHistoryRecord[]> {
  const db = await openOfflineDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VOICE_HISTORY, 'readonly');
      const store = tx.objectStore(STORE_VOICE_HISTORY);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = Array.isArray(req.result)
          ? (req.result as VoiceHistoryRecord[])
          : [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteVoiceHistoryRecord(id: string): Promise<void> {
  const db = await openOfflineDb();
  if (!db || !id) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VOICE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_VOICE_HISTORY);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
