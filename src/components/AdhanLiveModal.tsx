import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
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
import {
  formatClock12,
  formatClock24,
  formatTime12,
} from '../utils/prayerTimes';

interface AdhanLiveModalProps {
  prayerNameAr: string;
  voice: AdhanVoice;
  cityAr: string;
  countryAr: string;
  now: Date;
  schedule?: PrayerScheduleItem[];
  mode?: 'adhan' | 'iqamah' | 'dua';
  isPreview?: boolean;
  onClose: () => void;
  onPlayPostAzkar?: () => void;
}

const MOSQUE_GALLERY = [
  {src: makkahKaabaImg, labelAr: 'المسجد الحرام — مكة المكرمة'},
  {src: nabawiDomeImg, labelAr: 'المسجد النبوي الشريف — المدينة المنورة'},
  {src: mosqueMihrabImg, labelAr: 'محراب المسجد المذهب'},
  {src: mosqueCourtyardImg, labelAr: 'صحن المسجد العتيق ليلًا'},
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

export const AdhanLiveModal: React.FC<AdhanLiveModalProps> = ({
  prayerNameAr,
  voice,
  cityAr,
  countryAr,
  now,
  schedule = [],
  mode = 'adhan',
  isPreview = false,
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
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const usedFallbackRef = useRef(false);

  const isIqamah = mode === 'iqamah';
  const isDuaMode = mode === 'dua';
  const defaultOfflineUrl = isIqamah
    ? '/audio/iqamah-makkah.mp3'
    : '/audio/adhan-makkah.mp3';
  const fallbackOfflineUrl = voice.fallbackUrl || defaultOfflineUrl;
  const isFajr =
    !isIqamah &&
    !isDuaMode &&
    (prayerNameAr.includes('الفجر') || voice.id === 'adhan-fajr');
  const lines = useMemo(
    () => (isIqamah ? buildIqamahLines() : buildAdhanLines(isFajr)),
    [isIqamah, isFajr],
  );

  const toneMeta = ADHAN_TONE_DESCRIPTIONS[voice.id] || {
    maqamAr: 'أداء مؤذن الحرمين',
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

  // Calm smooth mosque photo cycling (4 seconds)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPhotoIdx((prev) => (prev + 1) % MOSQUE_GALLERY.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const hijri = getHijriParts(liveNow);
  const gregorian = formatGregorianAr(liveNow);
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
    activeLineRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [activeLineIdx]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    usedFallbackRef.current = false;
    setAudioErr(null);
    setProgress(0);
    setCurrentSec(0);
    setDurationSec(0);

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
      setIsPlaying(false);
      setProgress(1);
      if (mode === 'adhan') {
        setShowPostAdhanDua(true);
      }
    };
    const onError = () => {
      if (
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
      setAudioErr('اضغط على زر تشغيل الصوت لإعادة التشغيل');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    if (mode !== 'dua') {
      audio.src = voice.url;
      audio.load();
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [voice.url, fallbackOfflineUrl, mode]);

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
      audio.src = usedFallbackRef.current ? fallbackOfflineUrl : voice.url;
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (!usedFallbackRef.current) {
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

  return (
    <div
      dir="rtl"
      className="fixed inset-y-0 left-1/2 z-50 flex h-dvh w-full max-w-[400px] -translate-x-1/2 flex-col overflow-hidden border-x-2 border-[#C9A227] bg-[#000000] text-white"
    >
      <audio ref={audioRef} preload="auto" playsInline className="hidden" />

      {/* Top Electronic Muezzin Title Bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#C9A227] bg-[#080602] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C9A227] bg-[#141004] text-[#FCE38A]">
            <Radio className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-[#FCE38A]">
              {isDuaMode
                ? `دعاء ما بعد أذان ${prayerNameAr}`
                : isIqamah
                  ? `إقامة ${prayerNameAr}`
                  : isPreview
                    ? `المؤذن الإلكتروني — ${prayerNameAr}`
                    : `حان الآن أذان ${prayerNameAr}`}
            </h2>
            <p className="flex items-center gap-1 truncate text-[10px] font-semibold text-[#C9A227]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>
                {cityAr}، {countryAr} · {voice.nameAr}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTimeFormat}
          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-[#C9A227] bg-[#161104] px-2.5 py-1 text-[11px] font-bold text-[#FCE38A]"
        >
          <Clock className="h-3 w-3" />
          <span>{timeFormat === '12' ? '12س' : '24س'}</span>
        </button>
      </header>

      {/* Scrollable Center Body */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#000000] p-3">
        {/* 1. Electronic Muezzin LED Clock + Mosque Photo Panel */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050401]">
          {/* Cycling Mosque Photos (Crisp, Calm Crossfade, Zero Flicker/Blur) */}
          <div className="relative h-44 w-full overflow-hidden border-b border-[#C9A227]/60 bg-[#050401]">
            {MOSQUE_GALLERY.map((item, idx) => (
              <img
                key={item.labelAr}
                src={item.src}
                alt={item.labelAr}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  idx === photoIdx ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3.5 pt-8 pb-2.5">
              <p className="text-[11px] font-bold text-[#FCE38A]">
                {currentPhoto.labelAr}
              </p>
              <p className="text-[10px] text-zinc-200">{toneMeta.maqamAr}</p>
            </div>
          </div>

          {/* Electronic Muezzin Digital LED Board */}
          <div className="space-y-2.5 bg-[#060401] p-3.5">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/55 bg-black px-3.5 py-2.5">
              <div className="flex items-baseline gap-1.5">
                <span
                  dir="ltr"
                  className="font-mono-num text-3xl font-extrabold tracking-widest text-[#FCE38A]"
                >
                  {timeFormat === '12' ? clock12.time : clock24}
                </span>
                <span className="text-xs font-extrabold text-[#C9A227]">
                  {timeFormat === '12' ? clock12.periodAr : '24س'}
                </span>
              </div>

              <div className="text-left">
                <p className="text-[11px] font-bold text-[#FCE38A]">
                  {hijri.weekdayAr} · {hijri.day} {hijri.monthNameAr}{' '}
                  {hijri.year} هـ
                </p>
                <p className="text-[10px] text-zinc-300">{gregorian}</p>
              </div>
            </div>

            {/* 6-Prayer Electronic Muezzin LED Strip */}
            {schedule.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {schedule.map((item) => (
                  <div
                    key={item.key}
                    className={`flex flex-col items-center rounded-xl border px-1.5 py-1.5 text-center ${
                      item.isNext
                        ? 'border-2 border-[#FCE38A] bg-[#C9A227]/20'
                        : 'border-[#C9A227]/40 bg-black'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-zinc-200">
                      {item.nameAr}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono-num text-xs font-bold text-[#FCE38A]"
                    >
                      {timeFormat === '12'
                        ? formatTime12(item.time)
                        : item.formatted24}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Post-Adhan Dua Switcher & Full Synchronized Adhan / Iqamah Text */}
        {!isIqamah && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowPostAdhanDua(false)}
              className={`min-h-[36px] rounded-2xl border px-3 text-xs font-bold transition-colors ${
                !showPostAdhanDua
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/45 bg-[#070501] text-[#FCE38A]'
              }`}
            >
              نص الأذان المتزامن
            </button>
            <button
              type="button"
              onClick={() => setShowPostAdhanDua(true)}
              className={`min-h-[36px] rounded-2xl border px-3 text-xs font-bold transition-colors ${
                showPostAdhanDua
                  ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/45 bg-[#070501] text-[#FCE38A]'
              }`}
            >
              دعاء ما بعد الأذان
            </button>
          </div>
        )}

        {showPostAdhanDua && !isIqamah ? (
          <div className="space-y-2.5 rounded-3xl border-2 border-[#FCE38A] bg-[#141004] p-4 text-center">
            <p className="text-xs font-extrabold text-[#FCE38A]">
              {POST_ADHAN_DUA.titleAr}
            </p>
            <p className="font-quran text-xl font-bold leading-loose text-white">
              {POST_ADHAN_DUA.textAr}
            </p>
            <p className="text-[11px] leading-relaxed text-[#C9A227]">
              {POST_ADHAN_DUA.sourceAr}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-3xl border-2 border-[#C9A227] bg-[#070501] p-3 text-center">
            <p className="text-[11px] font-bold text-[#C9A227]">
              {isIqamah ? 'نص الإقامة الكامل' : 'نص الأذان الكامل'} ·{' '}
              {TO_ARABIC_DIGITS(activeLineIdx + 1)}/{TO_ARABIC_DIGITS(lines.length)}
            </p>
            {lines.map((line, idx) => {
              const isCurrent = idx === activeLineIdx;
              const isPassed = idx < activeLineIdx;
              return (
                <p
                  key={`${idx}-${line}`}
                  ref={isCurrent ? activeLineRef : null}
                  className={`font-quran rounded-xl border px-2.5 py-1.5 ${
                    isCurrent
                      ? 'border-[#FCE38A] bg-[#1C1504] text-xl font-bold text-[#FCE38A]'
                      : isPassed
                        ? 'border-transparent text-sm text-[#C9A227]/75'
                        : 'border-transparent text-sm text-zinc-200'
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* FIXED BOTTOM DOCKED PLAYBACK + PROMINENT FIXED CLOSE BUTTON */}
      <footer className="shrink-0 space-y-2.5 border-t-2 border-[#C9A227] bg-[#080602] px-3.5 py-3">
        <div className="space-y-1">
          <div
            onClick={handleSeek}
            role="slider"
            aria-label="تقديم أو تأخير الصوت"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            className="h-2 w-full cursor-pointer overflow-hidden rounded-full border border-[#C9A227]/50 bg-[#141004]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415]"
              style={{width: `${Math.round(progress * 100)}%`}}
            />
          </div>
          <div className="font-mono-num flex justify-between text-[10px] font-bold text-[#F3D56B]">
            <span>{formatSec(currentSec)}</span>
            <span>{durationSec > 0 ? formatSec(durationSec) : '--:--'}</span>
          </div>
        </div>

        {audioErr && (
          <p className="text-center text-[11px] font-bold text-[#FCE38A]">
            {audioErr}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={togglePlayPause}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[#C9A227] px-3 py-2 text-xs font-extrabold text-black"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>
              {isPlaying
                ? 'إيقاف مؤقت'
                : isIqamah
                ? 'تشغيل الإقامة'
                : 'تشغيل الأذان'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[#C9A227] bg-black px-3 py-2 text-xs font-bold text-[#FCE38A]"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            <span>{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</span>
          </button>
        </div>

        {onPlayPostAzkar && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onPlayPostAzkar();
            }}
            className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[#C9A227]/70 bg-[#141004] text-xs font-bold text-[#FCE38A]"
          >
            <Sparkles className="h-4 w-4" />
            <span>تشغيل أذكار بعد الصلاة</span>
          </button>
        )}

        {/* Fixed Permanent Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#FCE38A] bg-black text-sm font-extrabold text-[#FCE38A]"
        >
          <X className="h-5 w-5" />
          <span>إغلاق شاشة الأذان</span>
        </button>
      </footer>
    </div>
  );
};
