import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlarmClock,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  MapPin,
  Minus,
  MoonStar,
  Navigation,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {PRESET_CITIES} from '../data/cities';
import {
  ADHAN_VOICES_30,
  EID_TAKBEERAT_VOICES_3,
  FRIDAY_KAHF_VOICES_3,
  IQAMAH_VOICES_3,
  POST_ADHAN_DUA,
  POST_PRAYER_AZKAR_AUDIO_URLS,
  PRE_ADHAN_VOICES_3,
  SALAWAT_AUDIO_TRACKS,
  TAWASIH_NAQSHABANDI,
} from '../data/reciters';
import {
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
  cacheBatchUrls,
  resolveOfflinePlayableUrl,
} from '../utils/offlineAudioCache';
import {
  CALCULATION_METHODS,
  computeDailyPrayerData,
  computeQiyamAlLaylTime,
  DEFAULT_PRAYER_OFFSETS,
  formatClock12,
  formatClock24,
  formatCountdown,
  formatTime12,
  formatTime24,
  PRAYER_NAMES_AR,
} from '../utils/prayerTimes';
import {playRamadanCannonSound} from '../utils/ramadanCannon';
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

type MuezzinSlotKey = TrackablePrayer | 'sunrise' | 'qiyam';
type AccordionKey =
  | 'iqamah'
  | 'pre_adhan'
  | 'tawasih'
  | 'eid'
  | 'more_features';

const PRAYER_SLOTS: Array<{key: MuezzinSlotKey; labelAr: string}> = [
  {key: 'fajr', labelAr: 'الفجر'},
  {key: 'sunrise', labelAr: 'الشروق'},
  {key: 'dhuhr', labelAr: 'الظهر'},
  {key: 'asr', labelAr: 'العصر'},
  {key: 'maghrib', labelAr: 'المغرب'},
  {key: 'isha', labelAr: 'العشاء'},
  {key: 'qiyam', labelAr: 'قيام الليل'},
];

const FIVE_PRAYERS: TrackablePrayer[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];

const PRE_ADHAN_OPTIONS = [
  {minutes: 0, labelAr: 'عند الأذان'},
  {minutes: 5, labelAr: 'قبل 5 د'},
  {minutes: 10, labelAr: 'قبل 10 د'},
  {minutes: 15, labelAr: 'قبل 15 د'},
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
  const [selectedSlot, setSelectedSlot] = useState<MuezzinSlotKey>('fajr');
  const [iqamahSlot, setIqamahSlot] = useState<TrackablePrayer>('fajr');
  const [openAccordion, setOpenAccordion] = useState<AccordionKey | null>(
    'iqamah',
  );

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [muezzinSearch, setMuezzinSearch] = useState('');

  const [videoPreview, setVideoPreview] = useState<{
    prayerNameAr: string;
    voice: AdhanVoice;
    mode?: 'adhan' | 'iqamah' | 'dua' | 'tawasih' | 'eid';
  } | null>(null);

  const [timeFormat, setTimeFormat] = useState<'12' | '24'>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        window.localStorage.getItem('alzahabi_time_format') ||
        window.localStorage.getItem('adhan_live_time_format');
      if (saved === '12' || saved === '24') return saved;
    }
    return '12';
  });

  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window))
      return 'unsupported';
    return Notification.permission;
  });
  const [activationNote, setActivationNote] = useState<string | null>(null);

  useHardwareBack(cityPickerOpen, () => setCityPickerOpen(false));

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const postAzkarIdxRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggleTimeFormat = () => {
    setTimeFormat((prev) => {
      const next = prev === '24' ? '12' : '24';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('alzahabi_time_format', next);
        window.localStorage.setItem('adhan_live_time_format', next);
      }
      return next;
    });
  };

  const offsets: PrayerOffsets =
    settings.prayerOffsets || DEFAULT_PRAYER_OFFSETS;
  const perPrayerAdhan = settings.perPrayerAdhan || {
    fajr: 'adhan-fajr',
    dhuhr: settings.preferredAdhan,
    asr: settings.preferredAdhan,
    maghrib: settings.preferredAdhan,
    isha: settings.preferredAdhan,
  };
  const perPrayerIqamah = settings.perPrayerIqamah || {
    fajr: settings.preferredIqamah || 'iqamah-makkah',
    dhuhr: settings.preferredIqamah || 'iqamah-makkah',
    asr: settings.preferredIqamah || 'iqamah-makkah',
    maghrib: settings.preferredIqamah || 'iqamah-makkah',
    isha: settings.preferredIqamah || 'iqamah-makkah',
  };
  const enabledPrayers = settings.enabledPrayers || {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  };

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
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      location.latitude,
      location.longitude,
      dateKey,
      settings.calculationMethod,
      settings.madhab,
      offsets,
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

  const qiyamTimes = useMemo(
    () =>
      computeQiyamAlLaylTime(
        location.latitude,
        location.longitude,
        now,
        settings.calculationMethod,
        settings.madhab,
        offsets,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      location.latitude,
      location.longitude,
      dateKey,
      settings.calculationMethod,
      settings.madhab,
      offsets,
    ],
  );

  const hijri = useMemo(
    () => getHijriParts(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey],
  );
  const clock24 = formatClock24(now);
  const clock12 = formatClock12(now);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return PRESET_CITIES;
    return PRESET_CITIES.filter(
      (c) => c.city.includes(q) || c.country.includes(q),
    );
  }, [citySearch]);

  const filteredMuezzins = useMemo(() => {
    const q = muezzinSearch.trim();
    if (!q) return ADHAN_VOICES_30;
    return ADHAN_VOICES_30.filter(
      (a) =>
        a.nameAr.includes(q) ||
        a.muezzinAr.includes(q) ||
        a.locationAr.includes(q),
    );
  }, [muezzinSearch]);

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

    const resolvedFallback = fallbackUrl || '/audio/adhan-makkah.mp3';
    let usedFallback = false;
    audio.pause();
    audio.currentTime = 0;
    setPlayingId(id);

    const handleOfflineOrErr = () => {
      setPlayingId(null);
      setAudioErr(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'يرجى الاتصال بالإنترنت لتشغيل هذا الصوت (أو قم بتحميل قسم المؤذن)'
          : 'تعذر تشغيل الصوت حاليًا',
      );
    };

    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      if (!usedFallback && !url.startsWith('/audio/')) {
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
        if (!usedFallback && !url.startsWith('/audio/')) {
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

  const playPostPrayerAzkarSequence = () => {
    setAudioErr(null);
    if (playingId === 'special-post-azkar') {
      stopAnyAudio();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    postAzkarIdxRef.current = 0;

    const startIdx = (idx: number) => {
      if (idx >= POST_PRAYER_AZKAR_AUDIO_URLS.length) {
        setPlayingId(null);
        return;
      }
      const stepUrl = POST_PRAYER_AZKAR_AUDIO_URLS[idx];
      void resolveOfflinePlayableUrl(stepUrl).then((playableUrl) => {
        audio.src = playableUrl;
        setPlayingId('special-post-azkar');
        audio.onended = () => {
          postAzkarIdxRef.current = idx + 1;
          startIdx(idx + 1);
        };
        audio.onerror = () => {
          setPlayingId(null);
          setAudioErr(
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'يرجى الاتصال بالإنترنت لتشغيل أذكار بعد الصلاة'
              : 'تعذر تشغيل أذكار بعد الصلاة حاليًا',
          );
        };
        audio.play().catch(() => setPlayingId(null));
      });
    };
    startIdx(0);
  };

  const handleActivateAdhanSystem = async () => {
    setActivationNote(null);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const offlineAdhanSet = Array.from(
        new Set([
          ...ADHAN_VOICES_30.slice(0, 8).flatMap((v) => [
            v.url,
            ...(v.fallbackUrl ? [v.fallbackUrl] : []),
          ]),
          ...IQAMAH_VOICES_3.map((i) => i.url),
          ...PRE_ADHAN_VOICES_3.map((p) => p.url),
          POST_ADHAN_DUA.audioUrl,
          ...TAWASIH_NAQSHABANDI.map((t) => t.url),
          ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
          ...FRIDAY_KAHF_VOICES_3.map((k) => k.url),
          ...SALAWAT_AUDIO_TRACKS.map((s) => s.url),
          ...POST_PRAYER_AZKAR_AUDIO_URLS,
        ]),
      );
      void cacheBatchUrls(offlineAdhanSet, undefined, 4);
    }
    if (onActivateAdhanEngine) {
      await onActivateAdhanEngine();
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
        setNotifPerm(perm);
        onUpdateSettings((s) => ({
          ...s,
          adhanEnabled: true,
          backgroundAlertsEnabled: true,
          lockScreenKeepAlive: true,
          iqamahEnabled: true,
          postAdhanDuaEnabled: true,
          prayerConfirmReminderEnabled: true,
        }));
        if (perm === 'granted' && 'serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const regWithSync = reg as ServiceWorkerRegistration & {
            sync?: {register: (tag: string) => Promise<void>};
            periodicSync?: {
              register: (tag: string, opts: {minInterval: number}) => Promise<void>;
            };
          };
          if (regWithSync.sync) {
            await regWithSync.sync.register('adhan-background-check').catch(() => {});
          }
          if (regWithSync.periodicSync) {
            await regWithSync.periodicSync
              .register('adhan-background-check', {
                minInterval: 15 * 60 * 1000,
              })
              .catch(() => {});
          }
          reg.active?.postMessage({type: 'CHECK_DUE_ADHAN_ALERTS'});
          setActivationNote(
            'تم تفعيل منبه الأذان الخارجي والإقامة والعمل في الخلفية حتى والهاتف مقفول ✓',
          );
          return;
        }
      } catch {
        // ignore notification API errors
      }
    }
    onUpdateSettings((s) => ({
      ...s,
      adhanEnabled: true,
      backgroundAlertsEnabled: true,
      lockScreenKeepAlive: true,
    }));
    setActivationNote(
      'تم تفعيل المؤذن وتثبيت الخلفية — تأكد من السماح بالإشعارات في إعدادات الجهاز',
    );
  };

  const handleTestBackgroundAlarm = async () => {
    setActivationNote(null);
    const chosenAdhanVoice =
      ADHAN_VOICES_30.find((a) => a.id === settings.preferredAdhan) ||
      ADHAN_VOICES_30[0];

    playSingleAudio(
      `test-notif-${chosenAdhanVoice.id}`,
      chosenAdhanVoice.url,
      chosenAdhanVoice.fallbackUrl,
    );

    if (typeof window !== 'undefined' && 'Notification' in window) {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
        setNotifPerm(perm);
      }
      if (perm === 'granted') {
        const payload = {
          title: 'البرنامج الإسلامي الذهبي — منبه الأذان',
          body: `تجربة منبه الأذان الخارجي (${chosenAdhanVoice.nameAr}) — ${nextPrayer.nextNameAr}`,
          prayerName: nextPrayer.nextNameAr,
          audioUrl: chosenAdhanVoice.url,
          voiceId: chosenAdhanVoice.id,
        };
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg.active) {
              reg.active.postMessage({
                type: 'TEST_ADHAN_NOTIFICATION',
                payload,
              });
              setActivationNote('تم إرسال منبه وإشعار الأذان التجريبي وتشغيل الصوت ✓');
              return;
            }
          }
          new Notification(payload.title, {
            body: payload.body,
            icon: '/pwa-192x192.png',
          });
          setActivationNote('تم إرسال منبه الأذان التجريبي ✓');
          return;
        } catch {
          // fallback note below
        }
      }
    }
    setActivationNote('تم تشغيل صوت الأذان التجريبي.');
  };

  const adjustOffset = (key: PrayerKey, delta: number) => {
    onUpdateSettings((prev) => {
      const currentOffsets = prev.prayerOffsets || DEFAULT_PRAYER_OFFSETS;
      const nextVal = Math.max(
        -30,
        Math.min(30, (currentOffsets[key] || 0) + delta),
      );
      return {
        ...prev,
        prayerOffsets: {
          ...currentOffsets,
          [key]: nextVal,
        },
      };
    });
  };

  const activePreAdhanVoice =
    PRE_ADHAN_VOICES_3.find((v) => v.id === settings.preferredPreAdhanSound) ||
    PRE_ADHAN_VOICES_3[0];
  const activeTawasihVoice =
    TAWASIH_NAQSHABANDI.find((v) => v.id === settings.preferredTawasih) ||
    TAWASIH_NAQSHABANDI[0];
  const activeEidVoice =
    EID_TAKBEERAT_VOICES_3.find((v) => v.id === settings.preferredEidTakbeer) ||
    EID_TAKBEERAT_VOICES_3[0];
  const activeKahfVoice =
    FRIDAY_KAHF_VOICES_3.find((v) => v.id === settings.preferredFridayKahf) ||
    FRIDAY_KAHF_VOICES_3[0];
  const activeSlotIqamahVoice =
    IQAMAH_VOICES_3.find(
      (v) => v.id === (perPrayerIqamah[iqamahSlot] || settings.preferredIqamah),
    ) || IQAMAH_VOICES_3[0];

  const getSlotTimeText = (slotKey: MuezzinSlotKey): string => {
    if (slotKey === 'qiyam') {
      return timeFormat === '12'
        ? formatTime12(qiyamTimes.lastThirdStart)
        : formatTime24(qiyamTimes.lastThirdStart);
    }
    const found = schedule.find((s) => s.key === slotKey);
    if (!found) return '--:--';
    return timeFormat === '12' ? formatTime12(found.time) : found.formatted24;
  };

  const isTrackableSlot =
    selectedSlot !== 'sunrise' && selectedSlot !== 'qiyam';
  const selectedTrackablePrayer: TrackablePrayer = isTrackableSlot
    ? selectedSlot
    : 'fajr';
  const selectedSlotAdhanId =
    perPrayerAdhan[selectedTrackablePrayer] || settings.preferredAdhan;
  const selectedSlotVoice =
    ADHAN_VOICES_30.find((a) => a.id === selectedSlotAdhanId) ||
    ADHAN_VOICES_30[0];
  const isSlotEnabled = isTrackableSlot
    ? (enabledPrayers[selectedTrackablePrayer] ?? true)
    : selectedSlot === 'qiyam'
      ? (settings.qiyamEnabled ?? true)
      : true;

  const isFullyActive =
    settings.adhanEnabled &&
    (settings.lockScreenKeepAlive ?? true) &&
    notifPerm === 'granted';

  return (
    <div className="space-y-4 rounded-3xl bg-[#000000] text-white">
      {/* 1. TOP HERO BAR: BIG ADHAN BACKGROUND ALARM ACTIVATION + COMPACT CLOCK */}
      <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#070501] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C9A227] bg-[#161104] text-[#FCE38A]">
              <AlarmClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#FCE38A]">
                منبه الأذان الذهبي (يعمل خارج التطبيق)
              </h2>
              <p className="text-[11px] text-zinc-300">
                {isFullyActive
                  ? 'نشط الآن — يأذن مع الدعاء والإقامة والتطبيق مقفول ✓'
                  : 'يعمل في الخلفية والهاتف مقفول'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTimeFormat}
            className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-[#C9A227]/70 bg-black px-2.5 text-[11px] font-bold text-[#FCE38A]"
          >
            <Clock className="h-3.5 w-3.5 text-[#C9A227]" />
            <span>{timeFormat === '12' ? '12س' : '24س'}</span>
          </button>
        </div>

        {/* BIG HERO ACTIVATE ADHAN ALARM BUTTON */}
        <button
          type="button"
          onClick={() => void handleActivateAdhanSystem()}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-4 py-3 text-sm font-extrabold text-black active:scale-[0.99]"
        >
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>
            {isFullyActive
              ? 'منبه الأذان مفعّل في الخلفية (تحديث الأذونات)'
              : 'تفعيل الأذان والعمل خارج التطبيق'}
          </span>
        </button>

        {/* Compact Status & Pause Toggle Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleTestBackgroundAlarm()}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227]/70 bg-black px-2.5 text-xs font-bold text-[#FCE38A]"
          >
            <Radio className="h-3.5 w-3.5 text-[#C9A227]" />
            <span>تجربة صوت وإشعار الأذان</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings((s) => ({...s, adhanEnabled: !s.adhanEnabled}))
            }
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold ${
              settings.adhanEnabled
                ? 'border-emerald-500/60 bg-emerald-950/35 text-emerald-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-300'
            }`}
          >
            {settings.adhanEnabled ? (
              <Bell className="h-3.5 w-3.5" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
            <span>{settings.adhanEnabled ? 'الأذان: شغّال' : 'الأذان: متوقف'}</span>
          </button>
        </div>

        {activationNote && (
          <p className="rounded-xl border border-[#C9A227]/50 bg-[#141004] px-3 py-2 text-center text-xs font-bold text-[#FCE38A]">
            {activationNote}
          </p>
        )}

        {/* Compact Digital Clock + City/GPS Bar */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-black px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span
                dir="ltr"
                className="font-mono-num text-3xl font-extrabold tracking-widest text-[#FCE38A]"
              >
                {timeFormat === '12' ? clock12.time : clock24}
              </span>
              {timeFormat === '12' && (
                <span className="text-xs font-extrabold text-[#C9A227]">
                  {clock12.periodAr}
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-xs font-extrabold text-[#FCE38A]">
                القادمة: {nextPrayer.nextNameAr} ({nextPrayer.remainingFormatted})
              </p>
              <p className="text-[10px] text-zinc-400">
                {hijri.weekdayAr} · {hijri.day} {hijri.monthNameAr} {hijri.year} هـ
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#C9A227]/25 pt-2">
            <span className="flex items-center gap-1 truncate text-xs font-bold text-zinc-200">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" />
              <span>
                {location.city}، {location.country}
                {location.isGps ? ' · GPS ✓' : ''}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCityPickerOpen(true)}
                className="min-h-[32px] rounded-xl border border-[#C9A227]/60 bg-[#0D0A02] px-2.5 text-[11px] font-bold text-[#FCE38A]"
              >
                تغيير المدينة
              </button>
              <button
                type="button"
                onClick={onRequestGps}
                disabled={gpsLoading}
                aria-label="تحديث GPS"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#C9A227]/60 bg-[#0D0A02] px-2.5 text-[11px] font-bold text-[#FCE38A]"
              >
                <Navigation className="h-3 w-3 text-[#C9A227]" />
                <span>{gpsLoading ? '...' : 'GPS'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MUEZZIN SELECTION: ALL 7 PRAYERS/TIMES + 30 MUEZZINS WITH FULLSCREEN VIDEO BUTTON */}
      <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#FCE38A]">
              اختيار المؤذن لكل صلاة
            </h3>
            <p className="text-[11px] text-zinc-300">
              اختر الصلاة ثم اختر الشيخ من الـ 30 مؤذنًا أو اضغط علامة الفيديو للملء
            </p>
          </div>
        </div>

        {/* Clean 7-Item Selector Grid (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, Qiyam) */}
        <div className="grid grid-cols-2 gap-2">
          {PRAYER_SLOTS.map((slot) => {
            const isSelected = selectedSlot === slot.key;
            const timeText = getSlotTimeText(slot.key);
            const assignedName =
              slot.key === 'sunrise'
                ? 'شروق الشمس'
                : slot.key === 'qiyam'
                  ? activeTawasihVoice.reciterAr
                  : (
                      ADHAN_VOICES_30.find(
                        (v) =>
                          v.id ===
                          (perPrayerAdhan[slot.key as TrackablePrayer] ||
                            settings.preferredAdhan),
                      ) || ADHAN_VOICES_30[0]
                    ).muezzinAr;

            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => setSelectedSlot(slot.key)}
                className={`flex min-h-[58px] flex-col justify-between rounded-2xl border p-2.5 text-right transition-colors ${
                  slot.key === 'qiyam' ? 'col-span-2' : ''
                } ${
                  isSelected
                    ? 'border-2 border-[#FCE38A] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/45 bg-[#0B0903] text-white'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="text-sm font-extrabold">{slot.labelAr}</span>
                  <span
                    dir="ltr"
                    className={`font-mono-num text-xs font-bold ${
                      isSelected ? 'text-black' : 'text-[#FCE38A]'
                    }`}
                  >
                    {timeText}
                  </span>
                </div>
                <span
                  className={`truncate text-[10px] font-bold ${
                    isSelected ? 'text-black/80' : 'text-zinc-400'
                  }`}
                >
                  {assignedName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Expanded Panel for the Selected Prayer / Slot */}
        <div className="space-y-3 rounded-2xl border border-[#C9A227]/65 bg-[#0B0903] p-3.5">
          {selectedSlot === 'sunrise' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sunrise className="h-5 w-5 text-[#FCE38A]" />
                  <div>
                    <h4 className="text-sm font-extrabold text-[#FCE38A]">
                      وقت الشروق
                    </h4>
                    <p className="text-xs text-zinc-300">
                      نهاية وقت صلاة الفجر وبداية الضحى بعده بـ 15 دقيقة
                    </p>
                  </div>
                </div>
                <span
                  dir="ltr"
                  className="font-mono-num text-base font-extrabold text-[#FCE38A]"
                >
                  {getSlotTimeText('sunrise')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#C9A227]/40 bg-black px-3 py-2">
                <span className="text-xs font-bold text-zinc-200">
                  تعديل الدقائق للشروق
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="إنقاص دقيقة للشروق"
                    onClick={() => adjustOffset('sunrise', -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-[#141004] text-[#FCE38A]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    dir="ltr"
                    className="font-mono-num min-w-[40px] text-center text-xs font-bold text-[#FCE38A]"
                  >
                    {(offsets.sunrise || 0) > 0
                      ? `+${offsets.sunrise}`
                      : offsets.sunrise || 0}{' '}
                    د
                  </span>
                  <button
                    type="button"
                    aria-label="زيادة دقيقة للشروق"
                    onClick={() => adjustOffset('sunrise', 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-[#141004] text-[#FCE38A]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : selectedSlot === 'qiyam' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MoonStar className="h-5 w-5 text-[#FCE38A]" />
                  <div>
                    <h4 className="text-sm font-extrabold text-[#FCE38A]">
                      قيام الليل (الثلث الأخير من الليل)
                    </h4>
                    <p className="text-[11px] text-zinc-300">
                      تنبيه هادئ في وقت السحر بصوت الشيخ النقشبندي
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      qiyamEnabled: !(s.qiyamEnabled ?? true),
                    }))
                  }
                  className={`min-h-[34px] rounded-xl px-3 text-xs font-extrabold ${
                    isSlotEnabled
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-[#C9A227]/50 bg-black text-zinc-300'
                  }`}
                >
                  {isSlotEnabled ? 'مفعّل' : 'موقوف'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-[#C9A227]/35 bg-black px-2 py-2">
                  <p className="text-[10px] font-bold text-zinc-400">
                    منتصف الليل الشرعي
                  </p>
                  <p
                    dir="ltr"
                    className="font-mono-num text-sm font-extrabold text-[#FCE38A]"
                  >
                    {timeFormat === '12'
                      ? formatTime12(qiyamTimes.midpoint)
                      : formatTime24(qiyamTimes.midpoint)}
                  </p>
                </div>
                <div className="rounded-xl border border-[#C9A227] bg-[#141004] px-2 py-2">
                  <p className="text-[10px] font-bold text-[#C9A227]">
                    بداية الثلث الأخير
                  </p>
                  <p
                    dir="ltr"
                    className="font-mono-num text-sm font-extrabold text-[#FCE38A]"
                  >
                    {getSlotTimeText('qiyam')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    playSingleAudio(
                      `qiyam-${activeTawasihVoice.id}`,
                      activeTawasihVoice.url,
                    )
                  }
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-extrabold text-black"
                >
                  {playingId === `qiyam-${activeTawasihVoice.id}` ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span>استماع لمناجاة القيام</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopAnyAudio();
                    setVideoPreview({
                      prayerNameAr: 'قيام الليل',
                      voice: {
                        id: activeTawasihVoice.id,
                        nameAr: activeTawasihVoice.titleAr,
                        muezzinAr: activeTawasihVoice.reciterAr,
                        locationAr: 'السحر المبارك',
                        url: activeTawasihVoice.url,
                      },
                      mode: 'tawasih',
                    });
                  }}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black text-xs font-extrabold text-[#FCE38A]"
                >
                  <Video className="h-4 w-4" />
                  <span>فيديو ملء الشاشة</span>
                </button>
              </div>
            </div>
          ) : (
            /* 5 PRAYERS: FINE-TUNE + ALL 30 MUEZZINS WITH LISTEN & FULLSCREEN VIDEO */
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C9A227]/30 pb-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#FCE38A]">
                    مؤذن صلاة {PRAYER_NAMES_AR[selectedTrackablePrayer]} (
                    {getSlotTimeText(selectedTrackablePrayer)})
                  </h4>
                  <p className="text-[11px] text-zinc-300">
                    المختار حاليًا: {selectedSlotVoice.nameAr}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      enabledPrayers: {
                        ...(prev.enabledPrayers || enabledPrayers),
                        [selectedTrackablePrayer]: !isSlotEnabled,
                      },
                    }))
                  }
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl px-3 text-xs font-bold ${
                    isSlotEnabled
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-400'
                  }`}
                >
                  {isSlotEnabled ? (
                    <Bell className="h-3.5 w-3.5" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5" />
                  )}
                  <span>{isSlotEnabled ? 'مفعّل' : 'موقوف'}</span>
                </button>
              </div>

              {/* Minute Offset & Apply to All */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`إنقاص دقيقة لصلاة ${PRAYER_NAMES_AR[selectedTrackablePrayer]}`}
                    onClick={() => adjustOffset(selectedTrackablePrayer, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/60 bg-black text-[#FCE38A]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    dir="ltr"
                    className="font-mono-num min-w-[44px] text-center text-xs font-bold text-[#FCE38A]"
                  >
                    {(offsets[selectedTrackablePrayer] || 0) > 0
                      ? `+${offsets[selectedTrackablePrayer]}`
                      : offsets[selectedTrackablePrayer] || 0}{' '}
                    د
                  </span>
                  <button
                    type="button"
                    aria-label={`زيادة دقيقة لصلاة ${PRAYER_NAMES_AR[selectedTrackablePrayer]}`}
                    onClick={() => adjustOffset(selectedTrackablePrayer, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/60 bg-black text-[#FCE38A]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        prayerOffsets: {...DEFAULT_PRAYER_OFFSETS},
                      }))
                    }
                    aria-label="تصفير الدقائق"
                    className="flex h-8 items-center gap-1 rounded-xl border border-[#C9A227]/40 bg-black px-2 text-[10px] font-bold text-zinc-300"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>تصفير</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      preferredAdhan: selectedSlotVoice.id,
                      perPrayerAdhan: {
                        fajr: selectedSlotVoice.id,
                        dhuhr: selectedSlotVoice.id,
                        asr: selectedSlotVoice.id,
                        maghrib: selectedSlotVoice.id,
                        isha: selectedSlotVoice.id,
                      },
                    }))
                  }
                  className="min-h-[32px] rounded-xl border border-[#C9A227]/70 bg-black px-2.5 text-[11px] font-bold text-[#FCE38A]"
                >
                  تعميم هذا المؤذن للكل
                </button>
              </div>

              {/* Search within 30 Muezzins */}
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
                <input
                  type="text"
                  value={muezzinSearch}
                  onChange={(e) => setMuezzinSearch(e.target.value)}
                  placeholder="ابحث في الـ 30 مؤذنًا باسم الشيخ أو المدينة..."
                  className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/50 bg-black py-1.5 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
                />
              </div>

              {audioErr && (
                <p className="text-xs font-bold text-rose-400">{audioErr}</p>
              )}

              {/* All 30 Muezzins List (Listen + Fullscreen Video + Select for Selected Prayer) */}
              <div className="max-h-[360px] space-y-2 overflow-y-auto pl-1 touch-pan-y">
                {filteredMuezzins.map((adhan, idx) => {
                  const isChosenForPrayer = selectedSlotAdhanId === adhan.id;
                  const isPlayingThis =
                    playingId === `list-${selectedTrackablePrayer}-${adhan.id}`;

                  return (
                    <div
                      key={adhan.id}
                      className={`rounded-2xl border p-3 ${
                        isChosenForPrayer
                          ? 'border-2 border-[#FCE38A] bg-[#161104]'
                          : 'border-[#C9A227]/35 bg-black'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="truncate text-xs font-extrabold text-white">
                            {idx + 1}. {adhan.nameAr}
                          </h5>
                          <p className="truncate text-[11px] text-zinc-400">
                            {adhan.muezzinAr} · {adhan.locationAr}
                          </p>
                        </div>

                        {isChosenForPrayer && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#C9A227] px-2 py-0.5 text-[10px] font-extrabold text-black">
                            <Check className="h-3 w-3" />
                            <span>مختار</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            playSingleAudio(
                              `list-${selectedTrackablePrayer}-${adhan.id}`,
                              adhan.url,
                              adhan.fallbackUrl,
                            )
                          }
                          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 rounded-xl border border-[#C9A227]/60 bg-[#0D0A02] px-2 text-xs font-bold text-[#FCE38A]"
                        >
                          {isPlayingThis ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlayingThis ? 'إيقاف' : 'استماع'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopAnyAudio();
                            setVideoPreview({
                              prayerNameAr: `صلاة ${PRAYER_NAMES_AR[selectedTrackablePrayer]}`,
                              voice: adhan,
                              mode: 'adhan',
                            });
                          }}
                          aria-label={`فيديو ${adhan.nameAr}`}
                          className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-[#FCE38A]/70 bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                        >
                          <Video className="h-4 w-4 text-[#C9A227]" />
                          <span>فيديو</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((prev) => ({
                              ...prev,
                              preferredAdhan:
                                selectedTrackablePrayer === 'dhuhr'
                                  ? adhan.id
                                  : prev.preferredAdhan,
                              perPrayerAdhan: {
                                ...(prev.perPrayerAdhan || perPrayerAdhan),
                                [selectedTrackablePrayer]: adhan.id,
                              },
                            }))
                          }
                          className={`inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 rounded-xl px-2 text-xs font-extrabold ${
                            isChosenForPrayer
                              ? 'bg-[#C9A227] text-black'
                              : 'bg-[#C9A227]/20 text-[#FCE38A]'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>
                            {isChosenForPrayer
                              ? `لـ ${PRAYER_NAMES_AR[selectedTrackablePrayer]}`
                              : `اختر لـ ${PRAYER_NAMES_AR[selectedTrackablePrayer]}`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 3. CLEAN COLLAPSIBLE SECTIONS BELOW IN USER'S EXACT ORDER */}
      <div className="space-y-3">
        {/* A) IQAMAH PER PRAYER */}
        <section className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505]">
          <button
            type="button"
            onClick={() =>
              setOpenAccordion((prev) => (prev === 'iqamah' ? null : 'iqamah'))
            }
            className="flex min-h-[58px] w-full items-center justify-between gap-2 px-4 py-3 text-right"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 className="h-5 w-5 shrink-0 text-[#C9A227]" />
              <div>
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  اختيار الإقامة (بعد الأذان بـ 15 دقيقة)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {settings.iqamahEnabled ?? true
                    ? `مفعّلة · اختر شيخ الإقامة لكل صلاة`
                    : 'موقوفة حاليًا'}
                </p>
              </div>
            </div>
            {openAccordion === 'iqamah' ? (
              <ChevronUp className="h-5 w-5 text-[#C9A227]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#C9A227]" />
            )}
          </button>

          {openAccordion === 'iqamah' && (
            <div className="space-y-3 border-t border-[#C9A227]/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200">
                  تشغيل أذان الإقامة تلقائيًا بعد 15 دقيقة
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      iqamahEnabled: !(s.iqamahEnabled ?? true),
                    }))
                  }
                  className={`min-h-[32px] rounded-xl px-3 text-xs font-extrabold ${
                    settings.iqamahEnabled ?? true
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-300'
                  }`}
                >
                  {settings.iqamahEnabled ?? true ? 'مفعّل' : 'تفعيل'}
                </button>
              </div>

              {/* Select Prayer for Iqamah */}
              <div className="grid grid-cols-5 gap-1.5">
                {FIVE_PRAYERS.map((p) => {
                  const active = iqamahSlot === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setIqamahSlot(p)}
                      className={`min-h-[36px] rounded-xl border text-xs font-extrabold ${
                        active
                          ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                          : 'border-[#C9A227]/40 bg-black text-zinc-200'
                      }`}
                    >
                      {PRAYER_NAMES_AR[p]}
                    </button>
                  );
                })}
              </div>

              {/* Iqamah Voices with Listen + Fullscreen Video + Select */}
              <div className="space-y-2">
                {IQAMAH_VOICES_3.map((iq) => {
                  const isChosen =
                    (perPrayerIqamah[iqamahSlot] || settings.preferredIqamah) ===
                    iq.id;
                  const isPlayingIq =
                    playingId === `iqamah-${iqamahSlot}-${iq.id}`;
                  return (
                    <div
                      key={iq.id}
                      className={`rounded-2xl border p-3 ${
                        isChosen
                          ? 'border-2 border-[#FCE38A] bg-[#161104]'
                          : 'border-[#C9A227]/35 bg-black'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-white">
                            {iq.nameAr}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {iq.muezzinAr} · {iq.locationAr}
                          </p>
                        </div>
                        {isChosen && (
                          <span className="rounded-lg bg-[#C9A227] px-2 py-0.5 text-[10px] font-extrabold text-black">
                            مختار
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            playSingleAudio(
                              `iqamah-${iqamahSlot}-${iq.id}`,
                              iq.url,
                            )
                          }
                          className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-xl border border-[#C9A227]/60 bg-[#0D0A02] text-xs font-bold text-[#FCE38A]"
                        >
                          {isPlayingIq ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlayingIq ? 'إيقاف' : 'استماع'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopAnyAudio();
                            setVideoPreview({
                              prayerNameAr: `صلاة ${PRAYER_NAMES_AR[iqamahSlot]}`,
                              voice: iq,
                              mode: 'iqamah',
                            });
                          }}
                          className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#FCE38A]/70 bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                        >
                          <Video className="h-4 w-4 text-[#C9A227]" />
                          <span>فيديو</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((prev) => ({
                              ...prev,
                              preferredIqamah: iq.id,
                              perPrayerIqamah: {
                                ...(prev.perPrayerIqamah || perPrayerIqamah),
                                [iqamahSlot]: iq.id,
                              },
                            }))
                          }
                          className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-xl text-xs font-extrabold ${
                            isChosen
                              ? 'bg-[#C9A227] text-black'
                              : 'bg-[#C9A227]/20 text-[#FCE38A]'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>
                            {isChosen
                              ? `لـ ${PRAYER_NAMES_AR[iqamahSlot]}`
                              : `اختر لـ ${PRAYER_NAMES_AR[iqamahSlot]}`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    preferredIqamah: activeSlotIqamahVoice.id,
                    perPrayerIqamah: {
                      fajr: activeSlotIqamahVoice.id,
                      dhuhr: activeSlotIqamahVoice.id,
                      asr: activeSlotIqamahVoice.id,
                      maghrib: activeSlotIqamahVoice.id,
                      isha: activeSlotIqamahVoice.id,
                    },
                  }))
                }
                className="min-h-[36px] w-full rounded-xl border border-[#C9A227]/60 bg-black text-xs font-bold text-[#FCE38A]"
              >
                تعميم «{activeSlotIqamahVoice.nameAr}» لإقامة كل الصلوات
              </button>
            </div>
          )}
        </section>

        {/* B) PRE-ADHAN ALERT */}
        <section className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505]">
          <button
            type="button"
            onClick={() =>
              setOpenAccordion((prev) =>
                prev === 'pre_adhan' ? null : 'pre_adhan',
              )
            }
            className="flex min-h-[58px] w-full items-center justify-between gap-2 px-4 py-3 text-right"
          >
            <div className="flex items-center gap-2.5">
              <BellRing className="h-5 w-5 shrink-0 text-[#C9A227]" />
              <div>
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  التنبيه قبل الأذان (قربت الصلاة)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {settings.preAdhanMinutes > 0
                    ? `قبل الصلاة بـ ${settings.preAdhanMinutes} دقائق · ${activePreAdhanVoice.nameAr}`
                    : 'عند وقت الأذان فقط'}
                </p>
              </div>
            </div>
            {openAccordion === 'pre_adhan' ? (
              <ChevronUp className="h-5 w-5 text-[#C9A227]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#C9A227]" />
            )}
          </button>

          {openAccordion === 'pre_adhan' && (
            <div className="space-y-3 border-t border-[#C9A227]/30 p-4">
              <div className="grid grid-cols-4 gap-1.5">
                {PRE_ADHAN_OPTIONS.map((opt) => {
                  const active = settings.preAdhanMinutes === opt.minutes;
                  return (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((s) => ({
                          ...s,
                          preAdhanMinutes: opt.minutes,
                        }))
                      }
                      className={`min-h-[38px] rounded-xl border text-[11px] font-extrabold ${
                        active
                          ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                          : 'border-[#C9A227]/45 bg-black text-zinc-200'
                      }`}
                    >
                      {opt.labelAr}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                {PRE_ADHAN_VOICES_3.map((v) => {
                  const isChosen = activePreAdhanVoice.id === v.id;
                  const isPlayingThis = playingId === `pre-${v.id}`;
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${
                        isChosen
                          ? 'border-2 border-[#FCE38A] bg-[#161104]'
                          : 'border-[#C9A227]/35 bg-black'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-white">
                          {v.nameAr}
                        </p>
                        <p className="truncate text-[10px] text-zinc-400">
                          {v.descAr}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => playSingleAudio(`pre-${v.id}`, v.url)}
                          aria-label={`استماع لـ ${v.nameAr}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/60 bg-black text-[#FCE38A]"
                        >
                          {isPlayingThis ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((s) => ({
                              ...s,
                              preferredPreAdhanSound: v.id,
                            }))
                          }
                          className={`min-h-[36px] rounded-xl px-3 text-xs font-extrabold ${
                            isChosen
                              ? 'bg-[#C9A227] text-black'
                              : 'bg-[#C9A227]/20 text-[#FCE38A]'
                          }`}
                        >
                          {isChosen ? 'مختار' : 'اختيار'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* C) NAQSHABANDI TAWASIH ONLY */}
        <section className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505]">
          <button
            type="button"
            onClick={() =>
              setOpenAccordion((prev) =>
                prev === 'tawasih' ? null : 'tawasih',
              )
            }
            className="flex min-h-[58px] w-full items-center justify-between gap-2 px-4 py-3 text-right"
          >
            <div className="flex items-center gap-2.5">
              <Sunrise className="h-5 w-5 shrink-0 text-[#C9A227]" />
              <div>
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  التواشيح — الشيخ سيد النقشبندي
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {settings.fajrTawasihEnabled
                    ? `مفعّلة قبل الفجر · ${activeTawasihVoice.titleAr}`
                    : 'موقوفة'}
                </p>
              </div>
            </div>
            {openAccordion === 'tawasih' ? (
              <ChevronUp className="h-5 w-5 text-[#C9A227]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#C9A227]" />
            )}
          </button>

          {openAccordion === 'tawasih' && (
            <div className="space-y-3 border-t border-[#C9A227]/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200">
                  تشغيل قبل أذان الفجر بـ 20 دقيقة
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      fajrTawasihEnabled: !s.fajrTawasihEnabled,
                    }))
                  }
                  className={`min-h-[32px] rounded-xl px-3 text-xs font-extrabold ${
                    settings.fajrTawasihEnabled
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-300'
                  }`}
                >
                  {settings.fajrTawasihEnabled ? 'مفعّل' : 'تفعيل'}
                </button>
              </div>

              <div className="space-y-2">
                {TAWASIH_NAQSHABANDI.map((t) => {
                  const isChosen = activeTawasihVoice.id === t.id;
                  const isPlayingThis = playingId === `tawasih-${t.id}`;
                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl border p-3 ${
                        isChosen
                          ? 'border-2 border-[#FCE38A] bg-[#161104]'
                          : 'border-[#C9A227]/35 bg-black'
                      }`}
                    >
                      <p className="text-xs font-extrabold text-white">
                        {t.titleAr}
                      </p>
                      <p className="text-[11px] text-zinc-400">{t.reciterAr}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            playSingleAudio(`tawasih-${t.id}`, t.url)
                          }
                          className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-xl border border-[#C9A227]/60 bg-black text-xs font-bold text-[#FCE38A]"
                        >
                          {isPlayingThis ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlayingThis ? 'إيقاف' : 'استماع'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            stopAnyAudio();
                            setVideoPreview({
                              prayerNameAr: 'تواشيح الفجر',
                              voice: {
                                id: t.id,
                                nameAr: t.titleAr,
                                muezzinAr: t.reciterAr,
                                locationAr: 'مصر',
                                url: t.url,
                              },
                              mode: 'tawasih',
                            });
                          }}
                          className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#FCE38A]/70 bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                        >
                          <Video className="h-4 w-4 text-[#C9A227]" />
                          <span>فيديو</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((s) => ({
                              ...s,
                              preferredTawasih: t.id,
                            }))
                          }
                          className={`min-h-[36px] flex-1 rounded-xl text-xs font-extrabold ${
                            isChosen
                              ? 'bg-[#C9A227] text-black'
                              : 'bg-[#C9A227]/20 text-[#FCE38A]'
                          }`}
                        >
                          {isChosen ? 'مختار' : 'اختيار'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* D) EID TAKBEERAT */}
        <section className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505]">
          <button
            type="button"
            onClick={() =>
              setOpenAccordion((prev) => (prev === 'eid' ? null : 'eid'))
            }
            className="flex min-h-[58px] w-full items-center justify-between gap-2 px-4 py-3 text-right"
          >
            <div className="flex items-center gap-2.5">
              <MoonStar className="h-5 w-5 shrink-0 text-[#C9A227]" />
              <div>
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  تكبيرات العيد المباركة (بدون نت)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {settings.eidTakbeeratEnabled
                    ? `مفعّلة · ${activeEidVoice.titleAr}`
                    : 'موقوفة'}
                </p>
              </div>
            </div>
            {openAccordion === 'eid' ? (
              <ChevronUp className="h-5 w-5 text-[#C9A227]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#C9A227]" />
            )}
          </button>

          {openAccordion === 'eid' && (
            <div className="space-y-3 border-t border-[#C9A227]/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200">
                  تشغيل تلقائي صباح العيد
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      eidTakbeeratEnabled: !s.eidTakbeeratEnabled,
                    }))
                  }
                  className={`min-h-[32px] rounded-xl px-3 text-xs font-extrabold ${
                    settings.eidTakbeeratEnabled
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-300'
                  }`}
                >
                  {settings.eidTakbeeratEnabled ? 'مفعّل' : 'تفعيل'}
                </button>
              </div>

              <div className="space-y-2">
                {EID_TAKBEERAT_VOICES_3.map((v) => {
                  const isChosen = activeEidVoice.id === v.id;
                  const isPlayingThis = playingId === `eid-${v.id}`;
                  return (
                    <div
                      key={v.id}
                      className={`rounded-2xl border p-3 ${
                        isChosen
                          ? 'border-2 border-[#FCE38A] bg-[#161104]'
                          : 'border-[#C9A227]/35 bg-black'
                      }`}
                    >
                      <p className="text-xs font-extrabold text-white">
                        {v.titleAr}
                      </p>
                      <p className="text-[11px] text-zinc-400">{v.reciterAr}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => playSingleAudio(`eid-${v.id}`, v.url)}
                          className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-xl border border-[#C9A227]/60 bg-black text-xs font-bold text-[#FCE38A]"
                        >
                          {isPlayingThis ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlayingThis ? 'إيقاف' : 'استماع'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            stopAnyAudio();
                            setVideoPreview({
                              prayerNameAr: 'تكبيرات العيد',
                              voice: {
                                id: v.id,
                                nameAr: v.titleAr,
                                muezzinAr: v.reciterAr,
                                locationAr: 'الحرمين الشريفين',
                                url: v.url,
                              },
                              mode: 'eid',
                            });
                          }}
                          className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#FCE38A]/70 bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                        >
                          <Video className="h-4 w-4 text-[#C9A227]" />
                          <span>فيديو</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((s) => ({
                              ...s,
                              preferredEidTakbeer: v.id,
                            }))
                          }
                          className={`min-h-[36px] flex-1 rounded-xl text-xs font-extrabold ${
                            isChosen
                              ? 'bg-[#C9A227] text-black'
                              : 'bg-[#C9A227]/20 text-[#FCE38A]'
                          }`}
                        >
                          {isChosen ? 'مختار' : 'اختيار'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* E) POST-ADHAN DUA, PRAY-CONFIRM, RAMADAN CANNON, KAHF, METHOD & OFFLINE PACK */}
        <section className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505]">
          <button
            type="button"
            onClick={() =>
              setOpenAccordion((prev) =>
                prev === 'more_features' ? null : 'more_features',
              )
            }
            className="flex min-h-[58px] w-full items-center justify-between gap-2 px-4 py-3 text-right"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 shrink-0 text-[#C9A227]" />
              <div>
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  دعاء الأذان · تذكير «صليت» · رمضان · الكهف · الحساب
                </h3>
                <p className="text-[11px] text-zinc-400">
                  إعدادات الدعاء، تذكير الصلاة، طريقة الحساب والمذهب الفقهي
                </p>
              </div>
            </div>
            {openAccordion === 'more_features' ? (
              <ChevronUp className="h-5 w-5 text-[#C9A227]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#C9A227]" />
            )}
          </button>

          {openAccordion === 'more_features' && (
            <div className="space-y-3 border-t border-[#C9A227]/30 p-4">
              {/* Post-Adhan Dua */}
              <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#FCE38A]">
                    دعاء ما بعد الأذان تلقائيًا (صوت شيخ)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({
                        ...s,
                        postAdhanDuaEnabled: !(s.postAdhanDuaEnabled ?? true),
                      }))
                    }
                    className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                      settings.postAdhanDuaEnabled ?? true
                        ? 'bg-[#C9A227] text-black'
                        : 'border border-zinc-700 bg-black text-zinc-300'
                    }`}
                  >
                    {settings.postAdhanDuaEnabled ?? true ? 'مفعّل' : 'تفعيل'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      playSingleAudio('post-adhan-dua', POST_ADHAN_DUA.audioUrl)
                    }
                    className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-[#C9A227] text-xs font-bold text-black"
                  >
                    {playingId === 'post-adhan-dua' ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>استماع للدعاء</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopAnyAudio();
                      setVideoPreview({
                        prayerNameAr: nextPrayer.nextNameAr,
                        voice: selectedSlotVoice,
                        mode: 'dua',
                      });
                    }}
                    className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#C9A227] bg-black text-xs font-bold text-[#FCE38A]"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>فيديو الدعاء</span>
                  </button>
                </div>
              </div>

              {/* Prayer Confirm Reminder */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
                <div>
                  <p className="text-xs font-extrabold text-white">
                    تنبيه متكرر حتى تضغط «صليت ✓»
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    يفكّرك كل 5 دقائق بعد الأذان حتى تأكيد الصلاة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      prayerConfirmReminderEnabled: !(
                        s.prayerConfirmReminderEnabled ?? true
                      ),
                    }))
                  }
                  className={`min-h-[30px] shrink-0 rounded-xl px-3 text-[11px] font-bold ${
                    settings.prayerConfirmReminderEnabled ?? true
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-300'
                  }`}
                >
                  {settings.prayerConfirmReminderEnabled ?? true
                    ? 'مفعّل'
                    : 'تفعيل'}
                </button>
              </div>

              {/* Ramadan Cannon */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[#C9A227]" />
                  <div>
                    <p className="text-xs font-extrabold text-white">
                      مدفع رمضان عند المغرب
                    </p>
                    <button
                      type="button"
                      onClick={playRamadanCannonSound}
                      className="text-[11px] font-bold text-[#FCE38A] underline"
                    >
                      تجربة صوت المدفع
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      ramadanCannonEnabled: !s.ramadanCannonEnabled,
                    }))
                  }
                  className={`min-h-[30px] shrink-0 rounded-xl px-3 text-[11px] font-bold ${
                    settings.ramadanCannonEnabled
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-300'
                  }`}
                >
                  {settings.ramadanCannonEnabled ? 'مفعّل' : 'تفعيل'}
                </button>
              </div>

              {/* Friday Al-Kahf */}
              <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#C9A227]" />
                    <span className="text-xs font-extrabold text-white">
                      سورة الكهف يوم الجمعة
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({
                        ...s,
                        fridayKahfReminder: !s.fridayKahfReminder,
                      }))
                    }
                    className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                      settings.fridayKahfReminder
                        ? 'bg-[#C9A227] text-black'
                        : 'border border-zinc-700 bg-black text-zinc-300'
                    }`}
                  >
                    {settings.fridayKahfReminder ? 'مفعّل' : 'تفعيل'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    aria-label="قارئ سورة الكهف"
                    value={activeKahfVoice.id}
                    onChange={(e) =>
                      onUpdateSettings((s) => ({
                        ...s,
                        preferredFridayKahf: e.target.value,
                      }))
                    }
                    className="min-h-[36px] flex-1 rounded-xl border border-[#C9A227]/55 bg-black px-2 text-xs font-bold text-white outline-none"
                  >
                    {FRIDAY_KAHF_VOICES_3.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.reciterAr}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      playSingleAudio(
                        `kahf-${activeKahfVoice.id}`,
                        activeKahfVoice.url,
                      )
                    }
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#C9A227] px-3 text-xs font-bold text-black"
                  >
                    {playingId === `kahf-${activeKahfVoice.id}` ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>تشغيل</span>
                  </button>
                </div>
              </div>

              {/* Post-Prayer Azkar */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
                <div>
                  <p className="text-xs font-extrabold text-white">
                    أذكار بعد الصلاة
                  </p>
                  <button
                    type="button"
                    onClick={playPostPrayerAzkarSequence}
                    className="text-[11px] font-bold text-[#FCE38A] underline"
                  >
                    {playingId === 'special-post-azkar'
                      ? 'إيقاف الأذكار'
                      : 'استماع الآن'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings((s) => ({
                      ...s,
                      postPrayerAzkarEnabled: !s.postPrayerAzkarEnabled,
                    }))
                  }
                  className={`min-h-[30px] shrink-0 rounded-xl px-3 text-[11px] font-bold ${
                    settings.postPrayerAzkarEnabled
                      ? 'bg-[#C9A227] text-black'
                      : 'border border-zinc-700 bg-black text-zinc-300'
                  }`}
                >
                  {settings.postPrayerAzkarEnabled ? 'مفعّل' : 'تفعيل'}
                </button>
              </div>

              {/* Calculation Method & Madhab */}
              <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
                <p className="text-xs font-extrabold text-[#FCE38A]">
                  طريقة الحساب والمذهب الفقهي
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({...s, madhab: 'Shafi'}))
                    }
                    className={`min-h-[36px] rounded-xl border text-xs font-bold ${
                      settings.madhab === 'Shafi'
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/45 bg-black text-zinc-200'
                    }`}
                  >
                    الشافعي والجمهور
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({...s, madhab: 'Hanafi'}))
                    }
                    className={`min-h-[36px] rounded-xl border text-xs font-bold ${
                      settings.madhab === 'Hanafi'
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/45 bg-black text-zinc-200'
                    }`}
                  >
                    المذهب الحنفي
                  </button>
                </div>
                <select
                  aria-label="طريقة الحساب المعتمدة"
                  value={settings.calculationMethod}
                  onChange={(e) =>
                    onUpdateSettings((s) => ({
                      ...s,
                      calculationMethod: e.target.value as CalculationMethodId,
                    }))
                  }
                  className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
                >
                  {CALCULATION_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.labelAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* City Picker Modal */}
      {cityPickerOpen && (
        <div className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[400px] -translate-x-1/2 items-center justify-center bg-black/90 p-3">
          <div className="flex max-h-[85vh] w-full flex-col rounded-3xl border-2 border-[#C9A227] bg-[#050505] text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/35 px-4 py-3.5">
              <h3 className="text-sm font-bold text-[#FCE38A]">
                اختيار المدينة للمؤذن
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
                  className="w-full rounded-xl border border-[#C9A227]/50 bg-[#0D0D0D] py-2.5 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
                />
              </div>
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
                  className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[#C9A227]/30 bg-[#0A0904] px-3 py-2 text-right"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{c.city}</p>
                    <p className="text-[11px] text-zinc-400">{c.country}</p>
                  </div>
                  <span className="font-mono-num text-xs text-[#C9A227]">
                    {c.latitude.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Video Overlay */}
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
          onClose={() => setVideoPreview(null)}
        />
      )}
    </div>
  );
};
