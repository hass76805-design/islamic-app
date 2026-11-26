import {getSurahAudioUrl} from '../data/reciters';
import {
  clearAllDownloadRecords,
  deleteDownloadRecord,
  listDownloadRecords,
  saveAudioBlobToIdb,
  saveDownloadRecord,
  StoredDownloadRecord,
} from '../utils/offlineDb';

export const AUDIO_CACHE_BUCKET = 'audio-cache-v1';
const WIFI_ONLY_STORAGE_KEY = 'alzahabi_wifi_only_download_v1';
const PENDING_QUEUE_STORAGE_KEY = 'alzahabi_pending_download_queue_v1';

export type AudioSectionKey =
  | 'lectures'
  | 'quran_audio'
  | 'nasheed'
  | 'khutab';

export interface AudioCatalogItem {
  id: string;
  sectionId: AudioSectionKey;
  title: string;
  speaker: string;
  duration: string;
  url: string;
  estimatedMb: number;
}

export interface AudioSectionMeta {
  id: AudioSectionKey;
  titleAr: string;
  subtitleAr: string;
  items: AudioCatalogItem[];
}

export interface StorageUsageSummary {
  totalBytes: number;
  totalMb: number;
  downloadedCount: number;
  totalItemsCount: number;
  bySection: Record<
    AudioSectionKey,
    {downloadedCount: number; totalCount: number; usedMb: number}
  >;
}

export interface DownloadProgressInfo {
  sectionId?: AudioSectionKey | 'all';
  itemId?: string;
  completedItems: number;
  totalItems: number;
  percent: number;
}

export const AUDIO_SECTIONS_CATALOG: AudioSectionMeta[] = [
  {
    id: 'lectures',
    titleAr: 'استمع - محاضرات',
    subtitleAr: 'دروس إيمانية وتفسير ومواعظ صوتية مختارة',
    items: [
      {
        id: 'lec-1',
        sectionId: 'lectures',
        title: 'تأملات في سورة الفاتحة وأم الكتاب',
        speaker: 'خواطر وتفسير مختصر',
        duration: '06:20',
        url: 'https://everyayah.com/data/Husary_Muallim_128kbps/001001.mp3',
        estimatedMb: 2.1,
      },
      {
        id: 'lec-2',
        sectionId: 'lectures',
        title: 'أذكار الصباح الكاملة بالشرح والترتيل',
        speaker: 'حصن المسلم الصوتي',
        duration: '08:45',
        url: 'https://www.hisnmuslim.com/audio/ar/75.mp3',
        estimatedMb: 3.4,
      },
      {
        id: 'lec-3',
        sectionId: 'lectures',
        title: 'فضل آية الكرسي والتحصين اليومي',
        speaker: 'دروس العقيدة والتدبر',
        duration: '05:15',
        url: 'https://www.hisnmuslim.com/audio/ar/71.mp3',
        estimatedMb: 2.3,
      },
      {
        id: 'lec-4',
        sectionId: 'lectures',
        title: 'أدعية الكرب والهم وتفريج الشدائد',
        speaker: 'حصن المسلم الصوتي',
        duration: '04:50',
        url: 'https://www.hisnmuslim.com/audio/ar/120.mp3',
        estimatedMb: 1.9,
      },
      {
        id: 'lec-5',
        sectionId: 'lectures',
        title: 'الاستغفار والتوبة وسعة رحمة الله',
        speaker: 'مواعظ ورقائق إيمانية',
        duration: '07:10',
        url: 'https://www.hisnmuslim.com/audio/ar/247.mp3',
        estimatedMb: 2.8,
      },
    ],
  },
  {
    id: 'quran_audio',
    titleAr: 'قرآن صوتي - مشايخ',
    subtitleAr: 'تلاوات كاملة بأعذب أصوات قراء العالم الإسلامي',
    items: [
      {
        id: 'qa-fatiha-afasy',
        sectionId: 'quran_audio',
        title: 'سورة الفاتحة — الشيخ مشاري العفاسي',
        speaker: 'مشاري راشد العفاسي',
        duration: '01:05',
        url: getSurahAudioUrl('alafasy', 1),
        estimatedMb: 1.2,
      },
      {
        id: 'qa-mulk-maher',
        sectionId: 'quran_audio',
        title: 'سورة الملك — الشيخ ماهر المعيقلي',
        speaker: 'ماهر المعيقلي',
        duration: '07:40',
        url: getSurahAudioUrl('muaiqly', 67),
        estimatedMb: 6.8,
      },
      {
        id: 'qa-rahman-minshawi',
        sectionId: 'quran_audio',
        title: 'سورة الرحمن — الشيخ محمد صديق المنشاوي',
        speaker: 'محمد صديق المنشاوي',
        duration: '12:15',
        url: getSurahAudioUrl('minshawi', 55),
        estimatedMb: 9.5,
      },
      {
        id: 'qa-yasin-dosari',
        sectionId: 'quran_audio',
        title: 'سورة يس — الشيخ ياسر الدوسري',
        speaker: 'ياسر الدوسري',
        duration: '15:30',
        url: getSurahAudioUrl('dosari', 36),
        estimatedMb: 12.4,
      },
      {
        id: 'qa-kahf-abdulbasit',
        sectionId: 'quran_audio',
        title: 'سورة الكهف — الشيخ عبد الباسط عبد الصمد',
        speaker: 'عبد الباسط عبد الصمد',
        duration: '28:10',
        url: getSurahAudioUrl('abdulbasit', 18),
        estimatedMb: 22.0,
      },
      {
        id: 'qa-waqiah-sudais',
        sectionId: 'quran_audio',
        title: 'سورة الواقعة — الشيخ عبد الرحمن السديس',
        speaker: 'عبد الرحمن السديس',
        duration: '09:50',
        url: getSurahAudioUrl('sudais', 56),
        estimatedMb: 8.2,
      },
    ],
  },
  {
    id: 'nasheed',
    titleAr: 'أناشيد',
    subtitleAr: 'ابتهالات وتواشيح وصلوات إسلامية هادئة خالية من المعازف',
    items: [
      {
        id: 'nas-1',
        sectionId: 'nasheed',
        title: 'مولاي إني ببابك قد بسطت يدي',
        speaker: 'الشيخ سيد النقشبندي',
        duration: '06:15',
        url: '/audio/tawasih-naqshabandi-1.mp3',
        estimatedMb: 2.2,
      },
      {
        id: 'nas-2',
        sectionId: 'nasheed',
        title: 'أغيب وذو اللطائف لا يغيب',
        speaker: 'الشيخ سيد النقشبندي',
        duration: '05:10',
        url: '/audio/tawasih-naqshabandi-2.mp3',
        estimatedMb: 1.8,
      },
      {
        id: 'nas-3',
        sectionId: 'nasheed',
        title: 'يا رب إن عظمت ذنوبي كثرة',
        speaker: 'الشيخ سيد النقشبندي',
        duration: '03:45',
        url: '/audio/tawasih-naqshabandi-3.mp3',
        estimatedMb: 0.9,
      },
      {
        id: 'nas-4',
        sectionId: 'nasheed',
        title: 'نشيد الصلاة الإبراهيمية الخاشعة',
        speaker: 'الشيخ سعد الغامدي',
        duration: '01:55',
        url: '/audio/salawat-2.mp3',
        estimatedMb: 0.4,
      },
      {
        id: 'nas-5',
        sectionId: 'nasheed',
        title: 'تكبيرات الحرم المكي والعيد المبارك',
        speaker: 'الشيخ علي أحمد ملا',
        duration: '02:20',
        url: '/audio/eid-makkah-1.mp3',
        estimatedMb: 0.3,
      },
    ],
  },
  {
    id: 'khutab',
    titleAr: 'خطب',
    subtitleAr: 'مختارات من خطب الجمعة والتذكير وأعمال اليوم والليلة',
    items: [
      {
        id: 'kh-1',
        sectionId: 'khutab',
        title: 'تذكير يوم الجمعة — فضائل سورة الكهف',
        speaker: 'الشيخ مشاري العفاسي',
        duration: '04:30',
        url: '/audio/kahf-alafasy.mp3',
        estimatedMb: 0.35,
      },
      {
        id: 'kh-2',
        sectionId: 'khutab',
        title: 'عظمة القرآن وأثره في القلوب — خطبة وتلاوة',
        speaker: 'الشيخ ماهر المعيقلي',
        duration: '04:15',
        url: '/audio/kahf-muaiqly.mp3',
        estimatedMb: 0.3,
      },
      {
        id: 'kh-3',
        sectionId: 'khutab',
        title: 'سورة الجمعة — تلاوة صلاة الجمعة من الحرم',
        speaker: 'الشيخ عبد الرحمن السديس',
        duration: '05:40',
        url: getSurahAudioUrl('sudais', 62),
        estimatedMb: 4.5,
      },
      {
        id: 'kh-4',
        sectionId: 'khutab',
        title: 'وصايا الرزق والتوكل وسيد الاستغفار',
        speaker: 'حصن المسلم الصوتي',
        duration: '03:50',
        url: 'https://www.hisnmuslim.com/audio/ar/58.mp3',
        estimatedMb: 1.6,
      },
      {
        id: 'kh-5',
        sectionId: 'khutab',
        title: 'أدعية ختم القرآن والتضرع في المساجد',
        speaker: 'الشيخ عبد الباسط عبد الصمد',
        duration: '04:40',
        url: '/audio/kahf-abdulbasit.mp3',
        estimatedMb: 0.4,
      },
    ],
  },
];

export const ALL_AUDIO_CATALOG_ITEMS: AudioCatalogItem[] =
  AUDIO_SECTIONS_CATALOG.flatMap((sec) => sec.items);

const downloadListeners = new Set<() => void>();

function emitDownloadChange(): void {
  for (const listener of downloadListeners) {
    listener();
  }
}

export function subscribeDownloadsChanged(listener: () => void): () => void {
  downloadListeners.add(listener);
  return () => {
    downloadListeners.delete(listener);
  };
}

export function getWifiOnlySetting(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WIFI_ONLY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setWifiOnlySetting(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WIFI_ONLY_STORAGE_KEY, enabled ? 'true' : 'false');
    emitDownloadChange();
  } catch {
    // ignore
  }
}

export function isWifiConnectionActive(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (!navigator.onLine) return false;
  const nav = navigator as Navigator & {
    connection?: {type?: string; effectiveType?: string};
  };
  const connType = nav.connection?.type;
  if (!connType) return true; // desktop / browsers that don't expose .type
  return connType === 'wifi' || connType === 'ethernet';
}

export function canStartAutoWifiDownload(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!getWifiOnlySetting()) return true;
  return isWifiConnectionActive();
}

export function getPendingDownloadQueue(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function queueDownloadWhenOnline(itemId: string): void {
  if (typeof window === 'undefined' || !itemId) return;
  const current = getPendingDownloadQueue();
  if (!current.includes(itemId)) {
    try {
      window.localStorage.setItem(
        PENDING_QUEUE_STORAGE_KEY,
        JSON.stringify([...current, itemId]),
      );
    } catch {
      // ignore
    }
  }
  emitDownloadChange();
}

export function removeFromPendingQueue(itemId: string): void {
  if (typeof window === 'undefined' || !itemId) return;
  const next = getPendingDownloadQueue().filter((id) => id !== itemId);
  try {
    window.localStorage.setItem(PENDING_QUEUE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

async function putAudioResponseInCache(url: string, res: Response): Promise<number> {
  let byteLength = 0;
  try {
    const cloneForSize = res.clone();
    if (cloneForSize.type !== 'opaque' && cloneForSize.ok) {
      const blob = await cloneForSize.blob();
      byteLength = blob.size;
      if (blob.size > 0) {
        void saveAudioBlobToIdb(url, blob);
      }
    }
  } catch {
    // ignore size error
  }
  if (typeof caches !== 'undefined') {
    const cache = await caches.open(AUDIO_CACHE_BUCKET);
    await cache.put(url, res);
  }
  return byteLength;
}

export async function checkIfDownloaded(idOrUrl: string): Promise<boolean> {
  if (!idOrUrl) return false;
  const item =
    ALL_AUDIO_CATALOG_ITEMS.find((i) => i.id === idOrUrl || i.url === idOrUrl) ||
    null;
  const lookupUrl = item ? item.url : idOrUrl;

  try {
    const records = await listDownloadRecords();
    const rec = records.find((r) => r.id === idOrUrl || r.url === lookupUrl);
    if (rec?.downloaded) {
      return true;
    }
  } catch {
    // fallback to Cache API
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AUDIO_CACHE_BUCKET);
      const hit = await cache.match(lookupUrl);
      if (hit) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export async function resolveDownloadedAudioSrc(
  url: string,
): Promise<{src: string; cached: boolean}> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AUDIO_CACHE_BUCKET);
      const match = await cache.match(url);
      if (match && match.type !== 'opaque' && match.ok) {
        const blob = await match.clone().blob();
        if (blob && blob.size > 0) {
          return {src: URL.createObjectURL(blob), cached: true};
        }
      }
      if (match) {
        return {src: url, cached: true};
      }
    } catch {
      // ignore
    }
  }
  return {src: url, cached: false};
}

export async function downloadSingle(
  itemOrId: AudioCatalogItem | string,
  onProgress?: (progress: DownloadProgressInfo) => void,
): Promise<boolean> {
  const item =
    typeof itemOrId === 'string'
      ? ALL_AUDIO_CATALOG_ITEMS.find((i) => i.id === itemOrId || i.url === itemOrId)
      : itemOrId;

  if (!item) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine && !item.url.startsWith('/')) {
    return false;
  }

  const estimatedBytes = Math.round(item.estimatedMb * 1024 * 1024);

  await saveDownloadRecord({
    id: item.id,
    title: item.title,
    url: item.url,
    size: estimatedBytes,
    downloaded: false,
    progress: 10,
    sectionId: item.sectionId,
  });
  onProgress?.({
    sectionId: item.sectionId,
    itemId: item.id,
    completedItems: 0,
    totalItems: 1,
    percent: 10,
  });
  emitDownloadChange();

  try {
    let response: Response | null = null;
    try {
      const corsRes = await fetch(item.url, {mode: 'cors'});
      if (corsRes.ok) {
        response = corsRes;
      }
    } catch {
      // try no-cors for external audio CDNs
    }

    if (!response && !item.url.startsWith('/')) {
      const noCorsRes = await fetch(item.url, {mode: 'no-cors'});
      response = noCorsRes;
    }

    if (!response) {
      throw new Error('Download failed');
    }

    const actualBytes = await putAudioResponseInCache(item.url, response);
    const finalSize = actualBytes > 0 ? actualBytes : estimatedBytes;

    await saveDownloadRecord({
      id: item.id,
      title: item.title,
      url: item.url,
      size: finalSize,
      downloaded: true,
      progress: 100,
      sectionId: item.sectionId,
    });
    removeFromPendingQueue(item.id);
    onProgress?.({
      sectionId: item.sectionId,
      itemId: item.id,
      completedItems: 1,
      totalItems: 1,
      percent: 100,
    });
    emitDownloadChange();
    return true;
  } catch {
    await saveDownloadRecord({
      id: item.id,
      title: item.title,
      url: item.url,
      size: estimatedBytes,
      downloaded: false,
      progress: 0,
      sectionId: item.sectionId,
    });
    emitDownloadChange();
    return false;
  }
}

export async function downloadSection(
  sectionId: AudioSectionKey | 'all',
  onProgress?: (progress: DownloadProgressInfo) => void,
): Promise<{successCount: number; totalCount: number}> {
  const targets =
    sectionId === 'all'
      ? ALL_AUDIO_CATALOG_ITEMS
      : AUDIO_SECTIONS_CATALOG.find((s) => s.id === sectionId)?.items || [];

  const totalCount = targets.length;
  if (totalCount === 0) return {successCount: 0, totalCount: 0};

  let completedItems = 0;
  let successCount = 0;

  onProgress?.({
    sectionId,
    completedItems: 0,
    totalItems: totalCount,
    percent: 0,
  });

  for (const item of targets) {
    const ok = await downloadSingle(item);
    if (ok) successCount += 1;
    completedItems += 1;
    const percent = Math.round((completedItems / totalCount) * 100);
    onProgress?.({
      sectionId,
      itemId: item.id,
      completedItems,
      totalItems: totalCount,
      percent,
    });
  }

  emitDownloadChange();
  return {successCount, totalCount};
}

export async function deleteDownload(
  targetIdOrSectionId: string | AudioSectionKey | 'all',
): Promise<void> {
  if (targetIdOrSectionId === 'all') {
    await clearAllDownloadRecords();
    if (typeof caches !== 'undefined') {
      try {
        await caches.delete(AUDIO_CACHE_BUCKET);
      } catch {
        // ignore
      }
    }
    emitDownloadChange();
    return;
  }

  const section = AUDIO_SECTIONS_CATALOG.find(
    (s) => s.id === targetIdOrSectionId,
  );
  const targets = section
    ? section.items
    : ALL_AUDIO_CATALOG_ITEMS.filter(
        (i) => i.id === targetIdOrSectionId || i.url === targetIdOrSectionId,
      );

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AUDIO_CACHE_BUCKET);
      for (const item of targets) {
        await cache.delete(item.url);
      }
    } catch {
      // ignore
    }
  }

  for (const item of targets) {
    await deleteDownloadRecord(item.id);
  }
  if (targets.length === 0) {
    await deleteDownloadRecord(targetIdOrSectionId);
  }
  emitDownloadChange();
}

export async function getStorageUsage(): Promise<StorageUsageSummary> {
  const records = await listDownloadRecords();
  const downloadedMap = new Map<string, StoredDownloadRecord>();
  for (const rec of records) {
    if (rec.downloaded) {
      downloadedMap.set(rec.id, rec);
    }
  }

  const bySection: StorageUsageSummary['bySection'] = {
    lectures: {downloadedCount: 0, totalCount: 0, usedMb: 0},
    quran_audio: {downloadedCount: 0, totalCount: 0, usedMb: 0},
    nasheed: {downloadedCount: 0, totalCount: 0, usedMb: 0},
    khutab: {downloadedCount: 0, totalCount: 0, usedMb: 0},
  };

  let totalBytes = 0;
  let downloadedCount = 0;

  for (const sec of AUDIO_SECTIONS_CATALOG) {
    let secBytes = 0;
    let secDownloaded = 0;
    for (const item of sec.items) {
      const hit = downloadedMap.get(item.id);
      if (hit) {
        secDownloaded += 1;
        downloadedCount += 1;
        const sizeBytes =
          hit.size > 0 ? hit.size : Math.round(item.estimatedMb * 1024 * 1024);
        secBytes += sizeBytes;
        totalBytes += sizeBytes;
      }
    }
    bySection[sec.id] = {
      downloadedCount: secDownloaded,
      totalCount: sec.items.length,
      usedMb: Number((secBytes / (1024 * 1024)).toFixed(1)),
    };
  }

  return {
    totalBytes,
    totalMb: Number((totalBytes / (1024 * 1024)).toFixed(1)),
    downloadedCount,
    totalItemsCount: ALL_AUDIO_CATALOG_ITEMS.length,
    bySection,
  };
}

export async function processPendingDownloadsIfReady(): Promise<void> {
  if (!canStartAutoWifiDownload()) return;
  const queue = getPendingDownloadQueue();
  if (queue.length === 0) return;
  for (const itemId of queue) {
    await downloadSingle(itemId);
  }
}

export const DownloadManager = {
  downloadSection,
  downloadSingle,
  deleteDownload,
  getStorageUsage,
  checkIfDownloaded,
  resolveDownloadedAudioSrc,
  getWifiOnlySetting,
  setWifiOnlySetting,
  queueDownloadWhenOnline,
  processPendingDownloadsIfReady,
};
