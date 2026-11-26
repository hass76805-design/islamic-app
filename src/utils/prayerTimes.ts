import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  Madhab,
  Prayer,
  PrayerTimes,
  Qibla,
} from 'adhan';
import {
  AsrMadhab,
  CalculationMethodId,
  NextPrayerState,
  PrayerKey,
  PrayerOffsets,
  PrayerScheduleItem,
} from '../types';
import {readAppStateFromIdb, saveAppStateToIdb} from './offlineDb';

export const KAABA_COORDS = {
  latitude: 21.422487,
  longitude: 39.826206,
};

export const DEFAULT_PRAYER_OFFSETS: PrayerOffsets = {
  fajr: 0,
  sunrise: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

export const CALCULATION_METHODS: Array<{id: CalculationMethodId; labelAr: string}> = [
  {id: 'Egyptian', labelAr: 'وزارة الأوقاف المصرية (الهيئة العامة للمساحة)'},
  {id: 'MuslimWorldLeague', labelAr: 'رابطة العالم الإسلامي'},
  {id: 'NorthAmerica', labelAr: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)'},
  {id: 'UmmAlQura', labelAr: 'أم القرى (مكة المكرمة)'},
  {id: 'Karachi', labelAr: 'جامعة العلوم الإسلامية بكراتشي'},
  {id: 'Kuwait', labelAr: 'الكويت'},
  {id: 'France', labelAr: 'فرنسا (UOIF)'},
  {id: 'Dubai', labelAr: 'دبي / الإمارات'},
  {id: 'Qatar', labelAr: 'قطر'},
  {id: 'Custom', labelAr: 'حساب مخصص'},
];

function getMethodParams(
  methodId: CalculationMethodId,
  madhab: AsrMadhab,
  customFajrAngle = 18.5,
  customIshaAngle = 17.5,
): CalculationParameters {
  let params: CalculationParameters;
  switch (methodId) {
    case 'UmmAlQura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'Egyptian':
      params = CalculationMethod.Egyptian();
      break;
    case 'Karachi':
      params = CalculationMethod.Karachi();
      break;
    case 'NorthAmerica':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'Dubai':
      params = CalculationMethod.Dubai();
      break;
    case 'Kuwait':
      params = CalculationMethod.Kuwait();
      break;
    case 'Qatar':
      params = CalculationMethod.Qatar();
      break;
    case 'France':
      params = new CalculationParameters('Other', 12, 12);
      break;
    case 'Custom':
      params = new CalculationParameters('Other', customFajrAngle, customIshaAngle);
      break;
    case 'MuslimWorldLeague':
    default:
      params = CalculationMethod.MuslimWorldLeague();
      break;
  }
  params.madhab = madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

export const PRAYER_NAMES_AR: Record<PrayerKey, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};

export function formatTime24(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatTime12(date: Date): string {
  const rawHours = date.getHours();
  const period = rawHours >= 12 ? 'م' : 'ص';
  const h12 = rawHours % 12 || 12;
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${String(h12).padStart(2, '0')}:${mm} ${period}`;
}

export function formatClock24(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatClock12(date: Date): {time: string; periodAr: 'ص' | 'م'} {
  const rawHours = date.getHours();
  const periodAr: 'ص' | 'م' = rawHours >= 12 ? 'م' : 'ص';
  const h12 = rawHours % 12 || 12;
  const hh = String(h12).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return {time: `${hh}:${mm}:${ss}`, periodAr};
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function mapAdhanPrayerToKey(p: (typeof Prayer)[keyof typeof Prayer]): PrayerKey | null {
  switch (p) {
    case Prayer.Fajr:
      return 'fajr';
    case Prayer.Sunrise:
      return 'sunrise';
    case Prayer.Dhuhr:
      return 'dhuhr';
    case Prayer.Asr:
      return 'asr';
    case Prayer.Maghrib:
      return 'maghrib';
    case Prayer.Isha:
      return 'isha';
    default:
      return null;
  }
}

function addMinutes(d: Date, mins: number): Date {
  if (!mins) return d;
  return new Date(d.getTime() + mins * 60000);
}

export function computeDailyPrayerData(
  latitude: number,
  longitude: number,
  now: Date,
  methodId: CalculationMethodId,
  madhab: AsrMadhab,
  offsets: PrayerOffsets = DEFAULT_PRAYER_OFFSETS,
  dstEnabled = false,
  customFajrAngle = 18.5,
  customIshaAngle = 17.5,
): {
  schedule: PrayerScheduleItem[];
  nextPrayer: NextPrayerState;
} {
  const coords = new Coordinates(latitude, longitude);
  const params = getMethodParams(methodId, madhab, customFajrAngle, customIshaAngle);
  const todayTimes = new PrayerTimes(coords, now, params);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowTimes = new PrayerTimes(coords, tomorrow, params);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayTimes = new PrayerTimes(coords, yesterday, params);

  const dstMinutes = dstEnabled ? 60 : 0;
  const keys: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const timesMap: Record<PrayerKey, Date> = {
    fajr: addMinutes(todayTimes.fajr, (offsets.fajr || 0) + dstMinutes),
    sunrise: addMinutes(todayTimes.sunrise, (offsets.sunrise || 0) + dstMinutes),
    dhuhr: addMinutes(todayTimes.dhuhr, (offsets.dhuhr || 0) + dstMinutes),
    asr: addMinutes(todayTimes.asr, (offsets.asr || 0) + dstMinutes),
    maghrib: addMinutes(todayTimes.maghrib, (offsets.maghrib || 0) + dstMinutes),
    isha: addMinutes(todayTimes.isha, (offsets.isha || 0) + dstMinutes),
  };

  // Determine next prayer strictly among Fajr, Dhuhr, Asr, Maghrib, Isha (and Sunrise if before Sunrise)
  // Actually showing Sunrise as next marker or Fajr/Dhuhr/Asr/Maghrib/Isha:
  let nextKey: PrayerKey | null = null;
  for (const k of keys) {
    if (timesMap[k].getTime() > now.getTime()) {
      nextKey = k;
      break;
    }
  }

  let nextTime: Date;
  let prevTime: Date;
  let resolvedNextKey: PrayerKey;

  if (nextKey) {
    resolvedNextKey = nextKey;
    nextTime = timesMap[nextKey];
    const idx = keys.indexOf(nextKey);
    prevTime =
      idx > 0
        ? timesMap[keys[idx - 1]]
        : addMinutes(yesterdayTimes.isha, (offsets.isha || 0) + dstMinutes);
  } else {
    // After Isha -> next is tomorrow's Fajr
    resolvedNextKey = 'fajr';
    nextTime = addMinutes(tomorrowTimes.fajr, (offsets.fajr || 0) + dstMinutes);
    prevTime = timesMap.isha;
  }

  const totalSpan = Math.max(1, nextTime.getTime() - prevTime.getTime());
  const elapsed = Math.max(0, now.getTime() - prevTime.getTime());
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalSpan) * 100));
  const remainingMs = Math.max(0, nextTime.getTime() - now.getTime());

  const currentPrayerKey = mapAdhanPrayerToKey(todayTimes.currentPrayer(now));

  const schedule: PrayerScheduleItem[] = keys.map((key) => {
    const time = timesMap[key];
    return {
      key,
      nameAr: PRAYER_NAMES_AR[key],
      time,
      formatted24: formatTime24(time),
      isNext: nextKey === key || (!nextKey && key === 'fajr'),
      isPassed: time.getTime() <= now.getTime(),
    };
  });

  return {
    schedule,
    nextPrayer: {
      currentKey: currentPrayerKey,
      nextKey: resolvedNextKey,
      nextNameAr: PRAYER_NAMES_AR[resolvedNextKey],
      nextTime,
      remainingMs,
      remainingFormatted: formatCountdown(remainingMs),
      progressPercent,
    },
  };
}

export function computeQiblaBearing(latitude: number, longitude: number): number {
  const coords = new Coordinates(latitude, longitude);
  return Qibla(coords);
}

export function computeDistanceToKaabaKm(latitude: number, longitude: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(KAABA_COORDS.latitude - latitude);
  const dLon = toRad(KAABA_COORDS.longitude - longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(latitude)) *
      Math.cos(toRad(KAABA_COORDS.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes Islamic night midpoint & start of the Last Third of the Night (Qiyam al-Layl)
 * for the night between Maghrib and next Fajr (works 100% offline via local astronomical calculation).
 */
export function computeQiyamAlLaylTime(
  latitude: number,
  longitude: number,
  dateRef: Date,
  methodId: CalculationMethodId,
  madhab: AsrMadhab,
  offsets: PrayerOffsets = DEFAULT_PRAYER_OFFSETS,
  dstEnabled = false,
): {lastThirdStart: Date; midpoint: Date; maghrib: Date; nextFajr: Date} {
  const coords = new Coordinates(latitude, longitude);
  const params = getMethodParams(methodId, madhab);

  const dayAnchor = new Date(
    dateRef.getFullYear(),
    dateRef.getMonth(),
    dateRef.getDate(),
    12,
    0,
    0,
  );
  const nextAnchor = new Date(dayAnchor);
  nextAnchor.setDate(dayAnchor.getDate() + 1);

  const todayTimes = new PrayerTimes(coords, dayAnchor, params);
  const tomorrowTimes = new PrayerTimes(coords, nextAnchor, params);

  const dstMin = dstEnabled ? 60 : 0;
  const maghrib = addMinutes(todayTimes.maghrib, (offsets.maghrib || 0) + dstMin);
  const nextFajr = addMinutes(tomorrowTimes.fajr, (offsets.fajr || 0) + dstMin);

  const nightMs = Math.max(1, nextFajr.getTime() - maghrib.getTime());
  const midpoint = new Date(maghrib.getTime() + nightMs * 0.5);
  const lastThirdStart = new Date(maghrib.getTime() + (nightMs * 2) / 3);

  return {lastThirdStart, midpoint, maghrib, nextFajr};
}

export const PRAYER_MONTH_CACHE_KEY = 'alzahabi_prayer_month_cache_v1';

export interface SavedMonthlyPrayerDay {
  dateKey: string;
  timesMs: Record<PrayerKey, number>;
  formatted24: Record<PrayerKey, string>;
  qiyamLastThirdMs: number;
}

export interface SavedMonthlyPrayerCache {
  updatedAt: number;
  city: string;
  latitude: number;
  longitude: number;
  methodId: CalculationMethodId;
  madhab: AsrMadhab;
  days: SavedMonthlyPrayerDay[];
  cairoDays: SavedMonthlyPrayerDay[];
  beniSuefDays?: SavedMonthlyPrayerDay[];
}

function formatLocalDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthArray(
  latitude: number,
  longitude: number,
  methodId: CalculationMethodId,
  madhab: AsrMadhab,
  offsets: PrayerOffsets,
  totalDays: number,
  dstEnabled = false,
): SavedMonthlyPrayerDay[] {
  const coords = new Coordinates(latitude, longitude);
  const params = getMethodParams(methodId, madhab);
  const keys: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const baseDate = new Date();
  const list: SavedMonthlyPrayerDay[] = [];
  const dstMin = dstEnabled ? 60 : 0;

  for (let i = 0; i < totalDays; i++) {
    const target = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate() + i,
      12,
      0,
      0,
    );
    const pt = new PrayerTimes(coords, target, params);
    const timesMs = {} as Record<PrayerKey, number>;
    const formatted24 = {} as Record<PrayerKey, string>;

    for (const k of keys) {
      const adjusted = addMinutes(pt[k], (offsets[k] || 0) + dstMin);
      timesMs[k] = adjusted.getTime();
      formatted24[k] = formatTime24(adjusted);
    }

    const qiyam = computeQiyamAlLaylTime(
      latitude,
      longitude,
      target,
      methodId,
      madhab,
      offsets,
      dstEnabled,
    );

    list.push({
      dateKey: formatLocalDayKey(target),
      timesMs,
      formatted24,
      qiyamLastThirdMs: qiyam.lastThirdStart.getTime(),
    });
  }

  return list;
}

/**
 * Precomputes and saves 30 days ahead of Prayer Times for the user's city,
 * Cairo (القاهرة), and Beni Suef (بني سويف) in localStorage + IndexedDB + CacheStorage.
 */
export function precomputeMonthlyPrayerCache(
  latitude: number,
  longitude: number,
  methodId: CalculationMethodId,
  madhab: AsrMadhab,
  offsets: PrayerOffsets = DEFAULT_PRAYER_OFFSETS,
  cityLabel = 'القاهرة',
  totalDays = 30,
  dstEnabled = false,
): SavedMonthlyPrayerCache {
  const days = buildMonthArray(latitude, longitude, methodId, madhab, offsets, totalDays, dstEnabled);
  const cairoDays = buildMonthArray(
    30.0444,
    31.2357,
    'Egyptian',
    madhab,
    offsets,
    totalDays,
    dstEnabled,
  );
  const beniSuefDays = buildMonthArray(
    29.0661,
    31.0994,
    'Egyptian',
    madhab,
    offsets,
    totalDays,
    dstEnabled,
  );

  const payload: SavedMonthlyPrayerCache = {
    updatedAt: Date.now(),
    city: cityLabel,
    latitude,
    longitude,
    methodId,
    madhab,
    days,
    cairoDays,
    beniSuefDays,
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRAYER_MONTH_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
    void saveAppStateToIdb(PRAYER_MONTH_CACHE_KEY, payload);
    if (typeof caches !== 'undefined') {
      caches
        .open('alzahabi-core-data-v1')
        .then((cache) =>
          cache.put(
            '/__prayer_month_30d.json',
            new Response(JSON.stringify(payload), {
              headers: {'Content-Type': 'application/json'},
            }),
          ),
        )
        .catch(() => {});
    }
  }

  return payload;
}

export function readSavedMonthlyPrayerCache(): SavedMonthlyPrayerCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PRAYER_MONTH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedMonthlyPrayerCache;
  } catch {
    return null;
  }
}

export async function hydrateMonthlyPrayerCacheFromIdb(): Promise<SavedMonthlyPrayerCache | null> {
  const fromIdb = await readAppStateFromIdb<SavedMonthlyPrayerCache>(
    PRAYER_MONTH_CACHE_KEY,
  );
  if (fromIdb && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRAYER_MONTH_CACHE_KEY, JSON.stringify(fromIdb));
    } catch {
      // ignore
    }
  }
  return fromIdb;
}
