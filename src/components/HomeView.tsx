import React, {useEffect, useMemo, useState} from 'react';
import {
  AudioLines,
  Award,
  BellRing,
  BookOpen,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock,
  Compass,
  Copy,
  Download,
  Heart,
  HeartHandshake,
  HelpCircle,
  Loader2,
  MapPin,
  Mic,
  Moon,
  MoonStar,
  Navigation,
  Play,
  ScrollText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  X,
} from 'lucide-react';
import {PRESET_CITIES} from '../data/cities';
import {
  AppSettings,
  KhatmaPlan,
  MoreSubPageId,
  PrayerKey,
  StoryCategoryId,
  TabId,
  UserLocation,
} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {formatGregorianAr, getDateKey, getHijriParts} from '../utils/hijri';
import {
  computeDailyPrayerData,
  DEFAULT_PRAYER_OFFSETS,
  formatClock12,
  formatClock24,
  formatCountdown,
  formatTime12,
} from '../utils/prayerTimes';
import {
  BackgroundOfflineProgress,
  estimateOfflineSelection,
  getAllOfflineSectionIds,
  getAvailableOfflineSections,
  getCurrentOfflineProgress,
  getDownloadedOfflineSections,
  OfflineSectionId,
  resumeFullOfflineBackgroundDownload,
  startFullOfflineBackgroundDownload,
  subscribeDownloadedSections,
  subscribeOfflineDownloadState,
} from '../utils/offlineAudioCache';

interface HomeViewProps {
  now: Date;
  location: UserLocation;
  onSelectLocation: (loc: UserLocation) => void;
  onRequestGps: () => void;
  gpsLoading: boolean;
  gpsError: string | null;
  settings: AppSettings;
  khatma: KhatmaPlan;
  azkarDoneToday: number;
  azkarTotalMorningEvening: number;
  onNavigateTab: (tab: TabId) => void;
  onOpenQuranFatiha: () => void;
  onOpenQuranTest: () => void;
  onOpenMoreSubPage: (sub: MoreSubPageId, storyCat?: StoryCategoryId) => void;
  showPermBanner?: boolean;
  notifPermGranted?: boolean;
  onActivateAllPermissions?: () => Promise<void> | void;
  onDismissPermBanner?: () => void;
}

const PRAYER_ICON: Record<PrayerKey, React.ReactNode> = {
  fajr: <Sunrise className="h-4 w-4 text-[#C9A227]" />,
  sunrise: <Sun className="h-4 w-4 text-[#C9A227]" />,
  dhuhr: <Sun className="h-4 w-4 text-[#C9A227]" />,
  asr: <Sun className="h-4 w-4 text-[#C9A227]" />,
  maghrib: <Sunset className="h-4 w-4 text-[#C9A227]" />,
  isha: <Moon className="h-4 w-4 text-[#C9A227]" />,
};

export const HomeView: React.FC<HomeViewProps> = ({
  now,
  location,
  onSelectLocation,
  onRequestGps,
  gpsLoading,
  gpsError,
  settings,
  khatma,
  azkarDoneToday,
  azkarTotalMorningEvening,
  onNavigateTab,
  onOpenQuranFatiha,
  onOpenQuranTest,
  onOpenMoreSubPage,
  showPermBanner = false,
  notifPermGranted = false,
  onActivateAllPermissions,
  onDismissPermBanner,
}) => {
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [offlineChecklistOpen, setOfflineChecklistOpen] = useState(false);
  const [offlineSummaryOpen, setOfflineSummaryOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<OfflineSectionId[]>(
    () => getDownloadedOfflineSections(),
  );
  const [downloadedSections, setDownloadedSections] = useState<
    OfflineSectionId[]
  >(() => getDownloadedOfflineSections());
  const [selectionWarning, setSelectionWarning] = useState(false);
  const [offlineDownloadState, setOfflineDownloadState] =
    useState<BackgroundOfflineProgress>(() => getCurrentOfflineProgress());
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('alzahabi_time_format');
      if (saved === '12' || saved === '24') return saved;
    }
    return '12';
  });

  useHardwareBack(cityPickerOpen, () => setCityPickerOpen(false));
  useHardwareBack(shareModalOpen, () => setShareModalOpen(false));
  useHardwareBack(offlineChecklistOpen, () => setOfflineChecklistOpen(false));
  useHardwareBack(offlineSummaryOpen, () => setOfflineSummaryOpen(false));

  useEffect(() => {
    const unsubProgress = subscribeOfflineDownloadState((next) => {
      setOfflineDownloadState(next);
      const fromMeta = next.sections || [];
      if (fromMeta.length > 0) {
        setSelectedSections((prev) =>
          prev.length === 0 ? fromMeta : Array.from(new Set([...prev, ...fromMeta])),
        );
      }
    });
    const unsubSections = subscribeDownloadedSections(setDownloadedSections);
    return () => {
      unsubProgress();
      unsubSections();
    };
  }, []);

  const availableSections = useMemo(() => getAvailableOfflineSections(), []);
  const allSectionIds = useMemo(() => getAllOfflineSectionIds(), []);
  const allSectionsEstimate = useMemo(
    () => estimateOfflineSelection(allSectionIds),
    [allSectionIds],
  );
  const isAllSelected =
    allSectionIds.length > 0 &&
    allSectionIds.every((id) => selectedSections.includes(id));
  const selectionEstimate = useMemo(
    () => estimateOfflineSelection(selectedSections),
    [selectedSections],
  );

  const toggleSectionOption = (id: OfflineSectionId) => {
    setSelectionWarning(false);
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAllSections = () => {
    setSelectionWarning(false);
    setSelectedSections((prev) =>
      allSectionIds.every((id) => prev.includes(id)) ? [] : [...allSectionIds],
    );
  };

  const handleConfirmChecklist = () => {
    if (selectedSections.length === 0) {
      setSelectionWarning(true);
      return;
    }
    setSelectionWarning(false);
    setOfflineChecklistOpen(false);
    setOfflineSummaryOpen(true);
  };

  const handleConfirmStartFullDownload = () => {
    const chosen =
      selectedSections.length > 0 ? selectedSections : allSectionIds;
    setOfflineSummaryOpen(false);
    void startFullOfflineBackgroundDownload(settings.preferredReciter, chosen);
  };

  const toggleTimeFormat = () => {
    setTimeFormat((prev) => {
      const next = prev === '12' ? '24' : '12';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('alzahabi_time_format', next);
      }
      return next;
    });
  };

  const dateKey = getDateKey(now);
  const hijri = useMemo(
    () => getHijriParts(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey],
  );
  const gregorianStr = useMemo(
    () => formatGregorianAr(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey],
  );
  const clock24 = formatClock24(now);
  const clock12 = formatClock12(now);

  const dailyData = useMemo(
    () =>
      computeDailyPrayerData(
        location.latitude,
        location.longitude,
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
        settings.calculationMethod,
        settings.madhab,
        settings.prayerOffsets || DEFAULT_PRAYER_OFFSETS,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      location.latitude,
      location.longitude,
      dateKey,
      settings.calculationMethod,
      settings.madhab,
      settings.prayerOffsets,
    ],
  );

  const nowMs = now.getTime();
  const {schedule, nextPrayer} = useMemo(() => {
    const items = dailyData.schedule;
    const nextIdx = items.findIndex((item) => item.time.getTime() > nowMs);
    const computedSchedule = items.map((item, idx) => ({
      ...item,
      isNext: nextIdx >= 0 ? idx === nextIdx : idx === 0,
      isPassed: item.time.getTime() <= nowMs,
    }));

    const targetItem = nextIdx >= 0 ? items[nextIdx] : null;
    const prevIdx = nextIdx > 0 ? nextIdx - 1 : items.length - 1;
    const nextNameAr = targetItem ? targetItem.nameAr : 'الفجر';
    const nextTime = targetItem
      ? targetItem.time
      : new Date(items[0].time.getTime() + 24 * 60 * 60 * 1000);
    const prevTime = targetItem
      ? nextIdx > 0
        ? items[prevIdx].time
        : new Date(items[items.length - 1].time.getTime() - 24 * 60 * 60 * 1000)
      : items[items.length - 1].time;

    const span = Math.max(1, nextTime.getTime() - prevTime.getTime());
    const elapsed = Math.max(0, nowMs - prevTime.getTime());
    const progressPercent = Math.min(100, Math.max(0, (elapsed / span) * 100));
    const remainingMs = Math.max(0, nextTime.getTime() - nowMs);

    return {
      schedule: computedSchedule,
      nextPrayer: {
        ...dailyData.nextPrayer,
        nextNameAr,
        nextTime,
        remainingMs,
        remainingFormatted: formatCountdown(remainingMs),
        progressPercent,
      },
    };
  }, [dailyData, nowMs]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return PRESET_CITIES;
    return PRESET_CITIES.filter(
      (c) => c.city.includes(q) || c.country.includes(q),
    );
  }, [citySearch]);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset =
    circumference - (nextPrayer.progressPercent / 100) * circumference;

  const secondaryTiles: Array<{
    id: string;
    titleAr: string;
    descAr: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      id: 'books',
      titleAr: 'صحيح البخاري والكتب الإسلامية',
      descAr: 'صحيح البخاري كاملًا ومنظمًا بالبحث + الأربعون النووية ورياض الصالحين',
      icon: <BookOpenText className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('books'),
    },
    {
      id: 'rafiqi',
      titleAr: 'رفيقي (الحوار الصوتي الذكي)',
      descAr: 'صوت بشري يسمعك ويرد عليك + 30 كلمة بالآية المخصصة بصوت الشيخ',
      icon: <Mic className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('rafiqi'),
    },
    {
      id: 'salawat',
      titleAr: 'صلِّ على النبي ﷺ',
      descAr: 'عداد وسبحة ذهبية تفاعلية للصلاة على النبي ﷺ مع أصوات هادئة',
      icon: <Heart className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('salawat'),
    },
    {
      id: 'seerah',
      titleAr: 'السيرة النبوية الكاملة ﷺ',
      descAr: 'من الولادة لغاية الوفاة كاملة بدون نقص — قراءة نص واستماع صوتي',
      icon: <ScrollText className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('seerah'),
    },
    {
      id: 'voice_test',
      titleAr: 'اختبر صوتك في التلاوة',
      descAr: 'سجّل صوتك ليحدد السورة تلقائيًا ويصحح الآيات ويحفظ مقطعك الصوتي',
      icon: <AudioLines className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('voice_test'),
    },
    {
      id: 'prayer_guide',
      titleAr: 'تعليم الوضوء والصلاة بالتفصيل',
      descAr: 'خطوات الوضوء والصلاة بالحرف مع صور توضيحية وشرح محترم',
      icon: <BookOpen className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('prayer_guide'),
    },
    {
      id: 'fiqh',
      titleAr: 'الفقه كامل + مسابقة الفقه',
      descAr: 'المسائل الفقهية سؤال وجواب مع مسابقة بدرجة من 100',
      icon: <HelpCircle className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('fiqh'),
    },
    {
      id: 'qibla',
      titleAr: 'القبلة بالبوصلة',
      descAr: 'اتجاه الكعبة المشرفة بالبوصلة والمسافة بدقة بدون نت',
      icon: <Compass className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onNavigateTab('qibla'),
    },
    {
      id: 'tasbih',
      titleAr: 'المسبحة الإلكترونية',
      descAr: 'عداد تسبيح إلكتروني هادئ وحفظ الأذكار دون إنترنت',
      icon: <CircleDot className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('tasbih'),
    },
    {
      id: 'dreams',
      titleAr: 'تفسير الأحلام بالبحث',
      descAr: 'قاموس شامل لتعبير الرؤى والأحلام مع البحث الفوري',
      icon: <MoonStar className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('dreams'),
    },
    {
      id: 'prophets',
      titleAr: 'قصص الأنبياء كاملة (25 قصة)',
      descAr: 'سير الأنبياء الـ25 كاملة مع الدروس المستفادة',
      icon: <BookOpenText className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('stories', 'prophets'),
    },
    {
      id: 'quran_stories',
      titleAr: 'قصص القرآن الكريم (15 قصة)',
      descAr: 'أصحاب الكهف، ذو القرنين، قارون، أصحاب الفيل، الأخدود، وموسى والخضر',
      icon: <BookOpenText className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('stories', 'quran'),
    },
    {
      id: 'sahaba',
      titleAr: 'قصص الصحابة كاملة (100 قصة)',
      descAr: 'موسوعة 100 صحابي وصحابية كاملة بالتفصيل',
      icon: <BookOpenText className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('stories', 'sahaba'),
    },
    {
      id: 'lessons',
      titleAr: 'قصص وعبر ومواعظ (30 قصة)',
      descAr: '30 قصة إسلامية هادفة ومؤثرة في الصدق والأمانة',
      icon: <BookOpenText className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('stories', 'lessons'),
    },
    {
      id: 'repentance',
      titleAr: 'قصص الغفران والتوبة (20 قصة)',
      descAr: 'قصص مؤثرة في سعة رحمة الله وقبول التوبة',
      icon: <Sparkles className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('stories', 'repentance'),
    },
    {
      id: 'who_is_allah',
      titleAr: 'من هو الله بالأسماء والصفات',
      descAr: 'التعريف بالله وصفاته وأسمائه الحسنى الـ99',
      icon: <Sparkles className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('who_is_allah'),
    },
    {
      id: 'scholars',
      titleAr: 'محاضرات فيديو 30 شيخًا',
      descAr: '300 محاضرة لـ 30 شيخًا من العالم الإسلامي مع قائمة المفضلة',
      icon: <Mic className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('scholars'),
    },
    {
      id: 'duas',
      titleAr: 'قسم الأدعية الشامل',
      descAr: 'أدعية قرآنية ونبوية كاملة دون إنترنت',
      icon: <HeartHandshake className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('duas'),
    },
    {
      id: 'calendar',
      titleAr: 'التقويم الهجري',
      descAr: 'التاريخ الهجري والميلادي والمناسبات الإسلامية',
      icon: <CalendarDays className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('calendar'),
    },
    {
      id: 'tracker',
      titleAr: 'سجل الصلوات',
      descAr: 'متابعة أداء الصلوات الخمس اليومية',
      icon: <CheckCircle2 className="h-5 w-5 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('tracker'),
    },
  ];

  const quickChips = [
    {
      id: 'rafiqi',
      labelAr: 'رفيقي',
      icon: <Mic className="h-4 w-4 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('rafiqi'),
    },
    {
      id: 'salawat',
      labelAr: 'صلِّ على النبي ﷺ',
      icon: <Heart className="h-4 w-4 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('salawat'),
    },
    {
      id: 'voice_test',
      labelAr: 'اختبر صوتك',
      icon: <AudioLines className="h-4 w-4 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('voice_test'),
    },
    {
      id: 'books',
      labelAr: 'صحيح البخاري',
      icon: <BookOpenText className="h-4 w-4 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('books'),
    },
    {
      id: 'seerah',
      labelAr: 'السيرة النبوية',
      icon: <ScrollText className="h-4 w-4 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('seerah'),
    },
    {
      id: 'tasbih',
      labelAr: 'المسبحة',
      icon: <CircleDot className="h-4 w-4 text-[#C9A227]" />,
      onClick: () => onOpenMoreSubPage('tasbih'),
    },
  ];

  return (
    <div className="space-y-3">
      {/* One-Tap Background Adhan & Permissions Android Card */}
      {showPermBanner && onActivateAllPermissions && (
        <section className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-[#0B0802] p-3.5 text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227]/60 bg-[#C9A227]/15 text-[#FCE38A]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-[#FCE38A]">
                  تفعيل الأذان التلقائي والعمل في الخلفية
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-300">
                  {location.isGps ? `GPS: ${location.city}` : location.city} ·{' '}
                  {notifPermGranted ? 'الإشعارات مفعّلة ✓' : 'فعّل الإشعارات والهاتف مقفول'}
                </p>
              </div>
            </div>
            {onDismissPermBanner && (
              <button
                type="button"
                onClick={onDismissPermBanner}
                aria-label="إخفاء"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C9A227]/40 text-zinc-400 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void onActivateAllPermissions()}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-4 text-xs font-extrabold text-black active:scale-[0.98]"
          >
            <Check className="h-4 w-4" />
            <span>تفعيل الموقع والإشعارات والأذان بالخلفية</span>
          </button>
        </section>
      )}

      {/* Native Android Hero Card: Clock + Countdown Ring + 6 Prayers Grid */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 dark:bg-[#050505]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold text-[#9A7415] dark:text-[#FCE38A]">
                {hijri.weekdayAr} · {hijri.day} {hijri.monthNameAr} {hijri.year} هـ
              </p>
              <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                {gregorianStr} · {location.city}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              aria-label="مشاركة التطبيق"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-2xl border border-[#C9A227] bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-3 text-xs font-extrabold text-black active:scale-95"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>مشاركة</span>
            </button>
          </div>

          {/* Clock + Quick Controls + Next Prayer Countdown Ring */}
          <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#C9A227]/45 bg-[#080602] p-3 text-white">
            <div className="min-w-0 space-y-2">
              <div className="flex items-baseline gap-1.5">
                <span
                  dir="ltr"
                  className="font-mono-num text-[26px] font-extrabold leading-none tracking-wider text-[#FCE38A]"
                >
                  {timeFormat === '12' ? clock12.time : clock24}
                </span>
                {timeFormat === '12' && (
                  <span className="text-xs font-extrabold text-[#C9A227]">
                    {clock12.periodAr}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTimeFormat}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#C9A227]/80 bg-[#C9A227]/15 px-2.5 text-[11px] font-bold text-[#FCE38A] active:scale-95"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{timeFormat === '12' ? '12س' : '24س'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCityPickerOpen(true)}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#C9A227]/60 px-2.5 text-[11px] font-bold text-white active:scale-95"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#C9A227]" />
                  <span>{location.city}</span>
                </button>

                <button
                  type="button"
                  onClick={onRequestGps}
                  disabled={gpsLoading}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#C9A227]/60 px-2.5 text-[11px] font-bold text-[#F3D56B] active:scale-95"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>{gpsLoading ? '...' : 'GPS'}</span>
                </button>
              </div>
              {gpsError && <p className="text-[11px] text-rose-400">{gpsError}</p>}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('prayer')}
              aria-label={`الذهاب لشاشة الصلاة - ${nextPrayer.nextNameAr}`}
              className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full active:scale-95"
            >
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="rgba(201,162,39,0.22)"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="#C9A227"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-[#C9A227]">
                  {nextPrayer.nextNameAr}
                </span>
                <span
                  dir="ltr"
                  className="font-mono-num text-xs font-extrabold text-white"
                >
                  {nextPrayer.remainingFormatted}
                </span>
              </div>
            </button>
          </div>

          {/* 6 Prayers Tap Grid */}
          <div className="grid grid-cols-3 gap-2">
            {schedule.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigateTab('prayer')}
                className={`flex min-h-[68px] flex-col items-center justify-center rounded-2xl border px-1.5 py-2 text-center transition active:scale-95 ${
                  item.isNext
                    ? 'border-2 border-[#C9A227] bg-[#C9A227]/15'
                    : 'border-[#C9A227]/35 bg-transparent'
                }`}
              >
                {PRAYER_ICON[item.key]}
                <span className="mt-1 text-[11px] font-bold text-slate-900 dark:text-white">
                  {item.nameAr}
                </span>
                <span
                  dir="ltr"
                  className="font-mono-num text-xs font-extrabold text-[#9A7415] dark:text-[#F3D56B]"
                >
                  {timeFormat === '12'
                    ? formatTime12(item.time)
                    : item.formatted24}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Single Unified Offline Content Download CTA Button */}
      <button
        type="button"
        onClick={() => {
          if (offlineDownloadState.status === 'paused') {
            void resumeFullOfflineBackgroundDownload(settings.preferredReciter);
          } else if (offlineDownloadState.status !== 'downloading') {
            setSelectionWarning(false);
            setOfflineChecklistOpen(true);
          }
        }}
        disabled={offlineDownloadState.status === 'downloading'}
        className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-3xl border-2 px-4 py-3 text-right transition active:scale-[0.98] ${
          offlineDownloadState.status === 'completed'
            ? 'border-emerald-500/70 bg-emerald-950/25 text-emerald-200'
            : offlineDownloadState.status === 'paused'
              ? 'border-[#C9A227] bg-[#141004] text-[#FCE38A]'
              : 'border-[#FCE38A] bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black shadow-[0_6px_22px_rgba(201,162,39,0.28)]'
        }`}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-extrabold leading-snug">
            {offlineDownloadState.status === 'downloading'
              ? `جاري تحميل محتوى التطبيق... ${offlineDownloadState.percent}%`
              : offlineDownloadState.status === 'paused'
                ? `التحميل متوقف — باقي ${offlineDownloadState.remainingMb} ميجا`
                : offlineDownloadState.status === 'completed'
                  ? 'تحميل محتوى التطبيق · جاهز بدون نت ✓'
                  : 'تحميل محتوى التطبيق'}
          </p>
          <p
            className={`truncate text-[11px] font-semibold ${
              offlineDownloadState.status === 'completed'
                ? 'text-emerald-300'
                : offlineDownloadState.status === 'paused'
                  ? 'text-zinc-300'
                  : 'text-black/80'
            }`}
          >
            {offlineDownloadState.status === 'downloading'
              ? `${offlineDownloadState.downloadedMb} من ${offlineDownloadState.totalMb} ميجا — باقي ${offlineDownloadState.remainingMb} ميجا`
              : offlineDownloadState.status === 'paused'
                ? offlineDownloadState.pauseReason === 'offline'
                  ? `${offlineDownloadState.downloadedMb}/${offlineDownloadState.totalMb} ميجا — سيكمل تلقائيًا`
                  : `${offlineDownloadState.downloadedMb}/${offlineDownloadState.totalMb} ميجا — اضغط للاستئناف`
                : offlineDownloadState.status === 'completed'
                  ? `تم الحفظ دائمًا في IndexedDB (${offlineDownloadState.totalMb} ميجا) — اضغط لإضافة أقسام`
                  : 'اختر الأقسام لحفظها دائمًا وتشغيلها أوفلاين بالكامل'}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            offlineDownloadState.status === 'completed'
              ? 'bg-emerald-500/20 text-emerald-300'
              : offlineDownloadState.status === 'paused'
                ? 'bg-[#C9A227] text-black'
                : 'bg-black/15 text-black'
          }`}
        >
          {offlineDownloadState.status === 'downloading' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : offlineDownloadState.status === 'paused' ? (
            <Play className="h-5 w-5 fill-current" />
          ) : offlineDownloadState.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </span>
      </button>

      {/* Primary 2x2 Large Android Touch Action Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onOpenQuranFatiha}
          className="flex min-h-[120px] flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 text-right transition active:scale-[0.97] dark:bg-[#050505]"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="font-mono-num text-[11px] font-bold text-[#C9A227]">
              {khatma.completedPages.length}/604
            </span>
          </div>
          <div>
            <h2 className="font-quran text-xl font-bold text-slate-900 dark:text-white">
              القرآن الكريم
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-zinc-400">
              مصحف المدينة والتفسير
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenQuranTest}
          className="flex min-h-[120px] flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 text-right transition active:scale-[0.97] dark:bg-[#050505]"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C9A227] text-black">
              <Award className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-extrabold text-[#C9A227]">
              تصحيح صوتي
            </span>
          </div>
          <div>
            <h2 className="font-quran text-xl font-bold text-slate-900 dark:text-white">
              اختبر حفظك
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-zinc-400">
              آية بآية وتصحيح الشيخ
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('azkar')}
          className="flex min-h-[112px] flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 text-right transition active:scale-[0.97] dark:bg-[#050505]"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <span className="font-mono-num text-[11px] font-bold text-[#C9A227]">
              {azkarDoneToday}/{azkarTotalMorningEvening}
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              الأذكار اليومية
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-zinc-400">
              الصباح والمساء والنوم
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('prayer')}
          className="flex min-h-[112px] flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 text-right transition active:scale-[0.97] dark:bg-[#050505]"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <BellRing className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-bold text-[#C9A227]">
              30 مؤذنًا
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              الأذان والمؤذن
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-zinc-400">
              الإقامة والتواشيح والدعاء
            </p>
          </div>
        </button>
      </div>

      {/* Horizontal Android Swipe Strip for Top Tools */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
        {quickChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-[#C9A227]/70 bg-white px-3.5 text-xs font-extrabold text-slate-900 transition active:scale-95 dark:bg-[#080703] dark:text-[#FCE38A]"
          >
            {chip.icon}
            <span>{chip.labelAr}</span>
          </button>
        ))}
      </div>

      {/* Native Android Grouped List Rows for All Islamic Modules */}
      <section className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-white dark:bg-[#050505]">
        <div className="flex items-center justify-between border-b border-[#C9A227]/25 px-4 py-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#FCE38A]">
            المكتبة والأقسام الإسلامية
          </h3>
          <button
            type="button"
            onClick={() => onOpenMoreSubPage('menu')}
            className="min-h-[34px] text-xs font-bold text-[#C9A227] active:opacity-75"
          >
            عرض الكل
          </button>
        </div>

        <div className="divide-y divide-[#C9A227]/20">
          {secondaryTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              className="flex min-h-[64px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-right transition-colors active:bg-[#C9A227]/12"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227]/60 bg-[#C9A227]/12">
                  {tile.icon}
                </span>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {tile.titleAr}
                  </h4>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                    {tile.descAr}
                  </p>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-[#C9A227]" />
            </button>
          ))}
        </div>
      </section>

      {/* City Picker Modal */}
      {cityPickerOpen && (
        <div className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/90 p-0 sm:items-center sm:p-3">
          <div className="flex max-h-[85vh] w-full flex-col rounded-3xl border-2 border-[#C9A227] bg-[#050505] text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/30 px-4 py-3.5">
              <h3 className="text-sm font-bold text-[#F3D56B]">
                اختيار المدينة لحساب المواقيت
              </h3>
              <button
                type="button"
                onClick={() => setCityPickerOpen(false)}
                aria-label="إغلاق"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#F3D56B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5">
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="ابحث عن مدينة أو دولة..."
                  className="w-full rounded-xl border border-[#C9A227]/60 bg-[#0B0B0B] py-2.5 pr-10 pl-4 text-sm text-white outline-none focus:border-[#C9A227]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  onRequestGps();
                  setCityPickerOpen(false);
                }}
                className="mt-2.5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#C9A227] py-2 text-xs font-bold text-black"
              >
                <Navigation className="h-4 w-4" />
                <span>تحديد موقعي الحالي (GPS)</span>
              </button>
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto px-3.5 pb-4">
              {filteredCities.map((c) => (
                <button
                  key={`${c.city}-${c.country}`}
                  type="button"
                  onClick={() => {
                    onSelectLocation(c);
                    setCityPickerOpen(false);
                  }}
                  className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[#C9A227]/25 px-3 py-2 text-right hover:border-[#C9A227] hover:bg-[#C9A227]/12"
                >
                  <div>
                    <p className="text-sm font-bold text-white">{c.city}</p>
                    <p className="text-xs text-zinc-400">{c.country}</p>
                  </div>
                  <span className="font-mono-num text-xs text-[#C9A227]">
                    {c.latitude.toFixed(2)}°, {c.longitude.toFixed(2)}°
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="مشاركة التطبيق"
          className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/80 p-3 sm:items-center"
        >
          <div className="w-full space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-[#FCE38A]" />
                <h3 className="text-base font-bold text-[#FCE38A]">
                  مشاركة البرنامج الإسلامي الذهبي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#FCE38A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-zinc-300">
              شارك التطبيق مع أهلك وأصدقائك عبر واتساب أو فيسبوك واكسب أجر الدالّ على الخير:
            </p>

            {(() => {
              const appUrl =
                typeof window !== 'undefined' &&
                window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1'
                  ? window.location.origin
                  : 'https://ais-pre-6b23y7rzn4nr6hdpkn6nkk-744432451530.europe-west1.run.app';
              const shareText = `البرنامج الإسلامي الذهبي — القرآن كامل بدون نت، المؤذن الإلكتروني، الأذكار، السيرة النبوية، صحيح البخاري، وصلِّ على النبي ﷺ\n${appUrl}`;
              const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
              const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appUrl)}&quote=${encodeURIComponent(shareText)}`;

              return (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/60 bg-emerald-600/20 px-3 text-xs font-extrabold text-emerald-300"
                    >
                      <Share2 className="h-4 w-4" />
                      <span>مشاركة واتساب</span>
                    </a>

                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-blue-500/60 bg-blue-600/20 px-3 text-xs font-extrabold text-blue-300"
                    >
                      <Share2 className="h-4 w-4" />
                      <span>مشاركة فيسبوك</span>
                    </a>
                  </div>

                  {typeof navigator !== 'undefined' &&
                    typeof navigator.share === 'function' && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator
                            .share({
                              title: 'البرنامج الإسلامي الذهبي',
                              text: 'البرنامج الإسلامي الذهبي — القرآن بدون نت، المؤذن الإلكتروني، الأذكار وصلِّ على النبي ﷺ',
                              url: appUrl,
                            })
                            .catch(() => {});
                        }}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-xs font-extrabold text-black"
                      >
                        <Share2 className="h-4 w-4" />
                        <span>مشاركة عبر تطبيقات الهاتف</span>
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(appUrl);
                        setShareCopied(true);
                        window.setTimeout(() => setShareCopied(false), 2000);
                      } catch {
                        // ignore clipboard failure
                      }
                    }}
                    className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl border border-[#C9A227]/60 bg-black text-xs font-bold text-[#FCE38A]"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-300">
                          تم نسخ رابط التطبيق بنجاح
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>نسخ رابط التطبيق</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Step 1: Dynamic All-Sections Checklist Modal */}
      {offlineChecklistOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="اختيار أقسام التحميل بدون نت"
          className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/85 p-0 sm:items-center sm:p-3"
        >
          <div className="flex max-h-[85vh] w-full flex-col space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-5 text-white shadow-[0_0_40px_rgba(201,162,39,0.3)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#C9A227]/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-[#FCE38A]" />
                <div>
                  <h3 className="text-base font-extrabold text-[#FCE38A]">
                    تحميل محتوى التطبيق
                  </h3>
                  <p className="text-[10px] font-semibold text-[#C9A227]">
                    اختر الأقسام التي تريد حفظها للعمل أوفلاين ({availableSections.length} قسمًا)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOfflineChecklistOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#FCE38A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleAllSections}
              className={`flex min-h-[48px] w-full shrink-0 items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-2 text-right transition ${
                isAllSelected
                  ? 'border-[#FCE38A] bg-[#C9A227]/20 text-[#FCE38A]'
                  : 'border-[#C9A227]/55 bg-[#0A0904] text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    isAllSelected
                      ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/70 bg-black text-transparent'
                  }`}
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
                <span className="text-sm font-extrabold">
                  كل الأقسام ({availableSections.length})
                </span>
              </div>
              <span className="font-mono-num text-[11px] font-bold text-[#FCE38A]">
                {allSectionsEstimate.totalMb} ميجا
              </span>
            </button>

            <div className="flex-1 space-y-2 overflow-y-auto pl-1">
              {availableSections.map((opt) => {
                const checked = selectedSections.includes(opt.id);
                const alreadyDownloaded = downloadedSections.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`flex min-h-[54px] w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-right transition ${
                      alreadyDownloaded
                        ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-100'
                        : checked
                          ? 'border-[#FCE38A] bg-[#141004] text-[#FCE38A]'
                          : 'border-[#C9A227]/35 bg-black text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSectionOption(opt.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          checked
                            ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                            : 'border-[#C9A227]/60 bg-black text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-extrabold">
                            {opt.labelAr}
                          </p>
                          {alreadyDownloaded && (
                            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
                              تم التحميل ✓
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-zinc-400">
                          {opt.descAr}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-col items-end">
                      <span className="font-mono-num text-[11px] font-bold text-[#C9A227]">
                        {opt.estimatedMb} ميجا
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectionWarning && (
              <p className="shrink-0 text-center text-xs font-bold text-rose-400">
                اختر قسمًا واحدًا على الأقل للمتابعة
              </p>
            )}

            <div className="grid shrink-0 grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleConfirmChecklist}
                className="min-h-[46px] rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-sm font-extrabold text-black"
              >
                تم ({selectedSections.length})
              </button>
              <button
                type="button"
                onClick={() => setOfflineChecklistOpen(false)}
                className="min-h-[46px] rounded-2xl border border-[#C9A227]/60 bg-black text-sm font-bold text-[#FCE38A]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Size & Estimated Time Summary Dialog */}
      {offlineSummaryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل حجم ووقت التحميل"
          className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/85 p-0 sm:items-center sm:p-3"
        >
          <div className="w-full space-y-3.5 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-5 text-white shadow-[0_0_40px_rgba(201,162,39,0.3)]">
            <div className="flex items-center justify-between border-b border-[#C9A227]/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-[#FCE38A]" />
                <h3 className="text-base font-extrabold text-[#FCE38A]">
                  ملخص التحميل بدون نت
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOfflineSummaryOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#FCE38A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-[#C9A227]/45 bg-[#120E04] p-4 text-sm text-[#FCE38A]">
              <div className="flex items-center justify-between border-b border-[#C9A227]/25 pb-2">
                <span className="text-xs text-zinc-300">المساحة المطلوبة:</span>
                <span className="font-mono-num text-base font-extrabold text-[#FCE38A]">
                  {selectionEstimate.totalMb} ميجا تقريبًا
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[#C9A227]/25 pb-2">
                <span className="text-xs text-zinc-300">الوقت المتوقع:</span>
                <span className="font-mono-num text-sm font-extrabold text-[#FCE38A]">
                  حوالي {selectionEstimate.estimatedMinutes} دقيقة
                </span>
              </div>
              <div className="pt-0.5 text-xs text-zinc-300">
                <p className="font-bold text-[#FCE38A]">الأقسام المختارة:</p>
                <p className="mt-1 leading-relaxed text-zinc-200">
                  {selectionEstimate.selectedOptions
                    .map((o) => o.labelAr)
                    .join(' · ')}
                </p>
                <p className="mt-2 text-[11px] text-emerald-300">
                  سيتم حفظ كل الملفات محليًا (IndexedDB و Cache Storage) لتعمل بدون إنترنت تمامًا، مع أزرار إيقاف مؤقت واستئناف وإلغاء.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleConfirmStartFullDownload}
                className="min-h-[46px] rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-sm font-extrabold text-black"
              >
                بدء التحميل
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfflineSummaryOpen(false);
                  setOfflineChecklistOpen(true);
                }}
                className="min-h-[46px] rounded-2xl border border-[#C9A227]/60 bg-black text-sm font-bold text-[#FCE38A]"
              >
                تعديل الاختيارات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
