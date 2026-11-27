export type TabId =
  | 'home'
  | 'quran'
  | 'prayer'
  | 'azkar'
  | 'qibla'
  | 'settings'
  | 'more';

export type MoreSubPageId =
  | 'menu'
  | 'adhan'
  | 'books'
  | 'rafiqi'
  | 'salawat'
  | 'seerah'
  | 'voice_test'
  | 'prayer_guide'
  | 'audio_library'
  | 'fiqh'
  | 'duas'
  | 'dreams'
  | 'stories'
  | 'who_is_allah'
  | 'scholars'
  | 'tasbih'
  | 'calendar'
  | 'tracker'
  | 'downloads'
  | 'settings'
  | 'permissions';

export type ReciterId =
  | 'minshawi'
  | 'abdulbasit'
  | 'alafasy'
  | 'sudais'
  | 'dosari'
  | 'muaiqly'
  | 'husary'
  | 'ghamdi'
  | 'ajamy'
  | 'shuraim'
  | 'banna'
  | 'hudhaify'
  | 'tablawi'
  | 'jibreel'
  | 'ayyub'
  | 'basfar'
  | 'juhany'
  | 'shatri'
  | 'qatami'
  | 'rifai'
  | 'akhdar'
  | 'matroud'
  | 'abbad'
  | 'bukhatir'
  | 'budair'
  | 'qasim'
  | 'thubayti'
  | 'alijaber'
  | 'qahtani'
  | 'suwaid';

export interface ReciterInfo {
  id: ReciterId;
  nameAr: string;
  shortNameAr: string;
  styleAr: string;
  everyayahFolder: string;
  mp3quranBase: string;
}

export interface AdhanVoice {
  id: string;
  nameAr: string;
  muezzinAr: string;
  locationAr: string;
  url: string;
  fallbackUrl?: string;
  descAr?: string;
}

export interface FamousSurahItem {
  number: number;
  nameAr: string;
  ayahsCount: number;
  revelationAr: 'مكية' | 'مدنية';
  highlight?: boolean;
}

export interface MemorizationTestResult {
  id: string;
  surahNumber: number;
  surahName: string;
  page: number;
  score: number;
  totalWords: number;
  mistakesCount: number;
  hintsUsed: number;
  date: string;
}

export type FiqhCategoryId = 'wudu' | 'prayer' | 'zakat' | 'fasting' | 'hajj' | 'manners';

export interface FiqhQAItem {
  id: string;
  category: FiqhCategoryId;
  questionAr: string;
  answerAr: string;
  evidenceAr: string;
}

export interface FiqhQuizQuestion {
  id: string;
  category: FiqhCategoryId;
  questionAr: string;
  options: string[];
  correctIndex: number;
  explanationAr: string;
}

export type DuaCategoryId =
  | 'quranic'
  | 'prophetic'
  | 'distress'
  | 'rizq'
  | 'family'
  | 'travel'
  | 'ruqyah';

export interface DuaItem {
  id: string;
  category: DuaCategoryId;
  titleAr: string;
  arabicText: string;
  sourceAr: string;
}

export interface DreamEntry {
  id: string;
  symbolAr: string;
  categoryAr: string;
  interpretationAr: string;
  detailAr: string;
}

export type StoryCategoryId = 'prophets' | 'quran' | 'sahaba' | 'lessons' | 'repentance';

export interface StoryEntry {
  id: string;
  category: StoryCategoryId;
  titleAr: string;
  eraOrPersonAr: string;
  summaryAr: string;
  storyTextAr: string;
  lessonAr: string;
}

export interface ScholarVideo {
  videoId: string;
  titleAr: string;
  duration: string;
  thumbnail: string;
}

export interface ScholarProfile {
  id: string;
  number: number;
  nameAr: string;
  fullNameAr: string;
  categoryAr: string;
  avatarUrl: string;
  videos: ScholarVideo[];
}

export type CalculationMethodId =
  | 'UmmAlQura'
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'NorthAmerica'
  | 'Dubai'
  | 'Kuwait'
  | 'Qatar'
  | 'France'
  | 'Custom';

export type AsrMadhab = 'Shafi' | 'Hanafi';

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  isGps: boolean;
}

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerOffsets {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface PrayerScheduleItem {
  key: PrayerKey;
  nameAr: string;
  time: Date;
  formatted24: string;
  isNext: boolean;
  isPassed: boolean;
}

export interface NextPrayerState {
  currentKey: PrayerKey | null;
  nextKey: PrayerKey;
  nextNameAr: string;
  nextTime: Date;
  remainingMs: number;
  remainingFormatted: string;
  progressPercent: number;
}

export interface CompactAyah {
  id: number;
  n: number;
  t: string;
  p: number;
  j: number;
  h: number;
  s: number;
}

export interface CompactSurah {
  n: number;
  name: string;
  en: string;
  type: 'Meccan' | 'Medinan';
  ayahs: CompactAyah[];
}

export interface QuranBookmark {
  id: string;
  page: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  snippet: string;
  createdAt: number;
}

export interface KhatmaPlan {
  targetDays: number;
  startDate: string;
  currentPage: number;
  completedPages: number[];
}

export interface DhikrItem {
  id: string;
  text: string;
  count: number;
  reference: string;
  reward?: string;
  audioUrl?: string;
}

export type AzkarCategoryId =
  | 'morning'
  | 'evening'
  | 'prayer'
  | 'sleep'
  | 'wakeup'
  | 'duas';

export interface AzkarCategory {
  id: AzkarCategoryId;
  titleAr: string;
  subtitleAr: string;
  items: DhikrItem[];
}

export interface AllahName {
  number: number;
  name: string;
  transliteration: string;
  meaningAr: string;
  descriptionAr: string;
}

export type TrackablePrayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PrayerTrackStatus = 'none' | 'ontime' | 'late' | 'missed';

export type DailyPrayerLog = Record<string, Record<TrackablePrayer, PrayerTrackStatus>>;

export type PerPrayerAdhanMap = Record<TrackablePrayer, string>;
export type PerPrayerEnabledMap = Record<TrackablePrayer, boolean>;
export type AdhanAlertMode = 'off' | 'silent' | 'audio' | 'visual';
export type PerPrayerAlertModeMap = Record<PrayerKey, AdhanAlertMode>;

export interface AppSettings {
  calculationMethod: CalculationMethodId;
  madhab: AsrMadhab;
  darkMode: boolean; // true = #000000 black night, false = #FFFFFF white day
  quranFontSize: number;
  tasbihSound: boolean;
  tasbihVibration: boolean;
  preferredReciter: ReciterId;
  preferredAdhan: string;
  preferredIqamah: string;
  perPrayerIqamah?: PerPrayerAdhanMap;
  iqamahEnabled: boolean;
  iqamahMinutes?: number;
  postAdhanDuaEnabled: boolean;
  preferredPostAdhanDua?: string;
  postAdhanDuaDelaySeconds?: number;
  qiyamEnabled: boolean;
  preferredPreAdhanSound: string;
  preferredTawasih: string;
  preferredEidTakbeer: string;
  preferredFridayKahf: string;
  perPrayerAdhan: PerPrayerAdhanMap;
  enabledPrayers: PerPrayerEnabledMap;
  perPrayerAlertMode?: PerPrayerAlertModeMap;
  adhanEnabled: boolean;
  preAdhanEnabled?: boolean;
  preAdhanMinutes: number; // 0, 5, 10..30
  dstEnabled?: boolean;
  timeFormat?: '12' | '24';
  customFajrAngle?: number;
  customIshaAngle?: number;
  prayerOffsets: PrayerOffsets;
  ramadanCannonEnabled: boolean;
  fajrTawasihEnabled: boolean;
  eidTakbeeratEnabled: boolean;
  fridayKahfReminder: boolean;
  postPrayerAzkarEnabled: boolean;
  backgroundAlertsEnabled: boolean;
  lockScreenKeepAlive?: boolean;
  prayerConfirmReminderEnabled?: boolean;
  salawatReminderEnabled?: boolean;
  salawatIntervalMinutes?: number;
  preferredSalawatTrack?: string;
}
