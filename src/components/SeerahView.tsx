import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpenText,
  Check,
  CheckCircle2,
  Copy,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import {SEERAH_CHAPTERS, SeerahChapter} from '../data/seerahData';
import {useLocalStorage} from '../hooks/useLocalStorage';

type SeerahPhaseFilter =
  | 'الكل'
  | 'قبل الهجرة'
  | 'في المدينة المنورة'
  | 'حجة الوداع والوفاة';

function normalizeAr(text: string): string {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export const SeerahView: React.FC = () => {
  const [phaseFilter, setPhaseFilter] = useState<SeerahPhaseFilter>('الكل');
  const [query, setQuery] = useState('');
  const [activeChapterId, setActiveChapterId] = useState<string>(
    SEERAH_CHAPTERS[0].id,
  );
  const [readIds, setReadIds] = useLocalStorage<string[]>(
    'alzahabi_seerah_read_v1',
    [],
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Speech narration state
  const [playingChapterId, setPlayingChapterId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<0.85 | 1 | 1.2>(1);
  const [autoNext, setAutoNext] = useState(true);
  const speechQueueAbortRef = useRef(false);

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const stopNarration = () => {
    speechQueueAbortRef.current = true;
    setPlayingChapterId(null);
    setIsPaused(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    return () => {
      speechQueueAbortRef.current = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const markChapterRead = (id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const speakChapter = (
    chapter: SeerahChapter,
    rateOverride: number = playbackRate,
  ) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    speechQueueAbortRef.current = false;
    setPlayingChapterId(chapter.id);
    setActiveChapterId(chapter.id);
    setIsPaused(false);
    markChapterRead(chapter.id);

    const fullText = `${chapter.titleAr}. ${chapter.yearAr}. ${chapter.contentAr}. الدرس المستفاد: ${chapter.lessonAr}`;
    const chunks = fullText
      .split(/(?<=[.!؟،\n])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith('ar'));

    let idx = 0;
    const speakNextChunk = () => {
      if (speechQueueAbortRef.current) return;
      if (idx >= chunks.length) {
        setPlayingChapterId(null);
        setIsPaused(false);
        if (autoNext) {
          const curIdx = SEERAH_CHAPTERS.findIndex((c) => c.id === chapter.id);
          if (curIdx >= 0 && curIdx < SEERAH_CHAPTERS.length - 1) {
            speakChapter(SEERAH_CHAPTERS[curIdx + 1], rateOverride);
          }
        }
        return;
      }
      const utter = new SpeechSynthesisUtterance(chunks[idx]);
      utter.lang = 'ar-SA';
      utter.rate = rateOverride;
      if (arVoice) utter.voice = arVoice;
      utter.onend = () => {
        idx += 1;
        speakNextChunk();
      };
      utter.onerror = () => {
        setPlayingChapterId(null);
        setIsPaused(false);
      };
      window.speechSynthesis.speak(utter);
    };
    speakNextChunk();
  };

  const togglePlayPauseCurrent = (chapter: SeerahChapter) => {
    if (playingChapterId !== chapter.id) {
      speakChapter(chapter);
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const filteredChapters = useMemo(() => {
    const qNorm = normalizeAr(query);
    return SEERAH_CHAPTERS.filter((ch) => {
      if (phaseFilter !== 'الكل' && ch.phaseAr !== phaseFilter) return false;
      if (!qNorm) return true;
      return (
        normalizeAr(ch.titleAr).includes(qNorm) ||
        normalizeAr(ch.summaryAr).includes(qNorm) ||
        normalizeAr(ch.contentAr).includes(qNorm) ||
        normalizeAr(ch.lessonAr).includes(qNorm) ||
        normalizeAr(ch.yearAr).includes(qNorm)
      );
    });
  }, [phaseFilter, query]);

  const currentPlayingObj =
    SEERAH_CHAPTERS.find((c) => c.id === (playingChapterId || activeChapterId)) ||
    SEERAH_CHAPTERS[0];

  const currentIdx = SEERAH_CHAPTERS.findIndex(
    (c) => c.id === currentPlayingObj.id,
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Header & Audio Narration Player */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <BookOpenText className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#FCE38A]">
                السيرة النبوية الكاملة ﷺ
              </h2>
              <p className="text-[11px] text-zinc-300">
                من المولد الشريف إلى الوفاة · قراءة واستماع بدون نت
              </p>
            </div>
          </div>

          <span className="font-mono-num rounded-xl border border-[#C9A227]/50 bg-[#0A0904] px-2.5 py-1 text-[11px] font-bold text-[#F3D56B]">
            {toArabicDigits(readIds.length)}/{toArabicDigits(SEERAH_CHAPTERS.length)}
          </span>
        </div>

        {/* Sticky-like Seerah Voice Player */}
        <div className="mt-3 space-y-2.5 rounded-2xl border border-[#C9A227]/60 bg-[#0A0904] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#C9A227]">
                المشغل الصوتي للسيرة ({currentPlayingObj.yearAr})
              </p>
              <p className="truncate text-xs font-bold text-white">
                {currentPlayingObj.number}. {currentPlayingObj.titleAr}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoNext((v) => !v)}
              className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                autoNext
                  ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                  : 'border-zinc-700 text-zinc-400'
              }`}
            >
              تشغيل متتابع
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentIdx <= 0}
                onClick={() => {
                  const prevCh = SEERAH_CHAPTERS[Math.max(0, currentIdx - 1)];
                  if (prevCh) speakChapter(prevCh);
                }}
                aria-label="الفصل السابق"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-[#FCE38A] disabled:opacity-40"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => togglePlayPauseCurrent(currentPlayingObj)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3.5 text-xs font-extrabold text-black"
              >
                {playingChapterId === currentPlayingObj.id && !isPaused ? (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>إيقاف مؤقت</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>استمع</span>
                  </>
                )}
              </button>

              {playingChapterId && (
                <button
                  type="button"
                  onClick={stopNarration}
                  aria-label="إيقاف الصوت"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/50 bg-black text-rose-400"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                disabled={currentIdx >= SEERAH_CHAPTERS.length - 1}
                onClick={() => {
                  const nextCh =
                    SEERAH_CHAPTERS[
                      Math.min(SEERAH_CHAPTERS.length - 1, currentIdx + 1)
                    ];
                  if (nextCh) speakChapter(nextCh);
                }}
                aria-label="الفصل التالي"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-[#FCE38A] disabled:opacity-40"
              >
                <SkipBack className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {([0.85, 1, 1.2] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setPlaybackRate(r);
                    if (playingChapterId) {
                      const ch = SEERAH_CHAPTERS.find(
                        (x) => x.id === playingChapterId,
                      );
                      if (ch) speakChapter(ch, r);
                    }
                  }}
                  className={`font-mono-num rounded-lg border px-2 py-1 text-[10px] font-bold ${
                    playbackRate === r
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/40 text-zinc-300'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Phase Filters */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في أحداث السيرة (مثل: غار حراء، الهجرة، بدر، الفتح)..."
            className="min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-black py-2 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
          />
        </div>

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {(
            [
              'الكل',
              'قبل الهجرة',
              'في المدينة المنورة',
              'حجة الوداع والوفاة',
            ] as SeerahPhaseFilter[]
          ).map((phase) => (
            <button
              key={phase}
              type="button"
              onClick={() => setPhaseFilter(phase)}
              className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-xl border px-3 text-[11px] font-bold ${
                phaseFilter === phase
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/40 bg-[#0A0904] text-zinc-200'
              }`}
            >
              {phase}
            </button>
          ))}
        </div>
      </section>

      {/* Chapters List */}
      <div className="space-y-3">
        {filteredChapters.map((chapter) => {
          const isExpanded = activeChapterId === chapter.id;
          const isThisPlaying = playingChapterId === chapter.id;
          const isRead = readSet.has(chapter.id);
          const isCopied = copiedId === chapter.id;

          return (
            <article
              key={chapter.id}
              className={`rounded-3xl border-2 p-4 transition-colors ${
                isThisPlaying || isExpanded
                  ? 'border-[#C9A227] bg-white dark:bg-[#080602]'
                  : 'border-[#C9A227]/60 bg-white dark:bg-[#050505]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveChapterId(chapter.id);
                  markChapterRead(chapter.id);
                }}
                className="flex w-full items-start justify-between gap-2 text-right"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono-num rounded-lg bg-[#C9A227] px-2 py-0.5 text-[10px] font-extrabold text-black">
                      الفصل {toArabicDigits(chapter.number)}
                    </span>
                    <span className="rounded-lg border border-[#C9A227]/45 px-2 py-0.5 text-[10px] font-bold text-[#9A7415] dark:text-[#FCE38A]">
                      {chapter.yearAr}
                    </span>
                    {isRead && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    {chapter.titleAr}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                    {chapter.summaryAr}
                  </p>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-3 border-t border-[#C9A227]/30 pt-3">
                  <div className="whitespace-pre-line text-sm leading-[2] text-slate-800 dark:text-zinc-100">
                    {chapter.contentAr}
                  </div>

                  <div className="flex items-start gap-2 rounded-2xl border border-[#C9A227]/40 bg-[#C9A227]/10 p-3 text-xs leading-relaxed text-slate-800 dark:text-zinc-200">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
                    <div>
                      <strong className="text-[#9A7415] dark:text-[#FCE38A]">
                        الدرس المستفاد:{' '}
                      </strong>
                      <span>{chapter.lessonAr}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => togglePlayPauseCurrent(chapter)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3.5 text-xs font-extrabold text-black"
                    >
                      {isThisPlaying && !isPaused ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                      <span>
                        {isThisPlaying && !isPaused
                          ? 'إيقاف الصوت'
                          : 'اسمع الفصل بالصوت'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${chapter.titleAr} (${chapter.yearAr})\n\n${chapter.contentAr}\n\nالدرس المستفاد: ${chapter.lessonAr}`,
                          );
                          setCopiedId(chapter.id);
                          window.setTimeout(() => setCopiedId(null), 1600);
                        } catch {
                          // ignore
                        }
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C9A227]/55 px-3 text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
