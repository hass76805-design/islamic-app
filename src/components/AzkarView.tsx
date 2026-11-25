import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, Pause, Play, RotateCcw, Sparkles} from 'lucide-react';
import {AZKAR_CATEGORIES} from '../data/azkar';
import {AzkarCategoryId, DhikrItem} from '../types';
import {resolveOfflinePlayableUrl} from '../utils/offlineAudioCache';
import {SectionOfflineButton} from './SectionOfflineButton';

interface AzkarViewProps {
  counts: Record<string, number>;
  onIncrement: (id: string, target: number) => void;
  onResetCategory: (categoryId: AzkarCategoryId) => void;
}

export const AzkarView: React.FC<AzkarViewProps> = ({
  counts,
  onIncrement,
  onResetCategory,
}) => {
  const [activeCategory, setActiveCategory] = useState<AzkarCategoryId>('morning');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const category = useMemo(
    () =>
      AZKAR_CATEGORIES.find((c) => c.id === activeCategory) || AZKAR_CATEGORIES[0],
    [activeCategory],
  );

  const [audioErr, setAudioErr] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingId(null);
  };

  const toggleDhikrAudio = (e: React.MouseEvent, item: DhikrItem) => {
    e.stopPropagation();
    setAudioErr(null);
    if (!item.audioUrl) return;

    if (playingId === item.id) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    setPlayingId(item.id);
    const onOfflineOrErr = () => {
      setPlayingId(null);
      setAudioErr(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'يرجى الاتصال بالإنترنت لتشغيل هذا الذكر الصوتي (النص متاح بدون نت)'
          : 'تعذر تشغيل المقطع الصوتي حاليًا',
      );
    };
    audio.onended = () => setPlayingId(null);
    audio.onerror = onOfflineOrErr;
    void resolveOfflinePlayableUrl(item.audioUrl).then((playableUrl) => {
      audio.src = playableUrl;
      audio.play().catch(onOfflineOrErr);
    });
  };

  const completedCount = useMemo(
    () =>
      category.items.filter((item) => (counts[item.id] || 0) >= item.count).length,
    [category, counts],
  );

  const totalItems = category.items.length;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-3.5">
      {/* Category Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {AZKAR_CATEGORIES.map((cat) => {
          const isActive = cat.id === activeCategory;
          const catDone = cat.items.filter(
            (i) => (counts[i.id] || 0) >= i.count,
          ).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                stopAllAudio();
                setActiveCategory(cat.id);
              }}
              className={`min-h-[46px] shrink-0 whitespace-nowrap rounded-2xl border-2 px-4 py-2 text-xs font-extrabold transition-all active:scale-95 ${
                isActive
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 bg-white text-slate-900 dark:bg-[#050505] dark:text-white'
              }`}
            >
              <span>{cat.titleAr}</span>
              <span
                className={`mr-2 text-xs tabular-nums ${
                  isActive ? 'text-black/80' : 'text-[#C9A227]'
                }`}
              >
                {catDone}/{cat.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Progress Header */}
      <div className="flex items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227]">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">{category.subtitleAr} · نص وصوت</span>
          </div>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
            {category.titleAr}
          </h2>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#C9A227]/20">
            <div
              className="h-full rounded-full bg-[#C9A227] transition-all duration-300"
              style={{width: `${progressPct}%`}}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-mono-num text-lg font-extrabold text-[#C9A227]">
            {completedCount}/{totalItems}
          </span>

          <button
            type="button"
            onClick={() => onResetCategory(activeCategory)}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl border border-[#C9A227]/60 px-3 text-xs font-bold text-slate-800 active:scale-95 dark:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#C9A227]" />
            <span>ضبط</span>
          </button>
        </div>
      </div>

      <SectionOfflineButton
        sectionId="azkar"
        preferredReciter="alafasy"
        labelOverride="الأذكار والصوتيات"
      />

      {audioErr && (
        <div className="rounded-2xl border-2 border-[#C9A227] bg-[#FFFDF6] px-4 py-3 text-xs font-bold text-[#9A7415] dark:bg-[#0D0A02] dark:text-[#F3D56B]">
          {audioErr}
        </div>
      )}

      {/* Azkar Tap Cards Grid */}
      <div className="grid grid-cols-1 gap-3">
        {category.items.map((item) => {
          const current = counts[item.id] || 0;
          const remaining = Math.max(0, item.count - current);
          const done = current >= item.count;
          const isThisPlaying = playingId === item.id;
          const itemPct = Math.min(100, (current / item.count) * 100);
          const ringR = 24;
          const ringCirc = 2 * Math.PI * ringR;
          const ringOffset = ringCirc - (itemPct / 100) * ringCirc;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (!done) {
                  if (navigator.vibrate) navigator.vibrate(15);
                  onIncrement(item.id, item.count);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!done) onIncrement(item.id, item.count);
                }
              }}
              className={`group relative flex cursor-pointer flex-col justify-between rounded-3xl border-2 p-4 text-right transition-all active:scale-[0.98] ${
                done
                  ? 'border-[#C9A227] bg-[#C9A227]/12 dark:bg-[#141004]'
                  : 'border-[#C9A227]/75 bg-white dark:bg-[#050505]'
              }`}
            >
              <div>
                <p className="font-quran text-xl leading-[2.05] text-slate-900 dark:text-white">
                  {item.text}
                </p>
                {item.reward && (
                  <p className="mt-2.5 text-xs leading-relaxed text-[#9A7415] dark:text-[#F3D56B]">
                    {item.reward}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#C9A227]/25 pt-3">
                <div className="flex items-center gap-2">
                  {item.audioUrl && (
                    <button
                      type="button"
                      onClick={(e) => toggleDhikrAudio(e, item)}
                      aria-label={isThisPlaying ? 'إيقاف الصوت' : 'تشغيل الصوت المسجل'}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-bold transition-colors active:scale-95 ${
                        isThisPlaying
                          ? 'border-[#C9A227] bg-[#C9A227] text-black'
                          : 'border-[#C9A227]/60 text-slate-900 dark:text-[#F3D56B]'
                      }`}
                    >
                      {isThisPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>إيقاف</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>استماع</span>
                        </>
                      )}
                    </button>
                  )}
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    {item.reference}
                  </span>
                </div>

                {/* Circular Tap Counter Indicator */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#9A7415] dark:text-[#F3D56B]">
                    {done ? 'مكتمل' : `متبقي ${remaining}`}
                  </span>
                  <div className="relative flex h-14 w-14 items-center justify-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 60 60">
                      <circle
                        cx="30"
                        cy="30"
                        r={ringR}
                        fill="none"
                        stroke="rgba(201,162,39,0.2)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r={ringR}
                        fill="none"
                        stroke="#C9A227"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={ringCirc}
                        strokeDashoffset={ringOffset}
                        className="transition-all duration-200"
                      />
                    </svg>
                    <span className="font-mono-num absolute text-xs font-bold text-slate-900 dark:text-white">
                      {done ? (
                        <Check className="h-5 w-5 text-[#C9A227]" />
                      ) : (
                        `${current}/${item.count}`
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
