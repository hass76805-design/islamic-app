import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  BellRing,
  BookOpen,
  Check,
  Compass,
  Download,
  HeartHandshake,
  Home,
  Moon,
  Pause,
  Play,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import {AdhanLiveModal} from './components/AdhanLiveModal';
import {AdhanMuezzinView} from './components/AdhanMuezzinView';
import {AzkarView} from './components/AzkarView';
import {HomeView} from './components/HomeView';
import {MoreView} from './components/MoreView';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PWAInstallButton} from './components/PWAInstallButton';
import {QiblaView} from './components/QiblaView';
import {QuranTestModal} from './components/QuranTestModal';
import {QuranLaunchDirective, QuranView} from './components/QuranView';
import {SplashScreen} from './components/SplashScreen';
import {FirebaseProvider, useFirebase} from './contexts/FirebaseContext';
import {AZKAR_CATEGORIES} from './data/azkar';
import {INITIAL_QURAN_SEED} from './data/initialSeedData';
import {findNearestCity, PRESET_CITIES} from './data/cities';
import {
  ADHAN_VOICES_30,
  EID_TAKBEERAT_VOICES_3,
  FRIDAY_KAHF_VOICES_3,
  getAyahAudioUrl,
  IQAMAH_VOICES_3,
  POST_ADHAN_DUA,
  POST_PRAYER_AZKAR_AUDIO_URLS,
  PRE_ADHAN_VOICES_3,
  SALAWAT_AUDIO_TRACKS,
  TAWASIH_NAQSHABANDI,
} from './data/reciters';
import {useLocalStorage} from './hooks/useLocalStorage';
import {
  AdhanVoice,
  AppSettings,
  AzkarCategoryId,
  CompactSurah,
  DailyPrayerLog,
  KhatmaPlan,
  MemorizationTestResult,
  MoreSubPageId,
  PrayerTrackStatus,
  QuranBookmark,
  ReciterId,
  StoryCategoryId,
  TabId,
  TrackablePrayer,
  UserLocation,
} from './types';
import {
  popHistoryEntrySilently,
  pushNavigationState,
  setRootBackHandler,
} from './utils/backNavigation';
import {getDateKey, getHijriParts} from './utils/hijri';
import {
  BackgroundOfflineProgress,
  cacheBatchUrls,
  cancelFullOfflineBackgroundDownload,
  getCurrentOfflineProgress,
  hydrateOfflineStateFromIdb,
  loadOfflineJson,
  notifyNetworkOfflineToSw,
  notifyNetworkOnlineAutoResumeToSw,
  pauseFullOfflineBackgroundDownload,
  prewarmCoreOfflineTextData,
  resolveOfflinePlayableUrl,
  resumeFullOfflineBackgroundDownload,
  subscribeOfflineDownloadState,
  syncOfflineContentUpdatesInBackground,
} from './utils/offlineAudioCache';
import {
  ensureInitialOfflineSeedData,
  requestPersistentStorage,
} from './utils/offlineDb';
import {
  computeDailyPrayerData,
  computeQiyamAlLaylTime,
  DEFAULT_PRAYER_OFFSETS,
  formatCountdown,
  formatTime12,
  hydrateMonthlyPrayerCacheFromIdb,
  precomputeMonthlyPrayerCache,
} from './utils/prayerTimes';
import {
  resolveSheikhHumanVoiceUrl,
  STARTUP_DUA_TEXT,
} from './utils/rafiqiVoice';
import {playRamadanCannonSound} from './utils/ramadanCannon';

let splashPlayedThisLaunch = false;
const FIRED_ALERTS_STORAGE_KEY = 'alzahabi_fired_alerts_v1';
const SALAWAT_ANCHOR_STORAGE_KEY = 'alzahabi_salawat_anchor_v1';

function getOrInitSalawatAnchor(intervalMin: number): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const raw = window.localStorage.getItem(SALAWAT_ANCHOR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {ts?: number; interval?: number};
      if (
        typeof parsed.ts === 'number' &&
        parsed.ts > 0 &&
        parsed.interval === intervalMin
      ) {
        return parsed.ts;
      }
    }
    const ts = Date.now();
    window.localStorage.setItem(
      SALAWAT_ANCHOR_STORAGE_KEY,
      JSON.stringify({ts, interval: intervalMin}),
    );
    return ts;
  } catch {
    return Date.now();
  }
}

function readPersistedFiredAlerts(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(FIRED_ALERTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, number>;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const validKeys = Object.entries(parsed)
      .filter(([, ts]) => typeof ts === 'number' && ts >= cutoff)
      .map(([k]) => k);
    return new Set(validKeys);
  } catch {
    return new Set();
  }
}

function persistFiredAlert(key: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(FIRED_ALERTS_STORAGE_KEY);
    const parsed: Record<string, number> = raw ? JSON.parse(raw) : {};
    const nowTs = Date.now();
    const cutoff = nowTs - 48 * 60 * 60 * 1000;
    const cleaned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && ts >= cutoff) cleaned[k] = ts;
    }
    cleaned[key] = nowTs;
    window.localStorage.setItem(FIRED_ALERTS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore storage limits
  }
}

function createSilentWavBlobUrl(): string {
  const sampleRate = 8000;
  const numSamples = 8000; // 1 second of silence
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  return URL.createObjectURL(new Blob([buffer], {type: 'audio/wav'}));
}

const DEFAULT_CAIRO_CITY: UserLocation =
  PRESET_CITIES.find((c) => c.city === 'القاهرة') || PRESET_CITIES[7];

const DEFAULT_SETTINGS: AppSettings = {
  calculationMethod: 'Egyptian',
  madhab: 'Shafi',
  darkMode: true,
  quranFontSize: 22,
  tasbihSound: true,
  tasbihVibration: true,
  preferredReciter: 'alafasy',
  preferredAdhan: 'adhan-makkah',
  perPrayerAdhan: {
    fajr: 'adhan-fajr',
    dhuhr: 'adhan-makkah',
    asr: 'adhan-makkah',
    maghrib: 'adhan-madinah',
    isha: 'adhan-makkah',
  },
  enabledPrayers: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
  preferredIqamah: 'iqamah-makkah',
  perPrayerIqamah: {
    fajr: 'iqamah-makkah',
    dhuhr: 'iqamah-makkah',
    asr: 'iqamah-makkah',
    maghrib: 'iqamah-makkah',
    isha: 'iqamah-makkah',
  },
  iqamahEnabled: true,
  postAdhanDuaEnabled: true,
  qiyamEnabled: true,
  preferredPreAdhanSound: 'pre-takbeer',
  preferredTawasih: 'tawasih-naqshabandi-1',
  preferredEidTakbeer: 'eid-makkah-1',
  preferredFridayKahf: 'kahf-alafasy',
  adhanEnabled: true,
  preAdhanMinutes: 10,
  prayerOffsets: {...DEFAULT_PRAYER_OFFSETS},
  ramadanCannonEnabled: true,
  fajrTawasihEnabled: true,
  eidTakbeeratEnabled: true,
  fridayKahfReminder: true,
  postPrayerAzkarEnabled: true,
  backgroundAlertsEnabled: true,
  lockScreenKeepAlive: true,
  prayerConfirmReminderEnabled: true,
  salawatReminderEnabled: true,
  salawatIntervalMinutes: 10,
};

const NAV_ITEMS: Array<{id: TabId; labelAr: string; icon: typeof Home}> = [
  {id: 'home', labelAr: 'الرئيسية', icon: Home},
  {id: 'quran', labelAr: 'القرآن', icon: BookOpen},
  {id: 'prayer', labelAr: 'الصلاة', icon: BellRing},
  {id: 'azkar', labelAr: 'الأذكار', icon: HeartHandshake},
  {id: 'qibla', labelAr: 'القبلة', icon: Compass},
  {id: 'settings', labelAr: 'الإعدادات', icon: Settings},
];

export interface LastReadPosition {
  surahNumber: number;
  ayahNumber: number;
  page: number;
  updatedAt: number;
}

interface AppContentProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  khatma: KhatmaPlan;
  setKhatma: React.Dispatch<React.SetStateAction<KhatmaPlan>>;
}

function AppContent({
  settings,
  setSettings,
  khatma,
  setKhatma,
}: AppContentProps) {
  const {
    user,
    cloudState,
    syncReadingPosition,
    syncPreferences,
    pushTestResultToCloud,
    pushBookmarkToCloud,
    deleteBookmarkFromCloud,
  } = useFirebase();

  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (splashPlayedThisLaunch) return false;
    splashPlayedThisLaunch = true;
    return true;
  });
  const handleSplashComplete = useCallback(() => {
    splashPlayedThisLaunch = true;
    setShowSplash(false);
  }, []);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [moreSubPage, setMoreSubPage] = useState<MoreSubPageId>('menu');
  const [storyCategory, setStoryCategory] =
    useState<StoryCategoryId>('prophets');
  const [quranDirective, setQuranDirective] =
    useState<QuranLaunchDirective | null>(null);
  const [directTestOpen, setDirectTestOpen] = useState(false);
  const [directTestSurahs, setDirectTestSurahs] =
    useState<CompactSurah[]>(INITIAL_QURAN_SEED);
  const [now, setNow] = useState<Date>(() => new Date());

  const [location, setLocation] = useLocalStorage<UserLocation>(
    'ana_muslim_location',
    DEFAULT_CAIRO_CITY,
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [notifPermState, setNotifPermState] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  );
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [permBannerDismissed, setPermBannerDismissed] = useState(false);

  const [bookmarks, setBookmarks] = useLocalStorage<QuranBookmark[]>(
    'ana_muslim_bookmarks',
    [],
  );

  const [testHistory, setTestHistory] = useLocalStorage<
    MemorizationTestResult[]
  >('ana_muslim_test_history', []);

  const [lastRead, setLastRead] = useLocalStorage<LastReadPosition>(
    'alzahabi_last_read_v1',
    {
      surahNumber: 1,
      ayahNumber: 1,
      page: 1,
      updatedAt: Date.now(),
    },
  );

  const [azkarLog, setAzkarLog] = useLocalStorage<{
    date: string;
    counts: Record<string, number>;
  }>('ana_muslim_azkar', {
    date: getDateKey(new Date()),
    counts: {},
  });

  const [prayerLog, setPrayerLog] = useLocalStorage<DailyPrayerLog>(
    'ana_muslim_prayer_log',
    {},
  );

  // Restore cloud state softly when signed in
  const appliedCloudRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !cloudState || appliedCloudRef.current === user.uid) return;
    appliedCloudRef.current = user.uid;
    if (cloudState.lastReadPage >= 1 && cloudState.lastReadPage <= 604) {
      setLastRead((prev) =>
        prev.page === 1 && prev.surahNumber === 1
          ? {
              surahNumber: cloudState.lastReadSurah,
              ayahNumber: cloudState.lastReadAyah,
              page: cloudState.lastReadPage,
              updatedAt: Date.now(),
            }
          : prev,
      );
      setKhatma((prev) =>
        prev.currentPage === 1 && cloudState.lastReadPage > 1
          ? {...prev, currentPage: cloudState.lastReadPage}
          : prev,
      );
    }
  }, [user, cloudState, setLastRead, setKhatma]);

  // Live Adhan & Special Events Banner State
  const [adhanBanner, setAdhanBanner] = useState<{
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [liveAdhanModal, setLiveAdhanModal] = useState<{
    prayerNameAr: string;
    prayerKey?: TrackablePrayer;
    voice: AdhanVoice;
    mode?: 'adhan' | 'iqamah' | 'dua';
  } | null>(null);
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const triggeredAlertsRef = useRef<Set<string>>(readPersistedFiredAlerts());
  const navStateRef = useRef<{
    activeTab: TabId;
    moreSubPage: MoreSubPageId;
    storyCategory: StoryCategoryId;
  }>({
    activeTab: 'home',
    moreSubPage: 'menu',
    storyCategory: 'prophets',
  });
  navStateRef.current = {activeTab, moreSubPage, storyCategory};

  const navHistoryRef = useRef<
    Array<{
      activeTab: TabId;
      moreSubPage: MoreSubPageId;
      storyCategory: StoryCategoryId;
      scrollTop: number;
    }>
  >([]);
  const pendingScrollRestoreRef = useRef<number | null>(null);

  const mainScrollRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const target = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;
    const el = mainScrollRef.current;
    if (!el) return;
    if (target === null) return;

    el.scrollTop = target;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = target;
      }
      raf2 = window.requestAnimationFrame(() => {
        if (mainScrollRef.current && target > 0) {
          mainScrollRef.current.scrollTop = target;
        }
      });
    });
    const t =
      target > 0
        ? window.setTimeout(() => {
            if (mainScrollRef.current) {
              mainScrollRef.current.scrollTop = target;
            }
          }, 45)
        : 0;
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      if (t) window.clearTimeout(t);
    };
  }, [activeTab, moreSubPage, storyCategory]);

  const navigateForward = useCallback(
    (next: {
      activeTab: TabId;
      moreSubPage: MoreSubPageId;
      storyCategory?: StoryCategoryId;
      tag: string;
    }) => {
      const cur = navStateRef.current;
      const effectiveNextStory = next.storyCategory ?? cur.storyCategory;
      if (
        cur.activeTab === next.activeTab &&
        cur.moreSubPage === next.moreSubPage &&
        cur.storyCategory === effectiveNextStory
      ) {
        mainScrollRef.current?.scrollTo({top: 0, behavior: 'smooth'});
        return;
      }

      const currentScroll = mainScrollRef.current?.scrollTop ?? 0;
      navHistoryRef.current = [
        ...navHistoryRef.current.slice(-39),
        {
          activeTab: cur.activeTab,
          moreSubPage: cur.moreSubPage,
          storyCategory: cur.storyCategory,
          scrollTop: currentScroll,
        },
      ];
      pendingScrollRestoreRef.current = 0;
      pushNavigationState(next.tag);
      setActiveTab(next.activeTab);
      setMoreSubPage(next.moreSubPage);
      if (next.storyCategory) {
        setStoryCategory(next.storyCategory);
      }
    },
    [],
  );

  const navigateBackFromStack = useCallback((fromHardwarePop: boolean) => {
    const prev = navHistoryRef.current.pop();
    if (prev) {
      pendingScrollRestoreRef.current = prev.scrollTop;
      setActiveTab(prev.activeTab);
      setMoreSubPage(prev.moreSubPage);
      setStoryCategory(prev.storyCategory);
      if (!fromHardwarePop) {
        popHistoryEntrySilently();
      }
      return true;
    }

    const {activeTab: tab, moreSubPage: sub} = navStateRef.current;
    if (tab === 'more' && sub !== 'menu') {
      pendingScrollRestoreRef.current = 0;
      setMoreSubPage('menu');
      if (!fromHardwarePop) popHistoryEntrySilently();
      return true;
    }
    if (tab === 'settings' && sub !== 'settings') {
      pendingScrollRestoreRef.current = 0;
      setMoreSubPage('settings');
      if (!fromHardwarePop) popHistoryEntrySilently();
      return true;
    }
    if (tab !== 'home') {
      pendingScrollRestoreRef.current = 0;
      setActiveTab('home');
      setMoreSubPage('menu');
      if (!fromHardwarePop) popHistoryEntrySilently();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    setRootBackHandler(() => navigateBackFromStack(true));
    return () => setRootBackHandler(null);
  }, [navigateBackFromStack]);

  // Ensure initial non-GPS default migrates cleanly to Cairo + Egyptian method
  const cairoInitRef = useRef(false);
  useEffect(() => {
    if (cairoInitRef.current || typeof window === 'undefined') return;
    cairoInitRef.current = true;
    try {
      if (window.localStorage.getItem('alzahabi_cairo_default_v2') !== '1') {
        window.localStorage.setItem('alzahabi_cairo_default_v2', '1');
        if (!location.isGps && location.city === 'مكة المكرمة') {
          setLocation(DEFAULT_CAIRO_CITY);
          setSettings((s) => ({
            ...s,
            calculationMethod: 'Egyptian',
            preAdhanMinutes: 10,
            preferredPreAdhanSound: 'pre-takbeer',
            lockScreenKeepAlive: true,
            prayerConfirmReminderEnabled: true,
          }));
        }
      }
    } catch {
      // ignore storage failure
    }
  }, [location.isGps, location.city, setLocation, setSettings]);

  // Immediately request GPS permission on launch so times & Qibla calibrate automatically
  const gpsAutoRequestedRef = useRef(false);
  useEffect(() => {
    if (gpsAutoRequestedRef.current) return;
    gpsAutoRequestedRef.current = true;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const {latitude, longitude} = pos.coords;
        const nearest = findNearestCity(latitude, longitude);
        setLocation({
          latitude,
          longitude,
          city: nearest.city,
          country: nearest.country,
          isGps: true,
        });
        if (nearest.country === 'مصر') {
          setSettings((s) =>
            s.calculationMethod === 'Egyptian'
              ? s
              : {...s, calculationMethod: 'Egyptian'},
          );
        }
      },
      () => {
        // Fall back seamlessly to saved location / Cairo default
      },
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 180000},
    );
  }, [setLocation, setSettings]);

  // Unlock background Web Audio + keep-alive loop cleanly on first user interaction
  const unlockAudioEngine = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!adhanAudioRef.current) {
        adhanAudioRef.current = new Audio();
        adhanAudioRef.current.preload = 'auto';
      }
      const adhanEl = adhanAudioRef.current;
      adhanEl.volume = 1;
      adhanEl.muted = false;
      if (adhanEl.paused && !adhanEl.currentSrc) {
        const silentWav = createSilentWavBlobUrl();
        adhanEl.src = silentWav;
        adhanEl.muted = true;
        adhanEl
          .play()
          .then(() => {
            adhanEl.pause();
            adhanEl.currentTime = 0;
            adhanEl.muted = false;
            adhanEl.removeAttribute('src');
            URL.revokeObjectURL(silentWav);
          })
          .catch(() => {
            adhanEl.muted = false;
            URL.revokeObjectURL(silentWav);
          });
      }
      if (keepAliveAudioRef.current && keepAliveAudioRef.current.paused) {
        keepAliveAudioRef.current.play().catch(() => {});
      }
      setAudioUnlocked(true);
    } catch {
      setAudioUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || audioUnlocked) return;
    const onFirstGesture = () => {
      unlockAudioEngine();
    };
    document.addEventListener('pointerdown', onFirstGesture, {
      once: true,
      passive: true,
    });
    return () => {
      document.removeEventListener('pointerdown', onFirstGesture);
    };
  }, [audioUnlocked, unlockAudioEngine]);

  // Unified full offline pack progress state + automatic network offline/online resume & updates
  const [offlineDl, setOfflineDl] = useState<BackgroundOfflineProgress>(() =>
    getCurrentOfflineProgress(),
  );
  const [offlineDoneBannerVisible, setOfflineDoneBannerVisible] =
    useState(false);
  const prevOfflineDlStatusRef = useRef<BackgroundOfflineProgress['status']>(
    offlineDl.status,
  );

  useEffect(() => {
    void requestPersistentStorage();
    void ensureInitialOfflineSeedData();
    void hydrateOfflineStateFromIdb();
    void hydrateMonthlyPrayerCacheFromIdb();

    const unsub = subscribeOfflineDownloadState((next) => {
      const prevStatus = prevOfflineDlStatusRef.current;
      prevOfflineDlStatusRef.current = next.status;
      setOfflineDl(next);
      if (
        next.status === 'completed' &&
        (prevStatus === 'downloading' || prevStatus === 'paused')
      ) {
        setOfflineDoneBannerVisible(true);
      } else if (next.status !== 'completed') {
        setOfflineDoneBannerVisible(false);
      }
    });

    const handleOffline = () => {
      void notifyNetworkOfflineToSw();
    };
    const handleOnline = () => {
      void notifyNetworkOnlineAutoResumeToSw();
      void syncOfflineContentUpdatesInBackground(settings.preferredReciter);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (navigator.onLine) {
          void notifyNetworkOnlineAutoResumeToSw();
          void syncOfflineContentUpdatesInBackground(settings.preferredReciter);
        } else {
          void notifyNetworkOfflineToSw();
        }
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsub();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [settings.preferredReciter]);

  // Automatically cache all selected Adhan / Iqamah / Tawasih / Eid / Salawat audio files locally for offline background playback
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!settings.adhanEnabled && !settings.salawatReminderEnabled) return;

    const selectedAdhanIds = new Set<string>([
      settings.preferredAdhan,
      settings.perPrayerAdhan.fajr,
      settings.perPrayerAdhan.dhuhr,
      settings.perPrayerAdhan.asr,
      settings.perPrayerAdhan.maghrib,
      settings.perPrayerAdhan.isha,
    ]);
    const adhanUrls = ADHAN_VOICES_30.filter((v) =>
      selectedAdhanIds.has(v.id),
    ).flatMap((v) => [v.url, ...(v.fallbackUrl ? [v.fallbackUrl] : [])]);

    const iqamahUrls = IQAMAH_VOICES_3.map((i) => i.url);
    const preUrls = PRE_ADHAN_VOICES_3.map((p) => p.url);
    const tawasihUrls = TAWASIH_NAQSHABANDI.map((t) => t.url);
    const eidUrls = EID_TAKBEERAT_VOICES_3.map((e) => e.url);
    const kahfUrls = FRIDAY_KAHF_VOICES_3.map((k) => k.url);
    const salawatUrls = SALAWAT_AUDIO_TRACKS.map((s) => s.url);

    const allAdhanCoreUrls = Array.from(
      new Set([
        ...adhanUrls,
        ...iqamahUrls,
        ...preUrls,
        POST_ADHAN_DUA.audioUrl,
        ...tawasihUrls,
        ...eidUrls,
        ...kahfUrls,
        ...salawatUrls,
        ...POST_PRAYER_AZKAR_AUDIO_URLS,
      ]),
    );

    const t = window.setTimeout(() => {
      void cacheBatchUrls(allAdhanCoreUrls, undefined, 3);
    }, 300);
    return () => window.clearTimeout(t);
  }, [
    settings.adhanEnabled,
    settings.salawatReminderEnabled,
    settings.preferredAdhan,
    settings.perPrayerAdhan,
    settings.preferredIqamah,
    settings.perPrayerIqamah,
    settings.preferredPreAdhanSound,
    settings.preferredTawasih,
    settings.preferredEidTakbeer,
    settings.preferredFridayKahf,
  ]);

  // Play sweet welcoming opening Dua voice once per launch (offline-ready + autoplay-safe)
  const startupDuaTriggeredRef = useRef(false);
  const startupDuaAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveAdhanActiveRef = useRef(false);
  liveAdhanActiveRef.current = Boolean(liveAdhanModal);

  useEffect(() => {
    if (startupDuaTriggeredRef.current || typeof window === 'undefined') return;
    startupDuaTriggeredRef.current = true;

    let cancelled = false;
    let cleanupGesture: (() => void) | null = null;

    const prepareAndPlayStartupDua = async () => {
      if (cancelled || liveAdhanActiveRef.current) return;

      let duaSrc: string | null = await resolveSheikhHumanVoiceUrl(
        STARTUP_DUA_TEXT,
      );
      if (!duaSrc) {
        duaSrc = await resolveOfflinePlayableUrl(POST_ADHAN_DUA.audioUrl);
      }
      if (!duaSrc || cancelled || liveAdhanActiveRef.current) return;

      if (!startupDuaAudioRef.current) {
        startupDuaAudioRef.current = new Audio();
      }
      const audio = startupDuaAudioRef.current;
      audio.src = duaSrc;
      audio.volume = 0.92;
      audio.preload = 'auto';

      const tryPlayOnce = () => {
        if (cancelled || liveAdhanActiveRef.current) return;
        audio.play().catch(() => {
          // If browser blocked autoplay before user gesture, play immediately on first interaction
          if (cancelled || cleanupGesture) return;
          const onFirstInteraction = () => {
            cleanupGesture = null;
            if (!cancelled && !liveAdhanActiveRef.current) {
              audio.play().catch(() => {});
            }
          };
          document.addEventListener('pointerdown', onFirstInteraction, {
            once: true,
            passive: true,
          });
          document.addEventListener('keydown', onFirstInteraction, {
            once: true,
          });
          cleanupGesture = () => {
            document.removeEventListener('pointerdown', onFirstInteraction);
            document.removeEventListener('keydown', onFirstInteraction);
          };
        });
      };

      tryPlayOnce();
    };

    const t = window.setTimeout(() => {
      void prepareAndPlayStartupDua();
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      cleanupGesture?.();
      startupDuaAudioRef.current?.pause();
    };
  }, []);

  // Automatically pre-warm core offline Quran/Tafsir text + local audio silently when online
  const corePrewarmedRef = useRef(false);
  useEffect(() => {
    if (corePrewarmedRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    corePrewarmedRef.current = true;
    const t = window.setTimeout(() => {
      void prewarmCoreOfflineTextData(settings.preferredReciter);
      void syncOfflineContentUpdatesInBackground(settings.preferredReciter);
    }, 450);
    return () => window.clearTimeout(t);
  }, [settings.preferredReciter]);

  // Quietly pre-warm Al-Fatihah recitation audio once online after splash
  const prewarmedRef = useRef<string | null>(null);
  useEffect(() => {
    if (showSplash || typeof navigator === 'undefined' || !navigator.onLine) {
      return;
    }
    const reciterKey = settings.preferredReciter;
    if (prewarmedRef.current === reciterKey) return;
    prewarmedRef.current = reciterKey;

    const timer = window.setTimeout(() => {
      const urls = [1, 2, 3, 4, 5, 6, 7].map((ayah) =>
        getAyahAudioUrl(reciterKey, 1, ayah),
      );
      void cacheBatchUrls(urls);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [showSplash, settings.preferredReciter]);

  // Optional Lock-Screen Electronic Muezzin & Salawat Keep-Alive (silent WAV + MediaSession + WakeLock)
  useEffect(() => {
    if (
      !(settings.adhanEnabled || settings.salawatReminderEnabled) ||
      !settings.lockScreenKeepAlive ||
      typeof window === 'undefined'
    ) {
      if (keepAliveAudioRef.current) {
        keepAliveAudioRef.current.pause();
      }
      return;
    }

    const wavUrl = createSilentWavBlobUrl();
    const audio = keepAliveAudioRef.current || new Audio();
    keepAliveAudioRef.current = audio;
    audio.src = wavUrl;
    audio.loop = true;
    audio.volume = 0.001;
    audio.play().catch(() => {});

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: settings.salawatReminderEnabled
            ? 'المؤذن الذهبي ومذكّر الصلاة على النبي ﷺ نشط'
            : 'المؤذن الإلكتروني الذهبي نشط',
          artist: `${location.city} · يعمل في الخلفية`,
          album: 'البرنامج الإسلامي الذهبي',
        });
      } catch {
        // ignore unsupported mediaSession
      }
    }

    let wakeSentinel: {release?: () => Promise<void>} | null = null;
    const navWithWakeLock = navigator as Navigator & {
      wakeLock?: {request: (type: string) => Promise<{release?: () => Promise<void>}>};
    };
    if (navWithWakeLock.wakeLock) {
      navWithWakeLock.wakeLock
        .request('screen')
        .then((s) => {
          wakeSentinel = s;
        })
        .catch(() => {});
    }

    return () => {
      audio.pause();
      URL.revokeObjectURL(wavUrl);
      wakeSentinel?.release?.().catch(() => {});
    };
  }, [
    settings.adhanEnabled,
    settings.salawatReminderEnabled,
    settings.lockScreenKeepAlive,
    location.city,
  ]);

  const showSystemNotification = useCallback(
    (title: string, body: string, tag: string) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      ) {
        return;
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag,
              dir: 'rtl',
              lang: 'ar',
            });
          })
          .catch(() => {
            try {
              new Notification(title, {
                body,
                icon: '/pwa-192x192.png',
                tag,
              });
            } catch {
              // ignore
            }
          });
      } else {
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            tag,
          });
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  const playManagedAudio = useCallback((url: string) => {
    startupDuaAudioRef.current?.pause();
    if (!adhanAudioRef.current) {
      adhanAudioRef.current = new Audio();
      adhanAudioRef.current.preload = 'auto';
    }
    const el = adhanAudioRef.current;
    el.pause();
    el.volume = 1;
    el.muted = false;
    el.onended = null;
    void resolveOfflinePlayableUrl(url).then((playableUrl) => {
      el.src = playableUrl;
      el.load();
      el.play().catch(() => {});
    });
  }, []);

  const playPostPrayerAzkar = useCallback(() => {
    startupDuaAudioRef.current?.pause();
    if (!adhanAudioRef.current) {
      adhanAudioRef.current = new Audio();
    }
    const audio = adhanAudioRef.current;
    let idx = 0;
    const playStep = () => {
      if (idx >= POST_PRAYER_AZKAR_AUDIO_URLS.length) return;
      const stepUrl = POST_PRAYER_AZKAR_AUDIO_URLS[idx];
      void resolveOfflinePlayableUrl(stepUrl).then((playableUrl) => {
        audio.src = playableUrl;
        audio.onended = () => {
          idx += 1;
          playStep();
        };
        audio.play().catch(() => {});
      });
    };
    playStep();
  }, []);

  const isForcedBlackGold =
    settings.darkMode ||
    activeTab === 'prayer' ||
    (activeTab === 'more' &&
      (moreSubPage === 'adhan' || moreSubPage === 'prayer_guide'));

  useEffect(() => {
    const root = document.documentElement;
    if (isForcedBlackGold) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isForcedBlackGold]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Listen to Service Worker background notification clicks & query string triggers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const playAlertUrl = params.get('playAlert');
    const alertTypeParam = params.get('alertType');
    const prayerParam = params.get('prayer');
    const voiceIdParam = params.get('voiceId');
    const openMuezzin = params.get('openMuezzin');
    const tabParam = params.get('tab');
    if (playAlertUrl) {
      const matchedVoice =
        ADHAN_VOICES_30.find((v) => v.id === voiceIdParam) ||
        IQAMAH_VOICES_3.find((v) => v.id === voiceIdParam) ||
        ADHAN_VOICES_30.find((v) => v.url === playAlertUrl);
      if (matchedVoice) {
        const isIqamahMode =
          alertTypeParam === 'iqamah' ||
          IQAMAH_VOICES_3.some((i) => i.id === matchedVoice.id);
        const isDuaMode = alertTypeParam === 'post-adhan-dua';
        setLiveAdhanModal({
          prayerNameAr: prayerParam || 'الصلاة',
          voice: matchedVoice,
          mode: isDuaMode ? 'dua' : isIqamahMode ? 'iqamah' : 'adhan',
        });
      } else {
        setAdhanBanner({
          text: prayerParam
            ? `تنبيه المؤذن الإلكتروني — ${prayerParam}`
            : 'تنبيه المؤذن الإلكتروني — حان وقت الذكر أو الصلاة',
        });
        playManagedAudio(playAlertUrl);
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (openMuezzin) {
      setActiveTab('prayer');
      setMoreSubPage('menu');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (
      tabParam === 'quran' ||
      tabParam === 'prayer' ||
      tabParam === 'azkar' ||
      tabParam === 'qibla' ||
      tabParam === 'settings' ||
      tabParam === 'more'
    ) {
      setActiveTab(tabParam);
      if (tabParam === 'settings') setMoreSubPage('settings');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'MARK_PRAYER_CONFIRMED' && data.dateKey && data.prayerKey) {
        const pKey = data.prayerKey as TrackablePrayer;
        setPrayerLog((prev) => {
          const existingDay = prev[data.dateKey] || {
            fajr: 'none',
            dhuhr: 'none',
            asr: 'none',
            maghrib: 'none',
            isha: 'none',
          };
          return {
            ...prev,
            [data.dateKey]: {
              ...existingDay,
              [pKey]: 'ontime',
            },
          };
        });
        return;
      }

      if (data?.type === 'DISMISSED_PRAYERS_SNAPSHOT' && data.dismissed) {
        const dismissedMap = data.dismissed as Record<string, number>;
        const entries = Object.keys(dismissedMap);
        if (entries.length > 0) {
          setPrayerLog((prev) => {
            let changed = false;
            const next = {...prev};
            for (const composite of entries) {
              const lastDash = composite.lastIndexOf('-');
              if (lastDash <= 0) continue;
              const dKey = composite.slice(0, lastDash);
              const pKey = composite.slice(lastDash + 1) as TrackablePrayer;
              const existingDay = next[dKey] || {
                fajr: 'none',
                dhuhr: 'none',
                asr: 'none',
                maghrib: 'none',
                isha: 'none',
              };
              if (existingDay[pKey] === 'none') {
                next[dKey] = {...existingDay, [pKey]: 'ontime'};
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
        return;
      }

      if (data?.type === 'PLAY_ADHAN_FROM_NOTIFICATION') {
        const matchedVoice =
          ADHAN_VOICES_30.find((v) => v.id === data.voiceId) ||
          IQAMAH_VOICES_3.find((v) => v.id === data.voiceId) ||
          ADHAN_VOICES_30.find((v) => v.url === data.audioUrl);
        if (matchedVoice) {
          const isIqamahMode =
            data.alertType === 'iqamah' ||
            IQAMAH_VOICES_3.some((i) => i.id === matchedVoice.id);
          const isDuaMode = data.alertType === 'post-adhan-dua';
          setLiveAdhanModal({
            prayerNameAr: data.prayerName || data.prayerNameAr || 'الصلاة',
            prayerKey: (data.prayerKey || undefined) as
              | TrackablePrayer
              | undefined,
            voice: matchedVoice,
            mode: isDuaMode ? 'dua' : isIqamahMode ? 'iqamah' : 'adhan',
          });
        } else {
          setAdhanBanner({
            text: data.title || 'الأذان الإلكتروني — حان وقت التنبيه',
          });
          if (data.audioUrl) {
            playManagedAudio(data.audioUrl);
          }
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNow(new Date());
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.active?.postMessage({type: 'CHECK_DUE_ADHAN_ALERTS'});
          })
          .catch(() => {});
      }
    };
    const onFocusOrPageShow = () => {
      setNow(new Date());
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({type: 'CHECK_DUE_ADHAN_ALERTS'});
        })
        .catch(() => {});
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocusOrPageShow);
    window.addEventListener('pageshow', onFocusOrPageShow);
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({type: 'CHECK_DUE_ADHAN_ALERTS'});
      })
      .catch(() => {});
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocusOrPageShow);
      window.removeEventListener('pageshow', onFocusOrPageShow);
    };
  }, [playManagedAudio, setPrayerLog]);

  // Sync Today + Next 30 Days Prayer Times Cache (Cairo + Current Location) + Service Worker Alerts
  const scheduleDateKey = getDateKey(now);
  useEffect(() => {
    precomputeMonthlyPrayerCache(
      location.latitude,
      location.longitude,
      settings.calculationMethod,
      settings.madhab,
      settings.prayerOffsets,
      location.city,
      30,
    );
  }, [
    location.latitude,
    location.longitude,
    location.city,
    settings.calculationMethod,
    settings.madhab,
    settings.prayerOffsets,
    scheduleDateKey,
  ]);

  useEffect(() => {
    if (
      (!settings.adhanEnabled && !settings.salawatReminderEnabled) ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const activePreSound =
      PRE_ADHAN_VOICES_3.find(
        (p) => p.id === settings.preferredPreAdhanSound,
      ) || PRE_ADHAN_VOICES_3[0];
    const activeIqamahVoice =
      IQAMAH_VOICES_3.find((iq) => iq.id === settings.preferredIqamah) ||
      IQAMAH_VOICES_3[0];
    const activeTawasihVoice =
      TAWASIH_NAQSHABANDI.find((t) => t.id === settings.preferredTawasih) ||
      TAWASIH_NAQSHABANDI[0];
    const activeEidVoice =
      EID_TAKBEERAT_VOICES_3.find(
        (e) => e.id === settings.preferredEidTakbeer,
      ) || EID_TAKBEERAT_VOICES_3[0];
    const activeKahfVoice =
      FRIDAY_KAHF_VOICES_3.find((k) => k.id === settings.preferredFridayKahf) ||
      FRIDAY_KAHF_VOICES_3[0];

    const alerts: Array<{
      tag: string;
      title: string;
      body: string;
      prayerName: string;
      voiceId: string;
      timestamp: number;
      audioUrl: string;
      type: string;
      dateKey?: string;
      prayerKey?: string;
    }> = [];

    const nowMs = Date.now();
    // Schedule 30 days (1 full month) ahead in Service Worker so background Adhan keeps working offline all month
    for (let dayOffset = 0; settings.adhanEnabled && dayOffset < 30; dayOffset++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dayKey = getDateKey(targetDate);
      const hijriDay = getHijriParts(targetDate);
      const {schedule} = computeDailyPrayerData(
        location.latitude,
        location.longitude,
        targetDate,
        settings.calculationMethod,
        settings.madhab,
        settings.prayerOffsets,
      );

      for (const item of schedule) {
        if (item.key === 'sunrise') continue;
        const prayerKey = item.key as TrackablePrayer;
        const isPrayerEnabled = settings.enabledPrayers?.[prayerKey] ?? true;
        const voiceId =
          settings.perPrayerAdhan[prayerKey] || settings.preferredAdhan;
        const voice =
          ADHAN_VOICES_30.find((a) => a.id === voiceId) || ADHAN_VOICES_30[0];
        const resolvedAdhanUrl = voice.url || voice.fallbackUrl || '/audio/adhan-makkah.mp3';
        const ts = item.time.getTime();
        const isAlreadyPrayed =
          prayerLog[dayKey]?.[prayerKey] === 'ontime' ||
          prayerLog[dayKey]?.[prayerKey] === 'late';

        if (isPrayerEnabled && ts > nowMs) {
          alerts.push({
            tag: `adhan-${dayKey}-${item.key}`,
            title: `حان الآن أذان ${item.nameAr}`,
            body: `البرنامج الإسلامي الذهبي — ${voice.nameAr}`,
            prayerName: item.nameAr,
            voiceId: voice.id,
            timestamp: ts,
            audioUrl: resolvedAdhanUrl,
            type: 'adhan',
            dateKey: dayKey,
            prayerKey,
          });
        }

        if (isPrayerEnabled && settings.preAdhanMinutes > 0) {
          const preTs = ts - settings.preAdhanMinutes * 60 * 1000;
          if (preTs > nowMs) {
            alerts.push({
              tag: `preadhan-${dayKey}-${item.key}`,
              title: `قربت صلاة ${item.nameAr}`,
              body: `تنبيه: متبقي ${settings.preAdhanMinutes} دقائق على أذان ${item.nameAr}`,
              prayerName: item.nameAr,
              voiceId: activePreSound.id,
              timestamp: preTs,
              audioUrl: activePreSound.url,
              type: 'pre-adhan',
              dateKey: dayKey,
              prayerKey,
            });
          }
        }

        if (isPrayerEnabled && (settings.postAdhanDuaEnabled ?? true)) {
          const duaTs = ts + 135 * 1000;
          if (duaTs > nowMs) {
            alerts.push({
              tag: `dua-${dayKey}-${item.key}`,
              title: `دعاء ما بعد أذان ${item.nameAr}`,
              body: POST_ADHAN_DUA.textAr,
              prayerName: item.nameAr,
              voiceId: voice.id,
              timestamp: duaTs,
              audioUrl: POST_ADHAN_DUA.audioUrl,
              type: 'post-adhan-dua',
              dateKey: dayKey,
              prayerKey,
            });
          }
        }

        // Iqamah strictly 15 minutes after Adhan (per-prayer voice support)
        if (isPrayerEnabled && (settings.iqamahEnabled ?? true)) {
          const iqamahTs = ts + 15 * 60 * 1000;
          const prayerIqamahId =
            settings.perPrayerIqamah?.[prayerKey] || settings.preferredIqamah;
          const prayerIqamahVoice =
            IQAMAH_VOICES_3.find((iq) => iq.id === prayerIqamahId) ||
            activeIqamahVoice;
          if (iqamahTs > nowMs) {
            alerts.push({
              tag: `iqamah-${dayKey}-${item.key}`,
              title: `إقامة صلاة ${item.nameAr} — بعد 15 دقيقة`,
              body: `حان وقت إقامة صلاة ${item.nameAr} (${prayerIqamahVoice.nameAr})`,
              prayerName: item.nameAr,
              voiceId: prayerIqamahVoice.id,
              timestamp: iqamahTs,
              audioUrl: prayerIqamahVoice.url,
              type: 'iqamah',
              dateKey: dayKey,
              prayerKey,
            });
          }
        }

        // Persistent repeating prayer reminder until user taps "صليت ✓" (for next 3 days)
        if (
          dayOffset < 3 &&
          isPrayerEnabled &&
          (settings.prayerConfirmReminderEnabled ?? true) &&
          !isAlreadyPrayed
        ) {
          for (const offsetMin of [20, 25, 30, 35, 40, 45, 50]) {
            const confirmTs = ts + offsetMin * 60 * 1000;
            if (confirmTs > nowMs) {
              alerts.push({
                tag: `prayconfirm-${dayKey}-${item.key}-${offsetMin}`,
                title: `هل صليت ${item.nameAr}؟`,
                body: `وقت صلاة ${item.nameAr} قائم — اضغط «صليت ✓» لإيقاف التذكير`,
                prayerName: item.nameAr,
                voiceId: 'pre-chime',
                timestamp: confirmTs,
                audioUrl: '/audio/pre-chime.mp3',
                type: 'prayconfirm',
                dateKey: dayKey,
                prayerKey,
              });
            }
          }
        }

        if (settings.fajrTawasihEnabled && item.key === 'fajr') {
          const tawasihTs = ts - 20 * 60 * 1000;
          if (tawasihTs > nowMs) {
            alerts.push({
              tag: `tawasih-${dayKey}`,
              title: 'تواشيح وابتهالات الفجر — الشيخ سيد النقشبندي',
              body: `${activeTawasihVoice.titleAr} (${activeTawasihVoice.reciterAr})`,
              prayerName: 'تواشيح الفجر',
              voiceId: activeTawasihVoice.id,
              timestamp: tawasihTs,
              audioUrl: activeTawasihVoice.url,
              type: 'tawasih',
            });
          }
        }

        if (isPrayerEnabled && settings.postPrayerAzkarEnabled) {
          const postAzkarTs = ts + 18 * 60 * 1000;
          if (postAzkarTs > nowMs) {
            alerts.push({
              tag: `azkar-post-${dayKey}-${item.key}`,
              title: `أذكار بعد صلاة ${item.nameAr}`,
              body: 'لا تنسَ أذكار ما بعد الصلاة — البرنامج الإسلامي الذهبي',
              prayerName: `أذكار بعد ${item.nameAr}`,
              voiceId: 'post-prayer-azkar',
              timestamp: postAzkarTs,
              audioUrl: POST_PRAYER_AZKAR_AUDIO_URLS[0],
              type: 'post-prayer-azkar',
            });
          }
        }

        if (item.key === 'fajr') {
          const morningAzkarTs = ts + 25 * 60 * 1000;
          if (morningAzkarTs > nowMs) {
            alerts.push({
              tag: `azkar-morning-${dayKey}`,
              title: 'أذكار الصباح — البرنامج الإسلامي الذهبي',
              body: 'حان وقت أذكار الصباح والأدعية المباركة',
              prayerName: 'أذكار الصباح',
              voiceId: 'pre-istighfar',
              timestamp: morningAzkarTs,
              audioUrl: '/audio/pre-istighfar.mp3',
              type: 'morning-azkar',
            });
          }
        }

        if (item.key === 'asr') {
          const eveningAzkarTs = ts + 25 * 60 * 1000;
          if (eveningAzkarTs > nowMs) {
            alerts.push({
              tag: `azkar-evening-${dayKey}`,
              title: 'أذكار المساء — البرنامج الإسلامي الذهبي',
              body: 'حان وقت أذكار المساء والدعاء والتحصين',
              prayerName: 'أذكار المساء',
              voiceId: 'pre-istighfar',
              timestamp: eveningAzkarTs,
              audioUrl: '/audio/pre-istighfar.mp3',
              type: 'evening-azkar',
            });
          }
        }
      }

      // Qiyam al-Layl (Last Third of the Night)
      if (settings.qiyamEnabled ?? true) {
        const qiyamData = computeQiyamAlLaylTime(
          location.latitude,
          location.longitude,
          targetDate,
          settings.calculationMethod,
          settings.madhab,
          settings.prayerOffsets,
        );
        const qiyamTs = qiyamData.lastThirdStart.getTime();
        if (qiyamTs > nowMs) {
          alerts.push({
            tag: `qiyam-${dayKey}`,
            title: 'قيام الليل — الثلث الأخير من الليل',
            body: 'وقت السحر واستجابة الدعاء — قم وصلِّ ركعتين في جوف الليل',
            prayerName: 'قيام الليل',
            voiceId: activeTawasihVoice.id,
            timestamp: qiyamTs,
            audioUrl: activeTawasihVoice.url,
            type: 'qiyam',
          });
        }
      }

      // Friday Surah Al-Kahf reminder at 09:30 AM
      if (settings.fridayKahfReminder && targetDate.getDay() === 5) {
        const kahfTime = new Date(targetDate);
        kahfTime.setHours(9, 30, 0, 0);
        if (kahfTime.getTime() > nowMs) {
          alerts.push({
            tag: `kahf-${dayKey}`,
            title: 'جمعة مباركة — سورة الكهف',
            body: `تلاوة سورة الكهف (${activeKahfVoice.reciterAr})`,
            prayerName: 'سورة الكهف',
            voiceId: activeKahfVoice.id,
            timestamp: kahfTime.getTime(),
            audioUrl: activeKahfVoice.url,
            type: 'kahf',
          });
        }
      }

      // Eid Takbeerat at 06:30 AM on Eid days
      const isEid =
        (hijriDay.month === 10 && hijriDay.day === 1) ||
        (hijriDay.month === 12 && hijriDay.day >= 10 && hijriDay.day <= 13);
      if (settings.eidTakbeeratEnabled && isEid) {
        const eidTime = new Date(targetDate);
        eidTime.setHours(6, 30, 0, 0);
        if (eidTime.getTime() > nowMs) {
          alerts.push({
            tag: `eid-${dayKey}`,
            title: 'عيدكم مبارك — تكبيرات العيد',
            body: `${activeEidVoice.titleAr} (${activeEidVoice.reciterAr})`,
            prayerName: 'تكبيرات العيد',
            voiceId: activeEidVoice.id,
            timestamp: eidTime.getTime(),
            audioUrl: activeEidVoice.url,
            type: 'eid',
          });
        }
      }
    }

    // Recurring background Salawat reminders (every 10, 30, or 60 minutes)
    if (settings.salawatReminderEnabled) {
      const intervalMin = settings.salawatIntervalMinutes || 10;
      const intervalMs = intervalMin * 60 * 1000;
      const anchorMs = getOrInitSalawatAnchor(intervalMin);
      const firstFutureSlot = Math.max(
        1,
        Math.ceil((nowMs + 3000 - anchorMs) / intervalMs),
      );
      for (let idx = 0; idx < 48; idx++) {
        const slotIndex = firstFutureSlot + idx;
        const slotTs = anchorMs + slotIndex * intervalMs;
        const track =
          SALAWAT_AUDIO_TRACKS[slotIndex % SALAWAT_AUDIO_TRACKS.length];
        alerts.push({
          tag: `salawat-${intervalMin}-${slotIndex}`,
          title: 'صلِّ على النبي ﷺ — تذكير',
          body: `${track.textAr} (${track.reciterAr})`,
          prayerName: 'الصلاة على النبي ﷺ',
          voiceId: track.id,
          timestamp: slotTs,
          audioUrl: track.url,
          type: 'salawat',
        });
      }
    }

    const syncScheduleToSW = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
          type: 'SCHEDULE_ADHAN_ALERTS',
          alerts,
        });

        const regWithSync = reg as ServiceWorkerRegistration & {
          sync?: {register: (tag: string) => Promise<void>};
          periodicSync?: {
            register: (tag: string, opts: {minInterval: number}) => Promise<void>;
          };
        };

        if (regWithSync.sync) {
          try {
            await regWithSync.sync.register('adhan-background-check');
          } catch {
            // ignore unsupported sync errors
          }
        }
        if (regWithSync.periodicSync) {
          try {
            await regWithSync.periodicSync.register('adhan-background-check', {
              minInterval: 15 * 60 * 1000,
            });
          } catch {
            // ignore unsupported periodicSync permission errors
          }
        }
      } catch {
        // ignore SW not ready yet
      }
    };

    void syncScheduleToSW();
    const onControllerChange = () => {
      void syncScheduleToSW();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );
    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
    };
  }, [
    scheduleDateKey,
    location.latitude,
    location.longitude,
    settings.adhanEnabled,
    settings.iqamahEnabled,
    settings.postAdhanDuaEnabled,
    settings.qiyamEnabled,
    settings.enabledPrayers,
    settings.preferredIqamah,
    settings.perPrayerIqamah,
    settings.preferredPreAdhanSound,
    settings.preAdhanMinutes,
    settings.preferredAdhan,
    settings.perPrayerAdhan,
    settings.preferredTawasih,
    settings.preferredEidTakbeer,
    settings.preferredFridayKahf,
    settings.fajrTawasihEnabled,
    settings.postPrayerAzkarEnabled,
    settings.fridayKahfReminder,
    settings.eidTakbeeratEnabled,
    settings.salawatReminderEnabled,
    settings.salawatIntervalMinutes,
    settings.prayerConfirmReminderEnabled,
    prayerLog,
    settings.calculationMethod,
    settings.madhab,
    settings.prayerOffsets,
  ]);

  const dailyPrayerData = useMemo(
    () =>
      computeDailyPrayerData(
        location.latitude,
        location.longitude,
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
        settings.calculationMethod,
        settings.madhab,
        settings.prayerOffsets,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      scheduleDateKey,
      location.latitude,
      location.longitude,
      settings.calculationMethod,
      settings.madhab,
      settings.prayerOffsets,
    ],
  );

  // Real-time Scheduled Adhan & Salawat Trigger Watcher
  useEffect(() => {
    if (!settings.adhanEnabled && !settings.salawatReminderEnabled) return;
    const {schedule} = dailyPrayerData;

    const todayStr = scheduleDateKey;
    const hijri = getHijriParts(now);
    const nowSec = Math.floor(now.getTime() / 1000);

    const activeIqamahVoice =
      IQAMAH_VOICES_3.find((v) => v.id === settings.preferredIqamah) ||
      IQAMAH_VOICES_3[0];
    const activePreAdhanVoice =
      PRE_ADHAN_VOICES_3.find(
        (v) => v.id === settings.preferredPreAdhanSound,
      ) || PRE_ADHAN_VOICES_3[0];
    const activeTawasihVoice =
      TAWASIH_NAQSHABANDI.find((v) => v.id === settings.preferredTawasih) ||
      TAWASIH_NAQSHABANDI[0];
    const activeEidVoice =
      EID_TAKBEERAT_VOICES_3.find(
        (v) => v.id === settings.preferredEidTakbeer,
      ) || EID_TAKBEERAT_VOICES_3[0];
    const activeKahfVoice =
      FRIDAY_KAHF_VOICES_3.find((v) => v.id === settings.preferredFridayKahf) ||
      FRIDAY_KAHF_VOICES_3[0];

    const isDueWithinWindow = (targetSec: number, windowSec = 300) =>
      nowSec >= targetSec && nowSec - targetSec <= windowSec;

    const markAlertHandled = (key: string) => {
      triggeredAlertsRef.current.add(key);
      persistFiredAlert(key);
    };

    for (const item of settings.adhanEnabled ? schedule : []) {
      if (item.key === 'sunrise') continue;
      const prayerKey = item.key as TrackablePrayer;
      const isPrayerEnabled = settings.enabledPrayers?.[prayerKey] ?? true;
      const targetSec = Math.floor(item.time.getTime() / 1000);
      const exactKey = `exact-${todayStr}-${item.key}`;

      if (
        isPrayerEnabled &&
        isDueWithinWindow(targetSec, 300) &&
        !triggeredAlertsRef.current.has(exactKey)
      ) {
        markAlertHandled(exactKey);
        const voiceId =
          settings.perPrayerAdhan[prayerKey] || settings.preferredAdhan;
        const voice =
          ADHAN_VOICES_30.find((a) => a.id === voiceId) || ADHAN_VOICES_30[0];

        showSystemNotification(
          'البرنامج الإسلامي الذهبي — حان وقت الأذان',
          `حان الآن موعد أذان ${item.nameAr} (${voice.nameAr})`,
          exactKey,
        );

        if (
          settings.ramadanCannonEnabled &&
          item.key === 'maghrib' &&
          hijri.month === 9
        ) {
          playRamadanCannonSound();
          window.setTimeout(() => {
            setLiveAdhanModal({
              prayerNameAr: `صلاة ${item.nameAr}`,
              prayerKey,
              voice,
              mode: 'adhan',
            });
          }, 1500);
        } else {
          setLiveAdhanModal({
            prayerNameAr: `صلاة ${item.nameAr}`,
            prayerKey,
            voice,
            mode: 'adhan',
          });
        }
      }

      if (isPrayerEnabled && (settings.postAdhanDuaEnabled ?? true)) {
        const duaSec = targetSec + 135;
        const duaKey = `dua-${todayStr}-${item.key}`;
        if (
          isDueWithinWindow(duaSec, 300) &&
          !triggeredAlertsRef.current.has(duaKey)
        ) {
          markAlertHandled(duaKey);
          const voiceId =
            settings.perPrayerAdhan[prayerKey] || settings.preferredAdhan;
          const voice =
            ADHAN_VOICES_30.find((a) => a.id === voiceId) || ADHAN_VOICES_30[0];
          showSystemNotification(
            `دعاء ما بعد أذان ${item.nameAr}`,
            POST_ADHAN_DUA.textAr,
            duaKey,
          );
          setAdhanBanner({
            text: `دعاء بعد أذان ${item.nameAr}: اللهم رب هذه الدعوة التامة...`,
          });
          setLiveAdhanModal((prev) =>
            prev
              ? prev
              : {
                  prayerNameAr: `صلاة ${item.nameAr}`,
                  prayerKey,
                  voice,
                  mode: 'dua',
                },
          );
        }
      }

      // Iqamah strictly 15 minutes after Adhan (per-prayer voice support)
      if (isPrayerEnabled && (settings.iqamahEnabled ?? true)) {
        const iqamahSec = targetSec + 15 * 60;
        const iqamahKey = `iqamah-${todayStr}-${item.key}`;
        if (
          isDueWithinWindow(iqamahSec, 300) &&
          !triggeredAlertsRef.current.has(iqamahKey)
        ) {
          markAlertHandled(iqamahKey);
          const prayerIqamahId =
            settings.perPrayerIqamah?.[prayerKey] || settings.preferredIqamah;
          const prayerIqamahVoice =
            IQAMAH_VOICES_3.find((v) => v.id === prayerIqamahId) ||
            activeIqamahVoice;
          showSystemNotification(
            `إقامة صلاة ${item.nameAr} — البرنامج الإسلامي الذهبي`,
            `حان وقت إقامة صلاة ${item.nameAr} (${prayerIqamahVoice.nameAr})`,
            iqamahKey,
          );
          setLiveAdhanModal({
            prayerNameAr: `صلاة ${item.nameAr}`,
            prayerKey,
            voice: prayerIqamahVoice,
            mode: 'iqamah',
          });
        }
      }

      if (
        settings.fajrTawasihEnabled &&
        item.key === 'fajr' &&
        isDueWithinWindow(targetSec - 20 * 60, 300)
      ) {
        const tawasihKey = `tawasih-${todayStr}`;
        if (!triggeredAlertsRef.current.has(tawasihKey)) {
          markAlertHandled(tawasihKey);
          setAdhanBanner({
            text: `${activeTawasihVoice.titleAr} — قبل أذان الفجر بـ 20 دقيقة`,
          });
          showSystemNotification(
            'البرنامج الإسلامي الذهبي',
            `${activeTawasihVoice.titleAr} (${activeTawasihVoice.reciterAr})`,
            tawasihKey,
          );
          playManagedAudio(activeTawasihVoice.url);
        }
      }

      if (isPrayerEnabled && settings.preAdhanMinutes > 0) {
        const preTargetSec = targetSec - settings.preAdhanMinutes * 60;
        const preKey = `pre-${todayStr}-${item.key}-${settings.preAdhanMinutes}`;
        if (
          isDueWithinWindow(preTargetSec, 300) &&
          !triggeredAlertsRef.current.has(preKey)
        ) {
          markAlertHandled(preKey);
          setAdhanBanner({
            text: `قربت صلاة ${item.nameAr} — متبقي ${settings.preAdhanMinutes} دقائق على الأذان`,
          });
          showSystemNotification(
            `قربت صلاة ${item.nameAr}`,
            `تنبيه: متبقي ${settings.preAdhanMinutes} دقائق على أذان ${item.nameAr}`,
            preKey,
          );
          playManagedAudio(activePreAdhanVoice.url);
        }
      }

      // Foreground repeating prayer reminder every 5 minutes (from +20m to +90m) until marked "صليت"
      const loggedStatus = prayerLog[todayStr]?.[prayerKey] || 'none';
      const elapsedAfterAdhanMin = Math.floor((nowSec - targetSec) / 60);
      if (
        isPrayerEnabled &&
        (settings.prayerConfirmReminderEnabled ?? true) &&
        loggedStatus === 'none' &&
        elapsedAfterAdhanMin >= 20 &&
        elapsedAfterAdhanMin <= 90
      ) {
        const bucket = Math.floor(elapsedAfterAdhanMin / 5) * 5;
        const confirmKey = `prayconfirm-${todayStr}-${item.key}-${bucket}`;
        if (!triggeredAlertsRef.current.has(confirmKey)) {
          markAlertHandled(confirmKey);
          showSystemNotification(
            `هل صليت ${item.nameAr}؟`,
            `اضغط «صليت ✓» لإيقاف تذكير صلاة ${item.nameAr}`,
            confirmKey,
          );
          playManagedAudio('/audio/pre-chime.mp3');
        }
      }
    }

    if (settings.adhanEnabled && (settings.qiyamEnabled ?? true)) {
      const qiyamData = computeQiyamAlLaylTime(
        location.latitude,
        location.longitude,
        now,
        settings.calculationMethod,
        settings.madhab,
        settings.prayerOffsets,
      );
      const qiyamSec = Math.floor(qiyamData.lastThirdStart.getTime() / 1000);
      const qiyamKey = `qiyam-${todayStr}`;
      if (
        isDueWithinWindow(qiyamSec, 300) &&
        !triggeredAlertsRef.current.has(qiyamKey)
      ) {
        markAlertHandled(qiyamKey);
        showSystemNotification(
          'قيام الليل — الثلث الأخير من الليل',
          'وقت النزول الإلهي واستجابة الدعاء — أقم صلاة القيام الآن',
          qiyamKey,
        );
        setAdhanBanner({
          text: 'بدأ الثلث الأخير من الليل — وقت قيام الليل المبارك',
          actionLabel: 'تشغيل مناجاة الفجر',
          onAction: () => playManagedAudio(activeTawasihVoice.url),
        });
        playManagedAudio(activeTawasihVoice.url);
      }
    }

    const isEidDay =
      (hijri.month === 10 && hijri.day === 1) ||
      (hijri.month === 12 && hijri.day >= 10 && hijri.day <= 13);
    if (settings.adhanEnabled && settings.eidTakbeeratEnabled && isEidDay) {
      const eidKey = `eid-${todayStr}`;
      if (!triggeredAlertsRef.current.has(eidKey)) {
        triggeredAlertsRef.current.add(eidKey);
        setAdhanBanner({
          text: `عيدكم مبارك — ${activeEidVoice.titleAr} (${activeEidVoice.reciterAr})`,
          actionLabel: 'تشغيل تكبيرات العيد',
          onAction: () => playManagedAudio(activeEidVoice.url),
        });
      }
    }

    if (
      settings.adhanEnabled &&
      settings.fridayKahfReminder &&
      now.getDay() === 5 &&
      now.getHours() >= 9
    ) {
      const kahfKey = `kahf-${todayStr}`;
      if (!triggeredAlertsRef.current.has(kahfKey)) {
        triggeredAlertsRef.current.add(kahfKey);
        setAdhanBanner({
          text: `جمعة مباركة — سورة الكهف (${activeKahfVoice.reciterAr})`,
          actionLabel: 'استماع لسورة الكهف',
          onAction: () => playManagedAudio(activeKahfVoice.url),
        });
      }
    }

    if (settings.salawatReminderEnabled) {
      const intervalMin = settings.salawatIntervalMinutes || 10;
      const intervalMs = intervalMin * 60 * 1000;
      const anchorMs = getOrInitSalawatAnchor(intervalMin);
      const elapsedSinceAnchor = now.getTime() - anchorMs;
      if (elapsedSinceAnchor >= intervalMs) {
        const currentSlot = Math.floor(elapsedSinceAnchor / intervalMs);
        const slotSec = Math.floor((anchorMs + currentSlot * intervalMs) / 1000);
        const salawatKey = `salawat-${intervalMin}-${currentSlot}`;
        if (
          isDueWithinWindow(slotSec, 120) &&
          !triggeredAlertsRef.current.has(salawatKey)
        ) {
          markAlertHandled(salawatKey);
          const track =
            SALAWAT_AUDIO_TRACKS[currentSlot % SALAWAT_AUDIO_TRACKS.length];
          showSystemNotification(
            'صلِّ على النبي ﷺ — تذكير',
            `${track.textAr} (${track.reciterAr})`,
            salawatKey,
          );
          setAdhanBanner({
            text: `تذكير: صلِّ على النبي ﷺ · ${track.textAr}`,
            actionLabel: 'استماع للشيخ',
            onAction: () => playManagedAudio(track.url),
          });
          playManagedAudio(track.url);
        }
      }
    }
  }, [
    now,
    scheduleDateKey,
    dailyPrayerData,
    location.latitude,
    location.longitude,
    settings.adhanEnabled,
    settings.iqamahEnabled,
    settings.postAdhanDuaEnabled,
    settings.qiyamEnabled,
    settings.enabledPrayers,
    settings.calculationMethod,
    settings.madhab,
    settings.prayerOffsets,
    settings.preferredIqamah,
    settings.perPrayerIqamah,
    settings.preferredPreAdhanSound,
    settings.preferredTawasih,
    settings.preferredEidTakbeer,
    settings.preferredFridayKahf,
    settings.preAdhanMinutes,
    settings.preferredAdhan,
    settings.perPrayerAdhan,
    settings.ramadanCannonEnabled,
    settings.fajrTawasihEnabled,
    settings.eidTakbeeratEnabled,
    settings.postPrayerAzkarEnabled,
    settings.fridayKahfReminder,
    settings.salawatReminderEnabled,
    settings.salawatIntervalMinutes,
    settings.prayerConfirmReminderEnabled,
    prayerLog,
    playManagedAudio,
    showSystemNotification,
  ]);

  const todayKey = getDateKey(now);
  const todayAzkarCounts = useMemo(
    () => (azkarLog.date === todayKey ? azkarLog.counts : {}),
    [azkarLog, todayKey],
  );

  // Active prayer waiting for "صليت ✓" confirmation
  const activeUnconfirmedPrayer = useMemo(() => {
    if (!settings.adhanEnabled || !(settings.prayerConfirmReminderEnabled ?? true)) {
      return null;
    }
    const nowMs = now.getTime();
    const passed = dailyPrayerData.schedule.filter(
      (item) =>
        item.key !== 'sunrise' &&
        (settings.enabledPrayers?.[item.key as TrackablePrayer] ?? true) &&
        item.time.getTime() <= nowMs &&
        nowMs - item.time.getTime() <= 2 * 60 * 60 * 1000,
    );
    if (passed.length === 0) return null;
    const latest = passed[passed.length - 1];
    const pKey = latest.key as TrackablePrayer;
    const status = prayerLog[todayKey]?.[pKey] || 'none';
    if (status === 'ontime' || status === 'late') return null;
    const elapsedMin = Math.floor((nowMs - latest.time.getTime()) / 60000);
    return {
      key: pKey,
      nameAr: latest.nameAr,
      elapsedMin,
    };
  }, [
    settings.adhanEnabled,
    settings.prayerConfirmReminderEnabled,
    settings.enabledPrayers,
    dailyPrayerData.schedule,
    now,
    prayerLog,
    todayKey,
  ]);

  const confirmPrayerAndStopReminders = useCallback(
    (dKey: string, pKey: TrackablePrayer) => {
      setPrayerLog((prev) => {
        const existingDay = prev[dKey] || {
          fajr: 'none',
          dhuhr: 'none',
          asr: 'none',
          maghrib: 'none',
          isha: 'none',
        };
        return {
          ...prev,
          [dKey]: {
            ...existingDay,
            [pKey]: 'ontime',
          },
        };
      });
      adhanAudioRef.current?.pause();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.active?.postMessage({
              type: 'DISMISS_PRAYER_REMINDER',
              dateKey: dKey,
              prayerKey: pKey,
            });
          })
          .catch(() => {});
      }
    },
    [setPrayerLog],
  );

  const handleActivateAllPermissions = useCallback(async () => {
    unlockAudioEngine();
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const coreAdhanUrls = Array.from(
        new Set([
          ...ADHAN_VOICES_30.slice(0, 6).flatMap((v) => [
            v.url,
            ...(v.fallbackUrl ? [v.fallbackUrl] : []),
          ]),
          ...IQAMAH_VOICES_3.map((i) => i.url),
          ...PRE_ADHAN_VOICES_3.map((p) => p.url),
          POST_ADHAN_DUA.audioUrl,
          ...TAWASIH_NAQSHABANDI.map((t) => t.url),
          ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
          ...SALAWAT_AUDIO_TRACKS.map((s) => s.url),
        ]),
      );
      void cacheBatchUrls(coreAdhanUrls, undefined, 4);
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermState(perm);
        if (perm === 'granted' && 'serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const regWithSync = reg as ServiceWorkerRegistration & {
            sync?: {register: (tag: string) => Promise<void>};
            periodicSync?: {
              register: (tag: string, opts: {minInterval: number}) => Promise<void>;
            };
          };
          reg.active?.postMessage({type: 'CHECK_DUE_ADHAN_ALERTS'});
          if (regWithSync.sync) {
            await regWithSync.sync
              .register('adhan-background-check')
              .catch(() => {});
          }
          if (regWithSync.periodicSync) {
            await regWithSync.periodicSync
              .register('adhan-background-check', {
                minInterval: 15 * 60 * 1000,
              })
              .catch(() => {});
          }
        }
      } catch {
        // ignore notification errors
      }
    }
    if ('geolocation' in navigator) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const {latitude, longitude} = pos.coords;
          const nearest = findNearestCity(latitude, longitude);
          setLocation({
            latitude,
            longitude,
            city: nearest.city,
            country: nearest.country,
            isGps: true,
          });
          if (nearest.country === 'مصر') {
            setSettings((s) => ({...s, calculationMethod: 'Egyptian'}));
          }
          setGpsLoading(false);
        },
        () => {
          setGpsLoading(false);
        },
        {enableHighAccuracy: true, timeout: 10000, maximumAge: 300000},
      );
    }
    setSettings((s) => ({
      ...s,
      adhanEnabled: true,
      backgroundAlertsEnabled: true,
      lockScreenKeepAlive: true,
      postAdhanDuaEnabled: true,
      iqamahEnabled: true,
      prayerConfirmReminderEnabled: true,
      salawatReminderEnabled: true,
      preAdhanMinutes: s.preAdhanMinutes || 10,
    }));
  }, [unlockAudioEngine, setLocation, setSettings]);

  const handleRequestGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('المتصفح لا يدعم تحديد الموقع الجغرافي');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const {latitude, longitude} = pos.coords;
        const nearest = findNearestCity(latitude, longitude);
        setLocation({
          latitude,
          longitude,
          city: nearest.city,
          country: nearest.country,
          isGps: true,
        });
        if (nearest.country === 'مصر') {
          setSettings((s) => ({...s, calculationMethod: 'Egyptian'}));
        }
        setGpsLoading(false);
      },
      () => {
        setGpsError('تعذر الوصول إلى GPS — يمكنك اختيار المدينة يدويًا');
        setGpsLoading(false);
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 300000},
    );
  }, [setLocation, setSettings]);

  const handleToggleBookmark = useCallback(
    (bm: Omit<QuranBookmark, 'id' | 'createdAt'>) => {
      setBookmarks((prev) => {
        const exists = prev.find((item) => item.page === bm.page);
        if (exists) {
          void deleteBookmarkFromCloud(exists.id);
          return prev.filter((item) => item.page !== bm.page);
        }
        const created: QuranBookmark = {
          ...bm,
          id: `bm_${bm.page}_${Date.now()}`,
          createdAt: Date.now(),
        };
        void pushBookmarkToCloud(created);
        return [created, ...prev];
      });
    },
    [setBookmarks, pushBookmarkToCloud, deleteBookmarkFromCloud],
  );

  const handleRemoveBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      void deleteBookmarkFromCloud(id);
    },
    [setBookmarks, deleteBookmarkFromCloud],
  );

  const handleSaveTestResult = useCallback(
    (res: MemorizationTestResult, ayahNumber = 1) => {
      setTestHistory((prev) => [res, ...prev].slice(0, 30));
      void pushTestResultToCloud(res, ayahNumber);
    },
    [setTestHistory, pushTestResultToCloud],
  );

  const handleUpdateLastRead = useCallback(
    (surahNumber: number, ayahNumber: number, page: number) => {
      setLastRead({
        surahNumber,
        ayahNumber,
        page,
        updatedAt: Date.now(),
      });
      void syncReadingPosition(surahNumber, ayahNumber, page);
    },
    [setLastRead, syncReadingPosition],
  );

  // Sync Khatma / Reciter / Adhan to cloud smoothly when changed
  useEffect(() => {
    if (!user?.emailVerified) return;
    const t = window.setTimeout(() => {
      void syncPreferences(
        khatma.completedPages.length,
        settings.preferredReciter,
        settings.preferredAdhan,
      );
    }, 800);
    return () => window.clearTimeout(t);
  }, [
    user,
    khatma.completedPages.length,
    settings.preferredReciter,
    settings.preferredAdhan,
    syncPreferences,
  ]);

  const handleIncrementAzkar = useCallback(
    (id: string, target: number) => {
      setAzkarLog((prev) => {
        const currentCounts = prev.date === todayKey ? prev.counts : {};
        const nextVal = Math.min(target, (currentCounts[id] || 0) + 1);
        return {
          date: todayKey,
          counts: {...currentCounts, [id]: nextVal},
        };
      });
    },
    [setAzkarLog, todayKey],
  );

  const handleResetAzkarCategory = useCallback(
    (catId: AzkarCategoryId) => {
      const cat = AZKAR_CATEGORIES.find((c) => c.id === catId);
      if (!cat) return;
      setAzkarLog((prev) => {
        const currentCounts = prev.date === todayKey ? {...prev.counts} : {};
        for (const item of cat.items) {
          delete currentCounts[item.id];
        }
        return {date: todayKey, counts: currentCounts};
      });
    },
    [setAzkarLog, todayKey],
  );

  const {azkarDoneToday, azkarTotalMorningEvening} = useMemo(() => {
    const mAndE = AZKAR_CATEGORIES.filter(
      (c) => c.id === 'morning' || c.id === 'evening',
    );
    let done = 0;
    let total = 0;
    for (const c of mAndE) {
      for (const item of c.items) {
        total++;
        if ((todayAzkarCounts[item.id] || 0) >= item.count) {
          done++;
        }
      }
    }
    return {azkarDoneToday: done, azkarTotalMorningEvening: total};
  }, [todayAzkarCounts]);

  const handleSetPrayerStatus = useCallback(
    (dateKey: string, prayer: TrackablePrayer, status: PrayerTrackStatus) => {
      setPrayerLog((prev) => {
        const existingDay = prev[dateKey] || {
          fajr: 'none',
          dhuhr: 'none',
          asr: 'none',
          maghrib: 'none',
          isha: 'none',
        };
        return {
          ...prev,
          [dateKey]: {
            ...existingDay,
            [prayer]: status,
          },
        };
      });
    },
    [setPrayerLog],
  );

  const headerNextPrayer = useMemo(() => {
    const nowMs = now.getTime();
    const nextItem = dailyPrayerData.schedule.find(
      (item) => item.time.getTime() > nowMs,
    );
    const targetName = nextItem ? nextItem.nameAr : 'الفجر';
    const targetTime = nextItem
      ? nextItem.time
      : new Date(
          dailyPrayerData.schedule[0].time.getTime() + 24 * 60 * 60 * 1000,
        );
    const remainingMs = Math.max(0, targetTime.getTime() - nowMs);
    return {
      nameAr: targetName,
      timeText: formatTime12(targetTime),
      countdown: formatCountdown(remainingMs),
    };
  }, [dailyPrayerData, now]);

  const handleTabSelect = (tab: TabId) => {
    navigateForward({
      activeTab: tab,
      moreSubPage: tab === 'settings' ? 'settings' : 'menu',
      tag: `tab-${tab}`,
    });
  };

  const handleSelectMoreSubPage = (sub: MoreSubPageId) => {
    if (sub === 'adhan') {
      navigateForward({
        activeTab: 'prayer',
        moreSubPage: 'menu',
        tag: 'tab-prayer',
      });
      return;
    }
    if (sub === 'settings') {
      navigateForward({
        activeTab: 'settings',
        moreSubPage: 'settings',
        tag: 'tab-settings',
      });
      return;
    }
    navigateForward({
      activeTab: 'more',
      moreSubPage: sub,
      tag: `sub-${sub}`,
    });
  };

  const handleOpenQuranFatiha = () => {
    setQuranDirective({type: 'fatiha', key: Date.now()});
    navigateForward({
      activeTab: 'quran',
      moreSubPage: 'menu',
      tag: 'tab-quran-fatiha',
    });
  };

  const handleOpenQuranTest = () => {
    setDirectTestOpen(true);
    void loadOfflineJson<CompactSurah[]>('/data/quran.json')
      .then((loaded) => {
        if (Array.isArray(loaded) && loaded.length > 0) {
          setDirectTestSurahs(loaded);
        }
      })
      .catch(() => {});
  };

  const directTestEntries = useMemo(() => {
    const targetSurah =
      directTestSurahs.find((s) => s.n === lastRead.surahNumber) ||
      directTestSurahs[0];
    if (!targetSurah) return [];
    return targetSurah.ayahs.map((ayah) => ({surah: targetSurah, ayah}));
  }, [directTestSurahs, lastRead.surahNumber]);

  const handleOpenMoreSubPage = (
    sub: MoreSubPageId,
    storyCat?: StoryCategoryId,
  ) => {
    if (sub === 'adhan') {
      navigateForward({
        activeTab: 'prayer',
        moreSubPage: 'menu',
        tag: 'tab-prayer',
      });
      return;
    }
    if (sub === 'settings') {
      navigateForward({
        activeTab: 'settings',
        moreSubPage: 'settings',
        tag: 'tab-settings',
      });
      return;
    }
    navigateForward({
      activeTab: 'more',
      moreSubPage: sub,
      storyCategory: storyCat,
      tag: `sub-${sub}`,
    });
  };

  const showHomePermBanner =
    !permBannerDismissed &&
    (notifPermState === 'default' || !location.isGps || !audioUnlocked);

  return (
    <div className="h-dvh w-full overflow-hidden bg-[#000000]">
      <div
        className={`relative flex h-dvh w-full flex-col overflow-hidden ${
          isForcedBlackGold ? 'bg-[#000000] text-white' : 'bg-white text-slate-900'
        }`}
      >
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

        {/* Native Android Top AppBar (56px) with Live Prayer Time */}
        <header
          className={`z-40 shrink-0 border-b border-[#C9A227]/40 ${
            isForcedBlackGold
              ? 'bg-[#000000]/95 backdrop-blur-md'
              : 'bg-white/95 backdrop-blur-md'
          }`}
        >
          <div className="flex h-[56px] w-full items-center justify-between gap-2 px-3">
            <button
              type="button"
              onClick={() => handleTabSelect('home')}
              className="flex min-h-[44px] min-w-0 items-center gap-2 text-right transition-transform active:scale-[0.98]"
            >
              <img
                src="/pwa-192x192.png"
                alt="البرنامج الإسلامي الذهبي"
                className="h-9 w-9 shrink-0 rounded-xl border border-[#C9A227] object-cover"
              />
              <div className="min-w-0">
                <span className="font-quran block truncate text-[15px] font-bold leading-tight text-[#9A7415] dark:text-[#F3D56B]">
                  الذهبي الإسلامي
                </span>
                <span className="block truncate text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                  {location.city}
                </span>
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTabSelect('prayer')}
                aria-label={`الصلاة القادمة ${headerNextPrayer.nameAr}`}
                className="flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-[#C9A227]/65 bg-[#120D03] px-2.5 py-1 text-right text-white transition active:scale-[0.97]"
              >
                <BellRing className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" />
                <div className="leading-tight">
                  <span className="block text-[10px] font-extrabold text-[#FCE38A]">
                    {headerNextPrayer.nameAr} · {headerNextPrayer.timeText}
                  </span>
                  <span
                    dir="ltr"
                    className="font-mono-num block text-[10px] font-bold text-zinc-300"
                  >
                    باقي {headerNextPrayer.countdown}
                  </span>
                </div>
              </button>

              <PWAInstallButton compact />

              <button
                type="button"
                onClick={() =>
                  setSettings((s) => ({...s, darkMode: !s.darkMode}))
                }
                aria-label={
                  settings.darkMode
                    ? 'تغيير الخلفية إلى البيضاء'
                    : 'تغيير الخلفية إلى السوداء'
                }
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl border border-[#C9A227]/65 bg-black/40 text-[#C9A227] transition active:scale-[0.95]"
              >
                {settings.darkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Active Prayer Confirmation / Adhan Alert / Download Progress Strip */}
        {(activeUnconfirmedPrayer ||
          adhanBanner ||
          offlineDl.status === 'downloading' ||
          offlineDl.status === 'paused' ||
          (offlineDl.status === 'completed' && offlineDoneBannerVisible)) && (
          <div className="shrink-0 space-y-2 border-b border-[#C9A227]/25 px-3 py-2">
            {activeUnconfirmedPrayer && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#FCE38A] bg-gradient-to-l from-[#1C1404] via-[#120D02] to-[#080601] px-3 py-2 text-white">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#FCE38A]">
                    <BellRing className="h-4 w-4 shrink-0 text-[#FCE38A]" />
                    <span>هل صليت {activeUnconfirmedPrayer.nameAr}؟</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-300">
                    {activeUnconfirmedPrayer.elapsedMin > 0
                      ? `مرّ ${activeUnconfirmedPrayer.elapsedMin} دقيقة — اضغط صليت لإيقاف التذكير`
                      : 'حان وقت الصلاة — اضغط صليت عند الانتهاء'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    confirmPrayerAndStopReminders(
                      todayKey,
                      activeUnconfirmedPrayer.key,
                    )
                  }
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-gradient-to-b from-[#FCE38A] to-[#C9A227] px-3.5 text-xs font-extrabold text-black active:scale-95"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>صليت ✓</span>
                </button>
              </div>
            )}

            {adhanBanner && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A227] bg-[#0D0A02] px-3 py-2 text-white">
                <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[#F3D56B]">
                  <BellRing className="h-4 w-4 shrink-0 text-[#C9A227]" />
                  <span className="truncate">{adhanBanner.text}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {adhanBanner.actionLabel && adhanBanner.onAction && (
                    <button
                      type="button"
                      onClick={adhanBanner.onAction}
                      className="min-h-[36px] rounded-xl bg-[#C9A227] px-2.5 py-1 text-[11px] font-bold text-black"
                    >
                      {adhanBanner.actionLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      adhanAudioRef.current?.pause();
                      setAdhanBanner(null);
                    }}
                    aria-label="إغلاق تنبيه الأذان"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/60 text-[#F3D56B]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {(offlineDl.status === 'downloading' ||
              offlineDl.status === 'paused' ||
              (offlineDl.status === 'completed' &&
                offlineDoneBannerVisible)) && (
              <div className="space-y-2 rounded-2xl border-2 border-[#C9A227] bg-[#0B0902] p-2.5 text-white shadow-[0_6px_22px_rgba(201,162,39,0.22)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Download className="mt-0.5 h-4 w-4 shrink-0 text-[#FCE38A]" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-extrabold text-[#FCE38A]">
                        {offlineDl.status === 'completed'
                          ? 'تم تحميل المحتوى بالكامل ✓'
                          : offlineDl.status === 'paused'
                            ? `التحميل متوقف — باقي ${offlineDl.remainingMb} ميجا`
                            : offlineDl.mode === 'updating'
                              ? 'جاري تحميل تحديث المحتوى تلقائيًا...'
                              : 'جاري تحميل المحتوى المختار للعمل بدون نت'}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-300">
                        {offlineDl.status === 'completed'
                          ? `تم تحميل ${offlineDl.totalMb} ميجا من ${offlineDl.totalMb} ميجا — باقي 0 ميجا — 100%`
                          : offlineDl.status === 'paused' &&
                              offlineDl.pauseReason === 'offline'
                            ? `تم تحميل ${offlineDl.downloadedMb} من ${offlineDl.totalMb} ميجا (${offlineDl.percent}%) — سيكمل تلقائيًا فور عودة النت`
                            : `تم تحميل ${offlineDl.downloadedMb} من ${offlineDl.totalMb} ميجا — باقي ${offlineDl.remainingMb} ميجا — ${offlineDl.percent}%`}
                      </p>
                    </div>
                  </div>
                  {offlineDl.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => setOfflineDoneBannerVisible(false)}
                      aria-label="إغلاق إشعار اكتمال التحميل"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#C9A227]/60 text-[#FCE38A]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full border border-[#C9A227]/45 bg-black">
                    <div
                      className="h-full bg-gradient-to-l from-[#FCE38A] to-[#C9A227] transition-all duration-300"
                      style={{
                        width: `${offlineDl.status === 'completed' ? 100 : Math.max(3, offlineDl.percent)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono-num shrink-0 text-[11px] font-extrabold text-[#FCE38A]">
                    {offlineDl.status === 'completed' ? 100 : offlineDl.percent}%
                  </span>
                </div>

                {(offlineDl.status === 'downloading' ||
                  offlineDl.status === 'paused') && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={offlineDl.status !== 'downloading'}
                      onClick={() => void pauseFullOfflineBackgroundDownload()}
                      className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl border px-3 text-[11px] font-extrabold ${
                        offlineDl.status === 'downloading'
                          ? 'border-[#C9A227] bg-black text-[#FCE38A]'
                          : 'border-zinc-700 bg-black/50 text-zinc-500'
                      }`}
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>إيقاف مؤقت</span>
                    </button>
                    <button
                      type="button"
                      disabled={offlineDl.status !== 'paused'}
                      onClick={() =>
                        void resumeFullOfflineBackgroundDownload(
                          settings.preferredReciter,
                        )
                      }
                      className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl px-3 text-[11px] font-extrabold ${
                        offlineDl.status === 'paused'
                          ? 'bg-[#C9A227] text-black'
                          : 'border border-zinc-700 bg-black/50 text-zinc-500'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>استئناف</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelFullOfflineBackgroundDownload()}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-red-500/60 bg-red-950/30 px-3 text-[11px] font-bold text-red-200"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>إلغاء</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Native Mobile Vertical Scroll Body (TikTok/WhatsApp-like smooth vertical feed) */}
        <main
          id="app-main-scroll"
          ref={mainScrollRef}
          className="no-scrollbar w-full flex-1 overflow-y-auto overscroll-y-contain px-3 pt-2.5 pb-6"
        >
          {activeTab === 'home' && (
            <HomeView
              now={now}
              location={location}
              onSelectLocation={setLocation}
              onRequestGps={handleRequestGps}
              gpsLoading={gpsLoading}
              gpsError={gpsError}
              settings={settings}
              khatma={khatma}
              azkarDoneToday={azkarDoneToday}
              azkarTotalMorningEvening={azkarTotalMorningEvening}
              onNavigateTab={handleTabSelect}
              onOpenQuranFatiha={handleOpenQuranFatiha}
              onOpenQuranTest={handleOpenQuranTest}
              onOpenMoreSubPage={handleOpenMoreSubPage}
              showPermBanner={showHomePermBanner}
              notifPermGranted={notifPermState === 'granted'}
              onActivateAllPermissions={handleActivateAllPermissions}
              onDismissPermBanner={() => setPermBannerDismissed(true)}
            />
          )}

          {activeTab === 'quran' && (
            <QuranView
              bookmarks={bookmarks}
              onToggleBookmark={handleToggleBookmark}
              onRemoveBookmark={handleRemoveBookmark}
              khatma={khatma}
              onUpdateKhatma={setKhatma}
              fontSize={settings.quranFontSize}
              onChangeFontSize={(size) =>
                setSettings((s) => ({...s, quranFontSize: size}))
              }
              preferredReciter={settings.preferredReciter}
              onChangePreferredReciter={(id: ReciterId) =>
                setSettings((s) => ({...s, preferredReciter: id}))
              }
              testHistory={testHistory}
              onSaveTestResult={handleSaveTestResult}
              lastRead={lastRead}
              onUpdateLastRead={handleUpdateLastRead}
              launchDirective={quranDirective}
              onConsumeLaunchDirective={() => setQuranDirective(null)}
            />
          )}

          {activeTab === 'prayer' && (
            <AdhanMuezzinView
              now={now}
              location={location}
              onSelectLocation={setLocation}
              onRequestGps={handleRequestGps}
              gpsLoading={gpsLoading}
              settings={settings}
              onUpdateSettings={setSettings}
              onActivateAdhanEngine={handleActivateAllPermissions}
            />
          )}

          {activeTab === 'azkar' && (
            <AzkarView
              counts={todayAzkarCounts}
              onIncrement={handleIncrementAzkar}
              onResetCategory={handleResetAzkarCategory}
            />
          )}

          {activeTab === 'qibla' && (
            <QiblaView
              location={location}
              onRequestGps={handleRequestGps}
              gpsLoading={gpsLoading}
            />
          )}

          {(activeTab === 'settings' || activeTab === 'more') && (
            <MoreView
              subPage={
                activeTab === 'settings' && moreSubPage === 'menu'
                  ? 'settings'
                  : moreSubPage
              }
              onSelectSubPage={handleSelectMoreSubPage}
              onBack={() => {
                navigateBackFromStack(false);
              }}
              storyCategory={storyCategory}
              now={now}
              location={location}
              onSelectLocation={setLocation}
              onRequestGps={handleRequestGps}
              gpsLoading={gpsLoading}
              settings={settings}
              onUpdateSettings={setSettings}
              prayerLog={prayerLog}
              onSetPrayerStatus={handleSetPrayerStatus}
              onActivateAdhanEngine={handleActivateAllPermissions}
            />
          )}
        </main>

        {/* Native Android Bottom Navigation Bar (390px APK Tab Bar) */}
        <nav
          aria-label="شريط التنقل السفلي"
          className={`pb-safe z-40 shrink-0 border-t border-[#C9A227]/45 ${
            isForcedBlackGold
              ? 'bg-[#000000]/95 backdrop-blur-md'
              : 'bg-white/95 backdrop-blur-md'
          }`}
        >
          <div className="grid h-[60px] grid-cols-6 items-center px-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeTab === item.id ||
                (activeTab === 'more' &&
                  ((moreSubPage === 'adhan' && item.id === 'prayer') ||
                    (moreSubPage !== 'adhan' && item.id === 'settings')));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabSelect(item.id)}
                  className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-2xl transition-all active:scale-95 ${
                    isActive
                      ? 'text-[#C9A227]'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <span
                    className={`flex h-7 w-10 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-[#C9A227]/18' : ''
                    }`}
                  >
                    <Icon
                      className={`h-[19px] w-[19px] ${
                        isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'
                      }`}
                    />
                  </span>
                  <span className="whitespace-nowrap text-[10px] font-bold leading-none">
                    {item.labelAr}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {liveAdhanModal && (
          <AdhanLiveModal
            prayerNameAr={liveAdhanModal.prayerNameAr}
            voice={liveAdhanModal.voice}
            cityAr={location.city}
            countryAr={location.country}
            now={now}
            schedule={dailyPrayerData.schedule}
            mode={liveAdhanModal.mode || 'adhan'}
            postAdhanDuaEnabled={settings.postAdhanDuaEnabled ?? true}
            onConfirmPrayed={
              liveAdhanModal.prayerKey
                ? () =>
                    confirmPrayerAndStopReminders(
                      todayKey,
                      liveAdhanModal.prayerKey!,
                    )
                : undefined
            }
            isPrayerConfirmed={
              liveAdhanModal.prayerKey
                ? prayerLog[todayKey]?.[liveAdhanModal.prayerKey] ===
                    'ontime' ||
                  prayerLog[todayKey]?.[liveAdhanModal.prayerKey] === 'late'
                : false
            }
            onClose={() => setLiveAdhanModal(null)}
            onPlayPostAzkar={
              settings.postPrayerAzkarEnabled ? playPostPrayerAzkar : undefined
            }
          />
        )}

        {directTestOpen && directTestEntries.length > 0 && (
          <QuranTestModal
            entries={directTestEntries}
            allSurahs={directTestSurahs}
            initialSurahNumber={lastRead.surahNumber || 1}
            initialAyahNumber={lastRead.ayahNumber || 1}
            currentPage={lastRead.page || khatma.currentPage || 1}
            lastRead={lastRead}
            onUpdateLastRead={handleUpdateLastRead}
            history={testHistory}
            preferredReciter={settings.preferredReciter}
            onSaveResult={handleSaveTestResult}
            onClose={() => setDirectTestOpen(false)}
          />
        )}

        <OfflineIndicator />
      </div>
    </div>
  );
}

export default function App() {
  const [rawSettings, setSettings] = useLocalStorage<AppSettings>(
    'ana_muslim_settings_v2',
    DEFAULT_SETTINGS,
  );
  const settings: AppSettings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      preferredTawasih:
        rawSettings?.preferredTawasih === 'tawasih-housaini'
          ? 'tawasih-naqshabandi-1'
          : rawSettings?.preferredTawasih || DEFAULT_SETTINGS.preferredTawasih,
      postAdhanDuaEnabled: rawSettings?.postAdhanDuaEnabled ?? true,
      qiyamEnabled: rawSettings?.qiyamEnabled ?? true,
      prayerConfirmReminderEnabled:
        rawSettings?.prayerConfirmReminderEnabled ?? true,
      salawatReminderEnabled: rawSettings?.salawatReminderEnabled ?? true,
      salawatIntervalMinutes: rawSettings?.salawatIntervalMinutes || 10,
      prayerOffsets: {
        ...DEFAULT_PRAYER_OFFSETS,
        ...(rawSettings?.prayerOffsets || {}),
      },
      perPrayerAdhan: {
        ...DEFAULT_SETTINGS.perPrayerAdhan,
        ...(rawSettings?.perPrayerAdhan || {}),
      },
      perPrayerIqamah: {
        ...DEFAULT_SETTINGS.perPrayerIqamah!,
        ...(rawSettings?.perPrayerIqamah || {}),
      },
      enabledPrayers: {
        ...DEFAULT_SETTINGS.enabledPrayers,
        ...(rawSettings?.enabledPrayers || {}),
      },
    }),
    [rawSettings],
  );

  const [khatma, setKhatma] = useLocalStorage<KhatmaPlan>('ana_muslim_khatma', {
    targetDays: 30,
    startDate: getDateKey(new Date()),
    currentPage: 1,
    completedPages: [],
  });

  return (
    <FirebaseProvider
      initialReciter={settings.preferredReciter}
      initialAdhan={settings.preferredAdhan}
      initialKhatmaCount={khatma.completedPages.length}
    >
      <AppContent
        settings={settings}
        setSettings={setSettings}
        khatma={khatma}
        setKhatma={setKhatma}
      />
    </FirebaseProvider>
  );
}
