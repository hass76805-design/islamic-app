import React, {useEffect, useState} from 'react';
import {
  ArrowRight,
  AudioLines,
  BellRing,
  BookMarked,
  BookOpen,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  Cloud,
  Download,
  Heart,
  HelpCircle,
  Loader2,
  LogIn,
  LogOut,
  Mic,
  Moon,
  MoonStar,
  Radio,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import {useFirebase} from '../contexts/FirebaseContext';
import {
  ADHAN_VOICES_30,
  FAMOUS_SURAHS_30,
  getSurahAudioUrl,
  RECITERS_30,
} from '../data/reciters';
import {
  AppSettings,
  DailyPrayerLog,
  MoreSubPageId,
  PrayerTrackStatus,
  ReciterId,
  StoryCategoryId,
  TrackablePrayer,
  UserLocation,
} from '../types';
import {
  cacheBatchUrls,
  countCachedAudioItems,
  downloadAllOfflinePackage,
  isOfflinePackageDownloaded,
} from '../utils/offlineAudioCache';
import {CALCULATION_METHODS} from '../utils/prayerTimes';
import {AdhanMuezzinView} from './AdhanMuezzinView';
import {AudioLibraryView} from './AudioLibraryView';
import {BooksView} from './BooksView';
import {DreamsView} from './DreamsView';
import {DuasView} from './DuasView';
import {FiqhView} from './FiqhView';
import {HijriCalendarView} from './HijriCalendarView';
import {PrayerEducationView} from './PrayerEducationView';
import {PrayerTrackerView} from './PrayerTrackerView';
import {PWAInstallButton} from './PWAInstallButton';
import {RafiqiView} from './RafiqiView';
import {SalawatView} from './SalawatView';
import {ScholarsView} from './ScholarsView';
import {SeerahView} from './SeerahView';
import {StoriesView} from './StoriesView';
import {TasbihView} from './TasbihView';
import {VoiceTestView} from './VoiceTestView';
import {WhoIsAllahView} from './WhoIsAllahView';

interface MoreViewProps {
  subPage: MoreSubPageId;
  onSelectSubPage: (sub: MoreSubPageId) => void;
  storyCategory?: StoryCategoryId;
  now: Date;
  location: UserLocation;
  onSelectLocation: (loc: UserLocation) => void;
  onRequestGps: () => void;
  gpsLoading: boolean;
  settings: AppSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  prayerLog: DailyPrayerLog;
  onSetPrayerStatus: (
    dateKey: string,
    prayer: TrackablePrayer,
    status: PrayerTrackStatus,
  ) => void;
}

const SUB_ITEMS: Array<{
  id: Exclude<MoreSubPageId, 'menu'>;
  titleAr: string;
  descAr: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'adhan',
    titleAr: 'المؤذن الإلكتروني والأذان',
    descAr: '30 مؤذنًا وتواشيح النقشبندي وقيام الليل وتنبيه الإقامة ودعاء بعد الأذان',
    icon: <BellRing className="h-5 w-5" />,
  },
  {
    id: 'books',
    titleAr: 'صحيح البخاري والكتب الإسلامية',
    descAr: 'صحيح البخاري كاملًا ومنظمًا بالبحث مع الأربعين النووية ورياض الصالحين',
    icon: <BookOpenText className="h-5 w-5" />,
  },
  {
    id: 'rafiqi',
    titleAr: 'رفيقي (الحوار الصوتي الذكي)',
    descAr: 'صوت بشري يسمعك ويرد عليك + 30 كلمة بالآية المخصصة بصوت الشيخ',
    icon: <Mic className="h-5 w-5" />,
  },
  {
    id: 'salawat',
    titleAr: 'صلِّ على النبي ﷺ',
    descAr: 'سبحة ذهبية تفاعلية وعداد ذكي وأصوات هادئة للصلاة على النبي ﷺ',
    icon: <Heart className="h-5 w-5" />,
  },
  {
    id: 'seerah',
    titleAr: 'السيرة النبوية الكاملة ﷺ',
    descAr: 'من الولادة حتى الوفاة صلى الله عليه وسلم كاملة قراءةً واستماعًا بدون نت',
    icon: <ScrollText className="h-5 w-5" />,
  },
  {
    id: 'voice_test',
    titleAr: 'اختبر صوتك في التلاوة',
    descAr: 'سجّل تلاوتك ليحدد السورة تلقائيًا ويصححها ويحفظ المقطع بصوتك',
    icon: <AudioLines className="h-5 w-5" />,
  },
  {
    id: 'prayer_guide',
    titleAr: 'تعليم الوضوء والصلاة',
    descAr: 'تعليم الوضوء والصلاة بالحرف مع صور توضيحية وشرح محترم',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    id: 'fiqh',
    titleAr: 'الفقه كامل + مسابقة الفقه',
    descAr: 'جميع المسائل الفقهية سؤال وجواب مع مسابقة بدرجة',
    icon: <HelpCircle className="h-5 w-5" />,
  },
  {
    id: 'dreams',
    titleAr: 'تفسير الأحلام كامل بالبحث',
    descAr: 'تعبير الرؤى والأحلام مع البحث الفوري دون إنترنت',
    icon: <MoonStar className="h-5 w-5" />,
  },
  {
    id: 'stories',
    titleAr: 'القصص الإسلامية الكاملة',
    descAr: '25 قصة أنبياء و100 صحابة و30 وعبرة و20 غفران وتوبة',
    icon: <BookOpenText className="h-5 w-5" />,
  },
  {
    id: 'who_is_allah',
    titleAr: 'من هو الله بالأسماء والصفات',
    descAr: 'التعريف بالله وصفاته وأسمائه الحسنى الـ99',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: 'scholars',
    titleAr: 'محاضرات فيديو 30 شيخًا',
    descAr: '30 شيخًا من العالم × 10 فيديوهات يوتيوب لكل شيخ مع زر حفظ أوفلاين',
    icon: <Mic className="h-5 w-5" />,
  },
  {
    id: 'audio_library',
    titleAr: 'مكتبة 30 سورة مشهورة',
    descAr: 'تشغيل وتحميل 30 سورة مشهورة بـ 30 قارئًا دون إنترنت',
    icon: <Radio className="h-5 w-5" />,
  },
  {
    id: 'duas',
    titleAr: 'قسم الأدعية الكامل',
    descAr: 'أدعية قرآنية ونبوية شاملة مع النسخ الفوري',
    icon: <BookMarked className="h-5 w-5" />,
  },
  {
    id: 'tasbih',
    titleAr: 'المسبحة الإلكترونية',
    descAr: 'عداد تسبيح ذكي مع حفظ الدورات والإجمالي',
    icon: <CircleDot className="h-5 w-5" />,
  },
  {
    id: 'calendar',
    titleAr: 'التقويم الهجري',
    descAr: 'التاريخ الهجري والميلادي والمناسبات ومحوّل التاريخ',
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    id: 'tracker',
    titleAr: 'سجل الصلوات',
    descAr: 'متابعة الصلوات الخمس اليومية وسلسلة الالتزام',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  {
    id: 'settings',
    titleAr: 'الحساب السحابي والإعدادات',
    descAr: 'المزامنة السحابية، القراء الثلاثون، تحميل الكل للجهاز، وطريقة الحساب',
    icon: <Settings className="h-5 w-5" />,
  },
];

export const MoreView: React.FC<MoreViewProps> = ({
  subPage,
  onSelectSubPage,
  storyCategory,
  now,
  location,
  onSelectLocation,
  onRequestGps,
  gpsLoading,
  settings,
  onUpdateSettings,
  prayerLog,
  onSetPrayerStatus,
}) => {
  const {user, signingIn, authError, signInWithGoogle, signOutUser} =
    useFirebase();
  const [cachedCount, setCachedCount] = useState(0);
  const [batchStatus, setBatchStatus] = useState<{
    label: string;
    done: number;
    total: number;
  } | null>(null);
  const [allPackReady, setAllPackReady] = useState(() =>
    isOfflinePackageDownloaded(),
  );

  useEffect(() => {
    if (subPage === 'settings') {
      countCachedAudioItems().then(setCachedCount);
      setAllPackReady(isOfflinePackageDownloaded());
    }
  }, [subPage]);

  const handleDownloadFamous30 = async () => {
    const urls = FAMOUS_SURAHS_30.map((s) =>
      getSurahAudioUrl(settings.preferredReciter, s.number),
    );
    setBatchStatus({
      label: 'جاري تحميل السور المشهورة...',
      done: 0,
      total: urls.length,
    });
    await cacheBatchUrls(urls, (done, total) => {
      setBatchStatus({label: 'جاري تحميل السور المشهورة...', done, total});
    });
    setBatchStatus(null);
    countCachedAudioItems().then(setCachedCount);
  };

  const handleDownloadAllDevice = async () => {
    setBatchStatus({
      label: 'جاري تحميل الحزمة الشاملة للجهاز...',
      done: 0,
      total: 100,
    });
    await downloadAllOfflinePackage(
      settings.preferredReciter,
      (done, total, stageLabel) => {
        setBatchStatus({label: stageLabel, done, total});
      },
    );
    setBatchStatus(null);
    setAllPackReady(true);
    countCachedAudioItems().then(setCachedCount);
  };

  if (subPage !== 'menu') {
    const activeItem = SUB_ITEMS.find((i) => i.id === subPage);
    const forceBlackGold =
      subPage === 'adhan' ||
      subPage === 'prayer_guide' ||
      subPage === 'books' ||
      subPage === 'rafiqi' ||
      subPage === 'salawat' ||
      subPage === 'seerah' ||
      subPage === 'voice_test';
    return (
      <div className="space-y-4">
        <div
          className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A227] px-3.5 py-2.5 ${
            forceBlackGold
              ? 'bg-[#050505] text-white'
              : 'bg-white dark:bg-[#050505]'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectSubPage('menu')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C9A227] px-3 py-1.5 text-xs font-bold ${
              forceBlackGold
                ? 'bg-black text-[#F3D56B]'
                : 'text-[#9A7415] dark:text-[#F3D56B]'
            }`}
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة</span>
          </button>
          <h2
            className={`truncate text-sm font-bold ${
              forceBlackGold
                ? 'text-[#F3D56B]'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {activeItem?.titleAr}
          </h2>
        </div>

        {subPage === 'adhan' && (
          <AdhanMuezzinView
            now={now}
            location={location}
            onSelectLocation={onSelectLocation}
            onRequestGps={onRequestGps}
            gpsLoading={gpsLoading}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />
        )}
        {subPage === 'books' && <BooksView />}
        {subPage === 'rafiqi' && (
          <RafiqiView preferredReciter={settings.preferredReciter} />
        )}
        {subPage === 'salawat' && <SalawatView />}
        {subPage === 'seerah' && <SeerahView />}
        {subPage === 'voice_test' && (
          <VoiceTestView preferredReciter={settings.preferredReciter} />
        )}
        {subPage === 'prayer_guide' && <PrayerEducationView />}
        {subPage === 'fiqh' && <FiqhView />}
        {subPage === 'dreams' && <DreamsView />}
        {subPage === 'stories' && <StoriesView initialCategory={storyCategory} />}
        {subPage === 'who_is_allah' && <WhoIsAllahView />}
        {subPage === 'scholars' && <ScholarsView />}
        {subPage === 'audio_library' && (
          <AudioLibraryView
            preferredReciter={settings.preferredReciter}
            onChangePreferredReciter={(id) =>
              onUpdateSettings((s) => ({...s, preferredReciter: id}))
            }
            preferredAdhan={settings.preferredAdhan}
            onChangePreferredAdhan={(id) =>
              onUpdateSettings((s) => ({...s, preferredAdhan: id}))
            }
          />
        )}
        {subPage === 'duas' && <DuasView />}
        {subPage === 'tasbih' && <TasbihView />}
        {subPage === 'calendar' && <HijriCalendarView />}
        {subPage === 'tracker' && (
          <PrayerTrackerView log={prayerLog} onSetStatus={onSetPrayerStatus} />
        )}
        {subPage === 'settings' && (
          <div className="space-y-4">
            {/* Google Sign-In & Firebase Cloud Sync Card */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
                  <Cloud className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    المزامنة السحابية الآمنة (Firebase)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    احفظ آخر موضع قراءة وعلاماتك ونتائج اختبارات الحفظ عبر حسابك
                  </p>
                </div>
              </div>

              {user ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3.5 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#F3D56B]">
                        {user.displayName || 'مستخدم مسجّل'}
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        {user.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void signOutUser()}
                      className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-[#C9A227]/70 px-3 py-1.5 text-xs font-bold text-[#F3D56B]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>خروج</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={() => void signInWithGoogle()}
                  className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-4 py-2.5 text-xs font-extrabold text-black disabled:opacity-60"
                >
                  {signingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  <span>تسجيل الدخول بحساب جوجل لحفظ التقدم سحابيًا</span>
                </button>
              )}
              {authError && (
                <p className="mt-2 text-xs font-bold text-rose-400">
                  {authError}
                </p>
              )}
            </div>

            {/* 30 Reciters Selector */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    القراء الثلاثون الكاملون للقرآن
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                    القارئ المفضل للتلاوة والمصحف والتصحيح ورفيقي
                  </p>
                </div>
                <span className="font-mono-num text-[11px] font-bold text-[#C9A227]">
                  المحفوظ أوفلاين: {cachedCount}
                </span>
              </div>

              <div className="mt-3 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pl-1">
                {RECITERS_30.map((r) => {
                  const isPref = settings.preferredReciter === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((s) => ({
                          ...s,
                          preferredReciter: r.id as ReciterId,
                        }))
                      }
                      className={`flex min-h-[48px] items-center justify-between rounded-2xl border-2 px-3.5 py-2.5 text-right ${
                        isPref
                          ? 'border-[#C9A227] bg-[#C9A227]/15 text-slate-900 dark:text-white'
                          : 'border-[#C9A227]/40 bg-slate-50/70 dark:bg-[#0B0B0B] dark:text-white'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{r.nameAr}</p>
                        <p className="text-[11px] text-[#9A7415] dark:text-[#C9A227]">
                          {r.styleAr}
                        </p>
                      </div>
                      {isPref && <Check className="h-5 w-5 text-[#C9A227]" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-2 border-t border-[#C9A227]/25 pt-3">
                <button
                  type="button"
                  disabled={!!batchStatus}
                  onClick={handleDownloadAllDevice}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-4 py-2 text-xs font-extrabold text-black disabled:opacity-60"
                >
                  {batchStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : allPackReady ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>
                    {batchStatus
                      ? `${batchStatus.label} (${batchStatus.done}/${batchStatus.total})`
                      : allPackReady
                        ? 'تم تحميل الكل للجهاز (إعادة التحديث)'
                        : 'تحميل الكل للجهاز (عمل كامل بدون نت)'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!!batchStatus}
                  onClick={handleDownloadFamous30}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[#C9A227] bg-black px-4 py-2 text-xs font-bold text-[#FCE38A] disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  <span>تحميل 30 سورة مشهورة بصوت الشيخ المفضل</span>
                </button>
              </div>
            </div>

            {/* Preferred Adhan */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                صوت الأذان المفضل (30 مؤذنًا)
              </h3>
              <select
                value={settings.preferredAdhan}
                onChange={(e) =>
                  onUpdateSettings((s) => ({
                    ...s,
                    preferredAdhan: e.target.value,
                  }))
                }
                className="mt-2.5 w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none dark:bg-[#0B0B0B] dark:text-white"
              >
                {ADHAN_VOICES_30.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameAr} — {a.muezzinAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Background Theme */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                الخلفية الليلية والنهارية
              </h3>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings((s) => ({...s, darkMode: !s.darkMode}))
                }
                className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-bold text-black"
              >
                {settings.darkMode ? (
                  <>
                    <Sun className="h-4 w-4" />
                    <span>تغيير إلى الخلفية البيضاء</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    <span>تغيير إلى الخلفية السوداء الذهبية</span>
                  </>
                )}
              </button>
            </div>

            {/* Prayer Calculation */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                طريقة حساب مواقيت الصلاة
              </h3>
              <div className="mt-3 space-y-3">
                <select
                  aria-label="طريقة الحساب الفلكية"
                  value={settings.calculationMethod}
                  onChange={(e) =>
                    onUpdateSettings((s) => ({
                      ...s,
                      calculationMethod:
                        e.target.value as AppSettings['calculationMethod'],
                    }))
                  }
                  className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none dark:bg-[#0B0B0B] dark:text-white"
                >
                  {CALCULATION_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.labelAr}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({...s, madhab: 'Shafi'}))
                    }
                    className={`min-h-[40px] rounded-xl border py-2 text-xs font-bold ${
                      settings.madhab === 'Shafi'
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/40 text-slate-700 dark:text-white'
                    }`}
                  >
                    الجمهور (الشافعي)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({...s, madhab: 'Hanafi'}))
                    }
                    className={`min-h-[40px] rounded-xl border py-2 text-xs font-bold ${
                      settings.madhab === 'Hanafi'
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/40 text-slate-700 dark:text-white'
                    }`}
                  >
                    المذهب الحنفي
                  </button>
                </div>
              </div>
            </div>

            {/* Offline & PWA */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                تثبيت التطبيق والعمل دون إنترنت
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                القرآن 604 صفحة، التفسير الميسر، التعليم والوضوء، الأذكار، المسبحة، القبلة والأصوات تعمل تلقائيًا دون إنترنت.
              </p>
              <div className="mt-3">
                <PWAInstallButton />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          الأقسام والمكتبة الإسلامية الكاملة
        </h2>
        <p className="mt-0.5 text-[11px] text-[#9A7415] dark:text-[#C9A227]">
          المؤذن الإلكتروني · التعليم · الفقه · القصص · الحساب السحابي
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {SUB_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectSubPage(item.id)}
            className="flex items-start gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 text-right dark:bg-[#050505]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              {item.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {item.titleAr}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                {item.descAr}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
