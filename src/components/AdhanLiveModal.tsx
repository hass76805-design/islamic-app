import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  AlarmClock,
  BookOpen,
  Check,
  Clock,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import makkahKaabaImg from '../assets/images/makkah_kaaba_night_1795340358494.jpg';
import mosqueCourtyardImg from '../assets/images/mosque_courtyard_arch_1795340357980.jpg';
import mosqueMihrabImg from '../assets/images/mosque_gold_mihrab_1795340358298.jpg';
import nabawiDomeImg from '../assets/images/nabawi_green_dome_1795340358652.jpg';
import {
  ADHAN_TONE_DESCRIPTIONS,
  IQAMAH_VOICES_3,
  POST_ADHAN_DUA,
} from '../data/reciters';
import {AdhanVoice, PrayerScheduleItem} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {getHijriParts} from '../utils/hijri';
import {resolveOfflinePlayableUrl} from '../utils/offlineAudioCache';
import {formatClock12, formatClock24} from '../utils/prayerTimes';

interface AdhanLiveModalProps {
  prayerNameAr: string;
  voice: AdhanVoice;
  cityAr: string;
  countryAr: string;
  now: Date;
  schedule?: PrayerScheduleItem[];
  mode?: 'adhan' | 'iqamah' | 'dua' | 'tawasih' | 'eid';
  isPreview?: boolean;
  postAdhanDuaEnabled?: boolean;
  iqamahVoice?: AdhanVoice;
  iqamahMinutes?: number;
  postAdhanDuaVoice?: AdhanVoice;
  postAdhanDuaDelaySeconds?: number;
  onConfirmPrayed?: () => void;
  isPrayerConfirmed?: boolean;
  onSnooze5Min?: () => void;
  onClose: () => void;
  onPlayPostAzkar?: () => void;
}

const MOSQUE_GALLERY = [
  {src: makkahKaabaImg, labelAr: 'المسجد الحرام — مكة المكرمة'},
  {src: nabawiDomeImg, labelAr: 'المسجد النبوي الشريف — المدينة المنورة'},
  {src: mosqueMihrabImg, labelAr: 'محراب المسجد المذهب'},
  {src: mosqueCourtyardImg, labelAr: 'صحن المسجد المبارك'},
];

const TO_ARABIC_DIGITS = (n: number | string) =>
  String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

function buildAdhanLines(isFajr: boolean): string[] {
  const lines = [
    'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ',
    'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ',
    'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ',
    'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ',
    'أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ',
    'أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ',
    'حَيَّ عَلَى الصَّلَاةِ ، حَيَّ عَلَى الصَّلَاةِ',
    'حَيَّ عَلَى الْفَلَاحِ ، حَيَّ عَلَى الْفَلَاحِ',
  ];
  if (isFajr) {
    lines.push('الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ ، الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ');
  }
  lines.push('اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ', 'لَا إِلَٰهَ إِلَّا اللَّهُ');
  return lines;
}

function buildIqamahLines(): string[] {
  return [
    'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ',
    'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ',
    'أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ',
    'حَيَّ عَلَى الصَّلَاةِ',
    'حَيَّ عَلَى الْفَلَاحِ',
    'قَدْ قَامَتِ الصَّلَاةُ ، قَدْ قَامَتِ الصَّلَاةُ',
    'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ',
    'لَا إِلَٰهَ إِلَّا اللَّهُ',
  ];
}

function buildTawasihLines(titleAr: string): string[] {
  return [
    titleAr,
    'مَوْلَايَ إِنِّي بِبَابِكَ قَدْ بَسَطْتُ يَدِي',
    'مَنْ لِي أَلُوذُ بِهِ إِلَّاكَ يَا سَنَدِي',
    'أَقُومُ بِاللَّيْلِ وَالْأَسْحَارُ سَاهِرَةٌ',
    'أَدْعُو وَهَمْسُ الدُّعَاءِ النَّقِيُّ فِي خَلَدِي',
  ];
}

function buildEidLines(): string[] {
  return [
    'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ لَا إِلَٰهَ إِلَّا اللَّهُ',
    'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ',
    'اللَّهُ أَكْبَرُ كَبِيرًا وَالْحَمْدُ لِلَّهِ كَثِيرًا',
    'وَسُبْحَانَ اللَّهِ بُكْرَةً وَأَصِيلًا',
    'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ صَدَقَ وَعْدَهُ',
    'وَنَصَرَ عَبْدَهُ وَأَعَزَّ جُنْدَهُ وَهَزَمَ الْأَحْزَابَ وَحْدَهُ',
  ];
}

export const AdhanLiveModal: React.FC<AdhanLiveModalProps> = ({
  prayerNameAr,
  voice,
  cityAr,
  countryAr,
  now,
  mode = 'adhan',
  isPreview = false,
  postAdhanDuaEnabled = true,
  iqamahVoice,
  iqamahMinutes = 15,
  postAdhanDuaVoice,
  postAdhanDuaDelaySeconds = 135,
  onConfirmPrayed,
  isPrayerConfirmed = false,
  onSnooze5Min,
  onClose,
  onPlayPostAzkar,
}) => {
  const [activeMode, setActiveMode] = useState<
    'adhan' | 'iqamah' | 'dua' | 'tawasih' | 'eid'
  >(mode);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showPostAdhanDua, setShowPostAdhanDua] = useState(mode === 'dua');
  const [isPlayingDua, setIsPlayingDua] = useState(mode === 'dua');
  const [hudHidden, setHudHidden] = useState(false);

  const effectiveIqamahMinutes = Math.min(30, Math.max(5, iqamahMinutes || 15));
  const activeIqamahVoice = iqamahVoice || IQAMAH_VOICES_3[0];
  const activeDuaUrl = postAdhanDuaVoice?.url || POST_ADHAN_DUA.audioUrl;
  const activeDuaFallbackUrl =
    postAdhanDuaVoice?.fallbackUrl || '/audio/post-adhan-dua.mp3';

  // Iqamah live countdown state
  const [iqamahCountdownSec, setIqamahCountdownSec] = useState<number | null>(
    null,
  );
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useHardwareBack(true, onClose);

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  const [timeFormat, setTimeFormat] = useState<'12' | '24'>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        window.localStorage.getItem('alzahabi_time_format') ||
        window.localStorage.getItem('adhan_live_time_format');
      if (saved === '12' || saved === '24') return saved;
    }
    return '12';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalRootRef = useRef<HTMLDivElement | null>(null);
  const usedFallbackRef = useRef(false);
  const playingDuaRef = useRef(mode === 'dua');

  const isIqamah = activeMode === 'iqamah';
  const isDuaMode = activeMode === 'dua' || showPostAdhanDua;
  const isTawasih = activeMode === 'tawasih';
  const isEid = activeMode === 'eid';

  const activeAudioSourceUrl = useMemo(() => {
    if (activeMode === 'dua') return activeDuaUrl;
    if (activeMode === 'iqamah') return activeIqamahVoice.url;
    return voice.url;
  }, [activeMode, activeDuaUrl, activeIqamahVoice.url, voice.url]);

  const defaultOfflineUrl = isIqamah
    ? activeIqamahVoice.fallbackUrl || '/audio/iqamah-makkah.mp3'
    : isDuaMode
      ? activeDuaFallbackUrl
      : '/adhan-sounds/makkah.mp3';
  const fallbackOfflineUrl = voice.fallbackUrl || defaultOfflineUrl;
  const isFajr =
    activeMode === 'adhan' &&
    (prayerNameAr.includes('الفجر') || voice.id === 'adhan-fajr');

  const lines = useMemo(() => {
    if (isIqamah) return buildIqamahLines();
    if (isTawasih) return buildTawasihLines(voice.nameAr);
    if (isEid) return buildEidLines();
    return buildAdhanLines(isFajr);
  }, [isIqamah, isTawasih, isEid, isFajr, voice.nameAr]);

  const toneMeta = ADHAN_TONE_DESCRIPTIONS[voice.id] || {
    maqamAr: isTawasih
      ? 'الشيخ سيد النقشبندي'
      : isEid
        ? 'تكبيرات العيد المباركة'
        : isIqamah
          ? 'الإقامة الشرعية — 15 دقيقة'
          : 'أداء مؤذن الحرمين',
    paceFactor: 1.0,
  };

  const activeLineIdx = useMemo(() => {
    const adjusted = Math.min(
      0.999,
      Math.max(0, progress * toneMeta.paceFactor),
    );
    return Math.min(lines.length - 1, Math.floor(adjusted * lines.length));
  }, [progress, toneMeta.paceFactor, lines.length]);

  const [liveNow, setLiveNow] = useState<Date>(now);
  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Live 15-minute Iqamah countdown ticker
  useEffect(() => {
    if (iqamahCountdownSec === null || iqamahCountdownSec <= 0) return;
    const id = window.setInterval(() => {
      setIqamahCountdownSec((prev) => {
        if (prev === null || prev <= 1) {
          setActiveMode('iqamah');
          setShowPostAdhanDua(false);
          setStatusNotice('حان الآن وقت الإقامة ✓');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [iqamahCountdownSec]);

  // Smooth calm mosque visual cycling across the fullscreen video stage (5.5s)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPhotoIdx((prev) => (prev + 1) % MOSQUE_GALLERY.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, []);

  // Ambient fullscreen canvas animation (soft golden light particles + serene rays)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({length: 36}, (_, idx) => ({
      x: Math.random() * (canvas.width || 400),
      y: Math.random() * (canvas.height || 800),
      r: 1.2 + (idx % 4) * 0.9,
      vy: 0.25 + (idx % 5) * 0.14,
      vx: (Math.random() - 0.5) * 0.25,
      alpha: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
    }));

    const renderFrame = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Gentle radial golden aura synced softly with playback
      const pulse = isPlaying ? 0.14 + Math.sin(time * 0.0022) * 0.06 : 0.08;
      const grad = ctx.createRadialGradient(w / 2, h * 0.36, 10, w / 2, h * 0.36, Math.max(w, h) * 0.65);
      grad.addColorStop(0, `rgba(252, 227, 138, ${pulse})`);
      grad.addColorStop(0.45, `rgba(31, 164, 122, ${pulse * 0.45})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.y -= p.vy * (isPlaying ? 1.35 : 0.7);
        p.x += p.vx + Math.sin(time * 0.001 + p.phase) * 0.15;
        if (p.y < -12) {
          p.y = h + 12;
          p.x = Math.random() * w;
        }
        const glowAlpha = p.alpha * (0.65 + 0.35 * Math.sin(time * 0.003 + p.phase));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(252, 227, 138, ${glowAlpha.toFixed(2)})`;
        ctx.fill();
      }

      animId = window.requestAnimationFrame(renderFrame);
    };

    animId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isPlaying]);

  const hijri = getHijriParts(liveNow);
  const clock24 = formatClock24(liveNow);
  const clock12 = formatClock12(liveNow);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    usedFallbackRef.current = false;
    playingDuaRef.current = activeMode === 'dua';
    setIsPlayingDua(activeMode === 'dua');
    if (activeMode === 'dua') {
      setShowPostAdhanDua(true);
    }
    setAudioErr(null);
    setProgress(0);
    setCurrentSec(0);
    setDurationSec(0);
    audio.volume = 1;

    let cancelled = false;

    const onPlay = () => {
      setIsPlaying(true);
      setAudioErr(null);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onTimeUpdate = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDurationSec(Math.round(audio.duration));
        setCurrentSec(Math.round(audio.currentTime));
        setProgress(Math.min(1, audio.currentTime / audio.duration));
      }
    };
    const onEnded = () => {
      if (
        activeMode === 'adhan' &&
        !playingDuaRef.current &&
        postAdhanDuaEnabled &&
        activeDuaUrl
      ) {
        playingDuaRef.current = true;
        setIsPlayingDua(true);
        setShowPostAdhanDua(true);
        setProgress(0);
        setCurrentSec(0);
        setDurationSec(0);
        void resolveOfflinePlayableUrl(activeDuaUrl).then(
          (duaPlayable) => {
            if (cancelled) return;
            audio.src = duaPlayable;
            audio.load();
            audio.play().catch(() => setIsPlaying(false));
          },
        );
        return;
      }
      setIsPlaying(false);
      setProgress(1);
    };
    const onError = () => {
      if (
        !playingDuaRef.current &&
        !usedFallbackRef.current &&
        audio.src !== window.location.origin + fallbackOfflineUrl
      ) {
        usedFallbackRef.current = true;
        void resolveOfflinePlayableUrl(fallbackOfflineUrl).then(
          (fbPlayable) => {
            if (cancelled) return;
            audio.src = fbPlayable;
            audio.load();
            audio.play().catch(() => setIsPlaying(false));
          },
        );
        return;
      }
      setIsPlaying(false);
      setAudioErr(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'يرجى التحميل أو الضغط للتشغيل من التخزين المحلي'
          : 'اضغط تشغيل لبدء الصوت',
      );
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    void resolveOfflinePlayableUrl(activeAudioSourceUrl).then((playableUrl) => {
      if (cancelled) return;
      audio.src = playableUrl;
      audio.load();
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    });

    return () => {
      cancelled = true;
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [activeAudioSourceUrl, fallbackOfflineUrl, activeMode, postAdhanDuaEnabled, activeDuaUrl]);

  const playCustomModeAudio = (targetMode: 'dua' | 'iqamah') => {
    const audio = audioRef.current;
    setShowPostAdhanDua(targetMode === 'dua');
    setActiveMode(targetMode);
    if (!audio) return;
    const targetUrl =
      targetMode === 'dua' ? activeDuaUrl : activeIqamahVoice.url;
    playingDuaRef.current = targetMode === 'dua';
    setIsPlayingDua(targetMode === 'dua');
    void resolveOfflinePlayableUrl(targetUrl).then((playableUrl) => {
      audio.src = playableUrl;
      audio.load();
      audio.play().catch(() => setIsPlaying(false));
    });
  };

  const handleOpenPostAdhanDua = () => {
    const delayLabel =
      postAdhanDuaDelaySeconds >= 60
        ? `${Math.round(postAdhanDuaDelaySeconds / 60)} د`
        : `${postAdhanDuaDelaySeconds} ث`;
    setStatusNotice(
      `تشغيل الدعاء المأثور بعد الأذان (${postAdhanDuaVoice?.nameAr || 'الشيخ المفضل'} · ${delayLabel})`,
    );
    playCustomModeAudio('dua');
  };

  const handleStartIqamah = () => {
    setIqamahCountdownSec(effectiveIqamahMinutes * 60);
    setStatusNotice(
      `تم بدء عداد الإقامة (${TO_ARABIC_DIGITS(effectiveIqamahMinutes)} دقيقة) بصوت ${activeIqamahVoice.nameAr}`,
    );
    playCustomModeAudio('iqamah');
  };

  const handleToggleFullscreenHud = () => {
    setHudHidden((prev) => {
      const next = !prev;
      const el = modalRootRef.current;
      if (next && el && typeof el.requestFullscreen === 'function' && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      } else if (!next && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      }
      return next;
    });
  };

  const handleStopAndClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onClose();
  };

  const handleSnooze5Min = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const win = window as unknown as {
      AlZahabiAdhan?: {
        scheduleSnooze5Minutes?: (p: {
          prayerNameAr: string;
          voiceId: string;
          audioUrl: string;
        }) => Promise<unknown>;
      };
    };
    void win.AlZahabiAdhan?.scheduleSnooze5Minutes?.({
      prayerNameAr,
      voiceId: voice.id,
      audioUrl: voice.url,
    });
    if (onSnooze5Min) {
      onSnooze5Min();
    }
    onClose();
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused && !audio.ended) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    setAudioErr(null);
    if (audio.ended || progress >= 0.99) {
      audio.currentTime = 0;
      setProgress(0);
    }
    if (audio.error || !audio.currentSrc) {
      const targetUrl = playingDuaRef.current
        ? activeDuaUrl
        : usedFallbackRef.current
          ? fallbackOfflineUrl
          : activeAudioSourceUrl;
      void resolveOfflinePlayableUrl(targetUrl).then((playable) => {
        audio.src = playable;
        audio.load();
        audio.play().catch(() => {
          setIsPlaying(false);
        });
      });
      return;
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (!playingDuaRef.current && !usedFallbackRef.current) {
          usedFallbackRef.current = true;
          void resolveOfflinePlayableUrl(fallbackOfflineUrl).then((playable) => {
            audio.src = playable;
            audio.load();
            audio.play().catch(() => setIsPlaying(false));
          });
        } else {
          setIsPlaying(false);
        }
      });
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !Number.isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (rect.right - e.clientX) / rect.width),
    );
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const currentPhoto = MOSQUE_GALLERY[photoIdx];
  const prevLine = activeLineIdx > 0 ? lines[activeLineIdx - 1] : null;
  const activeLine = lines[activeLineIdx];
  const nextLine =
    activeLineIdx < lines.length - 1 ? lines[activeLineIdx + 1] : null;

  const modalContent = (
    <div
      ref={modalRootRef}
      dir="rtl"
      onClick={() => {
        if (hudHidden) setHudHidden(false);
      }}
      className="fixed inset-0 z-[9999] flex h-dvh w-screen flex-col justify-between overflow-hidden bg-black text-white"
    >
      <audio ref={audioRef} preload="auto" playsInline className="hidden" />

      {/* TRUE FULLSCREEN MOSQUE VIDEO VISUAL BACKDROP (100vw x 100dvh edge-to-edge) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
        {MOSQUE_GALLERY.map((item, idx) => {
          const isCurrent = idx === photoIdx;
          return (
            <img
              key={item.labelAr}
              src={item.src}
              alt={item.labelAr}
              className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-[2200ms] ease-out ${
                isCurrent
                  ? idx % 2 === 0
                    ? 'scale-110 translate-y-[-1%] opacity-100'
                    : 'scale-105 translate-y-[1%] opacity-100'
                  : 'scale-100 opacity-0'
              }`}
            />
          );
        })}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
      </div>

      {/* Subtle restore HUD pill when viewing full clean video */}
      {hudHidden && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFullscreenHud();
          }}
          className="relative z-20 mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#1FA47A]/70 bg-black/55 px-3.5 py-1.5 text-xs font-extrabold text-[#E8DCC8] backdrop-blur-md"
        >
          <Minimize2 className="h-3.5 w-3.5 text-[#1FA47A]" />
          <span>إظهار أزرار التحكم</span>
        </button>
      )}

      {/* TOP FLOATING HEADER: الأذان الآن */}
      <header
        className={`relative z-10 flex items-start justify-between gap-2 px-4 pt-4 transition-opacity duration-300 ${
          hudHidden ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="min-w-0 space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1FA47A]/95 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow">
            <Radio className="h-3.5 w-3.5 shrink-0" />
            <span>الأذان الآن · {currentPhoto.labelAr}</span>
          </div>

          <h2 className="truncate text-xl font-extrabold text-[#E8DCC8] drop-shadow-md">
            {isDuaMode
              ? `الدعاء بعد أذان ${prayerNameAr}`
              : isIqamah
                ? `إقامة ${prayerNameAr}`
                : isTawasih
                  ? 'تواشيح الفجر — النقشبندي'
                  : isEid
                    ? 'تكبيرات العيد المباركة'
                    : isPreview
                      ? `الأذان الآن — ${prayerNameAr}`
                      : `الأذان الآن — ${prayerNameAr}`}
          </h2>

          <p className="flex items-center gap-1 truncate text-xs font-bold text-[#E8DCC8] drop-shadow">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1FA47A]" />
            <span>
              {isIqamah
                ? activeIqamahVoice.nameAr
                : isDuaMode && postAdhanDuaVoice
                  ? postAdhanDuaVoice.nameAr
                  : voice.nameAr}{' '}
              · {cityAr}، {countryAr}
            </span>
          </p>

          <button
            type="button"
            onClick={toggleTimeFormat}
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-[#1FA47A]/60 bg-[#0F2225]/65 px-2.5 py-1 text-xs font-bold text-[#E8DCC8] backdrop-blur-md"
          >
            <Clock className="h-3 w-3 text-[#1FA47A]" />
            <span dir="ltr" className="font-mono-num">
              {timeFormat === '12'
                ? `${clock12.time} ${clock12.periodAr}`
                : clock24}
            </span>
            <span className="text-[10px] text-[#E8DCC8]/75">
              · {hijri.day} {hijri.monthNameAr}
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleFullscreenHud}
            aria-label="ملء الشاشة الكاملة"
            title="ملء الشاشة الكاملة"
            className="flex h-10 items-center gap-1 rounded-full border border-[#1FA47A] bg-[#0F2225]/65 px-3 text-[11px] font-extrabold text-[#E8DCC8] backdrop-blur-md active:scale-95"
          >
            <Maximize2 className="h-4 w-4 text-[#1FA47A]" />
            <span>ملء الشاشة</span>
          </button>

          <button
            type="button"
            onClick={handleStopAndClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1FA47A] bg-[#0F2225]/70 text-[#E8DCC8] backdrop-blur-md active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* BOTTOM SYNCHRONIZED TEXT & 4 PRIMARY ADHAN ACTION BUTTONS */}
      <footer
        className={`relative z-10 mt-auto space-y-2 px-4 pb-5 pt-2 transition-opacity duration-300 ${
          hudHidden ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        {iqamahCountdownSec !== null && (
          <div className="flex items-center justify-between rounded-2xl border border-[#1FA47A] bg-[#0F2225]/75 px-3.5 py-2 text-xs font-extrabold text-[#E8DCC8] backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-[#1FA47A]">
              <AlarmClock className="h-4 w-4" />
              <span>عداد الإقامة ({TO_ARABIC_DIGITS(effectiveIqamahMinutes)} دقيقة)</span>
            </span>
            <span dir="ltr" className="font-mono-num text-base text-white">
              {formatSec(iqamahCountdownSec)}
            </span>
          </div>
        )}

        {statusNotice && (
          <p className="rounded-xl bg-[#0F2225]/70 px-3 py-1 text-center text-[11px] font-bold text-[#E8DCC8] backdrop-blur-sm">
            {statusNotice}
          </p>
        )}

        {/* Audio Pulse + Maqam */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#E8DCC8]">
            {toneMeta.maqamAr}
          </span>
          <div className="flex h-4 items-end gap-1" aria-hidden="true">
            {[0.45, 0.85, 0.6, 1, 0.55].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full bg-[#1FA47A] transition-all duration-300 ${
                  isPlaying && !isMuted ? 'animate-pulse' : 'opacity-40'
                }`}
                style={{
                  height:
                    isPlaying && !isMuted ? `${Math.round(h * 16)}px` : '4px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Synchronized Text Area */}
        {showPostAdhanDua && !isIqamah && !isTawasih && !isEid ? (
          <div className="space-y-1 rounded-2xl border border-[#1FA47A]/55 bg-[#0F2225]/60 p-3 text-center backdrop-blur-md">
            <p className="text-[11px] font-bold text-[#1FA47A]">
              {POST_ADHAN_DUA.titleAr}
            </p>
            <p className="font-quran text-base font-bold leading-loose text-[#E8DCC8]">
              {POST_ADHAN_DUA.textAr}
            </p>
          </div>
        ) : (
          <div className="space-y-1 rounded-2xl border border-[#1FA47A]/50 bg-[#0F2225]/60 px-3.5 py-2.5 text-center backdrop-blur-md">
            {prevLine && (
              <p className="font-quran truncate text-sm text-[#E8DCC8]/60">
                {prevLine}
              </p>
            )}
            <p className="font-quran text-2xl font-bold leading-relaxed text-[#E8DCC8]">
              {activeLine}
            </p>
            {nextLine && (
              <p className="font-quran truncate text-sm text-[#E8DCC8]/75">
                {nextLine}
              </p>
            )}
            <p className="pt-0.5 text-[10px] font-bold text-[#1FA47A]">
              {isIqamah
                ? 'الإقامة'
                : isTawasih
                  ? 'ابتهال'
                  : isEid
                    ? 'التكبيرات'
                    : 'الأذان الآن'}{' '}
              · {TO_ARABIC_DIGITS(activeLineIdx + 1)} /{' '}
              {TO_ARABIC_DIGITS(lines.length)}
            </p>
          </div>
        )}

        {/* Seek Bar */}
        <div className="space-y-1">
          <div
            onClick={handleSeek}
            role="slider"
            aria-label="تقديم أو تأخير الصوت"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            className="h-2 w-full cursor-pointer overflow-hidden rounded-full border border-[#1FA47A]/50 bg-[#0F2225]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#34D399] to-[#1FA47A]"
              style={{width: `${Math.round(progress * 100)}%`}}
            />
          </div>
          <div className="font-mono-num flex justify-between text-[11px] font-bold text-[#E8DCC8]">
            <span>{formatSec(currentSec)}</span>
            <span>{durationSec > 0 ? formatSec(durationSec) : '--:--'}</span>
          </div>
        </div>

        {audioErr && (
          <p className="text-center text-xs font-bold text-[#E8DCC8]">
            {audioErr}
          </p>
        )}

        {/* Play / Pause & Mute Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlayPause}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#1FA47A] to-[#168462] px-3 text-sm font-extrabold text-white active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>
              {isPlaying
                ? 'إيقاف مؤقت'
                : isPlayingDua || isDuaMode
                  ? 'تشغيل الدعاء'
                  : isIqamah
                    ? 'تشغيل الإقامة'
                    : 'تشغيل الأذان'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl border border-[#1FA47A]/60 bg-[#0F2225]/90 text-[#E8DCC8]"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* REQUESTED 4 ACTION BUTTONS ON "الأذان الآن": الدعاء بعد الأذان | الإقامة | إيقاف | تأجيل 5 دقائق */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleOpenPostAdhanDua}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[#1FA47A]/70 bg-[#0F2225]/95 px-2.5 text-xs font-extrabold text-[#E8DCC8] active:scale-95"
          >
            <BookOpen className="h-4 w-4 text-[#1FA47A]" />
            <span>الدعاء بعد الأذان</span>
          </button>

          <button
            type="button"
            onClick={handleStartIqamah}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[#1FA47A]/70 bg-[#0F2225]/75 px-2.5 text-xs font-extrabold text-[#E8DCC8] backdrop-blur-md active:scale-95"
          >
            <AlarmClock className="h-4 w-4 text-[#1FA47A]" />
            <span>الإقامة ({TO_ARABIC_DIGITS(effectiveIqamahMinutes)} د)</span>
          </button>

          <button
            type="button"
            onClick={handleStopAndClose}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-rose-700 px-2.5 text-xs font-extrabold text-white active:scale-95"
          >
            <Square className="h-4 w-4 fill-current" />
            <span>إيقاف</span>
          </button>

          <button
            type="button"
            onClick={handleSnooze5Min}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-l from-[#1FA47A] to-[#147958] px-2.5 text-xs font-extrabold text-white active:scale-95"
          >
            <Clock className="h-4 w-4" />
            <span>تأجيل 5 دقائق</span>
          </button>
        </div>

        {!isPreview && onConfirmPrayed && (
          <button
            type="button"
            onClick={onConfirmPrayed}
            className={`flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl text-xs font-extrabold ${
              isPrayerConfirmed
                ? 'border border-[#1FA47A] bg-[#0F2225]/80 text-[#1FA47A]'
                : 'bg-[#E8DCC8] text-[#0F2225]'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>
              {isPrayerConfirmed
                ? `تم تسجيل أداء ${prayerNameAr} ✓`
                : 'صليت ✓ (إيقاف التذكير)'}
            </span>
          </button>
        )}

        {onPlayPostAzkar && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onPlayPostAzkar();
            }}
            className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#1FA47A]/55 bg-[#0F2225]/75 text-xs font-bold text-[#E8DCC8] backdrop-blur-md"
          >
            <Sparkles className="h-4 w-4 text-[#1FA47A]" />
            <span>تشغيل أذكار بعد الصلاة</span>
          </button>
        )}
      </footer>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
