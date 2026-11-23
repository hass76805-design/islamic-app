import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  Check,
  Clock,
  Download,
  Flame,
  Loader2,
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
import {cacheBatchUrls} from '../utils/offlineAudioCache';
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
}

const PRE_ADHAN_OPTIONS = [
  {minutes: 0, labelAr: 'عند الأذان'},
  {minutes: 5, labelAr: 'قبل 5 د'},
  {minutes: 10, labelAr: 'قبل 10 د'},
  {minutes: 15, labelAr: 'قبل 15 د'},
];

const FIVE_PRAYERS: TrackablePrayer[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];
const OFFSET_KEYS: PrayerKey[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];

export const AdhanMuezzinView: React.FC<AdhanMuezzinViewProps> = ({
  now,
  location,
  onSelectLocation,
  onRequestGps,
  gpsLoading,
  settings,
  onUpdateSettings,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadedAll, setDownloadedAll] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [muezzinSearch, setMuezzinSearch] = useState('');
  const [videoPreview, setVideoPreview] = useState<{
    prayerNameAr: string;
    voice: AdhanVoice;
    mode?: 'adhan' | 'iqamah' | 'dua';
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
  const [testNotifFeedback, setTestNotifFeedback] = useState<string | null>(
    null,
  );

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
    audio.src = url;
    audio.load();
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      if (!usedFallback && !url.startsWith('/audio/')) {
        usedFallback = true;
        audio.src = resolvedFallback;
        audio.load();
        audio.play().catch(() => setPlayingId(null));
        return;
      }
      setPlayingId(null);
      setAudioErr('تعذر تشغيل الصوت حاليًا');
    };
    audio.play().catch(() => {
      if (!usedFallback && !url.startsWith('/audio/')) {
        usedFallback = true;
        audio.src = resolvedFallback;
        audio.load();
        audio.play().catch(() => setPlayingId(null));
      } else {
        setPlayingId(null);
      }
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
      audio.src = POST_PRAYER_AZKAR_AUDIO_URLS[idx];
      setPlayingId('special-post-azkar');
      audio.onended = () => {
        postAzkarIdxRef.current = idx + 1;
        startIdx(idx + 1);
      };
      audio.onerror = () => {
        setPlayingId(null);
        setAudioErr('تعذر تشغيل أذكار بعد الصلاة حاليًا');
      };
      audio.play().catch(() => setPlayingId(null));
    };
    startIdx(0);
  };

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPerm('unsupported');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      onUpdateSettings((s) => ({
        ...s,
        backgroundAlertsEnabled: perm === 'granted',
      }));
      if (perm === 'granted' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const regWithSync = reg as ServiceWorkerRegistration & {
          periodicSync?: {
            register: (tag: string, opts: {minInterval: number}) => Promise<void>;
          };
        };
        if (regWithSync.periodicSync) {
          try {
            await regWithSync.periodicSync.register('adhan-background-check', {
              minInterval: 15 * 60 * 1000,
            });
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const activeIqamahVoice =
    IQAMAH_VOICES_3.find((v) => v.id === settings.preferredIqamah) ||
    IQAMAH_VOICES_3[0];
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

  const handleTestPhoneNotification = async () => {
    setTestNotifFeedback(null);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setTestNotifFeedback('المتصفح لا يدعم إشعارات النظام.');
      return;
    }

    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
      setNotifPerm(perm);
    }

    if (perm !== 'granted') {
      setTestNotifFeedback('الرجاء السماح بالإشعارات لظهور إشعار الأذان.');
      return;
    }

    const chosenAdhanVoice =
      ADHAN_VOICES_30.find((a) => a.id === settings.preferredAdhan) ||
      ADHAN_VOICES_30[0];

    playSingleAudio(
      `test-notif-${chosenAdhanVoice.id}`,
      chosenAdhanVoice.url,
      chosenAdhanVoice.fallbackUrl,
    );

    const payload = {
      title: 'البرنامج الإسلامي الذهبي — المؤذن الإلكتروني',
      body: `تجربة حية لإشعار الأذان (${chosenAdhanVoice.nameAr}) — ${nextPrayer.nextNameAr}`,
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
          setTestNotifFeedback('تم إرسال إشعار الهاتف التجريبي وتشغيل الصوت!');
          return;
        }
      }
      new Notification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      });
      setTestNotifFeedback('تم إرسال إشعار الهاتف وتشغيل الأذان!');
    } catch {
      setTestNotifFeedback('تم تشغيل صوت الأذان التجريبي.');
    }
  };

  const handleDownloadAllAdhan = async () => {
    setDownloadingAll(true);
    const urls = [
      ...ADHAN_VOICES_30.map((a) => a.url),
      ...IQAMAH_VOICES_3.map((i) => i.url),
      ...PRE_ADHAN_VOICES_3.map((p) => p.url),
      ...TAWASIH_NAQSHABANDI.map((t) => t.url),
      ...EID_TAKBEERAT_VOICES_3.map((e) => e.url),
      ...FRIDAY_KAHF_VOICES_3.map((k) => k.url),
      ...POST_PRAYER_AZKAR_AUDIO_URLS,
    ];
    await cacheBatchUrls(urls);
    setDownloadingAll(false);
    setDownloadedAll(true);
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

  const resetOffsets = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      prayerOffsets: {...DEFAULT_PRAYER_OFFSETS},
    }));
  };

  const defaultPreviewVoice =
    ADHAN_VOICES_30.find((a) => a.id === settings.preferredAdhan) ||
    ADHAN_VOICES_30[0];

  return (
    <div className="space-y-4 rounded-3xl bg-[#000000] text-white">
      {/* Electronic Digital Mosque Console Display */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-[#060401] p-4 text-white">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#C9A227]">
              <Radio className="h-4 w-4" />
              <span>لوحة المؤذن الإلكتروني الذكية</span>
            </div>

            <button
              type="button"
              onClick={toggleTimeFormat}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[#C9A227] bg-[#141004] px-2.5 py-1 text-[11px] font-bold text-[#FCE38A]"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{timeFormat === '12' ? '12 ساعة' : '24 ساعة'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {timeFormat === '12' ? (
              <div className="flex items-baseline gap-1.5">
                <span
                  dir="ltr"
                  className="font-mono-num text-4xl font-bold tracking-widest text-[#FCE38A]"
                >
                  {clock12.time}
                </span>
                <span className="text-base font-extrabold text-[#C9A227]">
                  {clock12.periodAr}
                </span>
              </div>
            ) : (
              <span
                dir="ltr"
                className="font-mono-num text-4xl font-bold tracking-widest text-[#FCE38A]"
              >
                {clock24}
              </span>
            )}
            <span className="text-[11px] font-bold text-zinc-300">
              {hijri.weekdayAr} · {hijri.day} {hijri.monthNameAr} {hijri.year} هـ
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-xl border border-[#C9A227]/60 bg-[#C9A227]/15 px-3 py-1 text-xs font-bold text-[#FCE38A]">
              القادمة: {nextPrayer.nextNameAr} ({nextPrayer.remainingFormatted})
            </span>
            <span className="text-xs text-zinc-300">
              {location.city}، {location.country}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                stopAnyAudio();
                setVideoPreview({
                  prayerNameAr: `صلاة ${nextPrayer.nextNameAr}`,
                  voice: defaultPreviewVoice,
                  mode: 'adhan',
                });
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] px-3 py-1.5 text-xs font-extrabold text-black"
            >
              <Video className="h-4 w-4" />
              <span>معاينة شاشة الأذان</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopAnyAudio();
                setVideoPreview({
                  prayerNameAr: nextPrayer.nextNameAr,
                  voice: activeIqamahVoice,
                  mode: 'iqamah',
                });
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#FCE38A] bg-[#141004] px-3 py-1.5 text-xs font-extrabold text-[#FCE38A]"
            >
              <Video className="h-4 w-4 text-[#C9A227]" />
              <span>معاينة الإقامة</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({...s, adhanEnabled: !s.adhanEnabled}))
              }
              className={`col-span-2 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                settings.adhanEnabled
                  ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300'
              }`}
            >
              {settings.adhanEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span>
                {settings.adhanEnabled
                  ? 'الأذان التلقائي مفعّل في وقته الحقيقي'
                  : 'تفعيل الأذان التلقائي'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCityPickerOpen(true)}
              className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-[#C9A227]/70 bg-black px-3 text-xs font-bold text-[#F3D56B]"
            >
              <MapPin className="h-3.5 w-3.5 text-[#C9A227]" />
              <span>تغيير المدينة</span>
            </button>

            <button
              type="button"
              onClick={onRequestGps}
              disabled={gpsLoading}
              className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-[#C9A227]/70 bg-black px-3 text-xs font-bold text-[#F3D56B]"
            >
              <Navigation className="h-3.5 w-3.5 text-[#C9A227]" />
              <span>{gpsLoading ? 'جاري...' : 'تحديد GPS'}</span>
            </button>
          </div>
        </div>

        {/* 6-Time Digital Mosque LED Strip (3x2 clean grid) */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#C9A227]/35 pt-3">
          {schedule.map((item) => (
            <div
              key={item.key}
              className={`flex flex-col items-center rounded-2xl border px-2 py-2 text-center ${
                item.isNext
                  ? 'border-2 border-[#C9A227] bg-[#C9A227]/20'
                  : 'border-[#C9A227]/40 bg-[#080808]'
              }`}
            >
              <span className="text-[11px] font-bold text-zinc-200">
                {item.nameAr}
              </span>
              <span
                dir="ltr"
                className="font-mono-num mt-0.5 text-sm font-bold text-[#FCE38A]"
              >
                {timeFormat === '12'
                  ? formatTime12(item.time)
                  : item.formatted24}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Prayer Muezzin Assignment & Minute Offset */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center justify-between gap-2 border-b border-[#C9A227]/30 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-[#FCE38A]">
              مؤذن وتوقيت كل صلاة
            </h3>
            <p className="text-[11px] text-zinc-400">
              اضبط المؤذن والدقائق لكل صلاة مستقلة
            </p>
          </div>

          <button
            type="button"
            onClick={resetOffsets}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[#C9A227]/65 bg-black px-2.5 text-[11px] font-bold text-[#F3D56B]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>تصفير</span>
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
          {FIVE_PRAYERS.map((key) => {
            const schedItem = schedule.find((s) => s.key === key);
            const offsetVal = offsets[key] || 0;
            const isPrayerEnabled = enabledPrayers[key] ?? true;
            const selectedAdhanId =
              perPrayerAdhan[key] || settings.preferredAdhan;
            const voice =
              ADHAN_VOICES_30.find((a) => a.id === selectedAdhanId) ||
              ADHAN_VOICES_30[0];
            const playKey = `prayer-${key}-${voice.id}`;
            const isPlayingThis = playingId === playKey;

            return (
              <div
                key={key}
                className={`space-y-2.5 rounded-2xl border p-3 transition-opacity ${
                  isPrayerEnabled
                    ? 'border-[#C9A227]/50 bg-[#0A0904]'
                    : 'border-zinc-800 bg-[#050505] opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          enabledPrayers: {
                            ...(prev.enabledPrayers || enabledPrayers),
                            [key]: !isPrayerEnabled,
                          },
                        }))
                      }
                      aria-label={
                        isPrayerEnabled
                          ? `إيقاف أذان ${PRAYER_NAMES_AR[key]}`
                          : `تفعيل أذان ${PRAYER_NAMES_AR[key]}`
                      }
                      className={`inline-flex min-h-[30px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold ${
                        isPrayerEnabled
                          ? 'border-[#C9A227] bg-[#C9A227] text-black'
                          : 'border-zinc-600 bg-black text-zinc-400'
                      }`}
                    >
                      {isPrayerEnabled ? (
                        <Bell className="h-3 w-3" />
                      ) : (
                        <BellOff className="h-3 w-3" />
                      )}
                      <span>{isPrayerEnabled ? 'مفعّل' : 'موقوف'}</span>
                    </button>

                    <div>
                      <p className="text-sm font-bold text-white">
                        صلاة {PRAYER_NAMES_AR[key]}
                      </p>
                      <p
                        dir="ltr"
                        className="font-mono-num text-sm font-bold text-[#F3D56B]"
                      >
                        {schedItem
                          ? timeFormat === '12'
                            ? formatTime12(schedItem.time)
                            : schedItem.formatted24
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`إنقاص دقيقة لصلاة ${PRAYER_NAMES_AR[key]}`}
                      onClick={() => adjustOffset(key, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/60 bg-black text-[#F3D56B]"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span
                      dir="ltr"
                      className="font-mono-num min-w-[40px] text-center text-xs font-bold text-[#F3D56B]"
                    >
                      {offsetVal > 0 ? `+${offsetVal}` : offsetVal} د
                    </span>
                    <button
                      type="button"
                      aria-label={`زيادة دقيقة لصلاة ${PRAYER_NAMES_AR[key]}`}
                      onClick={() => adjustOffset(key, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/60 bg-black text-[#F3D56B]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <select
                  aria-label={`اختيار مؤذن صلاة ${PRAYER_NAMES_AR[key]}`}
                  value={selectedAdhanId}
                  onChange={(e) => {
                    const nextVoiceId = e.target.value;
                    onUpdateSettings((prev) => ({
                      ...prev,
                      perPrayerAdhan: {
                        ...(prev.perPrayerAdhan || perPrayerAdhan),
                        [key]: nextVoiceId,
                      },
                    }));
                  }}
                  className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
                >
                  {ADHAN_VOICES_30.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nameAr} — {v.muezzinAr}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      playSingleAudio(playKey, voice.url, voice.fallbackUrl)
                    }
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] px-3 text-xs font-bold text-black"
                  >
                    {isPlayingThis ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>إيقاف</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>تجربة الصوت</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAnyAudio();
                      setVideoPreview({
                        prayerNameAr: `صلاة ${PRAYER_NAMES_AR[key]}`,
                        voice,
                      });
                    }}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3 text-xs font-bold text-[#FCE38A]"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>معاينة شاشة</span>
                  </button>
                </div>
              </div>
            );
          })}

          {OFFSET_KEYS.includes('sunrise') && (
            <div className="flex items-center justify-between rounded-2xl border border-[#C9A227]/40 bg-[#0A0904] px-3.5 py-2.5">
              <div>
                <span className="text-xs font-bold text-zinc-200">الشروق: </span>
                <span
                  dir="ltr"
                  className="font-mono-num text-xs font-bold text-[#F3D56B]"
                >
                  {(() => {
                    const sun = schedule.find((s) => s.key === 'sunrise');
                    if (!sun) return '';
                    return timeFormat === '12'
                      ? formatTime12(sun.time)
                      : sun.formatted24;
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="إنقاص دقيقة للشروق"
                  onClick={() => adjustOffset('sunrise', -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-white"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span
                  dir="ltr"
                  className="font-mono-num min-w-[36px] text-center text-xs font-bold text-[#F3D56B]"
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
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pre-Adhan Alert + Notifications + Calculation */}
      <div className="space-y-4">
        <div className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
          <h3 className="text-sm font-bold text-[#FCE38A]">
            التنبيه قبل الأذان وإشعارات الهاتف
          </h3>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
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
                  className={`min-h-[38px] rounded-xl border px-1.5 py-1.5 text-[11px] font-bold ${
                    active
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/45 bg-[#0A0904] text-zinc-200'
                  }`}
                >
                  {opt.labelAr}
                </button>
              );
            })}
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
            <label
              htmlFor="pre-adhan-sound"
              className="block text-xs font-bold text-[#FCE38A]"
            >
              صوت التنبيه قبل الأذان (بدون نت)
            </label>
            <select
              id="pre-adhan-sound"
              value={activePreAdhanVoice.id}
              onChange={(e) =>
                onUpdateSettings((s) => ({
                  ...s,
                  preferredPreAdhanSound: e.target.value,
                }))
              }
              className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
            >
              {PRE_ADHAN_VOICES_3.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nameAr}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                playSingleAudio(
                  `pre-${activePreAdhanVoice.id}`,
                  activePreAdhanVoice.url,
                )
              }
              className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-bold text-black"
            >
              {playingId === `pre-${activePreAdhanVoice.id}` ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>تجربة صوت التنبيه</span>
            </button>
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
            <p className="text-xs font-bold text-white">
              إشعارات الهاتف الحقيقية وقت الأذان (PWA)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRequestNotifications}
                className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl px-2.5 text-xs font-bold ${
                  notifPerm === 'granted'
                    ? 'border border-[#C9A227] bg-[#C9A227]/15 text-[#FCE38A]'
                    : 'bg-[#C9A227] text-black'
                }`}
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>{notifPerm === 'granted' ? 'مفعّلة' : 'تفعيل'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestPhoneNotification}
                className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-[#FCE38A] bg-black px-2.5 text-xs font-bold text-[#FCE38A]"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>تجربة الإشعار</span>
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
                const next = !settings.lockScreenKeepAlive;
                if (
                  next &&
                  typeof window !== 'undefined' &&
                  'Notification' in window &&
                  Notification.permission === 'default'
                ) {
                  try {
                    const res = await Notification.requestPermission();
                    setNotifPerm(res);
                  } catch {
                    // ignore
                  }
                }
                onUpdateSettings((s) => ({
                  ...s,
                  lockScreenKeepAlive: next,
                  adhanEnabled: next ? true : s.adhanEnabled,
                }));
                setTestNotifFeedback(
                  next
                    ? 'تم تفعيل تثبيت المؤذن في الخلفية ليعمل الأذان والإقامة والدعاء عند قفل الشاشة'
                    : 'تم إيقاف وضع التثبيت المستمر على قفل الشاشة',
                );
              }}
              className={`inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                settings.lockScreenKeepAlive
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 bg-black text-[#FCE38A]'
              }`}
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>
                {settings.lockScreenKeepAlive
                  ? 'مؤذن قفل الشاشة نشط (يعمل والشاشة مقفولة)'
                  : 'تثبيت المؤذن ليعمل والشاشة مقفولة'}
              </span>
            </button>

            {testNotifFeedback && (
              <p className="text-[11px] font-bold text-[#FCE38A]">
                {testNotifFeedback}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
          <h3 className="text-sm font-bold text-[#FCE38A]">
            المذهب وطريقة الحساب الفلكية
          </h3>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings((s) => ({...s, madhab: 'Shafi'}))}
              className={`min-h-[38px] rounded-xl border text-xs font-bold ${
                settings.madhab === 'Shafi'
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/45 bg-[#0A0904] text-zinc-200'
              }`}
            >
              الشافعي والجمهور
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({...s, madhab: 'Hanafi'}))
              }
              className={`min-h-[38px] rounded-xl border text-xs font-bold ${
                settings.madhab === 'Hanafi'
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/45 bg-[#0A0904] text-zinc-200'
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
            className="mt-2.5 min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-3 text-xs font-bold text-white outline-none"
          >
            {CALCULATION_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.labelAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Special Modules (Single Column Stack) */}
      <div className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <h3 className="text-sm font-bold text-[#FCE38A]">
          شعائر وتنبيهات المؤذن (تعمل بدون نت)
        </h3>

        {/* Ramadan Cannon */}
        <div className="rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#C9A227]" />
              <span className="text-sm font-bold">مدفع رمضان</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({
                  ...s,
                  ramadanCannonEnabled: !s.ramadanCannonEnabled,
                }))
              }
              className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                settings.ramadanCannonEnabled
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.ramadanCannonEnabled ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <button
            type="button"
            onClick={playRamadanCannonSound}
            className="mt-2.5 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black text-xs font-bold text-[#FCE38A]"
          >
            <Play className="h-3.5 w-3.5" />
            <span>تجربة صوت المدفع</span>
          </button>
        </div>

        {/* Fajr Tawasih — Naqshabandi Only */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-[#C9A227]" />
              <span className="text-sm font-bold">
                تواشيح الفجر — الشيخ سيد النقشبندي فقط
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({
                  ...s,
                  fajrTawasihEnabled: !s.fajrTawasihEnabled,
                }))
              }
              className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                settings.fajrTawasihEnabled
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.fajrTawasihEnabled ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <select
            aria-label="اختيار صوت التوشيح"
            value={activeTawasihVoice.id}
            onChange={(e) =>
              onUpdateSettings((s) => ({...s, preferredTawasih: e.target.value}))
            }
            className="min-h-[36px] w-full rounded-xl border border-[#C9A227]/55 bg-black px-2.5 text-xs font-bold text-white outline-none"
          >
            {TAWASIH_NAQSHABANDI.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titleAr} — {t.reciterAr}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              playSingleAudio(
                `tawasih-${activeTawasihVoice.id}`,
                activeTawasihVoice.url,
              )
            }
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-bold text-black"
          >
            {playingId === `tawasih-${activeTawasihVoice.id}` ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>تشغيل التوشيح</span>
          </button>
        </div>

        {/* Eid Takbeerat */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MoonStar className="h-4 w-4 text-[#C9A227]" />
              <span className="text-sm font-bold">تكبيرات العيد (بدون نت)</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({
                  ...s,
                  eidTakbeeratEnabled: !s.eidTakbeeratEnabled,
                }))
              }
              className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                settings.eidTakbeeratEnabled
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.eidTakbeeratEnabled ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <select
            aria-label="اختيار صوت تكبيرات العيد"
            value={activeEidVoice.id}
            onChange={(e) =>
              onUpdateSettings((s) => ({
                ...s,
                preferredEidTakbeer: e.target.value,
              }))
            }
            className="min-h-[36px] w-full rounded-xl border border-[#C9A227]/55 bg-black px-2.5 text-xs font-bold text-white outline-none"
          >
            {EID_TAKBEERAT_VOICES_3.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titleAr} — {v.reciterAr}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              playSingleAudio(`eid-${activeEidVoice.id}`, activeEidVoice.url)
            }
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-bold text-black"
          >
            {playingId === `eid-${activeEidVoice.id}` ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>تشغيل تكبيرات العيد</span>
          </button>
        </div>

        {/* Friday Al-Kahf */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#C9A227]" />
              <span className="text-sm font-bold">قرآن الجمعة (سورة الكهف)</span>
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
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.fridayKahfReminder ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <select
            aria-label="اختيار قارئ قرآن الجمعة"
            value={activeKahfVoice.id}
            onChange={(e) =>
              onUpdateSettings((s) => ({
                ...s,
                preferredFridayKahf: e.target.value,
              }))
            }
            className="min-h-[36px] w-full rounded-xl border border-[#C9A227]/55 bg-black px-2.5 text-xs font-bold text-white outline-none"
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
              playSingleAudio(`kahf-${activeKahfVoice.id}`, activeKahfVoice.url)
            }
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-bold text-black"
          >
            {playingId === `kahf-${activeKahfVoice.id}` ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>استماع لسورة الكهف</span>
          </button>
        </div>

        {/* Post-Prayer Azkar */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#C9A227]" />
              <span className="text-sm font-bold">أذكار بعد الصلاة</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({
                  ...s,
                  postPrayerAzkarEnabled: !s.postPrayerAzkarEnabled,
                }))
              }
              className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                settings.postPrayerAzkarEnabled
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.postPrayerAzkarEnabled ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <button
            type="button"
            onClick={playPostPrayerAzkarSequence}
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-bold text-black"
          >
            {playingId === 'special-post-azkar' ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>تشغيل أذكار بعد الصلاة</span>
          </button>
        </div>

        {/* Iqamah Selector */}
        <div className="space-y-2 rounded-2xl border-2 border-[#C9A227] bg-[#141004] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#FCE38A]">
              مؤذن الإقامة (بدون نت)
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({
                  ...s,
                  iqamahEnabled: !(s.iqamahEnabled ?? true),
                }))
              }
              className={`min-h-[30px] rounded-xl px-3 text-[11px] font-bold ${
                settings.iqamahEnabled ?? true
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.iqamahEnabled ?? true ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <select
            aria-label="اختيار مؤذن الإقامة"
            value={activeIqamahVoice.id}
            onChange={(e) =>
              onUpdateSettings((s) => ({...s, preferredIqamah: e.target.value}))
            }
            className="min-h-[36px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
          >
            {IQAMAH_VOICES_3.map((iq) => (
              <option key={iq.id} value={iq.id}>
                {iq.nameAr} — {iq.muezzinAr}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                playSingleAudio(
                  `iqamah-${activeIqamahVoice.id}`,
                  activeIqamahVoice.url,
                )
              }
              className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#C9A227] bg-black text-xs font-bold text-[#FCE38A]"
            >
              {playingId === `iqamah-${activeIqamahVoice.id}` ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>استماع</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopAnyAudio();
                setVideoPreview({
                  prayerNameAr: nextPrayer.nextNameAr,
                  voice: activeIqamahVoice,
                  mode: 'iqamah',
                });
              }}
              className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-[#C9A227] text-xs font-extrabold text-black"
            >
              <Video className="h-3.5 w-3.5" />
              <span>معاينة</span>
            </button>
          </div>
        </div>

        {/* Qiyam al-Layl (Last Third of the Night) */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/60 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MoonStar className="h-4 w-4 text-[#FCE38A]" />
              <div>
                <span className="text-sm font-bold text-[#FCE38A]">
                  قيام الليل (الثلث الأخير من الليل)
                </span>
                <p className="text-[10px] text-zinc-400">
                  تنبيه تلقائي قبل الفجر في وقت النزول الإلهي المبارك
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
              className={`min-h-[30px] shrink-0 rounded-xl px-3 text-[11px] font-bold ${
                settings.qiyamEnabled ?? true
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.qiyamEnabled ?? true ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="rounded-xl border border-[#C9A227]/35 bg-black px-2.5 py-2">
              <p className="text-[10px] font-bold text-zinc-400">منتصف الليل الشرعي</p>
              <p dir="ltr" className="font-mono-num mt-0.5 text-sm font-bold text-[#FCE38A]">
                {timeFormat === '12'
                  ? formatTime12(qiyamTimes.midpoint)
                  : formatTime24(qiyamTimes.midpoint)}
              </p>
            </div>
            <div className="rounded-xl border border-[#C9A227]/70 bg-[#141004] px-2.5 py-2">
              <p className="text-[10px] font-bold text-[#C9A227]">بداية الثلث الأخير</p>
              <p dir="ltr" className="font-mono-num mt-0.5 text-sm font-bold text-[#FCE38A]">
                {timeFormat === '12'
                  ? formatTime12(qiyamTimes.lastThirdStart)
                  : formatTime24(qiyamTimes.lastThirdStart)}
              </p>
            </div>
          </div>
        </div>

        {/* Post-Adhan Dua */}
        <div className="space-y-2 rounded-2xl border border-[#C9A227]/60 bg-[#0A0904] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#C9A227]" />
              <span className="text-sm font-bold text-[#FCE38A]">
                دعاء ما بعد الأذان التلقائي
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings((s) => ({
                  ...s,
                  postAdhanDuaEnabled: !(s.postAdhanDuaEnabled ?? true),
                }))
              }
              className={`min-h-[30px] shrink-0 rounded-xl px-3 text-[11px] font-bold ${
                settings.postAdhanDuaEnabled ?? true
                  ? 'bg-[#C9A227] text-black'
                  : 'border border-[#C9A227]/50 bg-black text-zinc-200'
              }`}
            >
              {settings.postAdhanDuaEnabled ?? true ? 'مفعّل' : 'تفعيل'}
            </button>
          </div>
          <p className="font-quran rounded-xl border border-[#C9A227]/35 bg-black p-2.5 text-sm leading-relaxed text-zinc-100">
            {POST_ADHAN_DUA.textAr}
          </p>
          <button
            type="button"
            onClick={() => {
              stopAnyAudio();
              setVideoPreview({
                prayerNameAr: nextPrayer.nextNameAr,
                voice: defaultPreviewVoice,
                mode: 'dua',
              });
            }}
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black text-xs font-bold text-[#FCE38A]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>عرض شاشة دعاء ما بعد الأذان</span>
          </button>
        </div>
      </div>

      {/* 30 Muezzins Library & Offline Batch Download */}
      <div className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="space-y-2 border-b border-[#C9A227]/30 pb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-[#C9A227]" />
            <h3 className="text-sm font-bold text-[#FCE38A]">
              مكتبة الـ 30 مؤذنًا الحقيقيين
            </h3>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={muezzinSearch}
              onChange={(e) => setMuezzinSearch(e.target.value)}
              placeholder="ابحث باسم المؤذن أو المدينة..."
              className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/50 bg-black py-1.5 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
            />
          </div>
          <button
            type="button"
            disabled={downloadingAll}
            onClick={handleDownloadAllAdhan}
            className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] px-3 text-xs font-bold text-black disabled:opacity-60"
          >
            {downloadingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : downloadedAll ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>
              {downloadedAll
                ? 'تم حفظ جميع أصوات الـ 30 مؤذنًا أوفلاين'
                : 'تحميل جميع أصوات الـ 30 مؤذنًا بدون نت'}
            </span>
          </button>
        </div>

        {audioErr && (
          <p className="text-xs font-semibold text-rose-400">{audioErr}</p>
        )}

        <div className="space-y-2.5">
          {filteredMuezzins.map((adhan) => {
            const isDefault = settings.preferredAdhan === adhan.id;
            const isPlaying = playingId === adhan.id;
            return (
              <div
                key={adhan.id}
                className={`space-y-2 rounded-2xl border p-3.5 ${
                  isDefault
                    ? 'border-2 border-[#C9A227] bg-[#141004]'
                    : 'border-[#C9A227]/45 bg-[#0A0904]'
                }`}
              >
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {adhan.nameAr}
                  </h4>
                  <p className="text-[11px] text-zinc-300">
                    {adhan.muezzinAr} · {adhan.locationAr}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      playSingleAudio(adhan.id, adhan.url, adhan.fallbackUrl)
                    }
                    className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-[#C9A227] px-2 text-xs font-bold text-black"
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>{isPlaying ? 'إيقاف' : 'استماع'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopAnyAudio();
                      setVideoPreview({
                        prayerNameAr:
                          adhan.id === 'adhan-fajr' ? 'صلاة الفجر' : 'الصلاة',
                        voice: adhan,
                      });
                    }}
                    className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#C9A227] bg-black px-2 text-xs font-bold text-[#FCE38A]"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>معاينة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({
                        ...s,
                        preferredAdhan: adhan.id,
                        perPrayerAdhan: {
                          fajr: adhan.id,
                          dhuhr: adhan.id,
                          asr: adhan.id,
                          maghrib: adhan.id,
                          isha: adhan.id,
                        },
                      }))
                    }
                    className={`min-h-[36px] rounded-xl border px-2 text-[11px] font-bold ${
                      isDefault
                        ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                        : 'border-[#C9A227]/50 bg-black text-zinc-200'
                    }`}
                  >
                    {isDefault ? 'معتمد' : 'تعيين للكل'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* City Picker Modal (400px Mobile Constrained) */}
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
