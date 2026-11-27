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
  ChevronLeft,
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
  ShieldCheck,
  Sparkles,
  Sun,
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
import {
  formatShortPermissionBadgeAr,
  OPEN_SETTINGS_STEPS_AR,
  openNativeOrBrowserSettings,
  readRealPermissionsSnapshot,
  RealPermissionSnapshot,
  requestAllRealPermissions,
  requestRealBatteryPersistencePermission,
  requestRealBackgroundAudioPermission,
  requestRealBootStartupPermission,
  requestRealDoNotDisturbPermission,
  requestRealLocationPermission,
  requestRealNotificationPermission,
  requestRealWakeLockPermission,
  subscribePermissionChanges,
} from '../utils/permissions';
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
import {PermissionsView} from './PermissionsView';

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
    id: 'permissions',
    titleAr: 'أذونات التطبيق (النظام والخلفية)',
    descAr: 'الإشعارات، الصوت بالخلفية، بدء التشغيل، عدم الإزعاج، والبطارية',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
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
  const [permSnap, setPermSnap] = useState<RealPermissionSnapshot | null>(null);
  const [requestingPerms, setRequestingPerms] = useState(false);
  const [showPermSteps, setShowPermSteps] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSnap = async () => {
      const next = await readRealPermissionsSnapshot();
      if (active) setPermSnap(next);
    };
    void loadSnap();
    const unsub = subscribePermissionChanges(() => {
      void loadSnap();
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  if (subPage !== 'menu') {
    const activeItem = SUB_ITEMS.find((i) => i.id === subPage);
    const forceBlackGold =
      subPage === 'adhan' ||
      subPage === 'prayer_guide' ||
      subPage === 'books' ||
      subPage === 'rafiqi' ||
      subPage === 'salawat' ||
      subPage === 'seerah' ||
      subPage === 'voice_test' ||
      subPage === 'permissions';
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
        {subPage === 'permissions' && (
          <PermissionsView
            onBack={() => onSelectSubPage('settings')}
            onRequestGps={onRequestGps}
            onActivateAdhanEngine={onActivateAdhanEngine}
          />
        )}
        {subPage === 'settings' && (
          <div className="space-y-3">
            {/* Quick Navigate to Dedicated Permissions Page */}
            <button
              type="button"
              onClick={() => onSelectSubPage('permissions')}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-[#0A0802] p-4 text-right text-white shadow-xl active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[#FCE38A]">
                    صفحة «أذونات التطبيق» الكاملة
                  </h3>
                  <p className="truncate text-xs text-zinc-300">
                    أذونات الإشعارات، الصوت بالخلفية، بدء التشغيل، عدم الإزعاج، والبطارية
                  </p>
                </div>
              </div>
              <ChevronLeft className="h-5 w-5 shrink-0 text-[#C9A227]" />
            </button>

            {/* Real System & Background Permissions Card */}
            <div className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      الأذونات الحقيقية للنظام والتشغيل بالخلفية
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      حالة أذونات الهاتف الرسمية (مفعل بالأخضر / غير مفعل بالأحمر مع طلب الإذن)
                    </p>
                  </div>
                </div>
              </div>

              {permSnap && (
                <div className="space-y-2 text-xs font-bold">
                  {(
                    [
                      {
                        key: 'notifications' as const,
                        label: 'إذن الإشعارات',
                        onReq: requestRealNotificationPermission,
                      },
                      {
                        key: 'backgroundAudio' as const,
                        label: 'إذن الصوت في الخلفية',
                        onReq: async () => {
                          await requestRealBackgroundAudioPermission();
                          if (onActivateAdhanEngine) {
                            await onActivateAdhanEngine();
                          }
                        },
                      },
                      {
                        key: 'bootStartup' as const,
                        label: 'إذن التشغيل عند بدء التشغيل',
                        onReq: requestRealBootStartupPermission,
                      },
                      {
                        key: 'doNotDisturb' as const,
                        label: 'إذن عدم الإزعاج وتجاوز الصامت',
                        onReq: requestRealDoNotDisturbPermission,
                      },
                      {
                        key: 'battery' as const,
                        label: 'إذن البطارية وتجاهل التوفير',
                        onReq: requestRealBatteryPersistencePermission,
                      },
                      {
                        key: 'location' as const,
                        label: 'إذن الموقع الجغرافي (GPS)',
                        onReq: async () => {
                          onRequestGps();
                          return requestRealLocationPermission();
                        },
                      },
                      {
                        key: 'overlay' as const,
                        label: 'إذن إبقاء الشاشة نشطة',
                        onReq: requestRealWakeLockPermission,
                      },
                    ]
                  ).map((item) => {
                    const st = permSnap[item.key];
                    const isGranted = st?.granted;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/30 bg-black/40 p-2.5 text-right"
                      >
                        <span className="text-xs font-extrabold text-white">
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (st?.status === 'denied') {
                              const opened = await openNativeOrBrowserSettings();
                              if (!opened) setShowPermSteps(true);
                            } else {
                              await item.onReq();
                              setPermSnap(await readRealPermissionsSnapshot());
                            }
                          }}
                          className={`min-h-[38px] rounded-xl px-3 text-xs font-extrabold transition active:scale-95 ${
                            isGranted
                              ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                              : 'bg-red-600 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                          }`}
                        >
                          {isGranted ? 'مفعل ✓' : 'غير مفعل - اضغط للتفعيل'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                disabled={requestingPerms}
                onClick={async () => {
                  setRequestingPerms(true);
                  try {
                    const next = await requestAllRealPermissions();
                    setPermSnap(next);
                    if (onActivateAdhanEngine) {
                      await onActivateAdhanEngine();
                    }
                    if (
                      Object.values(next).some((v) => v.status === 'denied')
                    ) {
                      setShowPermSteps(true);
                    }
                  } finally {
                    setRequestingPerms(false);
                  }
                }}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-4 text-xs font-extrabold text-black active:scale-[0.98] disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {requestingPerms
                    ? 'جاري طلب الأذونات...'
                    : 'اطلب كل الأذونات الآن'}
                </span>
              </button>

              {permSnap &&
                Object.values(permSnap).some((v) => v.status === 'denied') && (
                  <button
                    type="button"
                    onClick={async () => {
                      const opened = await openNativeOrBrowserSettings();
                      if (!opened) setShowPermSteps((v) => !v);
                    }}
                    className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-2xl border border-rose-500/70 bg-rose-950/30 px-3 text-xs font-extrabold text-rose-500 dark:text-rose-300"
                  >
                    <Settings className="h-4 w-4" />
                    <span>افتح الإعدادات واسمح بالأذونات المحظورة</span>
                  </button>
                )}

              {showPermSteps && (
                <div className="space-y-1.5 rounded-2xl border border-rose-500/40 bg-rose-950/20 p-3 text-[11px] leading-relaxed text-slate-700 dark:text-zinc-200">
                  {OPEN_SETTINGS_STEPS_AR.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </div>

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

            {/* App Installation */}
            <div className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                تثبيت التطبيق والعمل بدون إنترنت
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                يمكنك اختيار الأقسام التي تريد حفظها للعمل أوفلاين من زر «تحميل محتوى التطبيق» في الصفحة الرئيسية.
              </p>
              <PWAInstallButton />
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
