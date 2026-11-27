import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, Pause, Play, Repeat, Search, Volume2, X} from 'lucide-react';
import {getAyahAudioUrl, RECITERS_30} from '../data/reciters';
import {CompactAyah, CompactSurah, ReciterId} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {resolveOfflinePlayableUrl} from '../utils/offlineAudioCache';

interface AyahReciterSheetProps {
  surah: CompactSurah;
  ayah: CompactAyah;
  preferredReciter: ReciterId;
  onSelectReciter: (id: ReciterId) => void;
  onClose: () => void;
}

export const AyahReciterSheet: React.FC<AyahReciterSheetProps> = ({
  surah,
  ayah,
  preferredReciter,
  onSelectReciter,
  onClose,
}) => {
  useHardwareBack(true, onClose);
  const [activeReciter, setActiveReciter] = useState<ReciterId | null>(null);
  const [repeatNum, setRepeatNum] = useState(0);
  const [totalRepeats, setTotalRepeats] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reciterSearch, setReciterSearch] = useState('');

  const filteredReciters = useMemo(() => {
    const q = reciterSearch.trim();
    if (!q) return RECITERS_30;
    return RECITERS_30.filter(
      (r) =>
        r.nameAr.includes(q) ||
        r.shortNameAr.includes(q) ||
        r.styleAr.includes(q),
    );
  }, [reciterSearch]);

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

  const handleChooseReciterAndClose = (reciterId: ReciterId) => {
    stop();
    onSelectReciter(reciterId);
    onClose();
  };

  const previewWithSheikh = (
    e: React.MouseEvent,
    reciterId: ReciterId,
  ) => {
    e.stopPropagation();
    onSelectReciter(reciterId);
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

    const handleErr = () => {
      setIsPlaying(false);
      setErrorMsg(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'يرجى الاتصال بالإنترنت لسماع هذه الآية بصوت هذا القارئ'
          : 'تعذر تشغيل هذه الآية بهذا الصوت حاليًا',
      );
    };
    audio.onerror = handleErr;

    void resolveOfflinePlayableUrl(url).then((playableUrl) => {
      audio.src = playableUrl;
      audio.play().catch(handleErr);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/85 p-0">
      <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border-x-2 border-t-2 border-[#C9A227] bg-[#050505] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C9A227]/30 bg-black px-5 py-4 text-white">
          <div>
            <h3 className="text-base font-bold text-[#F3D56B]">
              اختر الشيخ القارئ (30 شيخًا)
            </h3>
            <p className="text-xs text-zinc-300">
              {surah.name} · آية {ayah.n} — اضغط على اسم الشيخ لاعتماده والعودة للمصحف
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
          <p className="font-quran rounded-2xl border border-[#C9A227]/50 bg-[#0B0B0B] p-4 text-xl leading-loose text-[#F3D56B]">
            {ayah.t}
          </p>

          {/* Repeat Count Selector */}
          <div className="flex items-center justify-between rounded-2xl border border-[#C9A227]/40 bg-[#0B0B0B] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227]">
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
                      : 'border-[#C9A227]/40 text-white'
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
            <p className="text-xs font-semibold text-amber-300">{errorMsg}</p>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={reciterSearch}
              onChange={(e) => setReciterSearch(e.target.value)}
              placeholder="ابحث في 30 شيخًا..."
              className="min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-[#0B0B0B] py-2 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
            />
          </div>

          {/* 30 Reciters List — tap Sheikh to select immediately & return to Mushaf */}
          <div className="grid grid-cols-1 gap-2.5">
            {filteredReciters.map((r) => {
              const isSelected = preferredReciter === r.id;
              const isPreviewing = activeReciter === r.id && isPlaying;
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChooseReciterAndClose(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChooseReciterAndClose(r.id);
                    }
                  }}
                  className={`flex min-h-[56px] cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-right transition-colors ${
                    isSelected
                      ? 'border-2 border-[#FCE38A] bg-[#C9A227]/20 text-white'
                      : 'border-[#C9A227]/45 bg-[#0B0B0B] text-white hover:border-[#C9A227]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{r.nameAr}</p>
                      {isSelected && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-[#C9A227] px-1.5 py-0.5 text-[10px] font-extrabold text-black">
                          <Check className="h-3 w-3" />
                          <span>مختار</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">{r.styleAr}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => previewWithSheikh(e, r.id)}
                    aria-label={`اختبار صوت ${r.shortNameAr}`}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isPreviewing
                        ? 'bg-[#C9A227] text-black'
                        : 'border border-[#C9A227]/50 text-[#C9A227]'
                    }`}
                  >
                    {isPreviewing ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
