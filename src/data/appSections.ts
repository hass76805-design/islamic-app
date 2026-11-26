import {AZKAR_CATEGORIES} from './azkar';
import {
  ADHAN_VOICES_30,
  EID_TAKBEERAT_VOICES_3,
  FAMOUS_SURAHS_30,
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
} from './reciters';
import {RAFIQI_WORDS_30} from './rafiqiData';
import {MoreSubPageId, ReciterId} from '../types';

export type MoreMenuSectionId = Exclude<MoreSubPageId, 'menu' | 'settings'>;
export type PrimarySectionId = 'quran' | 'hifz' | 'azkar' | 'qibla';
export type OfflineSectionId = PrimarySectionId | MoreMenuSectionId;

export type AppSectionIconKey =
  | 'book_open'
  | 'award'
  | 'audio_lines'
  | 'mic'
  | 'bell_ring'
  | 'heart_handshake'
  | 'radio'
  | 'heart'
  | 'book_open_text'
  | 'scroll_text'
  | 'help_circle'
  | 'moon_star'
  | 'sparkles'
  | 'book_marked'
  | 'circle_dot'
  | 'compass'
  | 'calendar_days'
  | 'check_circle_2'
  | 'download';

export interface AppSectionDefinition {
  id: OfflineSectionId;
  labelAr: string;
  descAr: string;
  moreDescAr?: string;
  iconKey: AppSectionIconKey;
  inMoreMenu: boolean;
  estimatedMb: number;
  estimatedMinutes: number;
  getOfflineUrls?: (preferredReciter: ReciterId) => string[];
}

export const CORE_LOCAL_AUDIO_ASSETS = [
  '/audio/azan.mp3',
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

const SHORT_SURAHS_OFFLINE_AYAHS: Array<[number, number]> = [
  [1, 7],
  [93, 11],
  [94, 8],
  [95, 8],
  [97, 5],
  [99, 8],
  [100, 11],
  [101, 11],
  [102, 8],
  [103, 3],
  [104, 9],
  [105, 5],
  [106, 4],
  [107, 7],
  [108, 3],
  [109, 6],
  [110, 3],
  [111, 5],
  [112, 4],
  [113, 5],
  [114, 6],
];

/**
 * Single canonical registry for EVERY section in the application.
 * Exhaustively typed against OfflineSectionId (Primary tabs + all MoreSubPageId sections)
 * so any newly added section automatically appears in the offline download picker and menus.
 */
const APP_SECTIONS_MAP: Record<OfflineSectionId, AppSectionDefinition> = {
  quran: {
    id: 'quran',
    labelAr: 'صفحة المصحف - بالاستماع والتفسير',
    descAr: 'المصحف كامل 604 صفحة بالتشكيل والتفسير وتلاوات القراء',
    iconKey: 'book_open',
    inMoreMenu: false,
    estimatedMb: 420,
    estimatedMinutes: 8,
    getOfflineUrls: (preferredReciter) => {
      const urls: string[] = [
        '/data/quran.json',
        '/data/tafsir.json',
        ...Array.from({length: 114}, (_, i) =>
          getSurahAudioUrl(preferredReciter, i + 1),
        ),
      ];
      const sharedSheikhSurahs = [
        1, 18, 36, 55, 56, 67, 87, 97, 108, 112, 113, 114,
      ];
      for (const reciter of RECITERS_30) {
        for (const sNum of sharedSheikhSurahs) {
          urls.push(getSurahAudioUrl(reciter.id, sNum));
        }
      }
      for (const [sNum, ayahCount] of SHORT_SURAHS_OFFLINE_AYAHS) {
        for (let a = 1; a <= ayahCount; a++) {
          urls.push(getAyahAudioUrl(preferredReciter, sNum, a));
        }
      }
      return urls;
    },
  },
  hifz: {
    id: 'hifz',
    labelAr: 'صفحة اختبار الحفظ',
    descAr: 'آيات الحفظ بصوت الشيخ للتصحيح كلمة بكلمة بدون نت',
    iconKey: 'award',
    inMoreMenu: false,
    estimatedMb: 120,
    estimatedMinutes: 3,
    getOfflineUrls: (preferredReciter) => {
      const urls: string[] = ['/data/quran.json'];
      const hifzReciters: ReciterId[] = Array.from(
        new Set<ReciterId>([
          preferredReciter,
          'husary',
          'minshawi',
          'abdulbasit',
          'muaiqly',
        ]),
      );
      for (const [sNum, ayahCount] of SHORT_SURAHS_OFFLINE_AYAHS) {
        for (let a = 1; a <= ayahCount; a++) {
          urls.push(getAyahAudioUrl(preferredReciter, sNum, a));
          urls.push(getAyahAudioUrl('husary', sNum, a));
        }
      }
      for (const rId of hifzReciters) {
        for (let a = 1; a <= 7; a++) {
          urls.push(getAyahAudioUrl(rId, 1, a));
        }
        for (const sNum of [1, 18, 36, 55, 67, 87, 97, 112, 113, 114]) {
          urls.push(getSurahAudioUrl(rId, sNum));
        }
      }
      return urls;
    },
  },
  voice_test: {
    id: 'voice_test',
    labelAr: 'اختبر صوتك في التلاوة (سجل صوتي)',
    descAr: 'نطق الآيات والكلمات بصوت الشيخ وحفظ التسجيلات محليًا بدون نت',
    moreDescAr: 'سجّل تلاوتك ليحدد السورة تلقائيًا ويصححها ويحفظ المقطع بصوتك',
    iconKey: 'audio_lines',
    inMoreMenu: true,
    estimatedMb: 90,
    estimatedMinutes: 2,
    getOfflineUrls: (preferredReciter) => {
      const urls: string[] = ['/data/quran.json'];
      for (const [sNum, ayahCount] of SHORT_SURAHS_OFFLINE_AYAHS) {
        for (let a = 1; a <= ayahCount; a++) {
          urls.push(getAyahAudioUrl(preferredReciter, sNum, a));
          urls.push(getAyahAudioUrl('husary', sNum, a));
        }
      }
      return urls;
    },
  },
  rafiqi: {
    id: 'rafiqi',
    labelAr: 'رفيقي (الحوار الصوتي الذكي)',
    descAr: 'آيات رفيقي + الـ 30 ردًا بصوت الشيخ البشري الحقيقي بدون نت',
    moreDescAr: 'صوت شيخ حقيقي يسمعك ويرد عليك + 30 كلمة بالآية المخصصة بصوت القارئ',
    iconKey: 'mic',
    inMoreMenu: true,
    estimatedMb: 75,
    estimatedMinutes: 2,
    getOfflineUrls: (preferredReciter) => {
      const rafiqiReciters: ReciterId[] = Array.from(
        new Set<ReciterId>([
          preferredReciter,
          'alafasy',
          'husary',
          'minshawi',
          'abdulbasit',
        ]),
      );
      const urls: string[] = [];
      for (const rId of rafiqiReciters) {
        for (const w of RAFIQI_WORDS_30) {
          urls.push(getAyahAudioUrl(rId, w.surahNumber, w.ayahNumber));
        }
      }
      return urls;
    },
  },
  adhan: {
    id: 'adhan',
    labelAr: 'المؤذن الإلكتروني والأذان',
    descAr: '30 مؤذنًا، الإقامة، التواشيح، دعاء بعد الأذان، وتنبيهات الصلاة',
    moreDescAr: '30 مؤذنًا وتواشيح النقشبندي وقيام الليل وتنبيه الإقامة ودعاء بعد الأذان',
    iconKey: 'bell_ring',
    inMoreMenu: true,
    estimatedMb: 65,
    estimatedMinutes: 2,
    getOfflineUrls: () => [
      ...ADHAN_VOICES_30.map((a) => a.url),
      ...IQAMAH_VOICES_3.map((i) => i.url),
      ...PRE_ADHAN_VOICES_3.map((p) => p.url),
      POST_ADHAN_DUA.audioUrl,
      ...TAWASIH_NAQSHABANDI.map((t) => t.url),
      ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
      ...FRIDAY_KAHF_VOICES_3.map((k) => k.url),
    ],
  },
  azkar: {
    id: 'azkar',
    labelAr: 'أذكار الصباح والمساء وجميع الأذكار',
    descAr: 'أذكار الصباح والمساء وأذكار ما بعد الصلاة بالصوت بدون نت',
    iconKey: 'heart_handshake',
    inMoreMenu: false,
    estimatedMb: 25,
    estimatedMinutes: 1,
    getOfflineUrls: () => [
      ...POST_PRAYER_AZKAR_AUDIO_URLS,
      ...AZKAR_CATEGORIES.flatMap((cat) =>
        cat.items
          .map((item) => item.audioUrl)
          .filter((u): u is string => Boolean(u)),
      ),
    ],
  },
  audio_library: {
    id: 'audio_library',
    labelAr: 'مكتبة 30 سورة مشهورة',
    descAr: 'تلاوة 30 سورة مشهورة بـ 30 قارئًا ومكتبة الـ 30 مؤذنًا',
    moreDescAr: 'تلاوة 30 سورة مشهورة بـ 30 قارئًا ومكتبة الـ 30 مؤذنًا',
    iconKey: 'radio',
    inMoreMenu: true,
    estimatedMb: 55,
    estimatedMinutes: 2,
    getOfflineUrls: (preferredReciter) => [
      ...FAMOUS_SURAHS_30.map((s) =>
        getSurahAudioUrl(preferredReciter, s.number),
      ),
      ...ADHAN_VOICES_30.map((a) => a.url),
    ],
  },
  salawat: {
    id: 'salawat',
    labelAr: 'صلِّ على النبي ﷺ',
    descAr: 'سبحة ذهبية تفاعلية وعداد ذكي وأصوات هادئة للصلاة على النبي ﷺ',
    iconKey: 'heart',
    inMoreMenu: true,
    estimatedMb: 8,
    estimatedMinutes: 1,
    getOfflineUrls: () => SALAWAT_AUDIO_TRACKS.map((s) => s.url),
  },
  books: {
    id: 'books',
    labelAr: 'صحيح البخاري والكتب الإسلامية',
    descAr: 'صحيح البخاري كاملًا ومنظمًا بالبحث مع الأربعين النووية ورياض الصالحين',
    iconKey: 'book_open_text',
    inMoreMenu: true,
    estimatedMb: 6,
    estimatedMinutes: 1,
  },
  seerah: {
    id: 'seerah',
    labelAr: 'السيرة النبوية الكاملة ﷺ',
    descAr: 'من الولادة حتى الوفاة صلى الله عليه وسلم كاملة قراءةً واستماعًا بدون نت',
    iconKey: 'scroll_text',
    inMoreMenu: true,
    estimatedMb: 5,
    estimatedMinutes: 1,
  },
  prayer_guide: {
    id: 'prayer_guide',
    labelAr: 'تعليم الوضوء والصلاة',
    descAr: 'تعليم الوضوء والصلاة بالحرف مع صور توضيحية وشرح محترم',
    iconKey: 'book_open',
    inMoreMenu: true,
    estimatedMb: 4,
    estimatedMinutes: 1,
  },
  fiqh: {
    id: 'fiqh',
    labelAr: 'الفقه كامل + مسابقة الفقه',
    descAr: 'جميع المسائل الفقهية سؤال وجواب مع مسابقة بدرجة',
    iconKey: 'help_circle',
    inMoreMenu: true,
    estimatedMb: 3,
    estimatedMinutes: 1,
  },
  dreams: {
    id: 'dreams',
    labelAr: 'تفسير الأحلام كامل بالبحث',
    descAr: 'تعبير الرؤى والأحلام مع البحث الفوري دون إنترنت',
    iconKey: 'moon_star',
    inMoreMenu: true,
    estimatedMb: 3,
    estimatedMinutes: 1,
  },
  stories: {
    id: 'stories',
    labelAr: 'القصص الإسلامية الكاملة',
    descAr: '25 قصة أنبياء و15 قصة قرآن و100 صحابة و30 وعبرة و20 غفران وتوبة',
    iconKey: 'book_open_text',
    inMoreMenu: true,
    estimatedMb: 8,
    estimatedMinutes: 1,
  },
  who_is_allah: {
    id: 'who_is_allah',
    labelAr: 'من هو الله بالأسماء والصفات',
    descAr: 'التعريف بالله وصفاته وأسمائه الحسنى الـ99',
    iconKey: 'sparkles',
    inMoreMenu: true,
    estimatedMb: 2,
    estimatedMinutes: 1,
  },
  scholars: {
    id: 'scholars',
    labelAr: 'محاضرات فيديو 30 شيخًا',
    descAr: '30 شيخًا من العالم × 10 فيديوهات لكل شيخ مع قائمة المفضلة',
    iconKey: 'mic',
    inMoreMenu: true,
    estimatedMb: 12,
    estimatedMinutes: 1,
  },
  duas: {
    id: 'duas',
    labelAr: 'قسم الأدعية الكامل',
    descAr: 'أدعية قرآنية ونبوية شاملة مع النسخ الفوري',
    iconKey: 'book_marked',
    inMoreMenu: true,
    estimatedMb: 2,
    estimatedMinutes: 1,
  },
  tasbih: {
    id: 'tasbih',
    labelAr: 'المسبحة الإلكترونية',
    descAr: 'عداد تسبيح ذكي مع حفظ الدورات والإجمالي',
    iconKey: 'circle_dot',
    inMoreMenu: true,
    estimatedMb: 1,
    estimatedMinutes: 1,
  },
  qibla: {
    id: 'qibla',
    labelAr: 'القبلة بالبوصلة',
    descAr: 'اتجاه الكعبة المشرفة بالبوصلة والمسافة بدقة بدون نت',
    iconKey: 'compass',
    inMoreMenu: false,
    estimatedMb: 1,
    estimatedMinutes: 1,
  },
  calendar: {
    id: 'calendar',
    labelAr: 'التقويم الهجري',
    descAr: 'التاريخ الهجري والميلادي والمناسبات ومحوّل التاريخ',
    iconKey: 'calendar_days',
    inMoreMenu: true,
    estimatedMb: 1,
    estimatedMinutes: 1,
  },
  tracker: {
    id: 'tracker',
    labelAr: 'سجل الصلوات',
    descAr: 'متابعة الصلوات الخمس اليومية وسلسلة الالتزام',
    iconKey: 'check_circle_2',
    inMoreMenu: true,
    estimatedMb: 1,
    estimatedMinutes: 1,
  },
  downloads: {
    id: 'downloads',
    labelAr: 'التحميلات والمكتبة الأوفلاين',
    descAr: 'تحميل المحاضرات، القرآن الصوتي، الأناشيد والخطب للاستماع بدون نت',
    moreDescAr: 'إدارة التحميلات الصوتية (audio-cache-v1) ومساحة التخزين بدون نت',
    iconKey: 'download',
    inMoreMenu: true,
    estimatedMb: 45,
    estimatedMinutes: 2,
  },
};

const APP_SECTION_ORDER: OfflineSectionId[] = [
  'quran',
  'hifz',
  'voice_test',
  'rafiqi',
  'adhan',
  'azkar',
  'audio_library',
  'downloads',
  'salawat',
  'books',
  'seerah',
  'prayer_guide',
  'fiqh',
  'dreams',
  'stories',
  'who_is_allah',
  'scholars',
  'duas',
  'tasbih',
  'qibla',
  'calendar',
  'tracker',
];

const MORE_MENU_ORDER: MoreMenuSectionId[] = [
  'downloads',
  'adhan',
  'books',
  'rafiqi',
  'salawat',
  'seerah',
  'voice_test',
  'prayer_guide',
  'fiqh',
  'dreams',
  'stories',
  'who_is_allah',
  'scholars',
  'audio_library',
  'duas',
  'tasbih',
  'calendar',
  'tracker',
];

const dynamicSections: AppSectionDefinition[] = [];

/**
 * Allows any future feature module to self-register at runtime if needed,
 * in addition to static compile-time discovery from APP_SECTIONS_MAP.
 */
export function registerDynamicAppSection(section: AppSectionDefinition): void {
  if (
    !APP_SECTIONS_MAP[section.id] &&
    !dynamicSections.some((s) => s.id === section.id)
  ) {
    dynamicSections.push(section);
  }
}

export function getAllAppSections(): AppSectionDefinition[] {
  const orderedIds = Array.from(
    new Set<OfflineSectionId>([
      ...APP_SECTION_ORDER,
      ...(Object.keys(APP_SECTIONS_MAP) as OfflineSectionId[]),
    ]),
  );
  return [
    ...orderedIds.map((id) => APP_SECTIONS_MAP[id]),
    ...dynamicSections,
  ];
}

export function getMoreMenuSections(): AppSectionDefinition[] {
  const orderedMore = MORE_MENU_ORDER.map((id) => APP_SECTIONS_MAP[id]).filter(
    Boolean,
  );
  const remainingMore = getAllAppSections().filter(
    (sec) =>
      sec.inMoreMenu && !MORE_MENU_ORDER.includes(sec.id as MoreMenuSectionId),
  );
  return [...orderedMore, ...remainingMore];
}

export function normalizeLegacySectionId(rawId: string): OfflineSectionId | null {
  if (rawId === 'voicetest') return 'voice_test';
  if (rawId in APP_SECTIONS_MAP) return rawId as OfflineSectionId;
  if (dynamicSections.some((s) => s.id === rawId)) {
    return rawId as OfflineSectionId;
  }
  return null;
}
