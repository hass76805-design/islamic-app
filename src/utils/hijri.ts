export interface HijriDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
  monthNameAr: string;
  weekdayAr: string;
}

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const WEEKDAYS_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export interface IslamicOccasion {
  month: number;
  day: number;
  titleAr: string;
  descriptionAr: string;
}

export const ISLAMIC_OCCASIONS: IslamicOccasion[] = [
  {month: 1, day: 1, titleAr: 'رأس السنة الهجرية', descriptionAr: 'بداية العام الهجري الجديد'},
  {month: 1, day: 10, titleAr: 'يوم عاشوراء', descriptionAr: 'صيام العاشر من محرم يكفر السنة الماضية'},
  {month: 3, day: 12, titleAr: 'ذكرى المولد النبوي', descriptionAr: 'ذكرى مولد النبي محمد ﷺ'},
  {month: 7, day: 27, titleAr: 'الإسراء والمعراج', descriptionAr: 'ليلة الإسراء والمعراج المباركة'},
  {month: 8, day: 15, titleAr: 'ليلة النصف من شعبان', descriptionAr: 'ليلة مباركة في شهر شعبان'},
  {month: 9, day: 1, titleAr: 'بداية شهر رمضان', descriptionAr: 'أول أيام شهر الصيام المبارك'},
  {month: 9, day: 27, titleAr: 'ليلة السابع والعشرين من رمضان', descriptionAr: 'من أرجى ليالي القدر في العشر الأواخر'},
  {month: 10, day: 1, titleAr: 'عيد الفطر المبارك', descriptionAr: 'أول أيام عيد الفطر السعيد'},
  {month: 12, day: 9, titleAr: 'يوم عرفة', descriptionAr: 'خير يوم طلعت عليه الشمس وصيامه يكفر سنتين'},
  {month: 12, day: 10, titleAr: 'عيد الأضحى المبارك', descriptionAr: 'يوم النحر وأول أيام عيد الأضحى'},
];

// Kuwaiti / Tabular Islamic Calendar conversion (100% deterministic offline)
export function gregorianToHijriTabular(date: Date): {year: number; month: number; day: number} {
  let day = date.getDate();
  let month = date.getMonth();
  let year = date.getFullYear();

  let m = month + 1;
  let y = year;
  if (m < 3) {
    y -= 1;
    m += 12;
  }

  let a = Math.floor(y / 100);
  let b = 2 - a + Math.floor(a / 4);
  if (y < 1583) b = 0;
  if (y === 1582) {
    if (m > 10) b = -10;
    if (m === 10) {
      b = 0;
      if (day > 4) b = -10;
    }
  }

  const jd =
    Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;

  b = 0;
  if (jd > 2299160) {
    a = Math.floor((jd - 1867216.25) / 36524.25);
    b = 1 + a - Math.floor(a / 4);
  }
  const bb = jd + b + 1524;
  let cc = Math.floor((bb - 122.1) / 365.25);
  const dd = Math.floor(365.25 * cc);
  const ee = Math.floor((bb - dd) / 30.6001);
  day = bb - dd - Math.floor(30.6001 * ee);
  month = ee - 1;
  if (ee > 13) {
    cc += 1;
    month = ee - 13;
  }
  year = cc - 4716;

  const iyear = 10631 / 30;
  const epochastro = 1948084;
  const shift1 = 8.01 / 60;

  let z = jd - epochastro;
  const cyc = Math.floor(z / 10631);
  z = z - 10631 * cyc;
  const j = Math.floor((z - shift1) / iyear);
  const iy = 30 * cyc + j;
  z = z - Math.floor(j * iyear + shift1);
  let im = Math.floor((z + 28.5001) / 29.5);
  if (im === 13) im = 12;
  const id = Math.floor(z - Math.floor(29.5001 * im - 29));

  return {year: iy, month: im, day: Math.max(1, Math.min(30, id))};
}

export function hijriToGregorianApprox(hYear: number, hMonth: number, hDay: number): Date {
  const jd =
    Math.floor((11 * hYear + 3) / 30) +
    354 * hYear +
    30 * hMonth -
    Math.floor((hMonth - 1) / 2) +
    hDay +
    1948440 -
    385;

  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;

  return new Date(y, m - 1, d, 12, 0, 0);
}

export function getHijriParts(date: Date): HijriDateParts {
  const weekdayAr = WEEKDAYS_AR[date.getDay()];
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = fmt.formatToParts(date);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
    if (day > 0 && month >= 1 && month <= 12 && year > 1300) {
      return {
        year,
        month,
        day,
        monthNameAr: HIJRI_MONTHS_AR[month - 1],
        weekdayAr,
      };
    }
  } catch {
    // Fallback to deterministic tabular algorithm
  }
  const tab = gregorianToHijriTabular(date);
  return {
    year: tab.year,
    month: tab.month,
    day: tab.day,
    monthNameAr: HIJRI_MONTHS_AR[tab.month - 1],
    weekdayAr,
  };
}

export function formatGregorianAr(date: Date): string {
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getHijriMonthGrid(hYear: number, hMonth: number) {
  // Find approximate Gregorian start of Hijri month, then walk +/- days using getHijriParts
  const approxStart = hijriToGregorianApprox(hYear, hMonth, 1);
  // Scan around approxStart (-5 to +5 days) to pinpoint day === 1 of (hYear, hMonth)
  let firstDayDate = new Date(approxStart);
  for (let offset = -5; offset <= 5; offset++) {
    const candidate = new Date(approxStart);
    candidate.setDate(approxStart.getDate() + offset);
    const parts = getHijriParts(candidate);
    if (parts.year === hYear && parts.month === hMonth && parts.day === 1) {
      firstDayDate = candidate;
      break;
    }
  }

  const days: Array<{
    hijriDay: number;
    gregorianDate: Date;
    isWhiteDay: boolean;
    occasion?: IslamicOccasion;
  }> = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(firstDayDate);
    d.setDate(firstDayDate.getDate() + i);
    const parts = getHijriParts(d);
    if (i > 27 && parts.month !== hMonth) {
      break;
    }
    const hDay = parts.month === hMonth ? parts.day : i + 1;
    const occasion = ISLAMIC_OCCASIONS.find(
      (o) => o.month === hMonth && o.day === hDay,
    );
    days.push({
      hijriDay: hDay,
      gregorianDate: d,
      isWhiteDay: hDay === 13 || hDay === 14 || hDay === 15,
      occasion,
    });
  }

  return {
    firstWeekday: firstDayDate.getDay(), // 0 = Sunday .. 6 = Saturday
    days,
  };
}
