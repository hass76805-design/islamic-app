import React from 'react';
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
  ChevronLeft,
  CircleDot,
  Cloud,
  Download,
  HardDrive,
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
  Trash2,
} from 'lucide-react';
import {AppSectionIconKey, getMoreMenuSections} from '../data/appSections';
import {useFirebase} from '../contexts/FirebaseContext';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {
  ADHAN_VOICES_30,
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
import {CALCULATION_METHODS} from '../utils/prayerTimes';
import {AdhanMuezzinView} from './AdhanMuezzinView';
import {AudioLibraryView} from './AudioLibraryView';
import {BooksView} from './BooksView';
import {DreamsView} from './DreamsView';
import {DuasView} from './DuasView';
import {FiqhView} from './FiqhView';
import {HijriCalendarView} from './HijriCalendarView';
import {OfflineDownloadsView} from './OfflineDownloadsView';
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
import {
  deleteDownload,
  downloadSection,
  getStorageUsage,
  getWifiOnlySetting,
  setWifiOnlySetting,
  StorageUsageSummary,
  subscribeDownloadsChanged,
} from '../services/downloadManager';

interface MoreViewProps {
  subPage: MoreSubPageId;
  onSelectSubPage: (sub: MoreSubPageId) => void;
  onBack: () => void;
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
  onActivateAdhanEngine?: () => Promise<void> | void;
}

function renderSectionIcon(iconKey: AppSectionIconKey): React.ReactNode {
  switch (iconKey) {
    case 'bell_ring':
      return <BellRing className="h-5 w-5" />;
    case 'book_open_text':
      return <BookOpenText className="h-5 w-5" />;
    case 'mic':
      return <Mic className="h-5 w-5" />;
    case 'heart':
      return <Heart className="h-5 w-5" />;
    case 'scroll_text':
      return <ScrollText className="h-5 w-5" />;
    case 'audio_lines':
      return <AudioLines className="h-5 w-5" />;
    case 'book_open':
      return <BookOpen className="h-5 w-5" />;
    case 'help_circle':
      return <HelpCircle className="h-5 w-5" />;
    case 'moon_star':
      return <MoonStar className="h-5 w-5" />;
    case 'sparkles':
      return <Sparkles className="h-5 w-5" />;
    case 'radio':
      return <Radio className="h-5 w-5" />;
    case 'book_marked':
      return <BookMarked className="h-5 w-5" />;
    case 'circle_dot':
      return <CircleDot className="h-5 w-5" />;
    case 'calendar_days':
      return <CalendarDays className="h-5 w-5" />;
    case 'check_circle_2':
      return <CheckCircle2 className="h-5 w-5" />;
    case 'download':
      return <Download className="h-5 w-5" />;
    default:
      return <Sparkles className="h-5 w-5" />;
  }
}

const SUB_ITEMS: Array<{
  id: Exclude<MoreSubPageId, 'menu'>;
  titleAr: string;
  descAr: string;
  icon: React.ReactNode;
}> = [
  ...getMoreMenuSections().map((sec) => ({
    id: sec.id as Exclude<MoreSubPageId, 'menu'>,
    titleAr: sec.labelAr,
    descAr: sec.moreDescAr || sec.descAr,
    icon: renderSectionIcon(sec.iconKey),
  })),
  {
    id: 'settings',
    titleAr: 'الحساب السحابي والإعدادات',
    descAr: 'المزامنة السحابية، القراء الثلاثون، العمل بدون نت، وطريقة الحساب',
    icon: <Settings className="h-5 w-5" />,
  },
];

export const MoreView: React.FC<MoreViewProps> = ({
  subPage,
  onSelectSubPage,
  onBack,
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
  onActivateAdhanEngine,
}) => {
  const {user, signingIn, authError, signInWithGoogle, signOutUser} =
    useFirebase();
  const isOnline = useOnlineStatus();
  const [storageUsage, setStorageUsage] =
    React.useState<StorageUsageSummary | null>(null);
  const [wifiOnly, setWifiOnly] = React.useState<boolean>(() =>
    getWifiOnlySetting(),
  );
  const [dlAllProgress, setDlAllProgress] = React.useState<number | null>(null);

  React.useEffect(() => {
    const syncStorage = () => {
      void getStorageUsage().then(setStorageUsage);
      setWifiOnly(getWifiOnlySetting());
    };
    syncStorage();
    return subscribeDownloadsChanged(syncStorage);
  }, [subPage]);

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
      <div className="space-y-3">
        <div
          className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A227] px-3 py-2 ${
            forceBlackGold
              ? 'bg-[#050505] text-white'
              : 'bg-white dark:bg-[#050505]'
          }`}
        >
          <button
            type="button"
            onClick={() =>
              subPage === 'settings' ? onSelectSubPage('menu') : onBack()
            }
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C9A227] px-3 text-xs font-bold active:scale-95 ${
              forceBlackGold
                ? 'bg-black text-[#F3D56B]'
                : 'text-[#9A7415] dark:text-[#F3D56B]'
            }`}
          >
            {subPage === 'settings' ? (
              <>
                <Sparkles className="h-4 w-4" />
                <span>كل الأقسام</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                <span>العودة</span>
              </>
            )}
          </button>
          <h2
            className={`truncate text-sm font-extrabold ${
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
            onActivateAdhanEngine={onActivateAdhanEngine}
          />
        )}
        {subPage === 'books' && <BooksView />}
        {subPage === 'rafiqi' && (
          <RafiqiView preferredReciter={settings.preferredReciter} />
        )}
        {subPage === 'salawat' && (
          <SalawatView
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />
        )}
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
        {subPage === 'downloads' && <OfflineDownloadsView />}
        {subPage === 'settings' && (
          <div className="space-y-3">
            {/* Google Sign-In & Firebase Cloud Sync Card */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
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

              {!isOnline && (
                <p className="mt-2.5 rounded-2xl border border-[#C9A227]/50 bg-[#120E04] px-3 py-2 text-[11px] font-bold text-[#FCE38A]">
                  المزامنة السحابية وتسجيل الدخول بحساب جوجل يتطلبان اتصالاً بالإنترنت — تقدمك وإعداداتك محفوظة محليًا على الجهاز بأمان.
                </p>
              )}

              {user ? (
                <div className="mt-3 space-y-2.5 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3 text-white">
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
                      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-[#C9A227]/70 px-3 text-xs font-bold text-[#F3D56B] active:scale-95"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>خروج</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={signingIn || !isOnline}
                  onClick={() => void signInWithGoogle()}
                  className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-4 text-xs font-extrabold text-black active:scale-[0.98] disabled:opacity-60"
                >
                  {signingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  <span>
                    {isOnline
                      ? 'تسجيل الدخول بحساب جوجل لحفظ التقدم سحابيًا'
                      : 'يتطلب إنترنت لتسجيل الدخول بجوجل'}
                  </span>
                </button>
              )}
              {authError && (
                <p className="mt-2 text-xs font-bold text-rose-400">
                  {authError}
                </p>
              )}
            </div>

            {/* 30 Reciters Selector */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  القراء الثلاثون الكاملون للقرآن
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                  القارئ المفضل للتلاوة والمصحف والتصحيح ورفيقي
                </p>
              </div>

              <div className="mt-3 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pl-1">
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
                      className={`flex min-h-[48px] items-center justify-between rounded-2xl border-2 px-3.5 py-2 text-right transition active:scale-[0.99] ${
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
            </div>

            {/* Preferred Adhan */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
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
                className="mt-2.5 min-h-[46px] w-full rounded-2xl border border-[#C9A227]/60 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none dark:bg-[#0B0B0B] dark:text-white"
              >
                {ADHAN_VOICES_30.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameAr} — {a.muezzinAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Background Theme */}
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                المظهر الليلي والنهاري
              </h3>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings((s) => ({...s, darkMode: !s.darkMode}))
                }
                className="mt-2.5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-4 text-xs font-extrabold text-black active:scale-[0.98]"
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
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                طريقة حساب مواقيت الصلاة
              </h3>
              <div className="mt-2.5 space-y-2.5">
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
                  className="min-h-[46px] w-full rounded-2xl border border-[#C9A227]/60 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none dark:bg-[#0B0B0B] dark:text-white"
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
                    className={`min-h-[44px] rounded-2xl border py-2 text-xs font-bold active:scale-95 ${
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
                    className={`min-h-[44px] rounded-2xl border py-2 text-xs font-bold active:scale-95 ${
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

            {/* Offline & PWA & Smart Audio Storage Manager */}
            <div className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  إدارة التحميلات والمساحة بدون إنترنت
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-400">
                  جاهز ✓
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                القرآن 604 صفحة، التفسير الميسر، التعليم والوضوء، الأذكار، المسبحة، القبلة والأذان تعمل تلقائيًا دون إنترنت.
              </p>

              <div className="flex items-center justify-between rounded-2xl border border-[#C9A227]/40 bg-slate-50 px-3.5 py-2.5 dark:bg-[#0B0B0B]">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-200">
                  <HardDrive className="h-4 w-4 text-[#C9A227]" />
                  <span>مساحة التخزين المستخدمة</span>
                </span>
                <span className="font-mono-num text-xs font-extrabold text-[#9A7415] dark:text-[#FCE38A]">
                  {storageUsage
                    ? `${storageUsage.totalMb} MB (${storageUsage.downloadedCount}/${storageUsage.totalItemsCount})`
                    : '0 MB'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isOnline || dlAllProgress !== null}
                  onClick={() => {
                    setDlAllProgress(1);
                    void downloadSection('all', (p) =>
                      setDlAllProgress(p.percent),
                    ).finally(() => setDlAllProgress(null));
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[#C9A227] px-3 text-xs font-extrabold text-black active:scale-95 disabled:opacity-50"
                >
                  {dlAllProgress !== null ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>
                    {dlAllProgress !== null
                      ? `تحميل الكل ${dlAllProgress}%`
                      : 'تحميل الكل'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void deleteDownload('all')}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-rose-500/60 bg-rose-950/20 px-3 text-xs font-extrabold text-rose-400 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف الكل</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !wifiOnly;
                  setWifiOnlySetting(next);
                  setWifiOnly(next);
                }}
                className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[#C9A227]/45 bg-slate-50 px-3.5 py-2 text-right dark:bg-[#0B0B0B]"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  تحميل تلقائي على واي فاي فقط
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                    wifiOnly
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-700/40 text-zinc-400'
                  }`}
                >
                  {wifiOnly ? 'مفعّل' : 'غير مفعّل'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSubPage('downloads')}
                className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[#C9A227] bg-[#0B0903] px-3.5 py-2 text-xs font-extrabold text-[#FCE38A] active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-[#C9A227]" />
                  <span>فتح مكتبة التحميلات الصوتية (4 أقسام)</span>
                </span>
                <ChevronLeft className="h-4 w-4 text-[#C9A227]" />
              </button>

              <div className="pt-1">
                <PWAInstallButton />
              </div>
            </div>

            {/* Quick Open All Islamic Library Sections */}
            <button
              type="button"
              onClick={() => onSelectSubPage('menu')}
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-[#0B0903] px-4 py-3 text-right text-[#FCE38A] active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-[#C9A227]" />
                <span className="text-sm font-extrabold">
                  فتح جميع الأقسام والمكتبة الإسلامية ({SUB_ITEMS.length - 1} قسمًا)
                </span>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-[#C9A227]" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            المكتبة والأقسام الإسلامية
          </h2>
          <p className="mt-0.5 text-[11px] text-[#9A7415] dark:text-[#C9A227]">
            المؤذن · التعليم · الفقه · القصص · الإعدادات
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectSubPage('settings')}
          className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-2xl bg-[#C9A227] px-3 text-xs font-extrabold text-black active:scale-95"
        >
          <Settings className="h-4 w-4" />
          <span>الإعدادات</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-white dark:bg-[#050505]">
        <div className="divide-y divide-[#C9A227]/20">
          {SUB_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSubPage(item.id)}
              className="flex min-h-[64px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-right transition-colors active:bg-[#C9A227]/12"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {item.titleAr}
                  </h3>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                    {item.descAr}
                  </p>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-[#C9A227]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
