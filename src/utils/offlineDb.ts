export const OFFLINE_DB_NAME = 'alzahabi-offline-json-db';
export const OFFLINE_DB_VERSION = 2;

export const STORE_JSON_CACHE = 'json_cache';
export const STORE_AUDIO_BLOBS = 'audio_blobs';
export const STORE_VOICE_HISTORY = 'voice_history';
export const STORE_OFFLINE_META = 'offline_meta';

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

export function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
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
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbRead<T>(
  storeName: string,
  key: string,
): Promise<T | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
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
): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'write' in db ? 'readwrite' : 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function saveAudioBlobToIdb(
  url: string,
  blob: Blob,
): Promise<void> {
  if (!url || !blob || blob.size === 0) return;
  await idbWrite(STORE_AUDIO_BLOBS, url, blob);
}

export async function readAudioBlobFromIdb(url: string): Promise<Blob | null> {
  if (!url) return null;
  return idbRead<Blob>(STORE_AUDIO_BLOBS, url);
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
