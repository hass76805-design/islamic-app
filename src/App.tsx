import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BellRing,
  BookOpen,
  Compass,
  HeartHandshake,
  Home,
  LayoutGrid,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import {AdhanLiveModal} from './components/AdhanLiveModal';
import {AzkarView} from './components/AzkarView';
import {HomeView} from './components/HomeView';
import {MoreView} from './components/MoreView';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PWAInstallButton} from './components/PWAInstallButton';
import {QiblaView} from './components/QiblaView';
import {QuranLaunchDirective, QuranView} from './components/QuranView';
import {SplashScreen} from './components/SplashScreen';
import {FirebaseProvider, useFirebase} from './contexts/FirebaseContext';
import {AZKAR_CATEGORIES} from './data/azkar';
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
  TAWASIH_NAQSHABANDI,
} from './data/reciters';
import {useLocalStorage} from './hooks/useLocalStorage';
import {
  AdhanVoice,
  AppSettings,
  AzkarCategoryId,
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
import {pushNavigationState, setRootBackHandler} from './utils/backNavigation';
import {getDateKey, getHijriParts} from './utils/hijri';
import {
  cacheBatchUrls,
  prewarmCoreOfflineTextData,
} from './utils/offlineAudioCache';
import {
  computeDailyPrayerData,
  computeQiyamAlLaylTime,
  DEFAULT_PRAYER_OFFSETS,
} from './utils/prayerTimes';
import {playRamadanCannonSound} from './utils/ramadanCannon';

const FIRED_ALERTS_STORAGE_KEY = 'alzahabi_fired_alerts_v1';

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

const DEFAULT_SETTINGS: AppSettings = {
  calculationMethod: 'UmmAlQura',
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
  iqamahEnabled: true,
  postAdhanDuaEnabled: true,
  qiyamEnabled: true,
  preferredPreAdhanSound: 'pre-chime',
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
  lockScreenKeepAlive: false,
};

const NAV_ITEMS: Array<{id: TabId; labelAr: string; icon: typeof Home}> = [
  {id: 'home', labelAr: 'الرئيسية', icon: Home},
  {id: 'quran', labelAr: 'القرآن', icon: BookOpen},
  {id: 'azkar', labelAr: 'الأذكار', icon: HeartHandshake},
  {id: 'qibla', labelAr: 'القبلة', icon: Compass},
  {id: 'more', labelAr: 'المزيد', icon: LayoutGrid},
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

  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [moreSubPage, setMoreSubPage] = useState<MoreSubPageId>('menu');
  const [storyCategory, setStoryCategory] =
    useState<StoryCategoryId>('prophets');
  const [quranDirective, setQuranDirective] =
    useState<QuranLaunchDirective | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const [location, setLocation] = useLocalStorage<UserLocation>(
    'ana_muslim_location',
    PRESET_CITIES[0],
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

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
    voice: AdhanVoice;
    mode?: 'adhan' | 'iqamah' | 'dua';
  } | null>(null);
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const triggeredAlertsRef = useRef<Set<string>>(readPersistedFiredAlerts());
  const navStateRef = useRef<{activeTab: TabId; moreSubPage: MoreSubPageId}>({
    activeTab: 'home',
    moreSubPage: 'menu',
  });
  navStateRef.current = {activeTab, moreSubPage};

  useEffect(() => {
    setRootBackHandler(() => {
      const {activeTab: tab, moreSubPage: sub} = navStateRef.current;
      if (tab === 'more' && sub !== 'menu') {
        setMoreSubPage('menu');
        return true;
      }
      if (tab !== 'home') {
        setActiveTab('home');
        setMoreSubPage('menu');
        return true;
      }
      return false;
    });
    return () => setRootBackHandler(null);
  }, []);

  // Silently auto-detect GPS on startup to calibrate prayer times & Qibla (falls back silently to last saved location when offline)
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
      },
      () => {
        // Keep last saved ana_muslim_location silently without showing any blocking error
      },
      {enableHighAccuracy: false, timeout: 6000, maximumAge: 600000},
    );
  }, [setLocation]);

  // Automatically pre-warm all core offline Quran/Tafsir text + local Adhan/Naqshabandi audio immediately when online
  const corePrewarmedRef = useRef(false);
  useEffect(() => {
    if (corePrewarmedRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    corePrewarmedRef.current = true;
    const t = window.setTimeout(() => {
      void prewarmCoreOfflineTextData();
    }, 450);
    return () => window.clearTimeout(t);
  }, []);

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

  // Optional Lock-Screen Electronic Muezzin Keep-Alive (silent WAV + MediaSession + WakeLock)
  useEffect(() => {
    if (
      !settings.adhanEnabled ||
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
          title: 'المؤذن الإلكتروني الذهبي نشط',
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
  }, [settings.adhanEnabled, settings.lockScreenKeepAlive, location.city]);

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
    if (!adhanAudioRef.current) {
      adhanAudioRef.current = new Audio();
    }
    adhanAudioRef.current.src = url;
    adhanAudioRef.current.onended = null;
    adhanAudioRef.current.play().catch(() => {});
  }, []);

  const playPostPrayerAzkar = useCallback(() => {
    if (!adhanAudioRef.current) {
      adhanAudioRef.current = new Audio();
    }
    const audio = adhanAudioRef.current;
    let idx = 0;
    const playStep = () => {
      if (idx >= POST_PRAYER_AZKAR_AUDIO_URLS.length) return;
      audio.src = POST_PRAYER_AZKAR_AUDIO_URLS[idx];
      audio.onended = () => {
        idx += 1;
        playStep();
      };
      audio.play().catch(() => {});
    };
    playStep();
  }, []);

  const isForcedBlackGold =
    settings.darkMode ||
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
      setMoreSubPage('adhan');
      setActiveTab('more');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (
      tabParam === 'quran' ||
      tabParam === 'azkar' ||
      tabParam === 'qibla' ||
      tabParam === 'more'
    ) {
      setActiveTab(tabParam);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data;
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
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocusOrPageShow);
      window.removeEventListener('pageshow', onFocusOrPageShow);
    };
  }, [playManagedAudio]);

  // Sync Today + Tomorrow Adhan, Pre-Adhan, Iqamah, Tawasih, Azkar, Kahf & Eid alerts to Service Worker + Background Sync
  const scheduleDateKey = getDateKey(now);
  useEffect(() => {
    if (
      !settings.adhanEnabled ||
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
    }> = [];

    const nowMs = Date.now();
    // Schedule 7 days ahead in Service Worker so background Adhan keeps working even without reopening daily
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
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
        const resolvedAdhanUrl = voice.fallbackUrl || voice.url;
        const ts = item.time.getTime();

        if (isPrayerEnabled && ts > nowMs) {
          alerts.push({
            tag: `adhan-${dayKey}-${item.key}`,
            title: 'البرنامج الإسلامي الذهبي',
            body: `حان الآن موعد أذان ${item.nameAr} (${voice.nameAr})`,
            prayerName: item.nameAr,
            voiceId: voice.id,
            timestamp: ts,
            audioUrl: resolvedAdhanUrl,
            type: 'adhan',
          });
        }

        if (isPrayerEnabled && settings.preAdhanMinutes > 0) {
          const preTs = ts - settings.preAdhanMinutes * 60 * 1000;
          if (preTs > nowMs) {
            alerts.push({
              tag: `preadhan-${dayKey}-${item.key}`,
              title: 'تنبيه اقتراب الصلاة — البرنامج الإسلامي الذهبي',
              body: `متبقي ${settings.preAdhanMinutes} دقائق على أذان ${item.nameAr}`,
              prayerName: item.nameAr,
              voiceId: activePreSound.id,
              timestamp: preTs,
              audioUrl: activePreSound.url,
              type: 'pre-adhan',
            });
          }
        }

        if (isPrayerEnabled && (settings.postAdhanDuaEnabled ?? true)) {
          const duaTs = ts + 150 * 1000;
          if (duaTs > nowMs) {
            alerts.push({
              tag: `dua-${dayKey}-${item.key}`,
              title: `دعاء ما بعد أذان ${item.nameAr}`,
              body: POST_ADHAN_DUA.textAr,
              prayerName: item.nameAr,
              voiceId: voice.id,
              timestamp: duaTs,
              audioUrl: resolvedAdhanUrl,
              type: 'post-adhan-dua',
            });
          }
        }

        if (isPrayerEnabled && (settings.iqamahEnabled ?? true)) {
          const iqamahTs = ts + 12 * 60 * 1000;
          if (iqamahTs > nowMs) {
            alerts.push({
              tag: `iqamah-${dayKey}-${item.key}`,
              title: `إقامة صلاة ${item.nameAr} — البرنامج الإسلامي الذهبي`,
              body: `حان وقت إقامة صلاة ${item.nameAr} (${activeIqamahVoice.nameAr})`,
              prayerName: item.nameAr,
              voiceId: activeIqamahVoice.id,
              timestamp: iqamahTs,
              audioUrl: activeIqamahVoice.url,
              type: 'iqamah',
            });
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

  // Real-time Scheduled Adhan & Electronic Muezzin Trigger Watcher
  useEffect(() => {
    if (!settings.adhanEnabled) return;
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

    for (const item of schedule) {
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
              voice,
              mode: 'adhan',
            });
          }, 1500);
        } else {
          setLiveAdhanModal({
            prayerNameAr: `صلاة ${item.nameAr}`,
            voice,
            mode: 'adhan',
          });
        }
      }

      if (isPrayerEnabled && (settings.postAdhanDuaEnabled ?? true)) {
        const duaSec = targetSec + 150;
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
                  voice,
                  mode: 'dua',
                },
          );
        }
      }

      if (isPrayerEnabled && (settings.iqamahEnabled ?? true)) {
        const iqamahSec = targetSec + 12 * 60;
        const iqamahKey = `iqamah-${todayStr}-${item.key}`;
        if (
          isDueWithinWindow(iqamahSec, 300) &&
          !triggeredAlertsRef.current.has(iqamahKey)
        ) {
          markAlertHandled(iqamahKey);
          showSystemNotification(
            'البرنامج الإسلامي الذهبي — إقامة الصلاة',
            `حان وقت إقامة صلاة ${item.nameAr} (${activeIqamahVoice.nameAr})`,
            iqamahKey,
          );
          setLiveAdhanModal({
            prayerNameAr: `صلاة ${item.nameAr}`,
            voice: activeIqamahVoice,
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
            text: `تنبيه: متبقي ${settings.preAdhanMinutes} دقائق على أذان ${item.nameAr}`,
          });
          showSystemNotification(
            'تنبيه اقتراب الصلاة — البرنامج الإسلامي الذهبي',
            `متبقي ${settings.preAdhanMinutes} دقائق على أذان ${item.nameAr}`,
            preKey,
          );
          playManagedAudio(activePreAdhanVoice.url);
        }
      }
    }

    if (settings.qiyamEnabled ?? true) {
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
    if (settings.eidTakbeeratEnabled && isEidDay) {
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
    playManagedAudio,
    showSystemNotification,
  ]);

  const todayKey = getDateKey(now);
  const todayAzkarCounts = useMemo(
    () => (azkarLog.date === todayKey ? azkarLog.counts : {}),
    [azkarLog, todayKey],
  );

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
        setGpsLoading(false);
      },
      () => {
        setGpsError('تعذر الوصول إلى GPS — يمكنك اختيار المدينة يدويًا');
        setGpsLoading(false);
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 300000},
    );
  }, [setLocation]);

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

  const handleTabSelect = (tab: TabId) => {
    if (tab !== 'home' && tab !== activeTab) {
      pushNavigationState(`tab-${tab}`);
    }
    setActiveTab(tab);
    if (tab !== 'more') {
      setMoreSubPage('menu');
    }
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  const handleSelectMoreSubPage = (sub: MoreSubPageId) => {
    if (sub !== 'menu' && moreSubPage === 'menu') {
      pushNavigationState(`sub-${sub}`);
    }
    setMoreSubPage(sub);
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  const handleOpenQuranFatiha = () => {
    if (activeTab !== 'quran') {
      pushNavigationState('tab-quran-fatiha');
    }
    setQuranDirective({type: 'fatiha', key: Date.now()});
    setActiveTab('quran');
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  const handleOpenQuranTest = () => {
    if (activeTab !== 'quran') {
      pushNavigationState('tab-quran-test');
    }
    setQuranDirective({type: 'test', key: Date.now()});
    setActiveTab('quran');
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  const handleOpenMoreSubPage = (
    sub: MoreSubPageId,
    storyCat?: StoryCategoryId,
  ) => {
    if (storyCat) setStoryCategory(storyCat);
    pushNavigationState(`sub-${sub}`);
    setMoreSubPage(sub);
    setActiveTab('more');
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  return (
    <div className="min-h-dvh w-full bg-[#000000]">
      <div
        className={`relative mx-auto flex min-h-dvh w-full max-w-[400px] flex-col overflow-x-clip border-x border-[#C9A227]/35 ${
          isForcedBlackGold ? 'bg-[#000000] text-white' : 'bg-white text-slate-900'
        }`}
      >
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

        {/* Fixed Calm 400px Mobile Top Header */}
        <header
          className={`sticky top-0 z-40 border-b border-[#C9A227]/45 ${
            isForcedBlackGold ? 'bg-[#000000]' : 'bg-white'
          }`}
        >
          <div className="flex h-[54px] w-full items-center justify-between gap-2 px-3">
            <button
              type="button"
              onClick={() => handleTabSelect('home')}
              className="flex min-w-0 items-center gap-2"
            >
              <img
                src="/pwa-192x192.png"
                alt="البرنامج الإسلامي الذهبي"
                className="h-8 w-8 shrink-0 rounded-xl border border-[#C9A227] object-cover"
              />
              <span className="font-quran truncate text-base font-bold text-[#9A7415] dark:text-[#F3D56B]">
                البرنامج الإسلامي الذهبي
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
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
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227] bg-black/40 text-[#C9A227]"
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

        {/* Non-blocking Reminder Banner */}
        {adhanBanner && (
          <div className="w-full px-3 pt-2.5">
            <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A227] bg-[#0D0A02] px-3 py-2.5 text-white">
              <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[#F3D56B]">
                <BellRing className="h-4 w-4 shrink-0 text-[#C9A227]" />
                <span className="truncate">{adhanBanner.text}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {adhanBanner.actionLabel && adhanBanner.onAction && (
                  <button
                    type="button"
                    onClick={adhanBanner.onAction}
                    className="min-h-[32px] rounded-xl bg-[#C9A227] px-2.5 py-1 text-[11px] font-bold text-black"
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
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/60 text-[#F3D56B]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="w-full flex-1 px-3 pt-3 pb-24">
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

          {activeTab === 'more' && (
            <MoreView
              subPage={moreSubPage}
              onSelectSubPage={handleSelectMoreSubPage}
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
            />
          )}
        </main>

        {/* Fixed 400px Bottom Mobile Navigation */}
        <nav
          aria-label="شريط التنقل السفلي"
          className={`pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[400px] -translate-x-1/2 border-t border-[#C9A227]/45 ${
            isForcedBlackGold ? 'bg-[#000000]' : 'bg-white'
          }`}
        >
          <div className="grid h-[58px] grid-cols-5 items-center">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabSelect(item.id)}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                    isActive
                      ? 'text-[#C9A227]'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                  />
                  <span className="whitespace-nowrap text-[10px] font-bold">
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
            onClose={() => setLiveAdhanModal(null)}
            onPlayPostAzkar={
              settings.postPrayerAzkarEnabled ? playPostPrayerAzkar : undefined
            }
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
      prayerOffsets: {
        ...DEFAULT_PRAYER_OFFSETS,
        ...(rawSettings?.prayerOffsets || {}),
      },
      perPrayerAdhan: {
        ...DEFAULT_SETTINGS.perPrayerAdhan,
        ...(rawSettings?.perPrayerAdhan || {}),
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
