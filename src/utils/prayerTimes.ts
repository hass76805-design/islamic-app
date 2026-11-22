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
  {id: 'UmmAlQura', labelAr: 'أم القرى (مكة المكرمة)'},
  {id: 'Egyptian', labelAr: 'الهيئة المصرية العامة للمساحة'},
  {id: 'MuslimWorldLeague', labelAr: 'رابطة العالم الإسلامي'},
  {id: 'Dubai', labelAr: 'دبي / الإمارات'},
  {id: 'Qatar', labelAr: 'قطر'},
  {id: 'Kuwait', labelAr: 'الكويت'},
  {id: 'Karachi', labelAr: 'جامعة العلوم الإسلامية بكراتشي'},
  {id: 'NorthAmerica', labelAr: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)'},
];

function getMethodParams(methodId: CalculationMethodId, madhab: AsrMadhab): CalculationParameters {
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
): {
  schedule: PrayerScheduleItem[];
  nextPrayer: NextPrayerState;
} {
  const coords = new Coordinates(latitude, longitude);
  const params = getMethodParams(methodId, madhab);
  const todayTimes = new PrayerTimes(coords, now, params);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowTimes = new PrayerTimes(coords, tomorrow, params);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayTimes = new PrayerTimes(coords, yesterday, params);

  const keys: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const timesMap: Record<PrayerKey, Date> = {
    fajr: addMinutes(todayTimes.fajr, offsets.fajr || 0),
    sunrise: addMinutes(todayTimes.sunrise, offsets.sunrise || 0),
    dhuhr: addMinutes(todayTimes.dhuhr, offsets.dhuhr || 0),
    asr: addMinutes(todayTimes.asr, offsets.asr || 0),
    maghrib: addMinutes(todayTimes.maghrib, offsets.maghrib || 0),
    isha: addMinutes(todayTimes.isha, offsets.isha || 0),
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
    prevTime = idx > 0 ? timesMap[keys[idx - 1]] : yesterdayTimes.isha;
  } else {
    // After Isha -> next is tomorrow's Fajr
    resolvedNextKey = 'fajr';
    nextTime = tomorrowTimes.fajr;
    prevTime = todayTimes.isha;
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
