import React, {useEffect, useRef, useState} from 'react';
import {Pause, Play, Repeat, Volume2, X} from 'lucide-react';
import {getAyahAudioUrl, RECITERS_10} from '../data/reciters';
import {CompactAyah, CompactSurah, ReciterId} from '../types';
import {useHardwareBack} from '../utils/backNavigation';

interface AyahReciterSheetProps {
  surah: CompactSurah;
  ayah: CompactAyah;
  onClose: () => void;
}

export const AyahReciterSheet: React.FC<AyahReciterSheetProps> = ({
  surah,
  ayah,
  onClose,
}) => {
  useHardwareBack(true, onClose);
  const [activeReciter, setActiveReciter] = useState<ReciterId | null>(null);
  const [repeatNum, setRepeatNum] = useState(0);
  const [totalRepeats, setTotalRepeats] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatCounterRef = useRef(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setActiveReciter(null);
    setRepeatNum(0);
  };

  const playWithSheikh = (reciterId: ReciterId) => {
    setErrorMsg(null);
    if (activeReciter === reciterId && isPlaying) {
      stop();
      return;
    }

    const url = getAyahAudioUrl(reciterId, surah.n, ayah.n);
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = url;
    repeatCounterRef.current = 1;
    setActiveReciter(reciterId);
    setRepeatNum(1);
    setIsPlaying(true);

    audio.onended = () => {
      if (repeatCounterRef.current < totalRepeats) {
        repeatCounterRef.current += 1;
        setRepeatNum(repeatCounterRef.current);
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
        setRepeatNum(0);
      }
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setErrorMsg(
        navigator.onLine
          ? 'تعذر تشغيل هذه الآية بهذا الصوت حاليًا'
          : 'هذه التلاوة غير محمّلة بعد للعمل بدون نت',
      );
    };

    audio.play().catch(() => {
      setIsPlaying(false);
    });
  };

  return (
    <div className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[400px] -translate-x-1/2 items-end justify-center bg-black/85 p-0">
      <div className="flex max-h-[88vh] w-full max-w-[400px] flex-col overflow-hidden rounded-t-3xl border-x-2 border-t-2 border-[#C9A227] bg-[#050505] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C9A227]/30 bg-black px-5 py-4 text-white">
          <div>
            <h3 className="text-base font-bold text-[#F3D56B]">
              الاستماع للآية بصوت 10 شيوخ
            </h3>
            <p className="text-xs text-zinc-300">
              {surah.name} · آية {ayah.n} — اختر القارئ للتشغيل والتكرار
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#F3D56B] hover:bg-[#C9A227]/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Selected Ayah Preview */}
          <p className="font-quran rounded-2xl border border-[#C9A227]/50 bg-slate-50 p-4 text-xl leading-loose text-slate-900 dark:bg-[#0B0B0B] dark:text-[#F3D56B]">
            {ayah.t}
          </p>

          {/* Repeat Count Selector (defaults to 3x) */}
          <div className="flex items-center justify-between rounded-2xl border border-[#C9A227]/40 bg-slate-50 px-4 py-2.5 dark:bg-[#0B0B0B]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
              <Repeat className="h-4 w-4" />
              <span>عدد مرات التكرار:</span>
            </div>
            <div className="flex gap-1.5">
              {[1, 3, 5, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTotalRepeats(n)}
                  className={`font-mono-num rounded-lg border px-3 py-1 text-xs font-bold ${
                    totalRepeats === n
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/40 text-slate-700 dark:text-white'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

          {isPlaying && activeReciter && (
            <div className="flex items-center justify-between rounded-2xl bg-[#C9A227] px-4 py-2.5 text-xs font-bold text-black">
              <span className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <span>
                  التكرار {repeatNum} من {totalRepeats}
                </span>
              </span>
              <button
                type="button"
                onClick={stop}
                className="rounded-lg bg-black px-3 py-1 text-[#C9A227]"
              >
                إيقاف
              </button>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-500">{errorMsg}</p>
          )}

          {/* 10 Reciters List */}
          <div className="grid grid-cols-1 gap-2.5">
            {RECITERS_10.map((r) => {
              const isCurrent = activeReciter === r.id && isPlaying;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => playWithSheikh(r.id)}
                  className={`flex min-h-[54px] items-center justify-between rounded-2xl border px-4 py-3 text-right transition-colors ${
                    isCurrent
                      ? 'border-2 border-[#C9A227] bg-[#C9A227]/15 text-slate-900 dark:text-white'
                      : 'border-[#C9A227]/45 bg-slate-50/70 hover:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{r.nameAr}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {r.styleAr}
                    </p>
                  </div>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      isCurrent
                        ? 'bg-[#C9A227] text-black'
                        : 'border border-[#C9A227]/50 text-[#C9A227]'
                    }`}
                  >
                    {isCurrent ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
