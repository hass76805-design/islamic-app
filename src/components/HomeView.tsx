import React, {useMemo, useState} from 'react';
import {
  AudioLines,
  Award,
  BellRing,
  BookOpen,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  Clock,
  Compass,
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
  ScrollText,
  Search,
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
  downloadAllOfflinePackage,
  isOfflinePackageDownloaded,
} from '../utils/offlineAudioCache';
import {
  computeDailyPrayerData,
  DEFAULT_PRAYER_OFFSETS,
  formatClock12,
  formatClock24,
  formatCountdown,
  formatTime12,
} from '../utils/prayerTimes';

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
}) => {
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [offlinePackDone, setOfflinePackDone] = useState(() =>
    isOfflinePackageDownloaded(),
  );
  const [offlineProgress, setOfflineProgress] = useState<{
    done: number;
    total: number;
    stageLabel: string;
  } | null>(null);
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('alzahabi_time_format');
      if (saved === '12' || saved === '24') return saved;
    }
    return '12';
  });

  const handleDownloadAllOffline = async () => {
    if (offlineProgress) return;
    setOfflineProgress({
      done: 0,
      total: 100,
      stageLabel: 'جاري تجهيز التحميل الكامل للجهاز...',
    });
    await downloadAllOfflinePackage(
      settings.preferredReciter,
      (done, total, stageLabel) => {
        setOfflineProgress({done, total, stageLabel});
      },
    );
    setOfflineProgress(null);
    setOfflinePackDone(true);
  };

  useHardwareBack(cityPickerOpen, () => setCityPickerOpen(false));

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
      descAr: '300 فيديو يوتيوب لـ 30 شيخًا من العالم مع التحميل أوفلاين',
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

  return (
    <div className="space-y-4">
      {/* Compact 400px Prayer & Clock Gold-Bordered Strip */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#000000]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="شعار البرنامج الإسلامي الذهبي"
              className="h-12 w-12 shrink-0 rounded-2xl border-2 border-[#C9A227] object-cover"
            />
            <div className="min-w-0">
              <h1 className="font-quran text-xl font-bold text-[#9A7415] dark:text-[#F3D56B]">
                البرنامج الإسلامي الذهبي
              </h1>
              <p className="text-[11px] font-bold text-[#9A7415] dark:text-[#C9A227]">
                {hijri.weekdayAr} · {hijri.day} {hijri.monthNameAr} {hijri.year} هـ ·{' '}
                {gregorianStr}
              </p>
            </div>
          </div>

          {/* Clock + Format Toggle + Next Prayer Ring */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#C9A227]/40 bg-[#080602] p-3 text-white">
            <div className="space-y-2">
              <div className="flex items-baseline gap-1.5">
                <span
                  dir="ltr"
                  className="font-mono-num text-2xl font-bold tracking-wider text-[#FCE38A]"
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
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#C9A227] bg-[#C9A227]/15 px-2.5 py-1 text-[11px] font-bold text-[#FCE38A]"
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{timeFormat === '12' ? '12 ساعة' : '24 ساعة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCityPickerOpen(true)}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#C9A227]/60 px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  <MapPin className="h-3 w-3 text-[#C9A227]" />
                  <span>{location.city}</span>
                </button>

                <button
                  type="button"
                  onClick={onRequestGps}
                  disabled={gpsLoading}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#C9A227]/60 px-2 py-1 text-[11px] font-bold text-[#F3D56B]"
                >
                  <Navigation className="h-3 w-3" />
                  <span>{gpsLoading ? '...' : 'GPS'}</span>
                </button>
              </div>
              {gpsError && <p className="text-[11px] text-rose-400">{gpsError}</p>}
            </div>

            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="rgba(201,162,39,0.22)"
                  strokeWidth="7"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="#C9A227"
                  strokeWidth="7"
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
                  className="font-mono-num text-xs font-bold text-white"
                >
                  {nextPrayer.remainingFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* 6 Prayers Clean 3x2 Mobile Grid */}
          <div className="grid grid-cols-3 gap-2">
            {schedule.map((item) => (
              <div
                key={item.key}
                className={`flex flex-col items-center rounded-2xl border px-2 py-2 text-center ${
                  item.isNext
                    ? 'border-2 border-[#C9A227] bg-[#C9A227]/15'
                    : 'border-[#C9A227]/35'
                }`}
              >
                {PRAYER_ICON[item.key]}
                <span className="mt-1 text-[11px] font-bold text-slate-900 dark:text-white">
                  {item.nameAr}
                </span>
                <span
                  dir="ltr"
                  className="font-mono-num text-xs font-bold text-[#9A7415] dark:text-[#F3D56B]"
                >
                  {timeFormat === '12'
                    ? formatTime12(item.time)
                    : item.formatted24}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Primary Hero Row (Single Column Mobile Stack) */}
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={onOpenQuranFatiha}
          className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-5 text-right dark:bg-[#000000]"
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-[#C9A227]">
                مصحف المدينة الذهبي · فهرس 114 سورة بدون نت
              </span>
              <h2 className="font-quran mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                القرآن الكريم
              </h2>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <BookOpen className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#C9A227]/25 pt-2.5 text-[11px] text-slate-600 dark:text-zinc-300">
            <span>تقليب بالسحب · استماع وتفسير ومعاني الكلمات</span>
            <span className="font-mono-num font-bold text-[#C9A227]">
              الختمة: {khatma.completedPages.length}/604
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenQuranTest}
          className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-5 text-right dark:bg-[#000000]"
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-[#C9A227]">
                ابدأ بصوت الشيخ · تصحيح كلمة بكلمة بالأخضر والأحمر
              </span>
              <h2 className="font-quran mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                اختبر حفظك
              </h2>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#C9A227] bg-[#C9A227] text-black">
              <Award className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#C9A227]/25 pt-2.5 text-[11px] text-slate-600 dark:text-zinc-300">
            <span>اضغط الكلمة الحمراء لسماع تصحيح الشيخ</span>
            <span className="font-bold text-[#C9A227]">درجة من 100</span>
          </div>
        </button>
      </div>

      {/* Azkar & Electronic Muezzin Stack */}
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('azkar')}
          className="flex items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 text-right dark:bg-[#000000]"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#C9A227]">
              أذكار الصباح والمساء · تعمل بدون نت
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              أذكار الصباح والمساء وجميع الأذكار
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              أنجزت اليوم {azkarDoneToday} من {azkarTotalMorningEvening} ذكر
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <HeartHandshake className="h-5 w-5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenMoreSubPage('adhan')}
          className="flex items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 text-right dark:bg-[#000000]"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#C9A227]">
              المؤذن الإلكتروني · شاشة كاملة وقت الأذان
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              الأذان وضبط مواقيت الصلاة
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              30 مؤذنًا، تواشيح النقشبندي، قيام الليل، الإقامة ودعاء بعد الأذان
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <BellRing className="h-5 w-5" />
          </span>
        </button>
      </div>

      {/* Offline Full Device Download Card */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-[#080602] p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#C9A227]">
              يعمل 100% بدون نت بعد تحميل مرة واحدة
            </span>
            <h3 className="mt-0.5 text-sm font-bold text-[#FCE38A]">
              تحميل محتوى التطبيق بالكامل للجهاز
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-300">
              {offlineProgress
                ? `${offlineProgress.stageLabel} (${offlineProgress.done}/${offlineProgress.total})`
                : offlinePackDone
                  ? 'تم حفظ المصحف والمؤذن والكتب ورفيقي أوفلاين على جهازك'
                  : 'المصحف، 30 مؤذنًا، التواشيح، الأذكار، القصص، رفيقي والكتب'}
            </p>
          </div>
          <button
            type="button"
            disabled={!!offlineProgress}
            onClick={handleDownloadAllOffline}
            className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-2xl bg-[#C9A227] px-3.5 py-2 text-xs font-extrabold text-black disabled:opacity-70"
          >
            {offlineProgress ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : offlinePackDone ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>
              {offlineProgress
                ? 'جاري...'
                : offlinePackDone
                  ? 'جاهز أوفلاين'
                  : 'تحميل الكل للجهاز'}
            </span>
          </button>
        </div>

        {offlineProgress && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-[#C9A227]/50 bg-black">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#FCE38A] to-[#C9A227] transition-all"
              style={{
                width: `${
                  offlineProgress.total > 0
                    ? Math.round((offlineProgress.done / offlineProgress.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        )}
      </div>

      {/* All Islamic Modules (1-Col Calm Mobile Cards) */}
      <div className="grid grid-cols-1 gap-3">
        {secondaryTiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={tile.onClick}
            className="flex items-start gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 text-right dark:bg-[#000000]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227]/60 bg-[#C9A227]/10">
              {tile.icon}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {tile.titleAr}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                {tile.descAr}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* City Picker Modal (400px Mobile Constrained) */}
      {cityPickerOpen && (
        <div className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[400px] -translate-x-1/2 items-center justify-center bg-black/90 p-3">
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
    </div>
  );
};
