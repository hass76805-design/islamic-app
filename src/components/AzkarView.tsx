import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, Download, Loader2, Pause, Play, RotateCcw, Sparkles} from 'lucide-react';
import {AZKAR_CATEGORIES} from '../data/azkar';
import {AzkarCategoryId, DhikrItem} from '../types';
import {cacheBatchUrls, isAudioCached} from '../utils/offlineAudioCache';

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
  const [cachedCategory, setCachedCategory] = useState(false);
  const [downloadingCat, setDownloadingCat] = useState<{done: number; total: number} | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const category = useMemo(
    () =>
      AZKAR_CATEGORIES.find((c) => c.id === activeCategory) || AZKAR_CATEGORIES[0],
    [activeCategory],
  );

  const categoryAudioUrls = useMemo(
    () =>
      Array.from(
        new Set(
          category.items
            .map((i) => i.audioUrl)
            .filter((u): u is string => Boolean(u)),
        ),
      ),
    [category],
  );

  useEffect(() => {
    let active = true;
    async function checkCatCache() {
      if (categoryAudioUrls.length === 0) {
        if (active) setCachedCategory(true);
        return;
      }
      const checks = await Promise.all(categoryAudioUrls.map((u) => isAudioCached(u)));
      if (active) setCachedCategory(checks.every(Boolean));
    }
    checkCatCache();
    return () => {
      active = false;
    };
  }, [categoryAudioUrls]);

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
    audio.src = item.audioUrl;
    setPlayingId(item.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      setAudioErr(
        navigator.onLine
          ? 'تعذر تشغيل المقطع الصوتي حاليًا، يرجى المحاولة لاحقًا'
          : 'المقطع الصوتي غير محمّل بعد — اضغط «تحميل الصوتيات بدون نت» أولاً',
      );
    };
    audio.play().catch(() => {
      setPlayingId(null);
      setAudioErr('تعذر بدء الصوت — تأكد من الاتصال أو حمّل الصوتيات للعمل أوفلاين');
    });
  };

  const handleDownloadCategoryAudio = async () => {
    if (categoryAudioUrls.length === 0) return;
    setDownloadingCat({done: 0, total: categoryAudioUrls.length});
    await cacheBatchUrls(categoryAudioUrls, (done, total) => {
      setDownloadingCat({done, total});
    });
    setDownloadingCat(null);
    setCachedCategory(true);
  };

  const completedCount = useMemo(
    () =>
      category.items.filter((item) => (counts[item.id] || 0) >= item.count).length,
    [category, counts],
  );

  const totalItems = category.items.length;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-5">
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
              className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-2xl border-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                isActive
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 bg-white text-slate-900 hover:border-[#C9A227] dark:bg-[#050505] dark:text-white'
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227]">
            <Sparkles className="h-4 w-4" />
            <span>{category.subtitleAr} · نص وصوت</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
            {category.titleAr}
          </h2>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#C9A227]/20">
            <div
              className="h-full rounded-full bg-[#C9A227] transition-all duration-300"
              style={{width: `${progressPct}%`}}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="ml-2 text-left">
            <span className="block text-[11px] text-slate-500 dark:text-zinc-400">
              المكتمل
            </span>
            <span className="font-mono-num text-xl font-bold text-[#C9A227]">
              {completedCount}/{totalItems}
            </span>
          </div>

          {categoryAudioUrls.length > 0 && (
            <button
              type="button"
              disabled={!!downloadingCat}
              onClick={handleDownloadCategoryAudio}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3.5 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {downloadingCat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : cachedCategory ? (
                <Check className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>
                {downloadingCat
                  ? `${downloadingCat.done}/${downloadingCat.total}`
                  : cachedCategory
                  ? 'الصوتيات محفوظة بدون نت'
                  : 'تحميل الصوتيات بدون نت'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onResetCategory(activeCategory)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227]/60 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-[#C9A227]/15 dark:text-white"
          >
            <RotateCcw className="h-4 w-4 text-[#C9A227]" />
            <span>إعادة ضبط</span>
          </button>
        </div>
      </div>

      {audioErr && (
        <div className="rounded-2xl border-2 border-[#C9A227] bg-[#FFFDF6] px-4 py-3 text-xs font-bold text-[#9A7415] dark:bg-[#0D0A02] dark:text-[#F3D56B]">
          {audioErr}
        </div>
      )}

      {/* Azkar Tap Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5">
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
              className={`group relative flex cursor-pointer flex-col justify-between rounded-3xl border-2 p-5 text-right transition-all active:scale-[0.99] ${
                done
                  ? 'border-[#C9A227] bg-[#C9A227]/10 dark:bg-[#141004]'
                  : 'border-[#C9A227]/75 bg-white hover:border-[#C9A227] dark:bg-[#050505]'
              }`}
            >
              <div>
                <p className="font-quran text-xl leading-[2.1] text-slate-900 dark:text-white sm:text-2xl">
                  {item.text}
                </p>
                {item.reward && (
                  <p className="mt-3 text-xs leading-relaxed text-[#9A7415] dark:text-[#F3D56B]">
                    {item.reward}
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#C9A227]/25 pt-3.5">
                <div className="flex items-center gap-2">
                  {item.audioUrl && (
                    <button
                      type="button"
                      onClick={(e) => toggleDhikrAudio(e, item)}
                      aria-label={isThisPlaying ? 'إيقاف الصوت' : 'تشغيل الصوت المسجل'}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        isThisPlaying
                          ? 'border-[#C9A227] bg-[#C9A227] text-black'
                          : 'border-[#C9A227]/60 text-slate-900 hover:bg-[#C9A227]/15 dark:text-[#F3D56B]'
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
