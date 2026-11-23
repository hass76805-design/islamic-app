import React, {useMemo, useState} from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  Check,
  Clock,
  Download,
  Film,
  Play,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import lectureStageFallback from '../assets/images/islamic_lectures_stage_1795364723996.jpg';
import {SCHOLARS_30} from '../data/scholarsData';
import {useLocalStorage} from '../hooks/useLocalStorage';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {ScholarProfile, ScholarVideo} from '../types';
import {cacheImageUrl} from '../utils/offlineAudioCache';

interface SavedOfflineLecture {
  videoId: string;
  scholarId: string;
  scholarNameAr: string;
  categoryAr: string;
  titleAr: string;
  duration: string;
  thumbnail: string;
  savedAt: number;
}

function normalizeAr(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

export const ScholarsView: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [selectedScholar, setSelectedScholar] = useState<ScholarProfile | null>(
    null,
  );
  const [activeVideo, setActiveVideo] = useState<ScholarVideo | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const [savedLectures, setSavedLectures] = useLocalStorage<
    SavedOfflineLecture[]
  >('alzahabi_saved_videos_v1', []);

  const savedIdSet = useMemo(
    () => new Set(savedLectures.map((item) => item.videoId)),
    [savedLectures],
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(SCHOLARS_30.map((s) => s.categoryAr)));
    return ['الكل', 'المحفوظة أوفلاين', ...unique];
  }, []);

  const filteredScholars = useMemo(() => {
    const q = normalizeAr(query);
    return SCHOLARS_30.filter((scholar) => {
      if (
        !q &&
        activeCategory !== 'الكل' &&
        activeCategory !== 'المحفوظة أوفلاين' &&
        scholar.categoryAr !== activeCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        normalizeAr(scholar.nameAr).includes(q) ||
        normalizeAr(scholar.fullNameAr).includes(q) ||
        normalizeAr(scholar.categoryAr).includes(q) ||
        scholar.videos.some((v) => normalizeAr(v.titleAr).includes(q))
      );
    });
  }, [query, activeCategory]);

  const matchingVideoHits = useMemo(() => {
    const q = normalizeAr(query);
    if (!q || q.length < 2) return [];
    const hits: Array<{scholar: ScholarProfile; video: ScholarVideo}> = [];
    for (const scholar of SCHOLARS_30) {
      for (const video of scholar.videos) {
        if (normalizeAr(video.titleAr).includes(q)) {
          hits.push({scholar, video});
          if (hits.length >= 12) return hits;
        }
      }
    }
    return hits;
  }, [query]);

  const handleOpenScholar = (
    scholar: ScholarProfile,
    initialVideo?: ScholarVideo,
  ) => {
    setSelectedScholar(scholar);
    setActiveVideo(initialVideo || scholar.videos[0] || null);
    window.scrollTo({top: 0, behavior: 'auto'});
  };

  const handleToggleSaveOffline = async (
    scholarId: string,
    scholarNameAr: string,
    categoryAr: string,
    video: ScholarVideo,
  ) => {
    if (savedIdSet.has(video.videoId)) {
      setSavedLectures((prev) =>
        prev.filter((item) => item.videoId !== video.videoId),
      );
      setOfflineNotice('تمت إزالة المحاضرة من المحفوظات');
      window.setTimeout(() => setOfflineNotice(null), 2200);
      return;
    }

    setSavingId(video.videoId);
    try {
      await cacheImageUrl(video.thumbnail);
    } catch {
      // thumbnail cache best-effort
    }
    setSavedLectures((prev) => [
      {
        videoId: video.videoId,
        scholarId,
        scholarNameAr,
        categoryAr,
        titleAr: video.titleAr,
        duration: video.duration,
        thumbnail: video.thumbnail,
        savedAt: Date.now(),
      },
      ...prev.filter((item) => item.videoId !== video.videoId),
    ]);
    setSavingId(null);
    setOfflineNotice(
      'تم حفظ بيانات المحاضرة وصورتها في قائمتك للعمل بدون نت',
    );
    window.setTimeout(() => setOfflineNotice(null), 3200);
  };

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';
    img.src = lectureStageFallback;
  };

  // Detail View for a selected scholar (10 real YouTube videos + player)
  if (selectedScholar) {
    const currentVideo = activeVideo || selectedScholar.videos[0];
    const currentSaved = currentVideo
      ? savedIdSet.has(currentVideo.videoId)
      : false;

    return (
      <div className="space-y-3.5 pb-4">
        {/* Top Back Bar */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A227] bg-white p-2.5 dark:bg-[#050505]">
          <button
            type="button"
            onClick={() => {
              setSelectedScholar(null);
              setActiveVideo(null);
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#C9A227]/60 bg-[#C9A227]/10 px-3 text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]"
          >
            <ArrowRight className="h-4 w-4 shrink-0" />
            <span>قائمة 30 شيخًا</span>
          </button>

          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
              {selectedScholar.nameAr}
            </p>
            <p className="truncate text-[11px] font-semibold text-[#C9A227]">
              {selectedScholar.categoryAr} · {selectedScholar.videos.length}{' '}
              فيديو
            </p>
          </div>

          <img
            src={selectedScholar.avatarUrl || lectureStageFallback}
            alt={selectedScholar.nameAr}
            referrerPolicy="no-referrer"
            onError={handleImgError}
            className="h-11 w-11 shrink-0 rounded-xl border border-[#C9A227] object-cover"
          />
        </div>

        {/* Sticky Inline Active Video Player — keeps video playing while scrolling */}
        {currentVideo && (
          <div className="sticky top-[58px] z-20 overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505] text-white shadow-[0_8px_24px_rgba(0,0,0,0.88)]">
            <div className="relative aspect-video w-full bg-black">
              {isOnline ? (
                <iframe
                  key={currentVideo.videoId}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${currentVideo.videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`}
                  title={currentVideo.titleAr}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="relative flex h-full w-full flex-col items-center justify-center p-4 text-center">
                  <img
                    src={currentVideo.thumbnail || lectureStageFallback}
                    alt={currentVideo.titleAr}
                    referrerPolicy="no-referrer"
                    onError={handleImgError}
                    className="absolute inset-0 h-full w-full object-cover opacity-35"
                  />
                  <div className="relative z-10 flex flex-col items-center gap-1.5 rounded-2xl border border-[#C9A227]/80 bg-black/90 px-4 py-3">
                    <BookmarkCheck className="h-6 w-6 text-[#C9A227]" />
                    <p className="text-xs font-bold text-[#FCE38A]">
                      بطاقة المحاضرة المحفوظة · {selectedScholar.nameAr}
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      معلومات المحاضرة وصورتها وبياناتها محفوظة داخل التطبيق بدون نت
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold leading-relaxed text-white">
                  {currentVideo.titleAr}
                </h3>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[#C9A227]/25 pt-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#FCE38A]">
                  <Clock className="h-3.5 w-3.5 text-[#C9A227]" />
                  <span>{currentVideo.duration}</span>
                  <span>·</span>
                  <span>{selectedScholar.nameAr}</span>
                </span>

                <button
                  type="button"
                  disabled={savingId === currentVideo.videoId}
                  onClick={() =>
                    void handleToggleSaveOffline(
                      selectedScholar.id,
                      selectedScholar.nameAr,
                      selectedScholar.categoryAr,
                      currentVideo,
                    )
                  }
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                    currentSaved
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227] bg-[#141004] text-[#FCE38A]'
                  }`}
                >
                  {currentSaved ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {savingId === currentVideo.videoId
                      ? 'جارٍ الحفظ...'
                      : currentSaved
                        ? 'محفوظ أوفلاين'
                        : 'تحميل أوفلاين'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {offlineNotice && (
          <div className="rounded-xl border border-[#C9A227] bg-[#141004] px-3 py-2 text-center text-xs font-bold text-[#FCE38A]">
            {offlineNotice}
          </div>
        )}

        {/* Horizontal Swipe Strip for All 30 Scholars */}
        <div className="overflow-x-auto pb-1">
          <div className="flex w-max gap-2">
            {SCHOLARS_30.map((item) => {
              const isCurrent = item.id === selectedScholar.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenScholar(item)}
                  className={`flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/45 bg-white text-slate-800 dark:bg-[#080703] dark:text-[#FCE38A]'
                  }`}
                >
                  <img
                    src={item.avatarUrl || lectureStageFallback}
                    alt={item.nameAr}
                    referrerPolicy="no-referrer"
                    onError={handleImgError}
                    className="h-6 w-6 rounded-lg object-cover"
                  />
                  <span className="whitespace-nowrap">{item.nameAr}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 10 Video Lectures List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]">
              محاضرات {selectedScholar.fullNameAr} (
              {selectedScholar.videos.length})
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              اضغط للتشغيل أو التحميل
            </span>
          </div>

          {selectedScholar.videos.map((video, idx) => {
            const isPlaying = currentVideo?.videoId === video.videoId;
            const isSaved = savedIdSet.has(video.videoId);

            return (
              <div
                key={video.videoId}
                className={`overflow-hidden rounded-2xl border-2 transition-colors ${
                  isPlaying
                    ? 'border-[#C9A227] bg-[#C9A227]/12 dark:bg-[#141004]'
                    : 'border-[#C9A227]/45 bg-white dark:bg-[#050505]'
                }`}
              >
                <div className="flex items-stretch gap-2.5 p-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveVideo(video)}
                    className="relative h-[68px] w-[108px] shrink-0 overflow-hidden rounded-xl border border-[#C9A227]/50 bg-black"
                  >
                    <img
                      src={video.thumbnail || lectureStageFallback}
                      alt={video.titleAr}
                      referrerPolicy="no-referrer"
                      onError={handleImgError}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isPlaying
                            ? 'bg-[#C9A227] text-black'
                            : 'bg-black/80 text-[#FCE38A]'
                        }`}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                    </div>
                    <span className="font-mono absolute bottom-1 left-1 rounded bg-black/85 px-1 text-[10px] font-bold text-[#FCE38A]">
                      {video.duration}
                    </span>
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveVideo(video)}
                      className="text-right"
                    >
                      <span className="font-mono text-[10px] font-bold text-[#C9A227]">
                        محاضرة {String(idx + 1).padStart(2, '0')}
                        {isPlaying ? ' · قيد التشغيل' : ''}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-slate-900 dark:text-white">
                        {video.titleAr}
                      </p>
                    </button>

                    <div className="mt-2 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={savingId === video.videoId}
                        onClick={() =>
                          void handleToggleSaveOffline(
                            selectedScholar.id,
                            selectedScholar.nameAr,
                            selectedScholar.categoryAr,
                            video,
                          )
                        }
                        className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold ${
                          isSaved
                            ? 'border-[#C9A227] bg-[#C9A227] text-black'
                            : 'border-[#C9A227]/50 text-[#9A7415] dark:text-[#FCE38A]'
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {savingId === video.videoId
                            ? 'حفظ...'
                            : isSaved
                              ? 'محفوظ'
                              : 'تحميل أوفلاين'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Main 30 Scholars Video Directory
  return (
    <div className="space-y-3.5 pb-4">
      {/* Header + Search + Category Tabs */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 dark:bg-[#050505]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <Video className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              محاضرات فيديو 30 شيخًا
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-zinc-300">
              30 شيخًا من العالم الإسلامي · 300 محاضرة فيديو حقيقية
            </p>
          </div>
        </div>

        {/* Search across all 30 scholars and titles */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الشيخ أو عنوان المحاضرة..."
            className="min-h-[44px] w-full rounded-xl border border-[#C9A227]/70 bg-slate-50 py-2 pr-9 pl-3 text-xs font-bold text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0D0D0D] dark:text-white"
          />
        </div>

        {/* Filter Tabs */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat && !query.trim();
            const isOfflineTab = cat === 'المحفوظة أوفلاين';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveCategory(cat);
                }}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl border px-3 text-[11px] font-bold transition-colors ${
                  isSelected
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/40 text-slate-700 dark:text-zinc-200'
                }`}
              >
                {cat}
                {isOfflineTab && savedLectures.length > 0
                  ? ` (${savedLectures.length})`
                  : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Offline Saved Videos Tab View */}
      {activeCategory === 'المحفوظة أوفلاين' && !query.trim() ? (
        <div className="space-y-2.5">
          {savedLectures.length === 0 ? (
            <div className="rounded-3xl border-2 border-[#C9A227]/50 bg-white p-6 text-center dark:bg-[#050505]">
              <Download className="mx-auto h-8 w-8 text-[#C9A227]" />
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                لا توجد محاضرات محفوظة بعد
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                افتح أي شيخ واضغط «تحميل أوفلاين» لحفظ المحاضرة وصورتها في
                قائمتك.
              </p>
            </div>
          ) : (
            savedLectures.map((saved) => {
              const scholarObj = SCHOLARS_30.find(
                (s) => s.id === saved.scholarId,
              );
              const videoObj = scholarObj?.videos.find(
                (v) => v.videoId === saved.videoId,
              );
              return (
                <div
                  key={saved.videoId}
                  className="flex items-center gap-2.5 rounded-2xl border-2 border-[#C9A227] bg-white p-2.5 dark:bg-[#050505]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (scholarObj) {
                        handleOpenScholar(scholarObj, videoObj);
                      }
                    }}
                    className="relative h-[64px] w-[100px] shrink-0 overflow-hidden rounded-xl border border-[#C9A227]/60 bg-black"
                  >
                    <img
                      src={saved.thumbnail || lectureStageFallback}
                      alt={saved.titleAr}
                      referrerPolicy="no-referrer"
                      onError={handleImgError}
                      className="h-full w-full object-cover"
                    />
                    <span className="font-mono absolute bottom-1 left-1 rounded bg-black/85 px-1 text-[10px] font-bold text-[#FCE38A]">
                      {saved.duration}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (scholarObj) {
                        handleOpenScholar(scholarObj, videoObj);
                      }
                    }}
                    className="min-w-0 flex-1 text-right"
                  >
                    <p className="text-[11px] font-bold text-[#C9A227]">
                      {saved.scholarNameAr} · {saved.categoryAr}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-bold text-slate-900 dark:text-white">
                      {saved.titleAr}
                    </p>
                  </button>

                  <button
                    type="button"
                    aria-label="حذف من المحفوظات"
                    onClick={() =>
                      setSavedLectures((prev) =>
                        prev.filter((item) => item.videoId !== saved.videoId),
                      )
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/40 text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          {/* Matching direct videos banner when user types a topic search */}
          {matchingVideoHits.length > 0 && (
            <div className="space-y-2 rounded-3xl border border-[#C9A227]/60 bg-white p-3 dark:bg-[#050505]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]">
                <Film className="h-4 w-4 text-[#C9A227]" />
                <span>محاضرات تطابق بحثك ({matchingVideoHits.length})</span>
              </div>
              <div className="space-y-1.5">
                {matchingVideoHits.slice(0, 5).map(({scholar, video}) => (
                  <button
                    key={`${scholar.id}-${video.videoId}`}
                    type="button"
                    onClick={() => handleOpenScholar(scholar, video)}
                    className="flex w-full items-center gap-2 rounded-xl border border-[#C9A227]/35 bg-slate-50 p-2 text-right dark:bg-[#0C0A04]"
                  >
                    <Play className="h-4 w-4 shrink-0 text-[#C9A227]" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
                        {video.titleAr}
                      </p>
                      <p className="text-[10px] font-semibold text-[#C9A227]">
                        {scholar.nameAr} · {video.duration}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 30 Scholars Grid (Portrait Image + Name + Category) */}
          {filteredScholars.length === 0 ? (
            <div className="rounded-3xl border-2 border-[#C9A227]/50 bg-white p-6 text-center dark:bg-[#050505]">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                لم يتم العثور على نتائج مطابقة لـ «{query}»
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredScholars.map((scholar) => (
                <button
                  key={scholar.id}
                  type="button"
                  onClick={() => handleOpenScholar(scholar)}
                  className="group overflow-hidden rounded-2xl border-2 border-[#C9A227]/75 bg-white text-right transition-colors hover:border-[#C9A227] dark:bg-[#050505]"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                    <img
                      src={scholar.avatarUrl || lectureStageFallback}
                      alt={scholar.nameAr}
                      referrerPolicy="no-referrer"
                      onError={handleImgError}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                    <span className="font-mono absolute top-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-[#FCE38A]">
                      {String(scholar.number).padStart(2, '0')}
                    </span>
                    <span className="absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#C9A227] bg-black/80 text-[#FCE38A]">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </span>
                  </div>

                  <div className="p-2.5">
                    <h3 className="line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
                      {scholar.nameAr}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#9A7415] dark:text-[#C9A227]">
                      {scholar.categoryAr} · {scholar.videos.length} فيديوهات
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
