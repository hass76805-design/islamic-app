import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlarmClock,
  BellRing,
  Check,
  Clock,
  Copy,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  resolveSalawatTrackById,
  SALAWAT_AUDIO_TRACKS,
} from '../data/reciters';
import {useLocalStorage} from '../hooks/useLocalStorage';
import {AppSettings} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {
  cacheAudioUrl,
  resolveOfflinePlayableUrl,
} from '../utils/offlineAudioCache';
import {
  OPEN_SETTINGS_STEPS_AR,
  openNativeOrBrowserSettings,
  readRealPermissionsSnapshot,
  requestRealNotificationPermission,
  subscribePermissionChanges,
} from '../utils/permissions';

interface SalawatViewProps {
  settings: AppSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const TARGET_OPTIONS = [10, 33, 100, 1000, 0] as const;
const REMINDER_INTERVAL_OPTIONS: Array<{minutes: number; labelAr: string}> = [
  {minutes: 1, labelAr: 'كل دقيقة'},
  {minutes: 5, labelAr: 'كل 5 دقائق'},
  {minutes: 10, labelAr: 'كل 10 دقائق'},
  {minutes: 15, labelAr: 'كل 15 دقيقة'},
  {minutes: 30, labelAr: 'كل 30 دقيقة'},
  {minutes: 60, labelAr: 'كل ساعة'},
];
const SALAWAT_ANCHOR_STORAGE_KEY = 'alzahabi_salawat_anchor_v1';

interface SalawatStats {
  count: number;
  cycles: number;
  totalAllTime: number;
  target: number;
}

// Persistent module-level background Salawat audio engine so playback continues
// across screen navigation and lock screen until the user pauses it.
let sharedAudio: HTMLAudioElement | null = null;
let sharedPlayingTrackId: string | null = null;
let sharedLoopEnabled = true;
const sharedListeners = new Set<() => void>();

function notifySharedListeners() {
  for (const listener of sharedListeners) {
    listener();
  }
}

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

function stopSharedSalawatAudio() {
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
  }
  sharedPlayingTrackId = null;
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'paused';
    } catch {
      // ignore
    }
  }
  notifySharedListeners();
}

function startSharedSalawatAudio(
  trackId: string,
  options?: {restart?: boolean; loop?: boolean},
) {
  const track = resolveSalawatTrackById(trackId);
  const audio = getSharedAudio();
  const loop = options?.loop ?? sharedLoopEnabled;
  sharedLoopEnabled = loop;

  if (!options?.restart && sharedPlayingTrackId === track.id && !audio.paused) {
    stopSharedSalawatAudio();
    return false;
  }

  audio.pause();
  audio.currentTime = 0;
  audio.loop = loop;
  sharedPlayingTrackId = track.id;
  notifySharedListeners();

  audio.onended = () => {
    if (!audio.loop) {
      sharedPlayingTrackId = null;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch {
          // ignore
        }
      }
      notifySharedListeners();
    }
  };
  audio.onerror = () => {
    sharedPlayingTrackId = null;
    notifySharedListeners();
  };

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `صلِّ على النبي ﷺ — ${track.titleAr}`,
        artist: track.reciterAr,
        album: 'البرنامج الإسلامي الذهبي',
        artwork: [{src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png'}],
      });
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler('play', () => {
        audio.play().catch(() => {});
        sharedPlayingTrackId = track.id;
        navigator.mediaSession.playbackState = 'playing';
        notifySharedListeners();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        stopSharedSalawatAudio();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopSharedSalawatAudio();
      });
    } catch {
      // ignore unsupported mediaSession actions
    }
  }

  void cacheAudioUrl(track.url);
  void resolveOfflinePlayableUrl(track.url).then((playableUrl) => {
    audio.src = playableUrl;
    audio.loop = sharedLoopEnabled;
    audio.load();
    audio.play().catch(() => {
      sharedPlayingTrackId = null;
      notifySharedListeners();
    });
  });

  return true;
}

function writeSalawatAnchor(intervalMin: number, ts = Date.now()) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SALAWAT_ANCHOR_STORAGE_KEY,
      JSON.stringify({ts, interval: intervalMin}),
    );
  } catch {
    // ignore storage errors
  }
}

function readSalawatAnchor(intervalMin: number): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SALAWAT_ANCHOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {ts?: number; interval?: number};
    if (typeof parsed.ts === 'number' && parsed.interval === intervalMin) {
      return parsed.ts;
    }
    return null;
  } catch {
    return null;
  }
}

function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playGoldenBeadAudio(isLapComplete: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext})
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (isLapComplete) {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.16, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.48);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(698.46, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // ignore WebAudio restrictions
  }
}

export const SalawatView: React.FC<SalawatViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [stats, setStats] = useLocalStorage<SalawatStats>(
    'alzahabi_salawat_stats_v1',
    {
      count: 0,
      cycles: 0,
      totalAllTime: 0,
      target: 33,
    },
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    () =>
      settings.preferredSalawatTrack
        ? resolveSalawatTrackById(settings.preferredSalawatTrack).id
        : SALAWAT_AUDIO_TRACKS[0].id,
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sheikhTapVoiceEnabled, setSheikhTapVoiceEnabled] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(
    () => sharedPlayingTrackId,
  );
  const [continuousLoop, setContinuousLoop] = useState<boolean>(
    () => sharedLoopEnabled,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [showNotifHelp, setShowNotifHelp] = useState(false);
  const [nextReminderText, setNextReminderText] = useState<string>('');
  const [testAlertNotice, setTestAlertNotice] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);

  useHardwareBack(timePickerOpen, () => setTimePickerOpen(false));
  useHardwareBack(voicePickerOpen, () => setVoicePickerOpen(false));

  const lastTapRef = useRef(0);

  useEffect(() => {
    let active = true;
    const sync = () => {
      setPlayingTrackId(sharedPlayingTrackId);
      setContinuousLoop(sharedLoopEnabled);
    };
    const syncPerm = () => {
      void readRealPermissionsSnapshot().then((snap) => {
        if (active) setNotifStatus(snap.notifications.status);
      });
    };
    sharedListeners.add(sync);
    sync();
    syncPerm();
    const unsubPerms = subscribePermissionChanges(syncPerm);
    return () => {
      active = false;
      sharedListeners.delete(sync);
      unsubPerms();
    };
  }, []);

  const activeTrack = useMemo(
    () => resolveSalawatTrackById(selectedTrackId),
    [selectedTrackId],
  );

  const reminderEnabled = Boolean(settings.salawatReminderEnabled);
  const intervalMinutes = settings.salawatIntervalMinutes || 10;

  // Live countdown to next automatic background Salawat alarm
  useEffect(() => {
    if (!reminderEnabled) {
      setNextReminderText('');
      return;
    }
    const updateCountdown = () => {
      const intervalMs = intervalMinutes * 60 * 1000;
      let anchor = readSalawatAnchor(intervalMinutes);
      if (!anchor) {
        anchor = Date.now();
        writeSalawatAnchor(intervalMinutes, anchor);
      }
      const elapsed = Math.max(0, Date.now() - anchor);
      const remainder = intervalMs - (elapsed % intervalMs);
      setNextReminderText(formatCountdownMs(remainder));
    };
    updateCountdown();
    const id = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(id);
  }, [reminderEnabled, intervalMinutes]);

  const playSheikhTrack = (
    trackId: string,
    restartIfSame = false,
    loopOverride?: boolean,
  ) => {
    startSharedSalawatAudio(trackId, {
      restart: restartIfSame,
      loop: loopOverride ?? continuousLoop,
    });
  };

  const handleSelectTrack = (trackId: string) => {
    const track = resolveSalawatTrackById(trackId);
    setSelectedTrackId(track.id);
    void cacheAudioUrl(track.url);
    onUpdateSettings((prev) => ({
      ...prev,
      preferredSalawatTrack: track.id,
    }));
    if (sharedPlayingTrackId) {
      startSharedSalawatAudio(track.id, {restart: true, loop: continuousLoop});
    }
  };

  const ensureNotificationPermission = async (): Promise<boolean> => {
    const status = await requestRealNotificationPermission();
    setNotifStatus(status === 'prompt' ? 'default' : status);
    if (status === 'denied') {
      setShowNotifHelp(true);
    }
    return status === 'granted';
  };

  const handleMainPlaySalawatButton = async () => {
    const track = resolveSalawatTrackById(selectedTrackId);
    const started = startSharedSalawatAudio(track.id, {
      loop: continuousLoop,
    });

    if (started) {
      await ensureNotificationPermission();
      writeSalawatAnchor(intervalMinutes, Date.now());
      onUpdateSettings((prev) => ({
        ...prev,
        preferredSalawatTrack: track.id,
        salawatReminderEnabled: true,
        salawatIntervalMinutes: prev.salawatIntervalMinutes || 10,
        backgroundAlertsEnabled: true,
        lockScreenKeepAlive: true,
      }));
      setTestAlertNotice(
        `يعمل الآن في الخلفية: ${track.titleAr} (${track.reciterAr}) — سيستمر عند التنقل وقفل الشاشة بدون نت ✓`,
      );
      window.setTimeout(() => setTestAlertNotice(null), 4500);
    }
  };

  const handleRosaryTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 80) return;
    lastTapRef.current = now;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(14);
      } catch {
        // ignore
      }
    }

    let completedCycleNow = false;
    setStats((prev) => {
      const target = prev.target;
      let nextCount = prev.count + 1;
      let nextCycles = prev.cycles;
      if (target > 0 && nextCount >= target) {
        nextCount = 0;
        nextCycles += 1;
        completedCycleNow = true;
      }
      if (soundEnabled && !sheikhTapVoiceEnabled) {
        playGoldenBeadAudio(completedCycleNow);
      }
      return {
        ...prev,
        count: nextCount,
        cycles: nextCycles,
        totalAllTime: prev.totalAllTime + 1,
      };
    });

    if (sheikhTapVoiceEnabled) {
      playSheikhTrack(activeTrack.id, true, false);
    }
  };

  const handleToggleBackgroundReminder = async () => {
    const nextEnabled = !reminderEnabled;
    if (nextEnabled) {
      await ensureNotificationPermission();
      writeSalawatAnchor(intervalMinutes, Date.now());
    }
    onUpdateSettings((prev) => ({
      ...prev,
      salawatReminderEnabled: nextEnabled,
      salawatIntervalMinutes: prev.salawatIntervalMinutes || 10,
      backgroundAlertsEnabled: true,
      lockScreenKeepAlive: nextEnabled ? true : prev.lockScreenKeepAlive,
    }));
  };

  const handleSelectInterval = async (minutes: number) => {
    writeSalawatAnchor(minutes, Date.now());
    if (!reminderEnabled) {
      await ensureNotificationPermission();
    }
    onUpdateSettings((prev) => ({
      ...prev,
      salawatReminderEnabled: true,
      salawatIntervalMinutes: minutes,
      backgroundAlertsEnabled: true,
      lockScreenKeepAlive: true,
    }));
  };

  const handleTestBackgroundAlert = async () => {
    const granted = await ensureNotificationPermission();
    const randomTrack =
      SALAWAT_AUDIO_TRACKS[
        Math.floor(Math.random() * SALAWAT_AUDIO_TRACKS.length)
      ];
    playSheikhTrack(randomTrack.id, true, false);

    if (granted && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
          type: 'TEST_ADHAN_NOTIFICATION',
          payload: {
            title: 'صلِّ على النبي ﷺ — تذكير',
            body: `${randomTrack.textAr} (${randomTrack.reciterAr})`,
            prayerNameAr: 'الصلاة على النبي ﷺ',
            voiceId: randomTrack.id,
            audioUrl: randomTrack.url,
            type: 'salawat',
          },
        });
        setTestAlertNotice(
          `تم إرسال تنبيه تجريبي وتشغيل صوت: ${randomTrack.reciterAr}`,
        );
      } catch {
        setTestAlertNotice(`جاري تشغيل: ${randomTrack.reciterAr}`);
      }
    } else {
      setTestAlertNotice(
        'جاري تشغيل صوت الشيخ — اسمح بالإشعارات لتصل الرسائل والشاشة مغلقة',
      );
    }
    window.setTimeout(() => setTestAlertNotice(null), 4000);
  };

  const beadCount = 33;
  const activeBeadIndex =
    stats.target > 0
      ? Math.round((stats.count / stats.target) * beadCount)
      : stats.count % beadCount;

  const isMainPlaying = playingTrackId === activeTrack.id;

  return (
    <div className="space-y-4 pb-4">
      {/* Header Verse + Background Play Button + Time & 10-Voice Pickers */}
      <div className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-center text-white">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A227]/60 bg-[#C9A227]/15 px-3 py-1 text-[11px] font-bold text-[#FCE38A]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>صلِّ على الحبيب المصطفى ﷺ</span>
        </span>
        <p className="font-quran text-lg leading-loose font-bold text-[#FCE38A]">
          ﴿إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ ۚ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا﴾
        </p>

        {/* Primary Button: Play in Background */}
        <button
          type="button"
          onClick={() => void handleMainPlaySalawatButton()}
          className={`flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl border-2 px-4 text-sm font-extrabold shadow-[0_6px_22px_rgba(201,162,39,0.28)] transition active:scale-[0.98] ${
            isMainPlaying
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : 'border-[#FCE38A] bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black'
          }`}
        >
          {isMainPlaying ? (
            <>
              <Pause className="h-5 w-5 fill-current" />
              <span>إيقاف صلِّ على النبي ﷺ (يعمل بالخلفية)</span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              <span>تشغيل صلِّ على النبي ﷺ</span>
            </>
          )}
        </button>

        {/* Two Action Buttons: تحديد الوقت + اختيار الصوت (3 صيغ أصلية) */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setTimePickerOpen(true)}
            className="flex min-h-[48px] flex-col items-center justify-center rounded-2xl border border-[#C9A227]/70 bg-[#0D0A03] px-2.5 py-1.5 text-center transition active:scale-95"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FCE38A]">
              <Clock className="h-4 w-4 text-[#C9A227]" />
              <span>تحديد الوقت</span>
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-zinc-300">
              {reminderEnabled ? `كل ${intervalMinutes} د` : 'متوقف'} ·{' '}
              {continuousLoop ? 'تكرار متواصل' : 'مرة واحدة'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVoicePickerOpen(true)}
            className="flex min-h-[48px] flex-col items-center justify-center rounded-2xl border border-[#C9A227]/70 bg-[#0D0A03] px-2.5 py-1.5 text-center transition active:scale-95"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FCE38A]">
              <Volume2 className="h-4 w-4 text-[#C9A227]" />
              <span>اختيار الصيغة ({SALAWAT_AUDIO_TRACKS.length})</span>
            </span>
            <span className="mt-0.5 max-w-full truncate px-1 text-[10px] font-semibold text-zinc-300">
              {activeTrack.reciterAr}
            </span>
          </button>
        </div>
      </div>

      {/* Real Background Salawat Alarm Card (Works When Closed / Screen Locked) */}
      <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#060502] p-4 text-white">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#FCE38A]">
              <AlarmClock className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-[#FCE38A]">
                منبّه الصلاة على النبي ﷺ في الخلفية
              </h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300">
                يُذكّرك تلقائيًا بصوت عشوائي من القراء الثلاثة (العفاسي · الغامدي · عبد الباسط) ويعمل بالخلفية بدون نت
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleToggleBackgroundReminder()}
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-extrabold ${
              reminderEnabled
                ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/50 bg-black text-[#FCE38A]'
            }`}
          >
            {reminderEnabled ? 'مفعّل' : 'تشغيل'}
          </button>
        </div>

        {/* Quick Interval Pills */}
        <div className="grid grid-cols-3 gap-2">
          {[10, 30, 60].map((mins) => {
            const active = reminderEnabled && intervalMinutes === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => void handleSelectInterval(mins)}
                className={`min-h-[40px] rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] to-[#C9A227] text-black'
                    : 'border-[#C9A227]/45 bg-black text-zinc-200 hover:border-[#C9A227]'
                }`}
              >
                {mins === 60 ? 'كل ساعة' : `كل ${mins} دقيقة`}
              </button>
            );
          })}
        </div>

        {reminderEnabled && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/45 bg-emerald-950/25 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <BellRing className="h-4 w-4 shrink-0" />
              <span>المنبّه نشط كل {intervalMinutes} دقيقة (تبديل عشوائي)</span>
            </span>
            {nextReminderText && (
              <span
                dir="ltr"
                className="font-mono-num rounded-lg bg-black/70 px-2 py-0.5 text-xs font-extrabold text-[#FCE38A]"
              >
                {nextReminderText}
              </span>
            )}
          </div>
        )}

        {/* Lock-screen Keep-Alive + Real Notification Permission + Test */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#C9A227]/25 pt-2.5">
          <button
            type="button"
            onClick={() =>
              onUpdateSettings((prev) => ({
                ...prev,
                lockScreenKeepAlive: !prev.lockScreenKeepAlive,
              }))
            }
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold ${
              settings.lockScreenKeepAlive
                ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                : 'border-zinc-700 bg-black text-zinc-400'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              تثبيت الخلفية وقفل الشاشة:{' '}
              {settings.lockScreenKeepAlive ? 'نشط' : 'عادي'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleTestBackgroundAlert()}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3 text-[11px] font-bold text-[#FCE38A]"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>تجربة صوت عشوائي وتنبيه</span>
          </button>
        </div>

        {notifStatus !== 'granted' && (
          <div className="space-y-2 rounded-xl border border-rose-500/45 bg-rose-950/30 p-2.5 text-[11px] text-rose-200">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">
                {notifStatus === 'denied'
                  ? 'حالة الإشعارات: ممنوع — تم حظر الإشعارات في المتصفح'
                  : 'حالة الإشعارات: ممنوع - دوس للسماح لتنبيهات الخلفية'}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (notifStatus === 'denied') {
                    const opened = await openNativeOrBrowserSettings();
                    if (!opened) setShowNotifHelp((v) => !v);
                  } else {
                    await ensureNotificationPermission();
                  }
                }}
                className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-[10px] font-extrabold text-white active:scale-95"
              >
                {notifStatus === 'denied' ? 'افتح الإعدادات واسمح' : 'تفعيل الآن'}
              </button>
            </div>
            {showNotifHelp && (
              <div className="space-y-1 border-t border-rose-500/30 pt-2 text-[10px] leading-relaxed text-rose-100">
                {OPEN_SETTINGS_STEPS_AR.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {testAlertNotice && (
          <p className="rounded-xl border border-[#C9A227]/50 bg-[#141004] p-2 text-center text-[11px] font-bold text-[#FCE38A]">
            {testAlertNotice}
          </p>
        )}
      </section>

      {/* Golden Rosary Interactive Ring */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TARGET_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setStats((s) => ({...s, target: t, count: 0}))
                }
                className={`font-mono-num min-h-[32px] rounded-xl border px-2.5 text-xs font-bold ${
                  stats.target === t
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/40 bg-black text-zinc-300'
                }`}
              >
                {t === 0 ? 'مفتوح' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              aria-label="صوت حبات السبحة"
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                soundEnabled
                  ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                  : 'border-zinc-700 bg-black text-zinc-400'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setStats((s) => ({...s, count: 0}))}
              aria-label="تصفير العداد"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-[#F3D56B]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Golden Beads Circle + Tap Center */}
        <div className="my-5 flex flex-col items-center justify-center">
          <div className="relative flex h-64 w-64 items-center justify-center">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 260 260"
            >
              <circle
                cx="130"
                cy="130"
                r="114"
                fill="none"
                stroke="rgba(201,162,39,0.22)"
                strokeWidth="2"
              />
              {Array.from({length: beadCount}).map((_, i) => {
                const angleRad =
                  ((i / beadCount) * 360 - 90) * (Math.PI / 180);
                const cx = 130 + 114 * Math.cos(angleRad);
                const cy = 130 + 114 * Math.sin(angleRad);
                const lit = i < activeBeadIndex;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={lit ? 5.2 : 4}
                    fill={lit ? '#FCE38A' : '#1F1A0B'}
                    stroke="#C9A227"
                    strokeWidth={lit ? 1.5 : 1}
                  />
                );
              })}
            </svg>

            <button
              type="button"
              onClick={handleRosaryTap}
              className="z-10 flex h-44 w-44 flex-col items-center justify-center gap-1 rounded-full border-4 border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] via-[#C9A227] to-[#9A7415] p-3 text-center text-black shadow-[0_0_40px_rgba(201,162,39,0.4)] active:scale-95"
            >
              <span className="font-mono-num text-4xl font-extrabold leading-none">
                {stats.count}
              </span>
              {stats.target > 0 && (
                <span className="font-mono-num text-xs font-bold text-black/75">
                  من {stats.target}
                </span>
              )}
              <span className="font-quran mt-1 text-sm font-bold leading-tight">
                صلِّ على محمد ﷺ
              </span>
            </button>
          </div>

          <p className="font-quran mt-3 text-center text-base font-bold text-[#FCE38A]">
            {activeTrack.textAr}
          </p>
          <p className="mt-1 text-[11px] font-bold text-[#C9A227]">
            {activeTrack.reciterAr}
          </p>
        </div>

        {/* Stats Row + Real Sheikh Voice Toggle */}
        <div className="grid grid-cols-3 gap-2 border-t border-[#C9A227]/30 pt-3 text-center">
          <div className="rounded-2xl border border-[#C9A227]/40 bg-[#0A0904] p-2">
            <span className="text-[10px] text-zinc-400">الدورات المكتملة</span>
            <p className="font-mono-num text-base font-bold text-[#FCE38A]">
              {stats.cycles}
            </p>
          </div>
          <div className="rounded-2xl border border-[#C9A227]/40 bg-[#0A0904] p-2">
            <span className="text-[10px] text-zinc-400">الإجمالي الكلي</span>
            <p className="font-mono-num text-base font-bold text-[#C9A227]">
              {stats.totalAllTime}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !sheikhTapVoiceEnabled;
              setSheikhTapVoiceEnabled(next);
              if (!next) {
                stopSharedSalawatAudio();
              }
            }}
            className={`rounded-2xl border p-2 text-center ${
              sheikhTapVoiceEnabled
                ? 'border-[#C9A227] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/40 bg-[#0A0904] text-[#FCE38A]'
            }`}
          >
            <span className="block text-[10px] font-bold">صوت الشيخ</span>
            <span className="text-xs font-extrabold">
              {sheikhTapVoiceEnabled ? 'مفعّل' : 'مغلق'}
            </span>
          </button>
        </div>
      </section>

      {/* Authentic 3 Original Salawat Formulas List (Offline Ready) */}
      <section className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#FCE38A]">
            3 صيغ أصلية للصلاة على النبي ﷺ (بدون نت)
          </h3>
          <span className="rounded-lg border border-[#C9A227]/45 bg-[#141004] px-2 py-0.5 text-[10px] font-bold text-[#FCE38A]">
            {SALAWAT_AUDIO_TRACKS.length} صيغ
          </span>
        </div>

        {SALAWAT_AUDIO_TRACKS.map((track) => {
          const isSelected = selectedTrackId === track.id;
          const isCopied = copiedId === track.id;
          const isPlaying = playingTrackId === track.id;
          return (
            <div
              key={track.id}
              className={`space-y-2 rounded-2xl border p-3.5 ${
                isSelected
                  ? 'border-2 border-[#C9A227] bg-[#C9A227]/12 dark:bg-[#141004]'
                  : 'border-[#C9A227]/40 bg-slate-50/70 dark:bg-[#0A0904]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]">
                    {track.titleAr}
                  </h4>
                  <p className="text-[11px] font-bold text-[#C9A227]">
                    {track.reciterAr}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => playSheikhTrack(track.id)}
                    aria-label="استماع بصوت الشيخ"
                    className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold ${
                      isPlaying
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/50 text-[#C9A227]'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>{isPlaying ? 'إيقاف' : 'سماع'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(track.textAr);
                        setCopiedId(track.id);
                        window.setTimeout(() => setCopiedId(null), 1600);
                      } catch {
                        // ignore
                      }
                    }}
                    aria-label="نسخ الصيغة"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#C9A227]"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <p className="font-quran text-base leading-loose text-slate-900 dark:text-white">
                {track.textAr}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                {track.virtueAr}
              </p>

              <button
                type="button"
                onClick={() => handleSelectTrack(track.id)}
                className={`min-h-[34px] w-full rounded-xl border text-xs font-bold ${
                  isSelected
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/50 text-[#9A7415] dark:text-[#FCE38A]'
                }`}
              >
                {isSelected
                  ? 'الصيغة النشطة على السبحة والتشغيل ✓'
                  : 'اعتماد هذه الصيغة'}
              </button>
            </div>
          );
        })}
      </section>

      {/* Time Picker Modal ("تحديد الوقت") */}
      {timePickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تحديد وقت التشغيل والتنبيه"
          className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/85 p-0 sm:items-center sm:p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-t-3xl border-2 border-[#C9A227] bg-[#050505] p-5 text-white shadow-[0_0_40px_rgba(201,162,39,0.28)] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-[#C9A227]/30 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#FCE38A]" />
                <h3 className="text-base font-extrabold text-[#FCE38A]">
                  تحديد وقت الصلاة على النبي ﷺ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTimePickerOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#FCE38A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-zinc-300">
                اختر الفاصل الزمني للتنبيه التلقائي في الخلفية:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {REMINDER_INTERVAL_OPTIONS.map((opt) => {
                  const active = reminderEnabled && intervalMinutes === opt.minutes;
                  return (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => void handleSelectInterval(opt.minutes)}
                      className={`min-h-[44px] rounded-2xl border px-3 text-xs font-extrabold transition ${
                        active
                          ? 'border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] to-[#C9A227] text-black'
                          : 'border-[#C9A227]/45 bg-[#0A0904] text-white'
                      }`}
                    >
                      {opt.labelAr}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !continuousLoop;
                  sharedLoopEnabled = next;
                  setContinuousLoop(next);
                  if (sharedAudio) {
                    sharedAudio.loop = next;
                  }
                }}
                className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 text-xs font-extrabold ${
                  continuousLoop
                    ? 'border-[#FCE38A] bg-[#141004] text-[#FCE38A]'
                    : 'border-[#C9A227]/40 bg-black text-zinc-300'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-[#C9A227]" />
                  <span>تكرار الصوت متواصلًا في الخلفية</span>
                </span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] ${
                    continuousLoop
                      ? 'bg-[#C9A227] text-black'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {continuousLoop ? 'متواصل ✓' : 'مرة واحدة'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTimePickerOpen(false)}
              className="min-h-[46px] w-full rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-sm font-extrabold text-black"
            >
              حفظ وإغلاق
            </button>
          </div>
        </div>
      )}

      {/* 3-Voice Original Salawat Picker Modal */}
      {voicePickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="اختيار صوت وصيغة الصلاة على النبي"
          className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/85 p-0 sm:items-center sm:p-4"
        >
          <div className="flex max-h-[86vh] w-full max-w-md flex-col space-y-3 rounded-t-3xl border-2 border-[#C9A227] bg-[#050505] p-5 text-white shadow-[0_0_40px_rgba(201,162,39,0.28)] sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#C9A227]/30 pb-3">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-[#FCE38A]" />
                <div>
                  <h3 className="text-base font-extrabold text-[#FCE38A]">
                    اختيار الصيغة والصوت ({SALAWAT_AUDIO_TRACKS.length} صيغ)
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    الصيغ الثلاث الأصلية بأصوات مشايخ حقيقيين — تعمل 100% بدون نت
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoicePickerOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#FCE38A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pl-1">
              {SALAWAT_AUDIO_TRACKS.map((track) => {
                const isSelected = selectedTrackId === track.id;
                const isPlaying = playingTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    className={`space-y-1.5 rounded-2xl border p-3 ${
                      isSelected
                        ? 'border-2 border-[#FCE38A] bg-[#141004]'
                        : 'border-[#C9A227]/40 bg-[#0A0904]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-[#FCE38A]">
                          {track.titleAr}
                        </p>
                        <p className="text-[11px] font-bold text-[#C9A227]">
                          {track.reciterAr}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => playSheikhTrack(track.id)}
                          className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold ${
                            isPlaying
                              ? 'border-[#C9A227] bg-[#C9A227] text-black'
                              : 'border-[#C9A227]/50 text-[#FCE38A]'
                          }`}
                        >
                          {isPlaying ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlaying ? 'إيقاف' : 'سماع'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectTrack(track.id);
                            setVoicePickerOpen(false);
                          }}
                          className={`inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-[11px] font-extrabold ${
                            isSelected
                              ? 'bg-emerald-500 text-black'
                              : 'bg-[#C9A227] text-black'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                          <span>{isSelected ? 'مختار' : 'اختيار'}</span>
                        </button>
                      </div>
                    </div>
                    <p className="font-quran text-sm leading-relaxed text-zinc-200">
                      {track.textAr}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
