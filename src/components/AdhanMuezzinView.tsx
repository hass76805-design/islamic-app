import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlarmClock,
  BatteryCharging,
  Bell,
  BellOff,
  BookOpen,
  Check,
  Clock,
  Eye,
  Layers,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {PRESET_CITIES} from '../data/cities';
import {
  ADHAN_VOICES_30,
  IQAMAH_VOICES_10,
  MUEZZIN_POPUP_VOICES_5,
  POST_ADHAN_DUA_VOICES_10,
  PRE_ADHAN_VOICES_10,
  resolveAdhanVoiceById,
  resolveIqamahVoiceById,
  resolvePostAdhanDuaVoiceById,
  resolvePreAdhanVoiceById,
} from '../data/reciters';
import {
  AppPermissionKey,
  formatShortPermissionBadgeAr,
  INITIAL_REAL_PERMISSION_SNAPSHOT,
  OPEN_SETTINGS_STEPS_AR,
  openNativeOrBrowserSettings,
  readRealPermissionsSnapshot,
  RealPermissionSnapshot,
  requestAllRealPermissions,
  requestPermissionByKey,
  requestRealBatteryPersistencePermission,
  requestRealExactAlarmPermission,
  requestRealLocationPermission,
  requestRealNotificationPermission,
  requestRealOverlayPermission,
  subscribePermissionChanges,
} from '../utils/permissions';
import {
  AdhanAlertMode,
  AdhanVoice,
  AppSettings,
  CalculationMethodId,
  PrayerKey,
  PrayerOffsets,
  TrackablePrayer,
  UserLocation,
} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {getDateKey, getHijriParts} from '../utils/hijri';
import {
  cacheAudioUrl,
  cacheBatchUrls,
  resolveOfflinePlayableUrl,
} from '../utils/offlineAudioCache';
import {
  computeDailyPrayerData,
  DEFAULT_PRAYER_OFFSETS,
  formatClock12,
  formatClock24,
  formatCountdown,
  formatTime12,
  formatTime24,
  precomputeMonthlyPrayerCache,
} from '../utils/prayerTimes';
import {AdhanLiveModal} from './AdhanLiveModal';

interface AdhanMuezzinViewProps {
  now: Date;
  location: UserLocation;
  onSelectLocation: (loc: UserLocation) => void;
  onRequestGps: () => void;
  gpsLoading: boolean;
  settings: AppSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onActivateAdhanEngine?: () => Promise<void> | void;
}

type MuezzinPageStep = 'permissions' | 'setup' | 'per_prayer';

const INITIAL_PERM_SNAPSHOT: RealPermissionSnapshot =
  INITIAL_REAL_PERMISSION_SNAPSHOT;

const STEP_STORAGE_KEY = 'alzahabi_muezzin_step_v2';

const SIX_PRAYERS: Array<{key: PrayerKey; nameAr: string}> = [
  {key: 'fajr', nameAr: 'الفجر'},
  {key: 'sunrise', nameAr: 'الشروق'},
  {key: 'dhuhr', nameAr: 'الظهر'},
  {key: 'asr', nameAr: 'العصر'},
  {key: 'maghrib', nameAr: 'المغرب'},
  {key: 'isha', nameAr: 'العشاء'},
];

const SETUP_CALC_METHODS: Array<{id: CalculationMethodId; labelAr: string}> = [
  {id: 'Egyptian', labelAr: 'وزارة الأوقاف المصرية'},
  {id: 'MuslimWorldLeague', labelAr: 'رابطة العالم الإسلامي'},
  {id: 'NorthAmerica', labelAr: 'ISNA'},
  {id: 'UmmAlQura', labelAr: 'أم القرى مكة'},
  {id: 'Karachi', labelAr: 'كراتشي'},
  {id: 'Kuwait', labelAr: 'الكويت'},
  {id: 'France', labelAr: 'فرنسا'},
  {id: 'Custom', labelAr: 'حساب مخصص'},
];

const ALERT_MODE_BUTTONS: Array<{
  mode: AdhanAlertMode;
  labelAr: string;
  icon: typeof BellOff;
}> = [
  {mode: 'off', labelAr: 'إيقاف', icon: BellOff},
  {mode: 'silent', labelAr: 'صامت', icon: VolumeX},
  {mode: 'audio', labelAr: 'صوتي', icon: Volume2},
  {mode: 'visual', labelAr: 'مرئي', icon: Eye},
];

export const AdhanMuezzinView: React.FC<AdhanMuezzinViewProps> = ({
  now,
  location,
  onSelectLocation,
  onRequestGps,
  gpsLoading,
  settings,
  onUpdateSettings,
  onActivateAdhanEngine,
}) => {
  const [permSnapshot, setPermSnapshot] = useState<RealPermissionSnapshot>(
    INITIAL_PERM_SNAPSHOT,
  );
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [step, setStep] = useState<MuezzinPageStep>(() => {
    if (typeof window === 'undefined') return 'per_prayer';
    const saved = window.localStorage.getItem(STEP_STORAGE_KEY);
    if (saved === 'setup' || saved === 'per_prayer') {
      return saved;
    }
    return 'per_prayer';
  });

  const [citySearch, setCitySearch] = useState('');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [showMoreVoicesInPopup, setShowMoreVoicesInPopup] = useState(false);
  const [popupPrayer, setPopupPrayer] = useState<PrayerKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeVoicePickerTab, setActiveVoicePickerTab] = useState<
    'pre' | 'iqamah' | 'dua' | null
  >(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [grantingAll, setGrantingAll] = useState(false);

  const [videoPreview, setVideoPreview] = useState<{
    prayerNameAr: string;
    voice: AdhanVoice;
    mode?: 'adhan' | 'iqamah' | 'dua';
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useHardwareBack(popupPrayer !== null, () => setPopupPrayer(null));
  useHardwareBack(activeVoicePickerTab !== null, () =>
    setActiveVoicePickerTab(null),
  );
  useHardwareBack(settingsOpen && activeVoicePickerTab === null, () =>
    setSettingsOpen(false),
  );
  useHardwareBack(showSettingsGuide, () => setShowSettingsGuide(false));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STEP_STORAGE_KEY, step);
    }
  }, [step]);

  useEffect(() => {
    let active = true;
    const syncPermissions = async () => {
      const snap = await readRealPermissionsSnapshot();
      if (active) {
        setPermSnapshot(snap);
      }
    };
    void syncPermissions();
    const unsubscribe = subscribePermissionChanges(() => {
      void syncPermissions();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const allPermissionsGranted = useMemo(
    () => Object.values(permSnapshot).every((item) => item.granted),
    [permSnapshot],
  );
  const hasDeniedPermission = useMemo(
    () =>
      Object.values(permSnapshot).some((item) => item.status === 'denied'),
    [permSnapshot],
  );

  const timeFormat: '12' | '24' = settings.timeFormat || '12';
  const dstEnabled = Boolean(settings.dstEnabled);
  const preAdhanEnabled = settings.preAdhanEnabled ?? settings.preAdhanMinutes > 0;
  const preAdhanSliderMinutes = [10, 15, 30].includes(settings.preAdhanMinutes)
    ? settings.preAdhanMinutes
    : 10;
  const iqamahEnabled = settings.iqamahEnabled ?? true;
  const iqamahMinutes = Math.min(30, Math.max(5, settings.iqamahMinutes || 15));
  const postAdhanDuaEnabled = settings.postAdhanDuaEnabled ?? true;
  const postAdhanDuaDelaySeconds = Math.min(
    900,
    Math.max(30, settings.postAdhanDuaDelaySeconds ?? 135),
  );
  const selectedPreVoice = resolvePreAdhanVoiceById(
    settings.preferredPreAdhanSound,
  );
  const selectedIqamahVoice = resolveIqamahVoiceById(settings.preferredIqamah);
  const selectedDuaVoice = resolvePostAdhanDuaVoiceById(
    settings.preferredPostAdhanDua,
  );

  const offsets: PrayerOffsets = settings.prayerOffsets || DEFAULT_PRAYER_OFFSETS;
  const perPrayerAdhan = settings.perPrayerAdhan || {
    fajr: 'muezzin-makkah',
    dhuhr: 'muezzin-makkah',
    asr: 'muezzin-makkah',
    maghrib: 'muezzin-makkah',
    isha: 'muezzin-makkah',
  };

  // Separate per-prayer voice map stored cleanly in localStorage + mirrored for the 5 fard prayers in settings.perPrayerAdhan
  const [perPrayerVoiceMap, setPerPrayerVoiceMap] = useState<
    Record<PrayerKey, string>
  >(() => {
    const base: Record<PrayerKey, string> = {
      fajr: settings.perPrayerAdhan?.fajr || '',
      sunrise: '',
      dhuhr: settings.perPrayerAdhan?.dhuhr || '',
      asr: settings.perPrayerAdhan?.asr || '',
      maghrib: settings.perPrayerAdhan?.maghrib || '',
      isha: settings.perPrayerAdhan?.isha || '',
    };
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('alzahabi_per_prayer_voices_6');
        if (raw) {
          return {...base, ...(JSON.parse(raw) as Partial<Record<PrayerKey, string>>)};
        }
      } catch {
        // ignore
      }
    }
    return base;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          'alzahabi_per_prayer_voices_6',
          JSON.stringify(perPrayerVoiceMap),
        );
      } catch {
        // ignore
      }
    }
  }, [perPrayerVoiceMap]);

  const perPrayerAlertMode: Record<PrayerKey, AdhanAlertMode> = useMemo(
    () => ({
      fajr:
        settings.perPrayerAlertMode?.fajr ||
        (settings.enabledPrayers?.fajr === false ? 'off' : 'audio'),
      sunrise: settings.perPrayerAlertMode?.sunrise || 'silent',
      dhuhr:
        settings.perPrayerAlertMode?.dhuhr ||
        (settings.enabledPrayers?.dhuhr === false ? 'off' : 'audio'),
      asr:
        settings.perPrayerAlertMode?.asr ||
        (settings.enabledPrayers?.asr === false ? 'off' : 'audio'),
      maghrib:
        settings.perPrayerAlertMode?.maghrib ||
        (settings.enabledPrayers?.maghrib === false ? 'off' : 'audio'),
      isha:
        settings.perPrayerAlertMode?.isha ||
        (settings.enabledPrayers?.isha === false ? 'off' : 'audio'),
    }),
    [settings.perPrayerAlertMode, settings.enabledPrayers],
  );

  const dateKey = getDateKey(now);
  const dailyData = useMemo(
    () =>
      computeDailyPrayerData(
        location.latitude,
        location.longitude,
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
        settings.calculationMethod,
        settings.madhab,
        offsets,
        dstEnabled,
        settings.customFajrAngle,
        settings.customIshaAngle,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      location.latitude,
      location.longitude,
      dateKey,
      settings.calculationMethod,
      settings.madhab,
      offsets,
      dstEnabled,
      settings.customFajrAngle,
      settings.customIshaAngle,
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
    const nextNameAr = targetItem ? targetItem.nameAr : 'الفجر';
    const nextTime = targetItem
      ? targetItem.time
      : new Date(items[0].time.getTime() + 24 * 60 * 60 * 1000);
    const remainingMs = Math.max(0, nextTime.getTime() - nowMs);

    return {
      schedule: computedSchedule,
      nextPrayer: {
        ...dailyData.nextPrayer,
        nextNameAr,
        nextTime,
        remainingMs,
        remainingFormatted: formatCountdown(remainingMs),
      },
    };
  }, [dailyData, nowMs]);

  const hijri = useMemo(
    () => getHijriParts(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey],
  );
  const clock24 = formatClock24(now);
  const clock12 = formatClock12(now);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) {
      // Prioritize بني سويف and القاهرة at top
      const priority = PRESET_CITIES.filter(
        (c) => c.city === 'بني سويف' || c.city === 'القاهرة',
      );
      const rest = PRESET_CITIES.filter(
        (c) => c.city !== 'بني سويف' && c.city !== 'القاهرة',
      );
      return [...priority, ...rest];
    }
    return PRESET_CITIES.filter(
      (c) => c.city.includes(q) || c.country.includes(q),
    );
  }, [citySearch]);

  const stopAnyAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingId(null);
  };

  const playSingleAudio = (id: string, url: string, fallbackUrl?: string) => {
    setAudioErr(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;

    if (playingId === id) {
      stopAnyAudio();
      return;
    }

    const resolvedFallback = fallbackUrl || '/adhan-sounds/makkah.mp3';
    let usedFallback = false;
    audio.pause();
    audio.currentTime = 0;
    setPlayingId(id);

    const handleOfflineOrErr = () => {
      setPlayingId(null);
      setAudioErr(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'هذا الصوت متاح عند التحميل المحلي أو الاتصال بالإنترنت'
          : 'تعذر تشغيل الصوت حاليًا',
      );
    };

    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      if (!usedFallback) {
        usedFallback = true;
        void resolveOfflinePlayableUrl(resolvedFallback).then((fbPlayable) => {
          audio.src = fbPlayable;
          audio.load();
          audio.play().catch(handleOfflineOrErr);
        });
        return;
      }
      handleOfflineOrErr();
    };

    void resolveOfflinePlayableUrl(url).then((playableUrl) => {
      audio.src = playableUrl;
      audio.load();
      audio.play().catch(() => {
        if (!usedFallback) {
          usedFallback = true;
          void resolveOfflinePlayableUrl(resolvedFallback).then((fbPlayable) => {
            audio.src = fbPlayable;
            audio.load();
            audio.play().catch(handleOfflineOrErr);
          });
        } else {
          handleOfflineOrErr();
        }
      });
    });
  };

  const refreshRealPerms = async () => {
    const snap = await readRealPermissionsSnapshot();
    setPermSnapshot(snap);
    return snap;
  };

  const handleOpenSettingsRecovery = async () => {
    const openedNative = await openNativeOrBrowserSettings();
    if (!openedNative) {
      setShowSettingsGuide(true);
    }
  };

  // REAL Permission Requests (no fake localStorage grants)
  const grantLocationPermission = async () => {
    onRequestGps();
    const res = await requestRealLocationPermission();
    await refreshRealPerms();
    if (res === 'denied') {
      setStatusNote(
        'إذن الموقع مرفوض من المتصفح — اضغط «افتح الإعدادات واسمح» لتفعيله',
      );
      setShowSettingsGuide(true);
    } else if (res === 'granted') {
      setStatusNote('تم السماح بالموقع الجغرافي وتحديد مدينتك ✓');
    }
  };

  const grantNotificationsPermission = async () => {
    const res = await requestRealNotificationPermission();
    await refreshRealPerms();
    if (res === 'denied') {
      setStatusNote(
        'الإشعارات محظورة من المتصفح — اضغط «افتح الإعدادات واسمح» لتفعيلها',
      );
      setShowSettingsGuide(true);
    } else if (res === 'granted') {
      setStatusNote('تم السماح بالإشعارات الحقيقية ✓');
    } else {
      setStatusNote('اختر «سماح / Allow» عند ظهور نافذة المتصفح لتفعيل الإشعارات');
    }
  };

  const grantExactAlarmPermission = async () => {
    const res = await requestRealExactAlarmPermission();
    try {
      precomputeMonthlyPrayerCache(
        location.latitude,
        location.longitude,
        settings.calculationMethod,
        settings.madhab,
        offsets,
        location.city,
        30,
        dstEnabled,
      );
    } catch {
      // ignore
    }
    onUpdateSettings((s) => ({
      ...s,
      adhanEnabled: true,
      backgroundAlertsEnabled: true,
    }));
    await refreshRealPerms();
    if (res === 'denied') {
      setStatusNote(
        'إذن التنبيه الدقيق يتطلب السماح بالإشعارات — افتح الإعدادات واسمح',
      );
      setShowSettingsGuide(true);
    } else if (res === 'granted') {
      setStatusNote('تم تفعيل جدولة الأذان الدقيق في الخلفية ✓');
    }
  };

  const grantBatteryPermission = async () => {
    const res = await requestRealBatteryPersistencePermission();
    try {
      void cacheBatchUrls(
        [
          ...MUEZZIN_POPUP_VOICES_5.map((v) => v.url),
          ...PRE_ADHAN_VOICES_10.map((v) => v.url),
          ...IQAMAH_VOICES_10.map((v) => v.url),
          ...POST_ADHAN_DUA_VOICES_10.flatMap((v) =>
            v.fallbackUrl ? [v.url, v.fallbackUrl] : [v.url],
          ),
        ],
        undefined,
        5,
      );
    } catch {
      // ignore
    }
    onUpdateSettings((s) => ({...s, lockScreenKeepAlive: true}));
    await refreshRealPerms();
    if (res === 'granted') {
      setStatusNote('تم تفعيل التخزين الدائم وحماية الخلفية ✓');
    } else {
      setStatusNote(
        'ثبّت التطبيق من القائمة (Add to Home screen) واسمح بالبطارية غير المقيدة',
      );
    }
  };

  const grantOverlayPermission = async () => {
    const res = await requestRealOverlayPermission();
    await refreshRealPerms();
    if (res === 'denied') {
      setShowSettingsGuide(true);
    } else if (res === 'granted') {
      setStatusNote('تم تفعيل الظهور فوق التطبيقات الأخرى ✓');
    } else if (res === 'unsupported') {
      setStatusNote(
        'هذا الإذن خاص بتطبيق الأندرويد (Capacitor APK) ويفتح شاشة النظام على الهاتف',
      );
    }
  };

  const grantAllRealBackgroundPermissions = async (advanceStep = false) => {
    setGrantingAll(true);
    setStatusNote('جاري طلب الأذونات الحقيقية من النظام...');
    try {
      const snap = await requestAllRealPermissions();
      setPermSnapshot(snap);
      if (snap.notifications.granted && onActivateAdhanEngine) {
        await onActivateAdhanEngine();
      }
      const allOk = Object.values(snap).every((v) => v.granted);
      const anyDenied = Object.values(snap).some(
        (v) => v.status === 'denied',
      );
      if (anyDenied) {
        setStatusNote(
          'توجد أذونات محظورة من النظام — اضغط «افتح الإعدادات واسمح»',
        );
        setShowSettingsGuide(true);
      } else if (allOk) {
        setStatusNote('جميع الأذونات مسموحة من النظام بنجاح ✓');
        if (advanceStep) {
          setStep('setup');
          setStatusNote(null);
        }
      } else {
        setStatusNote(
          'تم تحديث الحالة الحقيقية من النظام — اضغط على أي إذن غير مفعل لطلب صلاحيته',
        );
      }
    } finally {
      setGrantingAll(false);
    }
  };

  const handleContinueFromPermissions = async () => {
    await grantAllRealBackgroundPermissions(true);
  };

  const handleFinishSetup = () => {
    const preMins = preAdhanEnabled ? preAdhanSliderMinutes : 0;
    onUpdateSettings((s) => ({
      ...s,
      adhanEnabled: true,
      backgroundAlertsEnabled: true,
      lockScreenKeepAlive: true,
      preAdhanEnabled,
      preAdhanMinutes: preMins,
    }));
    precomputeMonthlyPrayerCache(
      location.latitude,
      location.longitude,
      settings.calculationMethod,
      settings.madhab,
      offsets,
      location.city,
      30,
      dstEnabled,
    );
    const win = window as unknown as {
      AlZahabiAdhan?: {
        saveMuezzinConfigOffline?: (cfg: Record<string, unknown>) => Promise<boolean>;
      };
    };
    void win.AlZahabiAdhan?.saveMuezzinConfigOffline?.({
      city: location.city,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      calculationMethod: settings.calculationMethod,
      dstEnabled,
      timeFormat,
      preAdhanEnabled,
      preAdhanMinutes: preMins,
    });
    setStep('per_prayer');
  };

  const handleSetPrayerAlertMode = (pKey: PrayerKey, mode: AdhanAlertMode) => {
    onUpdateSettings((prev) => {
      const nextMap: Record<PrayerKey, AdhanAlertMode> = {
        ...perPrayerAlertMode,
        [pKey]: mode,
      };
      const nextEnabled = {...prev.enabledPrayers};
      if (pKey !== 'sunrise') {
        nextEnabled[pKey as TrackablePrayer] = mode !== 'off';
      }
      return {
        ...prev,
        perPrayerAlertMode: nextMap,
        enabledPrayers: nextEnabled,
      };
    });
  };

  const handleSelectVoiceForPrayer = (pKey: PrayerKey, voiceId: string) => {
    setPerPrayerVoiceMap((prev) => ({...prev, [pKey]: voiceId}));
    if (pKey !== 'sunrise') {
      onUpdateSettings((prev) => ({
        ...prev,
        preferredAdhan: voiceId,
        perPrayerAdhan: {
          ...prev.perPrayerAdhan,
          [pKey]: voiceId,
        },
      }));
    }
    setPopupPrayer(null);
  };

  const handleApplyVoiceToAllPrayers = (voiceId: string) => {
    setPerPrayerVoiceMap({
      fajr: voiceId,
      sunrise: voiceId,
      dhuhr: voiceId,
      asr: voiceId,
      maghrib: voiceId,
      isha: voiceId,
    });
    onUpdateSettings((prev) => ({
      ...prev,
      preferredAdhan: voiceId,
      perPrayerAdhan: {
        fajr: voiceId,
        dhuhr: voiceId,
        asr: voiceId,
        maghrib: voiceId,
        isha: voiceId,
      },
    }));
    setPopupPrayer(null);
  };

  const getPrayerFormattedTime = (pKey: PrayerKey): string => {
    const item = schedule.find((s) => s.key === pKey);
    if (!item) return '--:--';
    return timeFormat === '12' ? formatTime12(item.time) : formatTime24(item.time);
  };

  const popupPrayerLabel =
    SIX_PRAYERS.find((p) => p.key === popupPrayer)?.nameAr || 'الصلاة';

  const permissionCards: Array<{
    key: keyof RealPermissionSnapshot;
    titleAr: string;
    descAr: string;
    icon: typeof MapPin;
    onGrant: () => void | Promise<void>;
  }> = [
    {
      key: 'location',
      titleAr: 'الموقع الجغرافي',
      descAr: 'لحساب مواقيت الصلاة بدقة في بني سويف والقاهرة ومدينتك',
      icon: MapPin,
      onGrant: grantLocationPermission,
    },
    {
      key: 'notifications',
      titleAr: 'الإشعارات',
      descAr: 'لإرسال تنبيه الأذان والإقامة والدعاء حتى عند إغلاق التطبيق',
      icon: Bell,
      onGrant: grantNotificationsPermission,
    },
    {
      key: 'exactAlarm',
      titleAr: 'التنبيه الدقيق',
      descAr: 'لجدولة الأذان في اللحظة المحددة دون أي تأخير في الخلفية',
      icon: AlarmClock,
      onGrant: grantExactAlarmPermission,
    },
    {
      key: 'battery',
      titleAr: 'تجاهل توفير البطارية',
      descAr: 'لحفظ البيانات دائمًا ومنع توقف منبه الأذان في الخلفية',
      icon: BatteryCharging,
      onGrant: grantBatteryPermission,
    },
    {
      key: 'overlay',
      titleAr: 'العرض فوق التطبيقات',
      descAr: 'لإظهار شاشة «الأذان الآن» فوراً مع أزرار الإقامة والتأجيل',
      icon: Layers,
      onGrant: grantOverlayPermission,
    },
  ];

  return (
    <div
      dir="rtl"
      className="space-y-4 rounded-3xl bg-[#E8DCC8] p-3.5 text-[#0F2225] shadow-inner"
    >
      {/* TOP MUEZZIN HEADER + SETTINGS BUTTON + LIVE NEXT PRAYER MINI BAR */}
      <header className="rounded-3xl bg-[#0F2225] p-4 text-white shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-[#E8DCC8]">المؤذن</h1>
            <p className="truncate text-[11px] font-bold text-[#1FA47A]">
              {location.city}، {location.country} · القادمة: {nextPrayer.nextNameAr} (
              {nextPrayer.remainingFormatted})
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-left">
              <span
                dir="ltr"
                className="font-mono-num block text-lg font-extrabold text-[#E8DCC8]"
              >
                {timeFormat === '12'
                  ? `${clock12.time} ${clock12.periodAr}`
                  : clock24}
              </span>
              <span className="block text-[10px] text-[#E8DCC8]/75">
                {hijri.weekdayAr} · {hijri.day} {hijri.monthNameAr}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveVoicePickerTab(null);
                setSettingsOpen(true);
              }}
              aria-label="إعدادات الأذان والتنبيه والإقامة والدعاء"
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl border border-[#1FA47A] bg-[#1FA47A]/20 px-3 text-xs font-extrabold text-[#E8DCC8] active:scale-95"
            >
              <Settings className="h-4 w-4 text-[#1FA47A]" />
              <span>الإعدادات</span>
            </button>
          </div>
        </div>

        {/* 3-PAGE STEP SWITCHER */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-black/25 p-1">
          <button
            type="button"
            onClick={() => setStep('permissions')}
            className={`min-h-[34px] rounded-xl px-1.5 text-[11px] font-extrabold transition ${
              step === 'permissions'
                ? 'bg-[#1FA47A] text-white'
                : 'text-[#E8DCC8]/80'
            }`}
          >
            ١. الأذونات
          </button>
          <button
            type="button"
            onClick={() => setStep('setup')}
            className={`min-h-[34px] rounded-xl px-1.5 text-[11px] font-extrabold transition ${
              step === 'setup' ? 'bg-[#1FA47A] text-white' : 'text-[#E8DCC8]/80'
            }`}
          >
            ٢. إعداد المؤذن
          </button>
          <button
            type="button"
            onClick={() => setStep('per_prayer')}
            className={`min-h-[34px] rounded-xl px-1.5 text-[11px] font-extrabold transition ${
              step === 'per_prayer'
                ? 'bg-[#1FA47A] text-white'
                : 'text-[#E8DCC8]/80'
            }`}
          >
            ٣. إعداد الأذان
          </button>
        </div>
      </header>

      {/* ==================== PAGE 1: REAL SYSTEM PERMISSIONS ==================== */}
      {step === 'permissions' && (
        <section className="space-y-3.5">
          <div className="rounded-3xl bg-[#0F2225] p-4 text-white">
            <h2 className="text-lg font-extrabold text-[#E8DCC8]">
              الأذونات الحقيقية للنظام (Capacitor)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#E8DCC8]/85">
              تُعرض هنا حالة أذونات النظام الحقيقية مباشرة — اضغط على أي إذن لفتح نافذة السماح الرسمية في أندرويد.
            </p>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-xs font-extrabold">
              <span className="text-[#E8DCC8]">حالة النظام الحالية:</span>
              <span
                className={
                  allPermissionsGranted ? 'text-[#34D399]' : 'text-amber-300'
                }
              >
                {allPermissionsGranted
                  ? 'جميع الأذونات مفعلة ✓'
                  : 'يوجد أذونات بانتظار السماح'}
              </span>
            </div>
          </div>

          {/* Permission Cards with Live Real Badges */}
          <div className="space-y-2.5">
            {permissionCards.map((item) => {
              const Icon = item.icon;
              const entry = permSnapshot[item.key];
              const isGranted = entry.granted;
              const isUnsupported = entry.status === 'unsupported';
              const badgeText = formatShortPermissionBadgeAr(entry.status);
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between gap-2.5 rounded-2xl border p-3.5 text-white shadow ${
                    isGranted
                      ? 'border-[#1FA47A]/60 bg-[#0F2225]'
                      : isUnsupported
                        ? 'border-amber-500/50 bg-[#1B160B]'
                        : 'border-rose-500/60 bg-[#1B1012]'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (entry.status === 'denied') {
                          void handleOpenSettingsRecovery();
                        } else {
                          void item.onGrant();
                        }
                      }}
                      className={`inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-xl px-3 text-[11px] font-extrabold transition active:scale-95 ${
                        isGranted
                          ? 'border border-[#1FA47A] bg-[#1FA47A]/20 text-[#34D399]'
                          : isUnsupported
                            ? 'border border-amber-400/60 bg-amber-950/60 text-amber-200'
                            : 'border border-rose-400 bg-rose-600 text-white'
                      }`}
                    >
                      {entry.status === 'denied'
                        ? 'افتح الإعدادات واسمح'
                        : badgeText}
                    </button>

                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold text-[#E8DCC8]">
                        {item.titleAr}
                      </h3>
                      <p className="text-[11px] leading-snug text-[#E8DCC8]/75">
                        {item.descAr}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isGranted
                        ? 'bg-[#1FA47A]/20 text-[#34D399]'
                        : isUnsupported
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              );
            })}
          </div>

          {hasDeniedPermission && (
            <button
              type="button"
              onClick={() => void handleOpenSettingsRecovery()}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-400 bg-rose-950/90 px-4 text-xs font-extrabold text-rose-100 active:scale-[0.98]"
            >
              <Settings className="h-4 w-4" />
              <span>افتح الإعدادات واسمح بالأذونات المحظورة</span>
            </button>
          )}

          {statusNote && (
            <p className="rounded-2xl bg-[#0F2225] px-3 py-2 text-center text-xs font-bold text-[#34D399]">
              {statusNote}
            </p>
          )}

          {/* Request All Real Permissions Button + Proceed */}
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={grantingAll}
              onClick={() => void handleContinueFromPermissions()}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#24B98A] via-[#1FA47A] to-[#137A59] text-base font-extrabold text-white shadow-lg active:scale-[0.99] disabled:opacity-70"
            >
              <span>
                {grantingAll ? 'جاري فتح نوافذ الأذونات...' : 'اطلب كل الأذونات'}
              </span>
            </button>

            {!allPermissionsGranted && (
              <button
                type="button"
                onClick={() => setStep('setup')}
                className="flex min-h-[42px] w-full items-center justify-center rounded-2xl border border-[#0F2225]/35 bg-[#0F2225]/10 text-xs font-extrabold text-[#0F2225]"
              >
                متابعة لإعداد المدينة والمواقيت
              </button>
            )}
          </div>
        </section>
      )}

      {/* ==================== PAGE 2: SETUP (خطوتان فقط للبدء) ==================== */}
      {step === 'setup' && (
        <section className="space-y-3.5">
          <div className="rounded-3xl bg-[#0F2225] p-4 text-white">
            <h2 className="text-base font-extrabold text-[#E8DCC8]">
              إعداد المؤذن - خطوتان فقط للبدء
            </h2>
            <p className="mt-0.5 text-xs text-[#E8DCC8]/75">
              حدد مدينتك وطريقة الحساب وسيعمل المؤذن تلقائيًا بدون إنترنت
            </p>

            {/* Step 1: GPS Auto-Detect + Manual City Search */}
            <div className="mt-3 space-y-2.5">
              <button
                type="button"
                onClick={onRequestGps}
                disabled={gpsLoading}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] text-sm font-extrabold text-white shadow active:scale-[0.99]"
              >
                <Navigation className="h-4 w-4" />
                <span>
                  {gpsLoading ? 'جاري تحديد الموقع...' : 'تحديد تلقائي بالـ GPS'}
                </span>
              </button>

              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1FA47A]" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="ابحث عن مدينتك يدوياً (بني سويف، القاهرة...)"
                  className="min-h-[42px] w-full rounded-2xl border border-[#1FA47A]/45 bg-black/30 py-2 pr-9 pl-3 text-xs font-bold text-[#E8DCC8] placeholder-[#E8DCC8]/50 outline-none focus:border-[#1FA47A]"
                />
              </div>

              {/* Quick Egypt Favorites + Filtered City List */}
              <div className="max-h-40 space-y-1.5 overflow-y-auto pl-1 touch-pan-y">
                {filteredCities.slice(0, 12).map((city) => {
                  const isCurrent =
                    location.city === city.city &&
                    location.country === city.country;
                  return (
                    <button
                      key={`${city.city}-${city.country}`}
                      type="button"
                      onClick={() => {
                        onSelectLocation({...city, isGps: false});
                        if (city.country === 'مصر') {
                          onUpdateSettings((s) => ({
                            ...s,
                            calculationMethod: 'Egyptian',
                          }));
                        }
                      }}
                      className={`flex min-h-[38px] w-full items-center justify-between rounded-xl px-3 text-xs font-bold ${
                        isCurrent
                          ? 'bg-[#1FA47A] text-white'
                          : 'bg-white/10 text-[#E8DCC8]'
                      }`}
                    >
                      <span>
                        {city.city} — {city.country}
                      </span>
                      {isCurrent && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Calculation Method Radio List */}
          <div className="rounded-3xl bg-[#0F2225] p-4 text-white">
            <h3 className="text-sm font-extrabold text-[#1FA47A]">
              طريقة الحساب
            </h3>
            <div className="mt-2.5 grid grid-cols-1 gap-1.5">
              {SETUP_CALC_METHODS.map((m) => {
                const selected = settings.calculationMethod === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex min-h-[40px] cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      selected
                        ? 'border-[#1FA47A] bg-[#1FA47A]/20 text-white'
                        : 'border-white/10 bg-white/5 text-[#E8DCC8]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="muezzin-calc-method"
                        checked={selected}
                        onChange={() =>
                          onUpdateSettings((s) => ({
                            ...s,
                            calculationMethod: m.id,
                          }))
                        }
                        className="h-4 w-4 accent-[#1FA47A]"
                      />
                      <span>{m.labelAr}</span>
                    </span>
                    {m.id === 'Egyptian' && (
                      <span className="rounded-lg bg-[#1FA47A]/30 px-2 py-0.5 text-[10px] text-[#34D399]">
                        الافتراضي
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {settings.calculationMethod === 'Custom' && (
              <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-3">
                <label className="space-y-1 text-[11px] font-bold text-[#E8DCC8]">
                  <span>زاوية الفجر (°)</span>
                  <input
                    type="number"
                    step="0.5"
                    min={10}
                    max={25}
                    value={settings.customFajrAngle ?? 18.5}
                    onChange={(e) =>
                      onUpdateSettings((s) => ({
                        ...s,
                        customFajrAngle: Number(e.target.value) || 18.5,
                      }))
                    }
                    className="w-full rounded-xl border border-[#1FA47A]/50 bg-[#0F2225] px-2.5 py-1.5 text-center text-white"
                  />
                </label>
                <label className="space-y-1 text-[11px] font-bold text-[#E8DCC8]">
                  <span>زاوية العشاء (°)</span>
                  <input
                    type="number"
                    step="0.5"
                    min={10}
                    max={25}
                    value={settings.customIshaAngle ?? 17.5}
                    onChange={(e) =>
                      onUpdateSettings((s) => ({
                        ...s,
                        customIshaAngle: Number(e.target.value) || 17.5,
                      }))
                    }
                    className="w-full rounded-xl border border-[#1FA47A]/50 bg-[#0F2225] px-2.5 py-1.5 text-center text-white"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Time Format + DST + Pre-Adhan Slider */}
          <div className="space-y-3 rounded-3xl bg-[#0F2225] p-4 text-white">
            {/* تنسيق الوقت: 12 ساعة / 24 ساعة */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#E8DCC8]">
                تنسيق الوقت
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({...s, timeFormat: '12'}))
                  }
                  className={`min-h-[36px] rounded-xl px-3 text-xs font-extrabold ${
                    timeFormat === '12'
                      ? 'bg-[#1FA47A] text-white'
                      : 'bg-white/10 text-[#E8DCC8]'
                  }`}
                >
                  12 ساعة
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({...s, timeFormat: '24'}))
                  }
                  className={`min-h-[36px] rounded-xl px-3 text-xs font-extrabold ${
                    timeFormat === '24'
                      ? 'bg-[#1FA47A] text-white'
                      : 'bg-white/10 text-[#E8DCC8]'
                  }`}
                >
                  24 ساعة
                </button>
              </div>
            </div>

            {/* التوقيت الصيفي Toggle */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <div>
                <p className="text-xs font-extrabold text-[#E8DCC8]">
                  التوقيت الصيفي
                </p>
                <p className="text-[10px] text-[#E8DCC8]/70">
                  إضافة +60 دقيقة تلقائيًا حسب التوقيت الصيفي
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dstEnabled}
                onClick={() =>
                  onUpdateSettings((s) => ({...s, dstEnabled: !dstEnabled}))
                }
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  dstEnabled ? 'bg-[#1FA47A]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                    dstEnabled ? 'left-1' : 'right-1'
                  }`}
                />
              </button>
            </div>

            {/* تنبيه قبل الصلاة Toggle + 5m / 10m ONLY */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-[#E8DCC8]">
                    تنبيه قبل الصلاة
                  </p>
                  <p className="text-[11px] font-bold text-[#1FA47A]">
                    {preAdhanEnabled
                      ? `قبل الأذان بـ ${preAdhanSliderMinutes} دقائق`
                      : 'متوقف حاليًا'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preAdhanEnabled}
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      preAdhanEnabled: !preAdhanEnabled,
                      preAdhanMinutes: !preAdhanEnabled
                        ? preAdhanSliderMinutes
                        : 0,
                    }))
                  }
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    preAdhanEnabled ? 'bg-[#1FA47A]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                      preAdhanEnabled ? 'left-1' : 'right-1'
                    }`}
                  />
                </button>
              </div>

              {preAdhanEnabled && (
                <div className="grid grid-cols-3 gap-1.5">
                  {[10, 15, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((s) => ({
                          ...s,
                          preAdhanEnabled: true,
                          preAdhanMinutes: m,
                        }))
                      }
                      className={`min-h-[38px] rounded-xl text-xs font-extrabold ${
                        preAdhanSliderMinutes === m
                          ? 'bg-[#1FA47A] text-white'
                          : 'bg-white/10 text-[#E8DCC8]'
                      }`}
                    >
                      {m} دقيقة
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinishSetup}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#24B98A] via-[#1FA47A] to-[#137A59] text-base font-extrabold text-white shadow-lg active:scale-[0.99]"
          >
            <span>ابدأ الآن</span>
          </button>
        </section>
      )}

      {/* ==================== PAGE 3: PER-PRAYER ADHAN SETUP ==================== */}
      {step === 'per_prayer' && (
        <section className="space-y-3">
          <div className="rounded-3xl bg-[#0F2225] p-4 text-white">
            <h2 className="text-base font-extrabold text-[#E8DCC8]">
              إعداد الأذان - اختر صوت الأذان ونوع التنبيه لكل صلاة
            </h2>
            <p className="mt-0.5 text-xs text-[#E8DCC8]/75">
              يمكنك اختيار صوت ونوع تنبيه مستقل لكل صلاة، مع معاينة الصوت والفيديو
              بدون إنترنت
            </p>

            {/* Preview "الأذان الآن" Screen Button */}
            <button
              type="button"
              onClick={() => {
                stopAnyAudio();
                const fajrVoice = resolveAdhanVoiceById(
                  perPrayerVoiceMap.fajr || perPrayerAdhan.fajr,
                );
                setVideoPreview({
                  prayerNameAr: nextPrayer.nextNameAr,
                  voice: fajrVoice,
                  mode: 'adhan',
                });
              }}
              className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] text-xs font-extrabold text-white active:scale-[0.99]"
            >
              <Radio className="h-4 w-4" />
              <span>معاينة شاشة «الأذان الآن» كاملة</span>
            </button>
          </div>

          {audioErr && (
            <p className="rounded-2xl bg-rose-900/90 px-3 py-2 text-center text-xs font-bold text-white">
              {audioErr}
            </p>
          )}

          {/* 6 SEPARATE PRAYER CARDS: الفجر - الشروق - الظهر - العصر - المغرب - العشاء */}
          <div className="space-y-3">
            {SIX_PRAYERS.map((prayer) => {
              const mode = perPrayerAlertMode[prayer.key];
              const rawVoiceId = perPrayerVoiceMap[prayer.key] || '';
              const hasChosenVoice =
                Boolean(rawVoiceId) && rawVoiceId !== 'unselected';
              const resolvedVoice = resolveAdhanVoiceById(rawVoiceId);
              const isPlayingCard = playingId === `card-${prayer.key}`;
              const prayerTimeFormatted = getPrayerFormattedTime(prayer.key);

              return (
                <div
                  key={prayer.key}
                  className="space-y-2.5 rounded-3xl bg-[#0F2225] p-3.5 text-white shadow-md"
                >
                  {/* Header: Green Prayer Name on Right, Time on Left */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#1FA47A]" />
                      <h3 className="text-base font-extrabold text-[#1FA47A]">
                        {prayer.nameAr}
                      </h3>
                    </div>

                    <span
                      dir="ltr"
                      className="font-mono-num rounded-xl bg-white/10 px-2.5 py-1 text-sm font-extrabold text-[#E8DCC8]"
                    >
                      {prayerTimeFormatted}
                    </span>
                  </div>

                  {/* 4 Alert Mode Buttons: إيقاف - صامت - صوتي - مرئي */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALERT_MODE_BUTTONS.map((btn) => {
                      const Icon = btn.icon;
                      const isActive = mode === btn.mode;
                      return (
                        <button
                          key={btn.mode}
                          type="button"
                          onClick={() =>
                            handleSetPrayerAlertMode(prayer.key, btn.mode)
                          }
                          className={`flex min-h-[38px] items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-extrabold transition ${
                            isActive
                              ? 'border-[#1FA47A] bg-[#1FA47A] text-white'
                              : 'border-white/15 bg-white/5 text-[#E8DCC8]/85'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{btn.labelAr}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sound Picker + Audio Preview + Video Preview when صوتي or مرئي */}
                  {(mode === 'audio' || mode === 'visual') && (
                    <div className="space-y-2 rounded-2xl bg-black/25 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#E8DCC8]">
                          الصوت المختار:{' '}
                          <span
                            className={
                              hasChosenVoice
                                ? 'font-extrabold text-[#34D399]'
                                : 'font-bold text-amber-300'
                            }
                          >
                            {hasChosenVoice
                              ? resolvedVoice.nameAr
                              : 'لم يختر بعد'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreVoicesInPopup(false);
                            setPopupPrayer(prayer.key);
                          }}
                          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] px-3 text-xs font-extrabold text-white active:scale-95"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>اختر صوتاً</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            playSingleAudio(
                              `card-${prayer.key}`,
                              resolvedVoice.url,
                              resolvedVoice.fallbackUrl,
                            )
                          }
                          className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold ${
                            isPlayingCard
                              ? 'border-[#1FA47A] bg-[#1FA47A] text-white'
                              : 'border-[#1FA47A]/50 bg-[#0F2225] text-[#E8DCC8]'
                          }`}
                        >
                          {isPlayingCard ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {isPlayingCard ? 'إيقاف الصوت' : 'معاينة صوت'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopAnyAudio();
                            setVideoPreview({
                              prayerNameAr: prayer.nameAr,
                              voice: resolvedVoice,
                              mode: 'adhan',
                            });
                          }}
                          className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-[#1FA47A]/50 bg-[#0F2225] text-xs font-bold text-[#E8DCC8]"
                        >
                          <Video className="h-3.5 w-3.5 text-[#1FA47A]" />
                          <span>معاينة فيديو</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ==================== VOICE SELECTION POPUP (30 VERIFIED MUADHINS + SEARCH) ==================== */}
      {popupPrayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-2 sm:items-center">
          <div className="animate-sheet-up flex max-h-[88dvh] w-full max-w-[390px] flex-col rounded-3xl border-2 border-[#1FA47A] bg-[#0F2225] p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#E8DCC8]">
                  اختر صوت الأذان — {popupPrayerLabel}
                </h3>
                <p className="text-[11px] text-[#1FA47A]">
                  30 مؤذنًا من أشهر مؤذني العالم الإسلامي · روابط صوتية عالية الجودة
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVoiceSearch('');
                  setPopupPrayer(null);
                }}
                aria-label="إغلاق"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1FA47A]/50 text-[#E8DCC8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-2.5">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1FA47A]" />
              <input
                type="text"
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="ابحث عن مؤذن (العفاسي، عبد الباسط، السديس...)"
                className="min-h-[40px] w-full rounded-xl border border-[#1FA47A]/45 bg-black/35 py-1.5 pr-9 pl-3 text-xs font-bold text-[#E8DCC8] placeholder-[#E8DCC8]/50 outline-none focus:border-[#1FA47A]"
              />
            </div>

            <div className="mt-2.5 flex-1 space-y-2.5 overflow-y-auto pl-1 touch-pan-y">
              {(voiceSearch.trim()
                ? ADHAN_VOICES_30.filter(
                    (v) =>
                      v.nameAr.includes(voiceSearch.trim()) ||
                      v.muezzinAr.includes(voiceSearch.trim()) ||
                      v.locationAr.includes(voiceSearch.trim()),
                  )
                : showMoreVoicesInPopup
                  ? ADHAN_VOICES_30
                  : MUEZZIN_POPUP_VOICES_5
              ).map((voice, idx) => {
                const isSelected = perPrayerVoiceMap[popupPrayer] === voice.id;
                const isPreviewPlaying = playingId === `popup-${voice.id}`;
                return (
                  <div
                    key={voice.id}
                    className={`rounded-2xl border p-3 ${
                      isSelected
                        ? 'border-2 border-[#1FA47A] bg-[#1FA47A]/20'
                        : 'border-white/15 bg-black/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-extrabold text-[#E8DCC8]">
                          {showMoreVoicesInPopup || voiceSearch.trim()
                            ? `${idx + 1}. ${voice.nameAr}`
                            : voice.nameAr}
                        </h4>
                        <p className="truncate text-[11px] text-[#E8DCC8]/70">
                          {voice.muezzinAr} · {voice.locationAr}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="rounded-lg bg-[#1FA47A] px-2 py-0.5 text-[10px] font-extrabold text-white">
                          مختار ✓
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          playSingleAudio(
                            `popup-${voice.id}`,
                            voice.url,
                            voice.fallbackUrl,
                          )
                        }
                        className={`inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border text-[11px] font-bold ${
                          isPreviewPlaying
                            ? 'border-[#1FA47A] bg-[#1FA47A] text-white'
                            : 'border-[#1FA47A]/50 bg-[#0F2225] text-[#E8DCC8]'
                        }`}
                      >
                        {isPreviewPlaying ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span>{isPreviewPlaying ? 'إيقاف' : 'معاينة ▶️'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          stopAnyAudio();
                          setVideoPreview({
                            prayerNameAr: popupPrayerLabel,
                            voice,
                            mode: 'adhan',
                          });
                        }}
                        className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#1FA47A]/50 bg-[#0F2225] text-[11px] font-bold text-[#E8DCC8]"
                      >
                        <Video className="h-3.5 w-3.5 text-[#1FA47A]" />
                        <span>فيديو 🎬</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleSelectVoiceForPrayer(popupPrayer, voice.id)
                        }
                        className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] text-[11px] font-extrabold text-white active:scale-95"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>اختيار</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {!voiceSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setShowMoreVoicesInPopup((v) => !v)}
                  className="w-full rounded-xl border border-[#1FA47A]/40 bg-white/5 py-2.5 text-xs font-extrabold text-[#34D399]"
                >
                  {showMoreVoicesInPopup
                    ? 'عرض الأصوات الأساسية الخمسة فقط'
                    : `عرض جميع المؤذنين (${ADHAN_VOICES_30.length} مؤذنًا)`}
                </button>
              )}
            </div>

            {perPrayerVoiceMap[popupPrayer] && (
              <button
                type="button"
                onClick={() =>
                  handleApplyVoiceToAllPrayers(perPrayerVoiceMap[popupPrayer])
                }
                className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#1FA47A] bg-black/30 text-xs font-bold text-[#E8DCC8]"
              >
                <Clock className="h-3.5 w-3.5 text-[#1FA47A]" />
                <span>تعميم الصوت المختار على جميع الصلوات</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== ADHAN TOP SETTINGS MODAL (2 NOTIFICATION TYPES ONLY + IQAMAH + DUA) ==================== */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 p-2 sm:items-center">
          <div className="animate-sheet-up flex max-h-[90dvh] w-full max-w-[400px] flex-col rounded-3xl border-2 border-[#1FA47A] bg-[#0F2225] p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#E8DCC8]">
                  إعدادات الأذان والتنبيهات
                </h3>
                <p className="text-[11px] text-[#1FA47A]">
                  تنبيه قبل الصلاة + تنبيه وقت الصلاة فقط · إقامة حقيقية · دعاء بعد الأذان
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveVoicePickerTab(null);
                  setSettingsOpen(false);
                }}
                aria-label="إغلاق الإعدادات"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1FA47A]/50 text-[#E8DCC8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto pl-1 touch-pan-y">
              {/* Auto-Location & LIVE Real Permissions Status */}
              <div className="space-y-2 rounded-2xl border border-[#1FA47A]/40 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#E8DCC8]">
                      <MapPin className="h-3.5 w-3.5 text-[#1FA47A]" />
                      <span>
                        الموقع الحالي: {location.city}، {location.country}
                      </span>
                    </p>
                    <p className="text-[10px] text-[#E8DCC8]/70">
                      {allPermissionsGranted
                        ? 'جميع أذونات النظام مفعلة ✓'
                        : 'اضغط على أي إذن غير مفعل لطلب الصلاحية من النظام'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void grantLocationPermission()}
                    disabled={gpsLoading}
                    className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl bg-[#1FA47A] px-2.5 text-[11px] font-extrabold text-white active:scale-95"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>{gpsLoading ? '...' : 'GPS تلقائي'}</span>
                  </button>
                </div>

                {/* Live Mini Status Grid inside Settings */}
                <div className="space-y-1.5 text-[11px] font-bold">
                  {(
                    [
                      {key: 'notifications' as AppPermissionKey, label: 'إذن الإشعارات'},
                      {key: 'location' as AppPermissionKey, label: 'إذن الموقع (GPS)'},
                      {key: 'exactAlarm' as AppPermissionKey, label: 'إذن المنبه الدقيق'},
                      {key: 'battery' as AppPermissionKey, label: 'تجاهل توفير البطارية'},
                      {key: 'overlay' as AppPermissionKey, label: 'العرض فوق التطبيقات'},
                      {key: 'doNotDisturb' as AppPermissionKey, label: 'تجاوز عدم الإزعاج'},
                    ]
                  ).map((item) => {
                    const st = permSnapshot[item.key];
                    const isGranted = st?.granted;
                    const badgeLabel = st
                      ? formatShortPermissionBadgeAr(st.status)
                      : 'غير مفعل';
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 rounded-xl bg-black/40 px-2.5 py-1.5"
                      >
                        <span className="text-[#E8DCC8]">{item.label}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (st?.status === 'denied') {
                              await handleOpenSettingsRecovery();
                            } else {
                              if (item.key === 'location') {
                                onRequestGps();
                              }
                              const res = await requestPermissionByKey(item.key);
                              if (res === 'denied') {
                                setShowSettingsGuide(true);
                              }
                              await refreshRealPerms();
                            }
                          }}
                          className={`rounded-lg px-2 py-1 text-[10px] font-extrabold active:scale-95 ${
                            isGranted
                              ? 'bg-emerald-600 text-white'
                              : st?.status === 'unsupported'
                                ? 'bg-amber-900/70 text-amber-200'
                                : 'bg-red-600 text-white'
                          }`}
                        >
                          {badgeLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    disabled={grantingAll}
                    onClick={() => void grantAllRealBackgroundPermissions(false)}
                    className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#1FA47A] bg-[#1FA47A]/20 px-3 text-xs font-extrabold text-[#34D399] active:scale-[0.98]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>
                      {grantingAll
                        ? 'جاري فتح نوافذ الأذونات...'
                        : 'اطلب كل الأذونات'}
                    </span>
                  </button>

                  {hasDeniedPermission && (
                    <button
                      type="button"
                      onClick={() => void handleOpenSettingsRecovery()}
                      className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-400 bg-rose-950/70 px-3 text-xs font-extrabold text-rose-200 active:scale-[0.98]"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>افتح الإعدادات واسمح بالأذونات المحظورة</span>
                    </button>
                  )}
                </div>

                {statusNote && (
                  <p className="text-center text-[11px] font-bold text-[#34D399]">
                    {statusNote}
                  </p>
                )}
              </div>

              {/* NOTIFICATION TYPES SUMMARY: ONLY 2 TYPES */}
              <div className="space-y-1.5 rounded-2xl border border-[#1FA47A]/35 bg-black/30 p-3 text-[11px]">
                <p className="font-extrabold text-[#E8DCC8]">
                  نوعا الإشعارات المعتمدان فقط (بدون تواشيح أو تكبيرات):
                </p>
                <p className="text-[#34D399]">
                  ١) قبل الصلاة بـ {preAdhanSliderMinutes} دقيقة: «اقتربت صلاة ...» بصوت شيخ حقيقي عالي وواضح (العفاسي، الغامدي، عبد الباسط، وإلا صلاتي)
                </p>
                <p className="text-[#34D399]">
                  ٢) عند دخول الوقت: «حان الآن وقت صلاة الفجر / الظهر / العصر / المغرب / العشاء»
                </p>
              </div>

              {/* BUTTON 1: تنبيه قبل الصلاة — 10، 15، 30 دقيقة بصوت شيخ حقيقي */}
              <div className="space-y-2.5 rounded-2xl border border-[#1FA47A]/45 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-[#E8DCC8]">
                      <Bell className="h-4 w-4 text-[#1FA47A]" />
                      <span>تنبيه قبل الصلاة</span>
                    </h4>
                    <p className="text-[11px] text-[#1FA47A]">
                      {preAdhanEnabled
                        ? `قبل الأذان بـ ${preAdhanSliderMinutes} دقيقة · ${selectedPreVoice.nameAr}`
                        : 'متوقف حاليًا'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preAdhanEnabled}
                    onClick={() =>
                      onUpdateSettings((s) => ({
                        ...s,
                        preAdhanEnabled: !preAdhanEnabled,
                        preAdhanMinutes: !preAdhanEnabled
                          ? preAdhanSliderMinutes
                          : 0,
                      }))
                    }
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      preAdhanEnabled ? 'bg-[#1FA47A]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        preAdhanEnabled ? 'left-1' : 'right-1'
                      }`}
                    />
                  </button>
                </div>

                {preAdhanEnabled && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {[10, 15, 30].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((s) => ({
                            ...s,
                            preAdhanEnabled: true,
                            preAdhanMinutes: m,
                          }))
                        }
                        className={`min-h-[34px] rounded-xl text-xs font-extrabold ${
                          preAdhanSliderMinutes === m
                            ? 'bg-[#1FA47A] text-white'
                            : 'bg-white/10 text-[#E8DCC8]'
                        }`}
                      >
                        {m} دقيقة
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveVoicePickerTab('pre')}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] px-3 text-xs font-extrabold text-white active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4" />
                    <span>صوت التنبيه قبل الصلاة — بصوت شيخ حقيقي</span>
                  </span>
                  <span className="rounded-lg bg-black/25 px-2 py-0.5 text-[10px]">
                    {PRE_ADHAN_VOICES_10.length} شيوخ
                  </span>
                </button>
              </div>

              {/* BUTTON 2: الإقامة (إقامة حقيقية فقط بدون أذان أو دعاء) */}
              <div className="space-y-2.5 rounded-2xl border border-[#1FA47A]/45 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-[#E8DCC8]">
                      <AlarmClock className="h-4 w-4 text-[#1FA47A]" />
                      <span>الإقامة</span>
                    </h4>
                    <p className="text-[11px] text-[#1FA47A]">
                      {iqamahEnabled
                        ? `بعد الأذان بـ ${iqamahMinutes} دقيقة · ${selectedIqamahVoice.nameAr}`
                        : 'متوقفة حاليًا'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={iqamahEnabled}
                    onClick={() =>
                      onUpdateSettings((s) => ({
                        ...s,
                        iqamahEnabled: !iqamahEnabled,
                      }))
                    }
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      iqamahEnabled ? 'bg-[#1FA47A]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        iqamahEnabled ? 'left-1' : 'right-1'
                      }`}
                    />
                  </button>
                </div>

                {iqamahEnabled && (
                  <div className="grid grid-cols-5 gap-1">
                    {[5, 10, 15, 20, 30].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((s) => ({
                            ...s,
                            iqamahEnabled: true,
                            iqamahMinutes: m,
                          }))
                        }
                        className={`min-h-[32px] rounded-xl text-[11px] font-extrabold ${
                          iqamahMinutes === m
                            ? 'bg-[#1FA47A] text-white'
                            : 'bg-white/10 text-[#E8DCC8]'
                        }`}
                      >
                        {m} د
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveVoicePickerTab('iqamah')}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] px-3 text-xs font-extrabold text-white active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5">
                    <AlarmClock className="h-4 w-4" />
                    <span>الإقامة — صوت الإقامة الحقيقية فقط</span>
                  </span>
                  <span className="rounded-lg bg-black/25 px-2 py-0.5 text-[10px]">
                    {IQAMAH_VOICES_10.length} أصوات
                  </span>
                </button>
              </div>

              {/* BUTTON 3: دعاء بعد الصلاة (ضبط الوقت + 10 أصوات شيوخ) */}
              <div className="space-y-2.5 rounded-2xl border border-[#1FA47A]/45 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-[#E8DCC8]">
                      <BookOpen className="h-4 w-4 text-[#1FA47A]" />
                      <span>دعاء بعد الصلاة</span>
                    </h4>
                    <p className="text-[11px] text-[#1FA47A]">
                      {postAdhanDuaEnabled
                        ? `بعد الأذان بـ ${
                            postAdhanDuaDelaySeconds >= 60
                              ? `${(postAdhanDuaDelaySeconds / 60).toFixed(postAdhanDuaDelaySeconds % 60 === 0 ? 0 : 1)} دقيقة`
                              : `${postAdhanDuaDelaySeconds} ثانية`
                          } · ${selectedDuaVoice.nameAr}`
                        : 'متوقف حاليًا'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={postAdhanDuaEnabled}
                    onClick={() =>
                      onUpdateSettings((s) => ({
                        ...s,
                        postAdhanDuaEnabled: !postAdhanDuaEnabled,
                      }))
                    }
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      postAdhanDuaEnabled ? 'bg-[#1FA47A]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        postAdhanDuaEnabled ? 'left-1' : 'right-1'
                      }`}
                    />
                  </button>
                </div>

                {postAdhanDuaEnabled && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[#E8DCC8]">
                      توقيت تشغيل الدعاء بعد الأذان:
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        {sec: 30, label: '30 ثانية'},
                        {sec: 60, label: 'دقيقة'},
                        {sec: 135, label: 'دقيقتان وربع'},
                        {sec: 180, label: '3 دقائق'},
                        {sec: 300, label: '5 دقائق'},
                        {sec: 600, label: '10 دقائق'},
                      ].map((opt) => (
                        <button
                          key={opt.sec}
                          type="button"
                          onClick={() =>
                            onUpdateSettings((s) => ({
                              ...s,
                              postAdhanDuaEnabled: true,
                              postAdhanDuaDelaySeconds: opt.sec,
                            }))
                          }
                          className={`min-h-[32px] rounded-xl text-[11px] font-extrabold ${
                            postAdhanDuaDelaySeconds === opt.sec
                              ? 'bg-[#1FA47A] text-white'
                              : 'bg-white/10 text-[#E8DCC8]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1 pt-1">
                      <input
                        type="range"
                        min={30}
                        max={600}
                        step={15}
                        value={Math.min(600, postAdhanDuaDelaySeconds)}
                        onChange={(e) => {
                          const sec = Number(e.target.value);
                          onUpdateSettings((s) => ({
                            ...s,
                            postAdhanDuaEnabled: true,
                            postAdhanDuaDelaySeconds: sec,
                          }));
                        }}
                        className="h-2 w-full cursor-pointer accent-[#1FA47A]"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-[#E8DCC8]/75">
                        <span>30 ثانية</span>
                        <span className="text-[#1FA47A]">
                          {postAdhanDuaDelaySeconds >= 60
                            ? `${Math.floor(postAdhanDuaDelaySeconds / 60)} د ${
                                postAdhanDuaDelaySeconds % 60
                                  ? `${postAdhanDuaDelaySeconds % 60} ث`
                                  : ''
                              }`
                            : `${postAdhanDuaDelaySeconds} ثانية`}
                        </span>
                        <span>10 دقائق</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveVoicePickerTab('dua')}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] px-3 text-xs font-extrabold text-white active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    <span>دعاء بعد الصلاة — اختر الصوت</span>
                  </span>
                  <span className="rounded-lg bg-black/25 px-2 py-0.5 text-[10px]">
                    {POST_ADHAN_DUA_VOICES_10.length} أصوات
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SOUND PICKER MODAL ==================== */}
      {activeVoicePickerTab && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-2 sm:items-center">
          <div className="animate-sheet-up flex max-h-[88dvh] w-full max-w-[400px] flex-col rounded-3xl border-2 border-[#1FA47A] bg-[#0F2225] p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#E8DCC8]">
                  {activeVoicePickerTab === 'pre'
                    ? 'نغمات تنبيه قبل الصلاة (نغمة قصيرة فقط)'
                    : activeVoicePickerTab === 'iqamah'
                      ? 'أصوات الإقامة الحقيقية (بدون أذان أو دعاء)'
                      : 'أصوات دعاء بعد الصلاة'}
                </h3>
                <p className="text-[11px] text-[#1FA47A]">
                  محفوظة للعمل أوفلاين بدون إنترنت
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopAnyAudio();
                  setActiveVoicePickerTab(null);
                }}
                aria-label="رجوع"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1FA47A]/50 text-[#E8DCC8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pl-1 touch-pan-y">
              {(activeVoicePickerTab === 'pre'
                ? PRE_ADHAN_VOICES_10
                : activeVoicePickerTab === 'iqamah'
                  ? IQAMAH_VOICES_10
                  : POST_ADHAN_DUA_VOICES_10
              ).map((voiceItem, idx) => {
                const isSelected =
                  activeVoicePickerTab === 'pre'
                    ? selectedPreVoice.id === voiceItem.id
                    : activeVoicePickerTab === 'iqamah'
                      ? selectedIqamahVoice.id === voiceItem.id
                      : selectedDuaVoice.id === voiceItem.id;
                const playKey = `settings-picker-${activeVoicePickerTab}-${voiceItem.id}`;
                const isThisPlaying = playingId === playKey;

                return (
                  <div
                    key={voiceItem.id}
                    className={`rounded-2xl border p-3 ${
                      isSelected
                        ? 'border-2 border-[#1FA47A] bg-[#1FA47A]/20'
                        : 'border-white/15 bg-black/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-extrabold text-[#E8DCC8]">
                          {idx + 1}. {voiceItem.nameAr}
                        </h4>
                        <p className="truncate text-[11px] text-[#1FA47A]">
                          {voiceItem.muezzinAr} · {voiceItem.locationAr}
                        </p>
                        {voiceItem.descAr && (
                          <p className="mt-0.5 text-[10px] text-[#E8DCC8]/75">
                            {voiceItem.descAr}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <span className="shrink-0 rounded-lg bg-[#1FA47A] px-2 py-0.5 text-[10px] font-extrabold text-white">
                          مختار ✓
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          playSingleAudio(
                            playKey,
                            voiceItem.url,
                            voiceItem.fallbackUrl,
                          )
                        }
                        className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold ${
                          isThisPlaying
                            ? 'border-[#1FA47A] bg-[#1FA47A] text-white'
                            : 'border-[#1FA47A]/50 bg-[#0F2225] text-[#E8DCC8]'
                        }`}
                      >
                        {isThisPlaying ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span>{isThisPlaying ? 'إيقاف' : 'استماع ▶️'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void cacheAudioUrl(voiceItem.url);
                          if (voiceItem.fallbackUrl) {
                            void cacheAudioUrl(voiceItem.fallbackUrl);
                          }
                          if (activeVoicePickerTab === 'pre') {
                            onUpdateSettings((s) => ({
                              ...s,
                              preAdhanEnabled: true,
                              preAdhanMinutes: s.preAdhanMinutes === 5 ? 5 : 10,
                              preferredPreAdhanSound: voiceItem.id,
                            }));
                          } else if (activeVoicePickerTab === 'iqamah') {
                            onUpdateSettings((s) => ({
                              ...s,
                              iqamahEnabled: true,
                              preferredIqamah: voiceItem.id,
                              perPrayerIqamah: {
                                fajr: voiceItem.id,
                                dhuhr: voiceItem.id,
                                asr: voiceItem.id,
                                maghrib: voiceItem.id,
                                isha: voiceItem.id,
                              },
                            }));
                          } else {
                            onUpdateSettings((s) => ({
                              ...s,
                              postAdhanDuaEnabled: true,
                              preferredPostAdhanDua: voiceItem.id,
                            }));
                          }
                          stopAnyAudio();
                          setActiveVoicePickerTab(null);
                        }}
                        className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-gradient-to-l from-[#24B98A] to-[#1FA47A] text-xs font-extrabold text-white active:scale-95"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>اختيار هذا الصوت</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== FULLSCREEN VIDEO / ADHAN LIVE PREVIEW ==================== */}
      {videoPreview && (
        <AdhanLiveModal
          prayerNameAr={videoPreview.prayerNameAr}
          voice={videoPreview.voice}
          cityAr={location.city}
          countryAr={location.country}
          now={now}
          schedule={schedule}
          mode={videoPreview.mode || 'adhan'}
          isPreview
          postAdhanDuaEnabled={postAdhanDuaEnabled}
          iqamahVoice={selectedIqamahVoice}
          iqamahMinutes={iqamahMinutes}
          postAdhanDuaVoice={selectedDuaVoice}
          postAdhanDuaDelaySeconds={postAdhanDuaDelaySeconds}
          onClose={() => setVideoPreview(null)}
        />
      )}
      {/* ==================== OPEN SETTINGS GUIDE MODAL WHEN DENIED ==================== */}
      {showSettingsGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="افتح الإعدادات واسمح"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 p-3 sm:items-center"
        >
          <div className="w-full max-w-sm space-y-3 rounded-3xl border-2 border-rose-400 bg-[#0F2225] p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-rose-400" />
                <h3 className="text-sm font-extrabold text-[#E8DCC8]">
                  افتح الإعدادات واسمح بالأذونات
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsGuide(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 text-[#E8DCC8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs leading-relaxed text-[#E8DCC8]/90">
              {OPEN_SETTINGS_STEPS_AR.map((stepLine) => (
                <p
                  key={stepLine}
                  className="rounded-xl border border-white/10 bg-black/30 p-2.5"
                >
                  {stepLine}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void refreshRealPerms();
                  setShowSettingsGuide(false);
                }}
                className="min-h-[42px] rounded-xl bg-[#1FA47A] px-3 text-xs font-extrabold text-white active:scale-95"
              >
                تحقق من الحالة الآن
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsGuide(false)}
                className="min-h-[42px] rounded-xl border border-white/20 bg-black/30 px-3 text-xs font-bold text-[#E8DCC8] active:scale-95"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
