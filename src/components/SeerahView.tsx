import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpenText,
  Check,
  CheckCircle2,
  Copy,
  Headphones,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import {
  SEERAH_AUDIO_EPISODES,
  SEERAH_CHAPTERS,
  SeerahAudioEpisode,
  SeerahChapter,
} from '../data/seerahData';
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

function formatDurationMMSS(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  // Real Sheikh HTML5 Audio player state (ZERO speechSynthesis)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playingTrackKind, setPlayingTrackKind] = useState<'chapter' | 'episode'>(
    'chapter',
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<0.85 | 1 | 1.2>(1);
  const [autoNext, setAutoNext] = useState(true);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [showFullSeries, setShowFullSeries] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoNextRef = useRef(autoNext);
  autoNextRef.current = autoNext;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const markChapterRead = (id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const stopNarration = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingTrackId(null);
    setIsPaused(false);
    setIsBuffering(false);
    setCurrentTimeSec(0);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const startAudioTrack = (
    trackId: string,
    url: string,
    kind: 'chapter' | 'episode',
    rateOverride: number = playbackRateRef.current,
  ) => {
    setAudioError(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    setPlayingTrackId(trackId);
    setPlayingTrackKind(kind);
    if (kind === 'chapter') {
      setActiveChapterId(trackId);
      markChapterRead(trackId);
    }
    setIsPaused(false);
    setIsBuffering(true);
    setCurrentTimeSec(0);
    setDurationSec(0);

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDurationSec(audio.duration);
      }
      audio.playbackRate = rateOverride;
    };
    audio.oncanplay = () => {
      setIsBuffering(false);
      audio.playbackRate = rateOverride;
    };
    audio.onwaiting = () => setIsBuffering(true);
    audio.onplaying = () => {
      setIsBuffering(false);
      setIsPaused(false);
      setAudioError(null);
    };
    audio.ontimeupdate = () => {
      if (Number.isFinite(audio.currentTime)) {
        setCurrentTimeSec(audio.currentTime);
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDurationSec(audio.duration);
      }
    };
    audio.onended = () => {
      setIsPaused(false);
      setIsBuffering(false);
      if (!autoNextRef.current) {
        setPlayingTrackId(null);
        return;
      }
      if (kind === 'chapter') {
        const curIdx = SEERAH_CHAPTERS.findIndex((c) => c.id === trackId);
        if (curIdx >= 0 && curIdx < SEERAH_CHAPTERS.length - 1) {
          const nextCh = SEERAH_CHAPTERS[curIdx + 1];
          startAudioTrack(nextCh.id, nextCh.audioUrl, 'chapter');
        } else {
          setPlayingTrackId(null);
        }
      } else {
        const curIdx = SEERAH_AUDIO_EPISODES.findIndex((e) => e.id === trackId);
        if (curIdx >= 0 && curIdx < SEERAH_AUDIO_EPISODES.length - 1) {
          const nextEp = SEERAH_AUDIO_EPISODES[curIdx + 1];
          startAudioTrack(nextEp.id, nextEp.url, 'episode');
        } else {
          setPlayingTrackId(null);
        }
      }
    };
    audio.onerror = () => {
      setIsBuffering(false);
      setIsPaused(false);
      setPlayingTrackId(null);
      setAudioError('تعذر تشغيل صوت الشيخ حاليًا');
    };

    audio.src = url;
    audio.playbackRate = rateOverride;
    audio.load();
    audio.play().catch(() => {
      setIsBuffering(false);
      setAudioError('اضغط تشغيل مرة أخرى لبدء الاستماع لصوت الشيخ');
    });
  };

  const togglePlayPauseChapter = (chapter: SeerahChapter) => {
    if (playingTrackId !== chapter.id || playingTrackKind !== 'chapter') {
      startAudioTrack(chapter.id, chapter.audioUrl, 'chapter');
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (isPaused || audio.paused) {
      audio
        .play()
        .then(() => setIsPaused(false))
        .catch(() => {});
    } else {
      audio.pause();
      setIsPaused(true);
    }
  };

  const togglePlayPauseEpisode = (ep: SeerahAudioEpisode) => {
    if (playingTrackId !== ep.id || playingTrackKind !== 'episode') {
      startAudioTrack(ep.id, ep.url, 'episode');
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (isPaused || audio.paused) {
      audio
        .play()
        .then(() => setIsPaused(false))
        .catch(() => {});
    } else {
      audio.pause();
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

  const currentEpisodeObj =
    playingTrackKind === 'episode' && playingTrackId
      ? SEERAH_AUDIO_EPISODES.find((e) => e.id === playingTrackId) || null
      : null;

  const currentChapterObj =
    SEERAH_CHAPTERS.find(
      (c) =>
        c.id ===
        (playingTrackKind === 'chapter' && playingTrackId
          ? playingTrackId
          : activeChapterId),
    ) || SEERAH_CHAPTERS[0];

  const currentIdx = SEERAH_CHAPTERS.findIndex(
    (c) => c.id === currentChapterObj.id,
  );
  const isCurrentActivePlaying =
    (currentEpisodeObj
      ? playingTrackId === currentEpisodeObj.id && playingTrackKind === 'episode'
      : playingTrackId === currentChapterObj.id &&
        playingTrackKind === 'chapter') && !isPaused;

  return (
    <div className="space-y-4 pb-4">
      {/* Header & Real Sheikh Audio Narration Player */}
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
                من المولد الشريف إلى الوفاة · بصوت الشيخ نبيل العوضي
              </p>
            </div>
          </div>

          <span className="font-mono-num rounded-xl border border-[#C9A227]/50 bg-[#0A0904] px-2.5 py-1 text-[11px] font-bold text-[#F3D56B]">
            {toArabicDigits(readIds.length)}/
            {toArabicDigits(SEERAH_CHAPTERS.length)}
          </span>
        </div>

        {/* Sticky-like Real Sheikh Seerah Audio Player */}
        <div className="mt-3 space-y-2.5 rounded-2xl border border-[#C9A227]/60 bg-[#0A0904] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#C9A227]">
                <Headphones className="h-3.5 w-3.5" />
                <span>
                  {currentEpisodeObj
                    ? currentEpisodeObj.sheikhNameAr
                    : `${currentChapterObj.sheikhNameAr} · ${currentChapterObj.yearAr}`}
                </span>
              </p>
              <p className="truncate text-xs font-bold text-white">
                {currentEpisodeObj
                  ? currentEpisodeObj.titleAr
                  : `${currentChapterObj.number}. ${currentChapterObj.titleAr}`}
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

          {/* Interactive Progress & Seek Bar */}
          {playingTrackId && (
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(durationSec))}
                value={Math.min(
                  Math.floor(currentTimeSec),
                  Math.max(1, Math.floor(durationSec)),
                )}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentTimeSec(val);
                  if (audioRef.current) {
                    audioRef.current.currentTime = val;
                  }
                }}
                aria-label="تقديم أو تأخير الصوت"
                className="h-1.5 w-full cursor-pointer accent-[#C9A227]"
              />
              <div className="font-mono-num flex items-center justify-between text-[10px] font-bold text-zinc-400">
                <span>{formatDurationMMSS(currentTimeSec)}</span>
                <span>
                  {isBuffering
                    ? 'جاري تحميل صوت الشيخ...'
                    : formatDurationMMSS(durationSec)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!currentEpisodeObj && currentIdx <= 0}
                onClick={() => {
                  if (currentEpisodeObj) {
                    const epIdx = SEERAH_AUDIO_EPISODES.findIndex(
                      (e) => e.id === currentEpisodeObj.id,
                    );
                    if (epIdx > 0) {
                      const prevEp = SEERAH_AUDIO_EPISODES[epIdx - 1];
                      startAudioTrack(prevEp.id, prevEp.url, 'episode');
                    }
                  } else {
                    const prevCh = SEERAH_CHAPTERS[Math.max(0, currentIdx - 1)];
                    if (prevCh)
                      startAudioTrack(prevCh.id, prevCh.audioUrl, 'chapter');
                  }
                }}
                aria-label="السابق"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-[#FCE38A] disabled:opacity-40"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  currentEpisodeObj
                    ? togglePlayPauseEpisode(currentEpisodeObj)
                    : togglePlayPauseChapter(currentChapterObj)
                }
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3.5 text-xs font-extrabold text-black"
              >
                {isBuffering && playingTrackId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري التحميل</span>
                  </>
                ) : isCurrentActivePlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>إيقاف مؤقت</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>استمع للشيخ</span>
                  </>
                )}
              </button>

              {playingTrackId && (
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
                disabled={
                  !currentEpisodeObj &&
                  currentIdx >= SEERAH_CHAPTERS.length - 1
                }
                onClick={() => {
                  if (currentEpisodeObj) {
                    const epIdx = SEERAH_AUDIO_EPISODES.findIndex(
                      (e) => e.id === currentEpisodeObj.id,
                    );
                    if (
                      epIdx >= 0 &&
                      epIdx < SEERAH_AUDIO_EPISODES.length - 1
                    ) {
                      const nextEp = SEERAH_AUDIO_EPISODES[epIdx + 1];
                      startAudioTrack(nextEp.id, nextEp.url, 'episode');
                    }
                  } else {
                    const nextCh =
                      SEERAH_CHAPTERS[
                        Math.min(SEERAH_CHAPTERS.length - 1, currentIdx + 1)
                      ];
                    if (nextCh)
                      startAudioTrack(nextCh.id, nextCh.audioUrl, 'chapter');
                  }
                }}
                aria-label="التالي"
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
                    if (audioRef.current) {
                      audioRef.current.playbackRate = r;
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

          {/* 30-Lecture Full Series Toggle */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowFullSeries((v) => !v)}
              className={`inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                showFullSeries
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 bg-black text-[#FCE38A]'
              }`}
            >
              <ListMusic className="h-3.5 w-3.5" />
              <span>السلسلة الصوتية الكاملة (٣٠ درسًا)</span>
            </button>
          </div>

          {audioError && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-bold text-rose-300">
              {audioError}
            </p>
          )}
        </div>

        {/* Collapsible 30-Lecture Complete Audio Series */}
        {showFullSeries && (
          <div className="mt-3 max-h-[260px] space-y-1.5 overflow-y-auto rounded-2xl border border-[#C9A227]/50 bg-black p-2.5">
            <p className="px-1 text-[11px] font-bold text-[#FCE38A]">
              سلسلة السيرة النبوية الكاملة — الشيخ نبيل العوضي (٣٠ درسًا):
            </p>
            {SEERAH_AUDIO_EPISODES.map((ep) => {
              const isPlayingEp =
                playingTrackId === ep.id && playingTrackKind === 'episode';
              return (
                <div
                  key={ep.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${
                    isPlayingEp
                      ? 'border-[#C9A227] bg-[#141004]'
                      : 'border-[#C9A227]/25 bg-[#080703]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePlayPauseEpisode(ep)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-right"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C9A227] text-black">
                      {isPlayingEp && !isPaused ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="truncate text-xs font-bold text-white">
                      {ep.titleAr}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

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

      {/* Chapters List (100% Written Text Available Offline) */}
      <div className="space-y-3">
        {filteredChapters.map((chapter) => {
          const isExpanded = activeChapterId === chapter.id;
          const isThisPlaying =
            playingTrackId === chapter.id && playingTrackKind === 'chapter';
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
                      onClick={() => togglePlayPauseChapter(chapter)}
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
                          : `استمع (${chapter.sheikhNameAr})`}
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
