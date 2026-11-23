import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Check,
  Clock,
  MapPin,
  Pause,
  Play,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import makkahKaabaImg from '../assets/images/makkah_kaaba_night_1795340358494.jpg';
import mosqueCourtyardImg from '../assets/images/mosque_courtyard_arch_1795340357980.jpg';
import mosqueMihrabImg from '../assets/images/mosque_gold_mihrab_1795340358298.jpg';
import nabawiDomeImg from '../assets/images/nabawi_green_dome_1795340358652.jpg';
import {ADHAN_TONE_DESCRIPTIONS, POST_ADHAN_DUA} from '../data/reciters';
import {AdhanVoice, PrayerScheduleItem} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {formatGregorianAr, getHijriParts} from '../utils/hijri';
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
  onConfirmPrayed?: () => void;
  isPrayerConfirmed?: boolean;
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
  onConfirmPrayed,
  isPrayerConfirmed = false,
  onClose,
  onPlayPostAzkar,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showPostAdhanDua, setShowPostAdhanDua] = useState(mode === 'dua');
  const [isPlayingDua, setIsPlayingDua] = useState(mode === 'dua');

  useHardwareBack(true, onClose);

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
  const usedFallbackRef = useRef(false);
  const playingDuaRef = useRef(mode === 'dua');

  const isIqamah = mode === 'iqamah';
  const isDuaMode = mode === 'dua';
  const isTawasih = mode === 'tawasih';
  const isEid = mode === 'eid';

  const defaultOfflineUrl = isIqamah
    ? '/audio/iqamah-makkah.mp3'
    : '/audio/adhan-makkah.mp3';
  const fallbackOfflineUrl = voice.fallbackUrl || defaultOfflineUrl;
  const isFajr =
    mode === 'adhan' &&
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

  // Smooth calm mosque visual cycling across the fullscreen video stage (4.5s)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPhotoIdx((prev) => (prev + 1) % MOSQUE_GALLERY.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

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
    playingDuaRef.current = mode === 'dua';
    setIsPlayingDua(mode === 'dua');
    setShowPostAdhanDua(mode === 'dua');
    setAudioErr(null);
    setProgress(0);
    setCurrentSec(0);
    setDurationSec(0);
    audio.volume = 1;

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
        mode === 'adhan' &&
        !playingDuaRef.current &&
        postAdhanDuaEnabled &&
        POST_ADHAN_DUA.audioUrl
      ) {
        playingDuaRef.current = true;
        setIsPlayingDua(true);
        setShowPostAdhanDua(true);
        setProgress(0);
        setCurrentSec(0);
        setDurationSec(0);
        audio.src = POST_ADHAN_DUA.audioUrl;
        audio.load();
        audio.play().catch(() => setIsPlaying(false));
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
        audio.src = fallbackOfflineUrl;
        audio.load();
        audio.play().catch(() => setIsPlaying(false));
        return;
      }
      setIsPlaying(false);
      setAudioErr('اضغط تشغيل لبدء الصوت');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    const initialSrc =
      mode === 'dua' ? POST_ADHAN_DUA.audioUrl : voice.url;
    audio.src = initialSrc;
    audio.load();
    audio.play().catch(() => {
      setIsPlaying(false);
    });

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [voice.url, fallbackOfflineUrl, mode, postAdhanDuaEnabled]);

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
      audio.src = playingDuaRef.current
        ? POST_ADHAN_DUA.audioUrl
        : usedFallbackRef.current
          ? fallbackOfflineUrl
          : voice.url;
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (!playingDuaRef.current && !usedFallbackRef.current) {
          usedFallbackRef.current = true;
          audio.src = fallbackOfflineUrl;
          audio.load();
          audio.play().catch(() => {
            setIsPlaying(false);
            setAudioErr('تعذر بدء الصوت — اضغط مرة أخرى للتشغيل');
          });
        } else {
          setIsPlaying(false);
          setAudioErr('تعذر بدء الصوت — اضغط مرة أخرى للتشغيل');
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

  return (
    <div
      dir="rtl"
      className="fixed inset-y-0 left-1/2 z-50 flex h-dvh w-full max-w-[400px] -translate-x-1/2 flex-col justify-between overflow-hidden bg-black text-white"
    >
      <audio ref={audioRef} preload="auto" playsInline className="hidden" />

      {/* FULLSCREEN MOSQUE VIDEO VISUAL BACKDROP */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
        {MOSQUE_GALLERY.map((item, idx) => {
          const isCurrent = idx === photoIdx;
          return (
            <img
              key={item.labelAr}
              src={item.src}
              alt={item.labelAr}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1800ms] ease-out ${
                isCurrent ? 'scale-105 opacity-100' : 'scale-100 opacity-0'
              }`}
            />
          );
        })}
        {/* Deep cinematic top + bottom scrims for crisp readability while center mosque shines */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/15 to-black" />
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/90 to-transparent" />
      </div>

      {/* TOP FLOATING VIDEO HEADER */}
      <header className="relative z-10 flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#FCE38A]">
            <Radio className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" />
            <span className="truncate">{currentPhoto.labelAr}</span>
          </div>

          <h2 className="truncate text-lg font-extrabold text-white drop-shadow">
            {isDuaMode
              ? `دعاء ما بعد أذان ${prayerNameAr}`
              : isIqamah
                ? `إقامة ${prayerNameAr}`
                : isTawasih
                  ? 'تواشيح الفجر — النقشبندي'
                  : isEid
                    ? 'تكبيرات العيد المباركة'
                    : isPreview
                      ? `فيديو الأذان — ${prayerNameAr}`
                      : `حان الآن أذان ${prayerNameAr}`}
          </h2>

          <p className="flex items-center gap-1 truncate text-xs font-bold text-[#FCE38A]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" />
            <span>
              {voice.muezzinAr} · {cityAr}، {countryAr}
            </span>
          </p>

          <button
            type="button"
            onClick={toggleTimeFormat}
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-[#C9A227]/50 bg-black/55 px-2.5 py-1 text-xs font-bold text-[#FCE38A] backdrop-blur-sm"
          >
            <Clock className="h-3 w-3 text-[#C9A227]" />
            <span dir="ltr" className="font-mono-num">
              {timeFormat === '12'
                ? `${clock12.time} ${clock12.periodAr}`
                : clock24}
            </span>
            <span className="text-[10px] text-zinc-300">
              · {hijri.day} {hijri.monthNameAr}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الفيديو"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#C9A227] bg-black/70 text-[#FCE38A] backdrop-blur-sm active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* BOTTOM SUBTITLE-STYLE SYNCHRONIZED TEXT & CONTROLS */}
      <footer className="relative z-10 mt-auto space-y-3 px-4 pb-5 pt-6">
        {/* Live Audio Pulse Bars */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#C9A227]">
            {toneMeta.maqamAr}
          </span>
          <div className="flex h-4 items-end gap-1" aria-hidden="true">
            {[0.45, 0.85, 0.6, 1, 0.55].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full bg-[#FCE38A] transition-all duration-300 ${
                  isPlaying && !isMuted ? 'animate-pulse' : 'opacity-40'
                }`}
                style={{
                  height: isPlaying && !isMuted ? `${Math.round(h * 16)}px` : '4px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Mode Switcher between Adhan & Post-Adhan Dua */}
        {mode === 'adhan' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowPostAdhanDua(false)}
              className={`min-h-[34px] rounded-xl border px-2 text-xs font-bold backdrop-blur-sm ${
                !showPostAdhanDua
                  ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/45 bg-black/60 text-[#FCE38A]'
              }`}
            >
              نص الأذان المتزامن
            </button>
            <button
              type="button"
              onClick={() => setShowPostAdhanDua(true)}
              className={`min-h-[34px] rounded-xl border px-2 text-xs font-bold backdrop-blur-sm ${
                showPostAdhanDua
                  ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/45 bg-black/60 text-[#FCE38A]'
              }`}
            >
              دعاء ما بعد الأذان
            </button>
          </div>
        )}

        {/* Bottom Emergent Synchronized Text Area (Video Subtitle Focus) */}
        {showPostAdhanDua && !isIqamah && !isTawasih && !isEid ? (
          <div className="space-y-1.5 rounded-2xl border border-[#C9A227]/65 bg-black/70 p-3.5 text-center backdrop-blur-md">
            <p className="text-[11px] font-bold text-[#C9A227]">
              {POST_ADHAN_DUA.titleAr}
            </p>
            <p className="font-quran text-xl font-bold leading-loose text-[#FCE38A]">
              {POST_ADHAN_DUA.textAr}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-2xl border border-[#C9A227]/55 bg-black/70 px-3.5 py-3.5 text-center backdrop-blur-md">
            {prevLine && (
              <p className="font-quran truncate text-sm text-zinc-400">
                {prevLine}
              </p>
            )}
            <p className="font-quran text-2xl font-bold leading-relaxed text-[#FCE38A] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              {activeLine}
            </p>
            {nextLine && (
              <p className="font-quran truncate text-sm text-zinc-300/80">
                {nextLine}
              </p>
            )}
            <p className="pt-1 text-[10px] font-bold text-[#C9A227]">
              {isIqamah
                ? 'الإقامة'
                : isTawasih
                  ? 'ابتهال'
                  : isEid
                    ? 'التكبيرات'
                    : 'الأذان'}{' '}
              · {TO_ARABIC_DIGITS(activeLineIdx + 1)} /{' '}
              {TO_ARABIC_DIGITS(lines.length)}
            </p>
          </div>
        )}

        {/* Video Seek Progress Bar */}
        <div className="space-y-1">
          <div
            onClick={handleSeek}
            role="slider"
            aria-label="تقديم أو تأخير الصوت"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            className="h-2 w-full cursor-pointer overflow-hidden rounded-full border border-[#C9A227]/55 bg-black/80"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415]"
              style={{width: `${Math.round(progress * 100)}%`}}
            />
          </div>
          <div className="font-mono-num flex justify-between text-[11px] font-bold text-[#FCE38A]">
            <span>{formatSec(currentSec)}</span>
            <span>{durationSec > 0 ? formatSec(durationSec) : '--:--'}</span>
          </div>
        </div>

        {audioErr && (
          <p className="text-center text-xs font-bold text-[#FCE38A]">
            {audioErr}
          </p>
        )}

        {/* Compact Video Controls Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlayPause}
            className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-3 text-sm font-extrabold text-black active:scale-95"
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
                    : 'تشغيل'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-black/75 text-[#FCE38A] backdrop-blur-sm"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[46px] shrink-0 items-center justify-center rounded-2xl border border-[#FCE38A]/70 bg-black/75 px-4 text-xs font-extrabold text-[#FCE38A] backdrop-blur-sm"
          >
            إغلاق
          </button>
        </div>

        {!isPreview && onConfirmPrayed && (
          <button
            type="button"
            onClick={onConfirmPrayed}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold ${
              isPrayerConfirmed
                ? 'border border-emerald-400 bg-emerald-950/80 text-emerald-200'
                : 'bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black'
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
            className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#C9A227]/70 bg-black/75 text-xs font-bold text-[#FCE38A] backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>تشغيل أذكار بعد الصلاة</span>
          </button>
        )}
      </footer>
    </div>
  );
};
