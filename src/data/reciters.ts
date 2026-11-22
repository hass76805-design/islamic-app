import {AdhanVoice, FamousSurahItem, ReciterId, ReciterInfo} from '../types';

export const RECITERS_10: ReciterInfo[] = [
  {
    id: 'minshawi',
    nameAr: 'محمد صديق المنشاوي',
    shortNameAr: 'المنشاوي',
    styleAr: 'مرتل خاشع',
    everyayahFolder: 'Minshawy_Murattal_128kbps',
    mp3quranBase: 'https://server10.mp3quran.net/minsh',
  },
  {
    id: 'abdulbasit',
    nameAr: 'عبد الباسط عبد الصمد',
    shortNameAr: 'عبد الباسط',
    styleAr: 'مرتل متقن',
    everyayahFolder: 'Abdul_Basit_Murattal_192kbps',
    mp3quranBase: 'https://server7.mp3quran.net/basit',
  },
  {
    id: 'alafasy',
    nameAr: 'مشاري راشد العفاسي',
    shortNameAr: 'العفاسي',
    styleAr: 'حفص عن عاصم',
    everyayahFolder: 'Alafasy_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/afs',
  },
  {
    id: 'sudais',
    nameAr: 'عبد الرحمن السديس',
    shortNameAr: 'السديس',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Abdurrahmaan_As-Sudais_192kbps',
    mp3quranBase: 'https://server11.mp3quran.net/sds',
  },
  {
    id: 'dosari',
    nameAr: 'ياسر الدوسري',
    shortNameAr: 'ياسر الدوسري',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Yasser_Ad-Dussary_128kbps',
    mp3quranBase: 'https://server11.mp3quran.net/yasser',
  },
  {
    id: 'muaiqly',
    nameAr: 'ماهر المعيقلي',
    shortNameAr: 'ماهر المعيقلي',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'MaherAlMuaiqly128kbps',
    mp3quranBase: 'https://server12.mp3quran.net/maher',
  },
  {
    id: 'husary',
    nameAr: 'محمود خليل الحصري',
    shortNameAr: 'الحصري',
    styleAr: 'مرتل تعليمي',
    everyayahFolder: 'Husary_128kbps',
    mp3quranBase: 'https://server13.mp3quran.net/husr',
  },
  {
    id: 'ghamdi',
    nameAr: 'سعد الغامدي',
    shortNameAr: 'سعد الغامدي',
    styleAr: 'مرتل هادئ',
    everyayahFolder: 'Ghamadi_40kbps',
    mp3quranBase: 'https://server7.mp3quran.net/s_gmd',
  },
  {
    id: 'ajamy',
    nameAr: 'أحمد بن علي العجمي',
    shortNameAr: 'أحمد العجمي',
    styleAr: 'مرتل ندي',
    everyayahFolder: 'ahmed_ibn_ali_al_ajamy_128kbps',
    mp3quranBase: 'https://server10.mp3quran.net/ajm',
  },
  {
    id: 'shuraim',
    nameAr: 'سعود الشريم',
    shortNameAr: 'سعود الشريم',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Saood_ash-Shuraym_128kbps',
    mp3quranBase: 'https://server7.mp3quran.net/shur',
  },
];

export function getReciterById(id: ReciterId): ReciterInfo {
  return RECITERS_10.find((r) => r.id === id) || RECITERS_10[2];
}

function pad3(num: number): string {
  return String(num).padStart(3, '0');
}

export function getAyahAudioUrl(
  reciterId: ReciterId,
  surahNumber: number,
  ayahInSurah: number,
): string {
  const reciter = getReciterById(reciterId);
  return `https://everyayah.com/data/${reciter.everyayahFolder}/${pad3(surahNumber)}${pad3(ayahInSurah)}.mp3`;
}

export function getSurahAudioUrl(reciterId: ReciterId, surahNumber: number): string {
  const reciter = getReciterById(reciterId);
  return `${reciter.mp3quranBase}/${pad3(surahNumber)}.mp3`;
}

export const ADHAN_VOICES_9: AdhanVoice[] = [
  {
    id: 'adhan-makkah',
    nameAr: 'أذان المسجد الحرام (محمّل بدون نت)',
    muezzinAr: 'الشيخ علي أحمد ملا',
    locationAr: 'مكة المكرمة',
    url: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-madinah',
    nameAr: 'أذان المسجد النبوي (محمّل بدون نت)',
    muezzinAr: 'أذان المدينة المنورة',
    locationAr: 'المدينة المنورة',
    url: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-alafasy',
    nameAr: 'أذان مشاري العفاسي (محمّل بدون نت)',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت',
    url: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-aqsa',
    nameAr: 'أذان المسجد الأقصى',
    muezzinAr: 'أذان القدس الشريف',
    locationAr: 'القدس',
    url: 'https://www.islamcan.com/audio/adhan/azan3.mp3',
  },
  {
    id: 'adhan-egypt',
    nameAr: 'الأذان المصري الكلاسيكي',
    muezzinAr: 'الأذان المقامي العريق',
    locationAr: 'القاهرة',
    url: 'https://www.islamcan.com/audio/adhan/azan5.mp3',
  },
  {
    id: 'adhan-fajr',
    nameAr: 'أذان الفجر الخاشع',
    muezzinAr: 'الصلاة خير من النوم',
    locationAr: 'الحرمين الشريفين',
    url: 'https://www.islamcan.com/audio/adhan/azan6.mp3',
  },
  {
    id: 'adhan-istanbul',
    nameAr: 'أذان إسطنبول',
    muezzinAr: 'الأذان العثماني الهادئ',
    locationAr: 'إسطنبول',
    url: 'https://www.islamcan.com/audio/adhan/azan7.mp3',
  },
  {
    id: 'adhan-sham',
    nameAr: 'أذان بلاد الشام',
    muezzinAr: 'أذان المسجد الأموي',
    locationAr: 'دمشق',
    url: 'https://www.islamcan.com/audio/adhan/azan8.mp3',
  },
  {
    id: 'adhan-haramain',
    nameAr: 'أذان الحرمين الندي',
    muezzinAr: 'الأذان الروحاني',
    locationAr: 'الحرم المكي',
    url: 'https://www.islamcan.com/audio/adhan/azan9.mp3',
  },
];

// 3 أصوات محمّلة داخل التطبيق بدون نت لكل قسم
export const ADHAN_VOICES_3: AdhanVoice[] = ADHAN_VOICES_9.slice(0, 3);

export const IQAMAH_VOICES_3: AdhanVoice[] = [
  {
    id: 'iqamah-makkah',
    nameAr: 'إقامة المسجد الحرام (محمّل بدون نت)',
    muezzinAr: 'الأداء المكي المتقن',
    locationAr: 'مكة المكرمة',
    url: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-madinah',
    nameAr: 'إقامة المسجد النبوي (محمّل بدون نت)',
    muezzinAr: 'الإقامة الهادئة الرصينة',
    locationAr: 'المدينة المنورة',
    url: '/audio/iqamah-madinah.mp3',
  },
  {
    id: 'iqamah-haram',
    nameAr: 'الإقامة الخاشعة (محمّل بدون نت)',
    muezzinAr: 'إقامة المسجد الجامع',
    locationAr: 'الحرمين',
    url: '/audio/iqamah-haram.mp3',
  },
];

export const PRE_ADHAN_VOICES_3: Array<{
  id: string;
  nameAr: string;
  descAr: string;
  url: string;
}> = [
  {
    id: 'pre-chime',
    nameAr: 'نغمة المسجد الهادئة',
    descAr: 'جرس ذهبي هادئ ولطيف للتنبيه قبل الأذان',
    url: '/audio/pre-chime.mp3',
  },
  {
    id: 'pre-takbeer',
    nameAr: 'تكبير التنبيه من الحرم',
    descAr: 'صوت «الله أكبر الله أكبر» لتنبيه اقتراب الصلاة',
    url: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-istighfar',
    nameAr: 'ذكر واستعداد للصلاة',
    descAr: 'تنبيه صوتي بالذكر قبل الأذان (حصن المسلم)',
    url: '/audio/pre-istighfar.mp3',
  },
];

export const TAWASIH_VOICES_3: Array<{
  id: string;
  titleAr: string;
  reciterAr: string;
  url: string;
}> = [
  {
    id: 'tawasih-naqshabandi-1',
    titleAr: 'ابتهال الفجر الخاشع',
    reciterAr: 'الشيخ سيد النقشبندي',
    url: '/audio/tawasih-naqshabandi-1.mp3',
  },
  {
    id: 'tawasih-naqshabandi-2',
    titleAr: 'مناجاة وتواشيح السحر',
    reciterAr: 'الشيخ سيد النقشبندي',
    url: '/audio/tawasih-naqshabandi-2.mp3',
  },
  {
    id: 'tawasih-housaini',
    titleAr: 'تواشيح وابتهالات الفجر',
    reciterAr: 'الشيخ علي الحسيني',
    url: '/audio/tawasih-housaini.mp3',
  },
];

export const EID_TAKBEERAT_VOICES_3: Array<{
  id: string;
  titleAr: string;
  reciterAr: string;
  url: string;
}> = [
  {
    id: 'eid-makkah-1',
    titleAr: 'تكبيرات المسجد الحرام',
    reciterAr: 'الشيخ علي أحمد ملا',
    url: '/audio/eid-makkah-1.mp3',
  },
  {
    id: 'eid-makkah-2',
    titleAr: 'تكبيرات الحرم المكي المباركة',
    reciterAr: 'مؤذنو المسجد الحرام',
    url: '/audio/eid-makkah-2.mp3',
  },
  {
    id: 'eid-jamaa',
    titleAr: 'تكبيرات العيد الجماعية',
    reciterAr: 'تكبيرات عيد الفطر والأضحى',
    url: '/audio/eid-jamaa.mp3',
  },
];

export const FRIDAY_KAHF_VOICES_3: Array<{
  id: string;
  titleAr: string;
  reciterAr: string;
  url: string;
}> = [
  {
    id: 'kahf-alafasy',
    titleAr: 'سورة الكهف ليوم الجمعة',
    reciterAr: 'الشيخ مشاري راشد العفاسي',
    url: '/audio/kahf-alafasy.mp3',
  },
  {
    id: 'kahf-abdulbasit',
    titleAr: 'سورة الكهف — تلاوة مجودة',
    reciterAr: 'الشيخ عبد الباسط عبد الصمد',
    url: '/audio/kahf-abdulbasit.mp3',
  },
  {
    id: 'kahf-muaiqly',
    titleAr: 'سورة الكهف — تلاوة الحرم',
    reciterAr: 'الشيخ ماهر المعيقلي',
    url: '/audio/kahf-muaiqly.mp3',
  },
];

export const EID_TAKBEERAT_AUDIO = EID_TAKBEERAT_VOICES_3[0];
export const FAJR_TAWASIH_AUDIO = TAWASIH_VOICES_3[0];

export const POST_PRAYER_AZKAR_AUDIO_URLS = [
  'https://www.hisnmuslim.com/audio/ar/66.mp3',
  'https://www.hisnmuslim.com/audio/ar/67.mp3',
  'https://www.hisnmuslim.com/audio/ar/68.mp3',
  'https://www.hisnmuslim.com/audio/ar/69.mp3',
  'https://www.hisnmuslim.com/audio/ar/71.mp3',
];

export const IQAMAH_AUDIO: AdhanVoice = IQAMAH_VOICES_3[0];

export const ADHAN_TONE_DESCRIPTIONS: Record<string, {maqamAr: string; paceFactor: number}> = {
  'adhan-makkah': {maqamAr: 'النغمة: المقام المكي الجَهوري (الحجاز)', paceFactor: 1.0},
  'adhan-madinah': {maqamAr: 'النغمة: المقام المدني الرصين (البيات)', paceFactor: 0.98},
  'adhan-alafasy': {maqamAr: 'النغمة: نبرة العفاسي الندية (الراست)', paceFactor: 1.0},
  'adhan-aqsa': {maqamAr: 'النغمة: مقام الأقصى الخاشع', paceFactor: 1.02},
  'adhan-egypt': {maqamAr: 'النغمة: المقام المصري التراثي (الصبا)', paceFactor: 0.95},
  'adhan-fajr': {maqamAr: 'النغمة: مقام الفجر الروحاني (الصبا والسيكاه)', paceFactor: 0.94},
  'adhan-istanbul': {maqamAr: 'النغمة: المقام العثماني الهادئ', paceFactor: 0.97},
  'adhan-sham': {maqamAr: 'النغمة: المقام الشامي العريق', paceFactor: 1.0},
  'adhan-haramain': {maqamAr: 'النغمة: أداء الحرمين الندي', paceFactor: 1.0},
  'iqamah-makkah': {maqamAr: 'نغمة الإقامة المكية المتقنة (محمّلة بدون نت)', paceFactor: 1.0},
  'iqamah-madinah': {maqamAr: 'نغمة الإقامة المدنية الهادئة (محمّلة بدون نت)', paceFactor: 1.0},
  'iqamah-haram': {maqamAr: 'نغمة الإقامة الخاشعة (محمّلة بدون نت)', paceFactor: 1.0},
};

export const FAMOUS_SURAHS_30: FamousSurahItem[] = [
  {number: 1, nameAr: 'سورة الفاتحة', ayahsCount: 7, revelationAr: 'مكية', highlight: true},
  {number: 18, nameAr: 'سورة الكهف', ayahsCount: 110, revelationAr: 'مكية', highlight: true},
  {number: 36, nameAr: 'سورة يس', ayahsCount: 83, revelationAr: 'مكية', highlight: true},
  {number: 67, nameAr: 'سورة الملك', ayahsCount: 30, revelationAr: 'مكية', highlight: true},
  {number: 56, nameAr: 'سورة الواقعة', ayahsCount: 96, revelationAr: 'مكية', highlight: true},
  {number: 55, nameAr: 'سورة الرحمن', ayahsCount: 78, revelationAr: 'مدنية', highlight: true},
  {number: 2, nameAr: 'سورة البقرة', ayahsCount: 286, revelationAr: 'مدنية'},
  {number: 3, nameAr: 'سورة آل عمران', ayahsCount: 200, revelationAr: 'مدنية'},
  {number: 12, nameAr: 'سورة يوسف', ayahsCount: 111, revelationAr: 'مكية'},
  {number: 19, nameAr: 'سورة مريم', ayahsCount: 98, revelationAr: 'مكية'},
  {number: 20, nameAr: 'سورة طه', ayahsCount: 135, revelationAr: 'مكية'},
  {number: 24, nameAr: 'سورة النور', ayahsCount: 64, revelationAr: 'مدنية'},
  {number: 25, nameAr: 'سورة الفرقان', ayahsCount: 77, revelationAr: 'مكية'},
  {number: 31, nameAr: 'سورة لقمان', ayahsCount: 34, revelationAr: 'مكية'},
  {number: 32, nameAr: 'سورة السجدة', ayahsCount: 30, revelationAr: 'مكية'},
  {number: 37, nameAr: 'سورة الصافات', ayahsCount: 182, revelationAr: 'مكية'},
  {number: 48, nameAr: 'سورة الفتح', ayahsCount: 29, revelationAr: 'مدنية'},
  {number: 50, nameAr: 'سورة ق', ayahsCount: 45, revelationAr: 'مكية'},
  {number: 59, nameAr: 'سورة الحشر', ayahsCount: 24, revelationAr: 'مدنية'},
  {number: 73, nameAr: 'سورة المزمل', ayahsCount: 20, revelationAr: 'مكية'},
  {number: 76, nameAr: 'سورة الإنسان', ayahsCount: 31, revelationAr: 'مدنية'},
  {number: 78, nameAr: 'سورة النبأ', ayahsCount: 40, revelationAr: 'مكية'},
  {number: 87, nameAr: 'سورة الأعلى', ayahsCount: 19, revelationAr: 'مكية'},
  {number: 88, nameAr: 'سورة الغاشية', ayahsCount: 26, revelationAr: 'مكية'},
  {number: 93, nameAr: 'سورة الضحى', ayahsCount: 11, revelationAr: 'مكية'},
  {number: 94, nameAr: 'سورة الشرح', ayahsCount: 8, revelationAr: 'مكية'},
  {number: 97, nameAr: 'سورة القدر', ayahsCount: 5, revelationAr: 'مكية'},
  {number: 99, nameAr: 'سورة الزلزلة', ayahsCount: 8, revelationAr: 'مدنية'},
  {number: 112, nameAr: 'سورة الإخلاص', ayahsCount: 4, revelationAr: 'مكية'},
  {number: 113, nameAr: 'سورة الفلق', ayahsCount: 5, revelationAr: 'مكية'},
];
