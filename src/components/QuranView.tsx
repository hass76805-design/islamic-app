import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  History,
  List,
  Mic,
  Pause,
  Play,
  Repeat,
  Search,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {LastReadPosition} from '../App';
import {
  getAyahAudioUrl,
  getReciterById,
  getSurahAudioUrl,
  RECITERS_30,
} from '../data/reciters';
import {
  CompactAyah,
  CompactSurah,
  KhatmaPlan,
  MemorizationTestResult,
  QuranBookmark,
  ReciterId,
} from '../types';
import {
  cleanQuranText,
  cleanTafsirText,
  extractAyahWordMeanings,
} from '../utils/ayahWordMeanings';
import {useHardwareBack} from '../utils/backNavigation';
import {
  cacheAudioUrl,
  isQuranShowingInitialSeedOnly,
  loadOfflineJson,
  resolveOfflinePlayableUrl,
} from '../utils/offlineAudioCache';
import {AyahReciterSheet} from './AyahReciterSheet';
import {SurahHeaderFrame} from './IslamicOrnament';
import {QuranTeacherModal} from './QuranTeacherModal';
import {QuranTestModal} from './QuranTestModal';

export interface QuranLaunchDirective {
  type: 'fatiha' | 'test';
  key: number;
}

interface QuranViewProps {
  bookmarks: QuranBookmark[];
  onToggleBookmark: (bm: Omit<QuranBookmark, 'id' | 'createdAt'>) => void;
  onRemoveBookmark: (id: string) => void;
  khatma: KhatmaPlan;
  onUpdateKhatma: React.Dispatch<React.SetStateAction<KhatmaPlan>>;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  preferredReciter: ReciterId;
  onChangePreferredReciter: (id: ReciterId) => void;
  testHistory: MemorizationTestResult[];
  onSaveTestResult: (res: MemorizationTestResult, ayahNumber?: number) => void;
  lastRead: LastReadPosition;
  onUpdateLastRead: (
    surahNumber: number,
    ayahNumber: number,
    page: number,
  ) => void;
  launchDirective?: QuranLaunchDirective | null;
  onConsumeLaunchDirective?: () => void;
}

interface PageEntry {
  surah: CompactSurah;
  ayah: CompactAyah;
}

type IndexDrawerTab = 'surah' | 'juz' | 'search' | 'bookmarks' | 'khatma';
type AyahDetailTab = 'tafsir' | 'meanings';

const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

function toArabicDigits(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

let cachedSurahs: CompactSurah[] | null = null;
let cachedTafsir: Record<number, string> | null = null;

export const QuranView: React.FC<QuranViewProps> = ({
  bookmarks,
  onToggleBookmark,
  onRemoveBookmark,
  khatma,
  onUpdateKhatma,
  fontSize,
  onChangeFontSize,
  preferredReciter,
  onChangePreferredReciter,
  testHistory,
  onSaveTestResult,
  lastRead,
  onUpdateLastRead,
  launchDirective,
  onConsumeLaunchDirective,
}) => {
  const [surahs, setSurahs] = useState<CompactSurah[] | null>(cachedSurahs);
  const [tafsir, setTafsir] = useState<Record<number, string> | null>(
    cachedTafsir,
  );
  const [loading, setLoading] = useState(!cachedSurahs);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seedOnlyMode, setSeedOnlyMode] = useState<boolean>(() =>
    isQuranShowingInitialSeedOnly(),
  );

  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (launchDirective?.type === 'fatiha') return 1;
    const savedPage = lastRead?.page || khatma.currentPage || 1;
    return Math.min(604, Math.max(1, savedPage));
  });
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [highlightedAyahId, setHighlightedAyahId] = useState<number | null>(
    null,
  );
  const [selectedAyah, setSelectedAyah] = useState<PageEntry | null>(null);

  // 4-Circular-Button Translucent Ayah Dock
  const [floatingPopup, setFloatingPopup] = useState<PageEntry | null>(null);
  const [popupSubmenu, setPopupSubmenu] = useState<'none' | 'sahhahli'>('none');
  const mushafBoxRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{x: number; y: number; ignored: boolean} | null>(
    null,
  );
  const pointerSwipeRef = useRef<{
    x: number;
    y: number;
    ignored: boolean;
  } | null>(null);

  // Tafsir & Word Meanings Modal
  const [ayahDetailModal, setAyahDetailModal] = useState<{
    entry: PageEntry;
    tab: AyahDetailTab;
  } | null>(null);

  const [teacherOpen, setTeacherOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(launchDirective?.type === 'test');
  const [testInitialSurah, setTestInitialSurah] = useState<number>(
    lastRead?.surahNumber || 1,
  );
  const [testInitialAyah, setTestInitialAyah] = useState<number>(
    lastRead?.ayahNumber || 1,
  );
  const [longPressTarget, setLongPressTarget] = useState<PageEntry | null>(
    null,
  );

  // Single Unified Index Drawer (فهرس)
  const [indexOpen, setIndexOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<IndexDrawerTab>('surah');
  const [surahFilter, setSurahFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Hardware Back handlers
  useHardwareBack(Boolean(floatingPopup), () => {
    setFloatingPopup(null);
    setPopupSubmenu('none');
  });
  useHardwareBack(indexOpen, () => setIndexOpen(false));
  useHardwareBack(Boolean(ayahDetailModal), () => setAyahDetailModal(null));

  // Audio state
  const [playingAyahId, setPlayingAyahId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [correctingAyahBanner, setCorrectingAyahBanner] =
    useState<PageEntry | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playSessionRef = useRef<number>(0);

  const [retryTick, setRetryTick] = useState(0);

  // Load offline Quran & Tafsir JSONs (IndexedDB -> CacheStorage -> Network -> Initial Seed Data)
  useEffect(() => {
    let active = true;
    async function loadData(forceUpgradeSeed = false) {
      if (cachedSurahs && !forceUpgradeSeed && !isQuranShowingInitialSeedOnly()) {
        setSurahs(cachedSurahs);
        setTafsir(cachedTafsir);
        setSeedOnlyMode(false);
        setLoadError(null);
        setLoading(false);
        if (!cachedTafsir) {
          loadOfflineJson<Record<number, string>>('/data/tafsir.json')
            .then((tData) => {
              cachedTafsir = tData;
              if (active) setTafsir(tData);
            })
            .catch(() => {});
        }
        return;
      }
      try {
        if (!cachedSurahs) setLoading(true);
        setLoadError(null);
        const qData = await loadOfflineJson<CompactSurah[]>('/data/quran.json');
        cachedSurahs = qData;
        if (active) {
          setSurahs(qData);
          setSeedOnlyMode(isQuranShowingInitialSeedOnly());
          setLoading(false);
        }
        // Load tafsir in parallel non-blocking so Quran opens seamlessly offline
        loadOfflineJson<Record<number, string>>('/data/tafsir.json')
          .then((tData) => {
            cachedTafsir = tData;
            if (active) setTafsir(tData);
          })
          .catch(() => {});
      } catch {
        if (active && !cachedSurahs) {
          setLoadError(
            'تعذر فتح صفحة المصحف حاليًا — اضغط إعادة المحاولة',
          );
          setLoading(false);
        }
      }
    }
    void loadData();

    const handleOnlineUpgrade = () => {
      if (isQuranShowingInitialSeedOnly()) {
        cachedSurahs = null;
        cachedTafsir = null;
        void loadData(true);
      }
    };
    window.addEventListener('online', handleOnlineUpgrade);
    return () => {
      active = false;
      window.removeEventListener('online', handleOnlineUpgrade);
    };
  }, [retryTick]);

  const handledDirectiveKeyRef = useRef<number | null>(null);
  const lastReadRef = useRef(lastRead);
  lastReadRef.current = lastRead;

  // Respond to Home tile directives ONCE per directive key (never snap back to Al-Fatiha!)
  useEffect(() => {
    if (!launchDirective) return;
    if (handledDirectiveKeyRef.current === launchDirective.key) return;
    handledDirectiveKeyRef.current = launchDirective.key;
    if (launchDirective.type === 'fatiha') {
      setCurrentPage(1);
      setSelectedAyah(null);
      setHighlightedAyahId(null);
      setFloatingPopup(null);
      setIndexOpen(false);
      setTestOpen(false);
      setTeacherOpen(false);
    } else if (launchDirective.type === 'test') {
      setFloatingPopup(null);
      setTestInitialSurah(lastReadRef.current?.surahNumber || 1);
      setTestInitialAyah(lastReadRef.current?.ayahNumber || 1);
      setTestOpen(true);
    }
    onConsumeLaunchDirective?.();
  }, [launchDirective, onConsumeLaunchDirective]);

  const {pageMap, surahStartPages, searchableAyahs} = useMemo(() => {
    const map = new Map<number, PageEntry[]>();
    const startPages = new Map<number, number>();
    const searchable: Array<{
      surah: CompactSurah;
      ayah: CompactAyah;
      norm: string;
    }> = [];

    if (surahs) {
      for (const surah of surahs) {
        if (surah.ayahs.length > 0) {
          startPages.set(surah.n, surah.ayahs[0].p);
        }
        for (const ayah of surah.ayahs) {
          const cleanedAyah: CompactAyah = {
            ...ayah,
            t: cleanQuranText(ayah.t),
          };
          const list = map.get(cleanedAyah.p);
          if (list) {
            list.push({surah, ayah: cleanedAyah});
          } else {
            map.set(cleanedAyah.p, [{surah, ayah: cleanedAyah}]);
          }
          searchable.push({
            surah,
            ayah: cleanedAyah,
            norm: normalizeArabic(cleanedAyah.t),
          });
        }
      }
    }
    return {
      pageMap: map,
      surahStartPages: startPages,
      searchableAyahs: searchable,
    };
  }, [surahs]);

  const pageEntries = useMemo(
    () => pageMap.get(currentPage) || [],
    [pageMap, currentPage],
  );

  // Sync page changes -> Khatma + Last Read Position
  useEffect(() => {
    setPageInput(String(currentPage));
    setFloatingPopup(null);
    onUpdateKhatma((prev) =>
      prev.currentPage === currentPage ? prev : {...prev, currentPage},
    );
    const matchingSelected =
      selectedAyah && selectedAyah.ayah.p === currentPage ? selectedAyah : null;
    const targetEntry = matchingSelected || pageEntries[0];
    if (targetEntry) {
      onUpdateLastRead(targetEntry.surah.n, targetEntry.ayah.n, currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageEntries.length]);

  const activeSelectedEntry = useMemo<PageEntry | null>(() => {
    if (
      selectedAyah &&
      pageEntries.some((e) => e.ayah.id === selectedAyah.ayah.id)
    ) {
      return selectedAyah;
    }
    return selectedAyah || pageEntries[0] || null;
  }, [selectedAyah, pageEntries]);

  const groupedPageSections = useMemo(() => {
    const groups: Array<{surah: CompactSurah; ayahs: CompactAyah[]}> = [];
    for (const entry of pageEntries) {
      const last = groups[groups.length - 1];
      if (last && last.surah.n === entry.surah.n) {
        last.ayahs.push(entry.ayah);
      } else {
        groups.push({surah: entry.surah, ayahs: [entry.ayah]});
      }
    }
    return groups;
  }, [pageEntries]);

  const currentJuz = pageEntries[0]?.ayah.j ?? 1;
  const currentHizb = pageEntries[0]?.ayah.h ?? 1;
  const currentSurahName =
    selectedAyah && selectedAyah.ayah.p === currentPage
      ? selectedAyah.surah.name
      : pageEntries[0]?.surah.name ?? '';

  const goToPage = useCallback((page: number, highlightId?: number) => {
    const clamped = Math.min(604, Math.max(1, page));
    setCurrentPage(clamped);
    setHighlightedAyahId(highlightId ?? null);
    setFloatingPopup(null);
    setIndexOpen(false);
    document.getElementById('app-main-scroll')?.scrollTo({top: 0, behavior: 'auto'});
  }, []);

  // Explicit Surah ID lookup (1..114) -> exact start page, closes index immediately
  const goToSurahById = useCallback(
    (surahId: number) => {
      if (!surahs || surahs.length === 0) return;
      const targetSurah = surahs.find((item) => item.n === surahId);
      if (!targetSurah || targetSurah.ayahs.length === 0) return;
      const firstAyah = targetSurah.ayahs[0];
      const targetPage = Math.min(604, Math.max(1, firstAyah.p));
      setSelectedAyah({surah: targetSurah, ayah: firstAyah});
      setHighlightedAyahId(firstAyah.id);
      setFloatingPopup(null);
      setIndexOpen(false);
      setSurahFilter('');
      setCurrentPage(targetPage);
      onUpdateLastRead(targetSurah.n, firstAyah.n, targetPage);
      document.getElementById('app-main-scroll')?.scrollTo({top: 0, behavior: 'auto'});
    },
    [surahs, onUpdateLastRead],
  );

  const stopAudio = useCallback(() => {
    playSessionRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = 1;
    }
    setIsPlaying(false);
    setPlayingAyahId(null);
    setCorrectingAyahBanner(null);
  }, []);

  const playSingleAyahOrSequence = useCallback(
    (entry: PageEntry, continuePage = false, slowTajweed = false) => {
      setAudioError(null);
      const rawUrl = getAyahAudioUrl(
        preferredReciter,
        entry.surah.n,
        entry.ayah.n,
      );
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;

      if (
        isPlaying &&
        playingAyahId === entry.ayah.id &&
        !continuePage &&
        !slowTajweed
      ) {
        stopAudio();
        return;
      }

      const session = ++playSessionRef.current;

      if (slowTajweed) {
        setCorrectingAyahBanner(entry);
      } else {
        setCorrectingAyahBanner(null);
      }

      setPlayingAyahId(entry.ayah.id);
      setIsPlaying(true);

      void resolveOfflinePlayableUrl(rawUrl).then((playableUrl) => {
        if (session !== playSessionRef.current) return;
        audio.src = playableUrl;
        audio.playbackRate = slowTajweed ? 0.88 : 1;

        audio.onended = () => {
          if (session !== playSessionRef.current) return;
          audio.playbackRate = 1;
          if (continuePage) {
            const idx = pageEntries.findIndex(
              (e) => e.ayah.id === entry.ayah.id,
            );
            if (idx >= 0 && idx < pageEntries.length - 1) {
              playSingleAyahOrSequence(pageEntries[idx + 1], true);
              return;
            }
          }
          setIsPlaying(false);
          setPlayingAyahId(null);
          setCorrectingAyahBanner(null);
        };

        audio.onerror = () => {
          if (session !== playSessionRef.current) return;
          audio.playbackRate = 1;
          setIsPlaying(false);
          setPlayingAyahId(null);
          setAudioError(
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'يرجى الاتصال بالإنترنت لسماع هذه التلاوة (القراءة والتفسير متاحان بدون نت)'
              : 'تعذر تشغيل هذه التلاوة حاليًا',
          );
        };

        audio
          .play()
          .then(() => {
            void cacheAudioUrl(rawUrl);
          })
          .catch(() => {
            if (session !== playSessionRef.current) return;
            audio.playbackRate = 1;
            setIsPlaying(false);
          });
      });
    },
    [preferredReciter, pageEntries, isPlaying, playingAyahId, stopAudio],
  );

  const playSurahAyahsSequentially = useCallback(
    (surah: CompactSurah, ayahIdx: number, session: number) => {
      if (session !== playSessionRef.current) return;
      const ayah = surah.ayahs[ayahIdx];
      if (!ayah) {
        setIsPlaying(false);
        setPlayingAyahId(null);
        return;
      }
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      const rawUrl = getAyahAudioUrl(preferredReciter, surah.n, ayah.n);
      setPlayingAyahId(ayah.id);
      setIsPlaying(true);

      void resolveOfflinePlayableUrl(rawUrl).then((playableUrl) => {
        if (session !== playSessionRef.current) return;
        audio.src = playableUrl;
        audio.playbackRate = 1;
        audio.onended = () => {
          if (session !== playSessionRef.current) return;
          playSurahAyahsSequentially(surah, ayahIdx + 1, session);
        };
        audio.onerror = () => {
          if (session !== playSessionRef.current) return;
          setIsPlaying(false);
          setPlayingAyahId(null);
          setAudioError(
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'يرجى الاتصال بالإنترنت لسماع تلاوة السورة (القراءة والتفسير متاحان بدون نت)'
              : 'تعذر تشغيل تلاوة السورة حاليًا',
          );
        };
        audio.play().catch(() => {
          if (session !== playSessionRef.current) return;
          setIsPlaying(false);
          setPlayingAyahId(null);
        });
      });
    },
    [preferredReciter],
  );

  const playFullSurahAudio = useCallback(
    (surah: CompactSurah) => {
      setAudioError(null);
      setCorrectingAyahBanner(null);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      const session = ++playSessionRef.current;
      const firstAyahId = surah.ayahs[0]?.id ?? null;
      setPlayingAyahId(firstAyahId);
      setIsPlaying(true);

      const surahUrl = getSurahAudioUrl(preferredReciter, surah.n);
      void resolveOfflinePlayableUrl(surahUrl).then((playableUrl) => {
        if (session !== playSessionRef.current) return;
        audio.src = playableUrl;
        audio.playbackRate = 1;
        audio.onended = () => {
          if (session !== playSessionRef.current) return;
          setIsPlaying(false);
          setPlayingAyahId(null);
        };
        audio.onerror = () => {
          if (session !== playSessionRef.current) return;
          // Seamless fallback to sequential ayah-by-ayah playback for the entire Surah
          playSurahAyahsSequentially(surah, 0, session);
        };
        audio.play().catch(() => {
          if (session !== playSessionRef.current) return;
          playSurahAyahsSequentially(surah, 0, session);
        });
      });
    },
    [preferredReciter, playSurahAyahsSequentially],
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Dismiss 4-button Ayah dock when tapping outside
  useEffect(() => {
    if (!floatingPopup) return;
    const handleOutside = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-ayah-popup="true"]')) return;
      if (target.closest('[data-ayah-span="true"]')) return;
      setFloatingPopup(null);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, {passive: true});
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [floatingPopup]);

  const togglePlayPage = () => {
    if (isPlaying) {
      stopAudio();
    } else if (pageEntries.length > 0) {
      playSingleAyahOrSequence(activeSelectedEntry ?? pageEntries[0], true);
    }
  };

  const openAyahCircularDock = (entry: PageEntry) => {
    setSelectedAyah(entry);
    setFloatingPopup(entry);
    setPopupSubmenu('none');
    onUpdateLastRead(entry.surah.n, entry.ayah.n, currentPage);
  };

  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim();
    const numeric = parseInt(trimmed, 10);
    if (!Number.isNaN(numeric) && String(numeric) === trimmed && surahs) {
      const byNum: Array<{surah: CompactSurah; ayah: CompactAyah}> = [];
      for (const s of surahs) {
        const hit = s.ayahs.find((a) => a.n === numeric);
        if (hit) {
          byNum.push({surah: s, ayah: hit});
          if (byNum.length >= 60) break;
        }
      }
      return byNum;
    }

    const q = normalizeArabic(searchQuery);
    if (q.length < 2) return [];
    const matches: Array<{surah: CompactSurah; ayah: CompactAyah}> = [];
    for (const item of searchableAyahs) {
      if (item.norm.includes(q)) {
        matches.push({surah: item.surah, ayah: item.ayah});
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [searchQuery, searchableAyahs, surahs]);

  const filteredSurahs = useMemo(() => {
    if (!surahs) return [];
    const q = normalizeArabic(surahFilter);
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        normalizeArabic(s.name).includes(q) ||
        String(s.n) === surahFilter.trim() ||
        s.en.toLowerCase().includes(surahFilter.trim().toLowerCase()),
    );
  }, [surahs, surahFilter]);

  const isPageCompletedInKhatma = khatma.completedPages.includes(currentPage);
  const togglePageKhatma = () => {
    onUpdateKhatma((prev) => {
      const exists = prev.completedPages.includes(currentPage);
      const completedPages = exists
        ? prev.completedPages.filter((p) => p !== currentPage)
        : [...prev.completedPages, currentPage].sort((a, b) => a - b);
      return {...prev, completedPages};
    });
  };

  const isCurrentPageBookmarked = bookmarks.some((b) => b.page === currentPage);
  const activeSheikh = getReciterById(preferredReciter);

  const modalWordMeanings = useMemo(() => {
    if (!ayahDetailModal) return [];
    const rawTafsir = tafsir?.[ayahDetailModal.entry.ayah.id];
    return extractAyahWordMeanings(ayahDetailModal.entry.ayah.t, rawTafsir);
  }, [ayahDetailModal, tafsir]);

  const modalCleanTafsir = useMemo(() => {
    if (!ayahDetailModal) return '';
    const raw = tafsir?.[ayahDetailModal.entry.ayah.id];
    return raw ? cleanTafsirText(raw) : 'لا يتوفر تفسير لهذه الآية.';
  }, [ayahDetailModal, tafsir]);

  if (loading) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center rounded-3xl border-2 border-[#C9A227] bg-white p-6 text-center dark:bg-[#050505]">
        <BookOpen className="h-10 w-10 text-[#C9A227]" />
        <p className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
          جاري تجهيز صفحات المصحف الشريف (604 صفحة) بدون نت...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-white p-6 text-center dark:bg-[#050505]">
        <p className="text-sm font-bold text-rose-500">{loadError}</p>
        <button
          type="button"
          onClick={() => setRetryTick((t) => t + 1)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#C9A227] px-5 text-xs font-extrabold text-black"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* COMPACT TOP BAR: SINGLE "فهرس" BUTTON + PAGE & SHEIKH */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/80 bg-[#070602] px-2.5 py-1.5 text-white">
        <button
          type="button"
          onClick={() => {
            setDrawerTab('surah');
            setIndexOpen(true);
          }}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3 py-1.5 text-xs font-extrabold text-black"
        >
          <List className="h-4 w-4" />
          <span>فهرس</span>
        </button>

        <div className="min-w-0 text-center">
          <p className="font-quran truncate text-base font-bold leading-tight text-[#FCE38A]">
            {currentSurahName}
          </p>
          <p className="font-mono-num text-[10px] font-bold text-[#C9A227]">
            الجزء {toArabicDigits(currentJuz)} · ص {toArabicDigits(currentPage)} / ٦٠٤ · {activeSheikh.shortNameAr}
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-xl border border-[#C9A227]/45 bg-[#120E04] px-2 py-1 text-[10px] font-bold text-[#F3D56B]">
          <History className="h-3 w-3 text-[#C9A227]" />
          <span>أوفلاين</span>
        </span>
      </div>

      {seedOnlyMode && (
        <div className="rounded-2xl border border-[#C9A227]/60 bg-[#120E04] px-3 py-2 text-center text-[11px] font-bold leading-relaxed text-[#FCE38A]">
          وضع الأوفلاين المبدئي: السور الأساسية والقصار متاحة من الذاكرة المحلية — اتصل بالنت أو اضغط «تحميل محتوى التطبيق» من الرئيسية لحفظ الـ 604 صفحة كاملة.
        </div>
      )}

      {audioError && (
        <p className="rounded-xl border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-center text-xs font-bold text-rose-300">
          {audioError}
        </p>
      )}

      {correctingAyahBanner && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#C9A227] bg-[#120E04] px-3 py-2 text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#FCE38A]">
              الشيخ {activeSheikh.shortNameAr} يصحح الآية{' '}
              {toArabicDigits(correctingAyahBanner.ayah.n)} بالتجويد
            </p>
            <p className="font-quran truncate text-sm text-emerald-300">
              {cleanQuranText(correctingAyahBanner.ayah.t)}
            </p>
          </div>
          <button
            type="button"
            onClick={stopAudio}
            className="shrink-0 rounded-xl border border-[#C9A227]/60 px-2.5 py-1 text-[11px] font-bold text-[#FCE38A]"
          >
            إيقاف
          </button>
        </div>
      )}

      {/* ILLUMINATED MEDINAN MUSHAF PAGE PLATE (Full-Page Left/Right Swipe, Zero Next/Prev Buttons) */}
      <div
        ref={mushafBoxRef}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          const target = e.target as HTMLElement | null;
          const ignored = Boolean(target?.closest('input, select, button, form'));
          pointerSwipeRef.current = {x: e.clientX, y: e.clientY, ignored};
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') return;
          const start = pointerSwipeRef.current;
          pointerSwipeRef.current = null;
          if (!start || start.ignored) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.15) {
            if (dx > 0) {
              if (currentPage < 604) {
                goToPage(currentPage + 1);
                document.getElementById('app-main-scroll')?.scrollTo({top: 0, behavior: 'auto'});
              }
            } else if (currentPage > 1) {
              goToPage(currentPage - 1);
              document.getElementById('app-main-scroll')?.scrollTo({top: 0, behavior: 'auto'});
            }
          }
        }}
        onTouchStart={(e) => {
          if (e.touches.length !== 1) return;
          const target = e.target as HTMLElement | null;
          const ignored = Boolean(target?.closest('input, select, button, form'));
          swipeStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            ignored,
          };
        }}
        onTouchEnd={(e) => {
          const start = swipeStartRef.current;
          swipeStartRef.current = null;
          if (!start || start.ignored || e.changedTouches.length === 0) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.15) {
            if (dx > 0) {
              if (currentPage < 604) {
                goToPage(currentPage + 1);
                document.getElementById('app-main-scroll')?.scrollTo({top: 0, behavior: 'auto'});
              }
            } else if (currentPage > 1) {
              goToPage(currentPage - 1);
              document.getElementById('app-main-scroll')?.scrollTo({top: 0, behavior: 'auto'});
            }
          }
        }}
        className="mushaf-surface relative min-h-[calc(100dvh-134px)] w-full touch-pan-y rounded-2xl border-2 border-[#C9A227] p-1.5 shadow-[0_0_28px_rgba(201,162,39,0.14)]"
      >
        {/* Fullscreen Illuminated Plate Frame */}
        <div className="relative flex min-h-[calc(100dvh-150px)] flex-col justify-between rounded-xl border border-[#C9A227]/65 px-2.5 py-2.5 sm:px-4 sm:py-3">
          {/* Illuminated Top Page Plate Header */}
          <div className="mb-2 flex items-center justify-between border-b border-[#C9A227]/40 pb-1.5 text-[11px] font-bold text-[#9A7415] dark:text-[#FCE38A]">
            <span>{currentSurahName}</span>
            <span>الحزب {toArabicDigits(currentHizb)}</span>
            <span>الجزء {toArabicDigits(currentJuz)}</span>
          </div>

          {/* Crisp Calligraphic Mushaf Body */}
          <div className="flex-1 space-y-3">
            {groupedPageSections.map(({surah, ayahs}) => {
              const startsHere = ayahs[0]?.n === 1;
              const showBismillah = startsHere && surah.n !== 1 && surah.n !== 9;
              return (
                <div key={`p-${currentPage}-s-${surah.n}`}>
                  {startsHere && (
                    <SurahHeaderFrame
                      title={surah.name}
                      subtitle={`${surah.type === 'Meccan' ? 'مكية' : 'مدنية'} · ${toArabicDigits(surah.ayahs.length)} آية`}
                    />
                  )}
                  {showBismillah && (
                    <p className="font-quran my-3 text-center text-xl font-bold text-[#9A7415] dark:text-[#FCE38A]">
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </p>
                  )}

                  <div
                    className="font-quran text-justify leading-[2.5] tracking-normal text-slate-900 dark:text-white"
                    style={{fontSize: `${fontSize}px`}}
                  >
                    {ayahs.map((ayah) => {
                      let displayText = cleanQuranText(ayah.t);
                      if (ayah.n === 1 && surah.n !== 1 && surah.n !== 9) {
                        const parts = displayText.split(/\s+/);
                        if (parts.length > 4) {
                          const first4 = parts.slice(0, 4).map((p) =>
                            p
                              .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
                              .replace(/[ٱأإآ]/g, 'ا'),
                          );
                          if (
                            first4[0] === 'بسم' &&
                            first4[1] === 'الله' &&
                            first4[2] === 'الرحمن' &&
                            first4[3] === 'الرحيم'
                          ) {
                            displayText = parts.slice(4).join(' ').trim();
                          }
                        }
                      }

                      const isAudioActive = playingAyahId === ayah.id;
                      const isExplicitSelected =
                        selectedAyah?.ayah.id === ayah.id;
                      const isSearchHit = highlightedAyahId === ayah.id;

                      return (
                        <span
                          key={ayah.id}
                          data-ayah-span="true"
                          role="button"
                          tabIndex={0}
                          onClick={() => openAyahCircularDock({surah, ayah})}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openAyahCircularDock({surah, ayah});
                            }
                          }}
                          className={`inline cursor-pointer rounded-xl px-1 py-0.5 transition-colors ${
                            isAudioActive
                              ? 'bg-[#C9A227] font-bold text-black'
                              : isExplicitSelected || isSearchHit
                              ? 'bg-[#C9A227]/28 text-[#9A7415] ring-1 ring-[#C9A227] dark:text-[#FCE38A]'
                              : 'hover:bg-[#C9A227]/12'
                          }`}
                        >
                          {displayText}{' '}
                          <span
                            className={`font-mono-num mx-0.5 inline-flex h-[1.45em] min-w-[1.45em] items-center justify-center rounded-full border px-1 align-middle text-[0.55em] font-bold leading-none ${
                              isAudioActive
                                ? 'border-black/70 bg-black text-[#FCE38A]'
                                : isExplicitSelected
                                ? 'border-[#C9A227] bg-[#C9A227] text-black'
                                : 'border-[#C9A227]/85 bg-[#C9A227]/15 text-[#9A7415] dark:text-[#FCE38A]'
                            }`}
                          >
                            {toArabicDigits(ayah.n)}
                          </span>{' '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ornamental Mushaf Bottom Folio Plate */}
          <div className="mt-5 flex flex-col items-center gap-1.5 border-t border-[#C9A227]/40 pt-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C9A227]/65 bg-[#C9A227]/10 px-4 py-1 text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]">
              <span>﴿ {toArabicDigits(currentPage)} ﴾</span>
            </div>
            <p className="text-[10px] font-semibold text-[#9A7415] dark:text-[#C9A227]">
              اسحب بإصبعك يمينًا وشمالًا لتقليب الصفحة · اضغط على أي آية للخيارات
            </p>
          </div>
        </div>
      </div>

      {/* 4 SMALL CIRCULAR BUTTONS TRANSLUCENT AYAH DOCK (تغيير الشيخ | استماع | صححلي | تفسير) */}
      {floatingPopup && (
        <div
          data-ayah-popup="true"
          className="fixed inset-x-2 bottom-[72px] z-40 rounded-3xl border-2 border-[#C9A227] bg-black/92 p-3 text-white shadow-[0_12px_36px_rgba(0,0,0,0.88)]"
        >
          <div className="mb-2 flex items-center justify-between border-b border-[#C9A227]/35 pb-1.5">
            <span className="truncate text-xs font-bold text-[#FCE38A]">
              {floatingPopup.surah.name} — الآية{' '}
              {toArabicDigits(floatingPopup.ayah.n)}
            </span>
            <button
              type="button"
              onClick={() => {
                setFloatingPopup(null);
                setPopupSubmenu('none');
              }}
              aria-label="إغلاق"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#C9A227]/50 text-[#F3D56B]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {popupSubmenu === 'sahhahli' && (
            <div className="mb-3 space-y-1.5 rounded-2xl border border-[#C9A227]/60 bg-[#0D0A02] p-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-extrabold text-[#FCE38A]">
                  اختر طريقة الاستماع (صححلي):
                </span>
                <button
                  type="button"
                  onClick={() => setPopupSubmenu('none')}
                  className="text-[10px] font-bold text-zinc-400"
                >
                  رجوع
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const target = floatingPopup;
                    setPopupSubmenu('none');
                    setFloatingPopup(null);
                    playSingleAyahOrSequence(target, false);
                  }}
                  className="min-h-[40px] rounded-xl border border-[#C9A227] bg-black px-2 py-1.5 text-[11px] font-extrabold text-[#FCE38A] active:scale-95"
                >
                  استمع للآية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const startOfPage = pageEntries[0] || floatingPopup;
                    setPopupSubmenu('none');
                    setFloatingPopup(null);
                    playSingleAyahOrSequence(startOfPage, true);
                  }}
                  className="min-h-[40px] rounded-xl border border-[#C9A227] bg-black px-2 py-1.5 text-[11px] font-extrabold text-[#FCE38A] active:scale-95"
                >
                  استمع للصفحة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetSurah = floatingPopup.surah;
                    setPopupSubmenu('none');
                    setFloatingPopup(null);
                    playFullSurahAudio(targetSurah);
                  }}
                  className="min-h-[40px] rounded-xl bg-[#C9A227] px-2 py-1.5 text-[11px] font-extrabold text-black active:scale-95"
                >
                  استمع للسورة كاملة
                </button>
              </div>
            </div>
          )}

          {/* 4 SMALL CIRCULAR ACTION BUTTONS */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {/* 1. تغيير الشيخ */}
            <button
              type="button"
              onClick={() => {
                const target = floatingPopup;
                stopAudio();
                setPopupSubmenu('none');
                setFloatingPopup(null);
                setLongPressTarget(target);
              }}
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#C9A227] bg-[#120E04] text-[#FCE38A]">
                <UserCheck className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold leading-tight text-white">
                تغيير الشيخ
              </span>
              <span className="max-w-[74px] truncate text-[9px] font-semibold text-[#C9A227]">
                {activeSheikh.shortNameAr}
              </span>
            </button>

            {/* 2. استماع */}
            <button
              type="button"
              onClick={() => playSingleAyahOrSequence(floatingPopup, false)}
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#FCE38A] bg-[#C9A227] text-black shadow-[0_0_14px_rgba(201,162,39,0.4)]">
                {isPlaying &&
                playingAyahId === floatingPopup.ayah.id &&
                !correctingAyahBanner ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </span>
              <span className="text-[10px] font-bold leading-tight text-[#FCE38A]">
                استماع
              </span>
              <span className="max-w-[74px] truncate text-[9px] font-semibold text-zinc-300">
                {activeSheikh.shortNameAr}
              </span>
            </button>

            {/* 3. صححلي */}
            <button
              type="button"
              onClick={() =>
                setPopupSubmenu((prev) =>
                  prev === 'sahhahli' ? 'none' : 'sahhahli',
                )
              }
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                  popupSubmenu === 'sahhahli'
                    ? 'border-[#FCE38A] bg-emerald-500 text-black'
                    : 'border-[#C9A227] bg-[#141004] text-emerald-400'
                }`}
              >
                <Mic className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold leading-tight text-[#FCE38A]">
                صححلي
              </span>
            </button>

            {/* 4. تفسير */}
            <button
              type="button"
              onClick={() => {
                const target = floatingPopup;
                setPopupSubmenu('none');
                setFloatingPopup(null);
                setAyahDetailModal({entry: target, tab: 'tafsir'});
              }}
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#C9A227] bg-[#120E04] text-[#FCE38A]">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold leading-tight text-white">
                تفسير
              </span>
            </button>
          </div>
        </div>
      )}

      {/* TAFSIR & WORD MEANINGS MODAL */}
      {ayahDetailModal && (
        <div className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/90">
          <div className="animate-sheet-up flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t-2 border-x-2 border-[#C9A227] bg-[#050505] text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/35 px-4 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-[#FCE38A]">
                  {ayahDetailModal.entry.surah.name} — الآية{' '}
                  {toArabicDigits(ayahDetailModal.entry.ayah.n)}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  التفسير الميسر ومعاني الكلمات · الشيخ{' '}
                  {activeSheikh.shortNameAr}
                </p>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setAyahDetailModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/60 text-[#F3D56B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-2xl border-2 border-[#C9A227] bg-[#0D0A02] p-3.5">
                <p className="font-quran text-center text-xl leading-[2.2] font-bold text-[#FCE38A]">
                  {cleanQuranText(ayahDetailModal.entry.ayah.t)}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      playSingleAyahOrSequence(ayahDetailModal.entry, false)
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3 py-1.5 text-xs font-bold text-black"
                  >
                    {isPlaying &&
                    playingAyahId === ayahDetailModal.entry.ayah.id ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>استمع ({activeSheikh.shortNameAr})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const entry = ayahDetailModal.entry;
                      setAyahDetailModal(null);
                      setLongPressTarget(entry);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C9A227] px-3 py-1.5 text-xs font-bold text-[#F3D56B]"
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    <span>تغيير الشيخ</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#C9A227]/40 p-1">
                <button
                  type="button"
                  onClick={() =>
                    setAyahDetailModal((prev) =>
                      prev ? {...prev, tab: 'tafsir'} : prev,
                    )
                  }
                  className={`min-h-[38px] rounded-xl py-1.5 text-xs font-bold ${
                    ayahDetailModal.tab === 'tafsir'
                      ? 'bg-[#C9A227] text-black'
                      : 'text-zinc-200'
                  }`}
                >
                  التفسير الميسر
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAyahDetailModal((prev) =>
                      prev ? {...prev, tab: 'meanings'} : prev,
                    )
                  }
                  className={`min-h-[38px] rounded-xl py-1.5 text-xs font-bold ${
                    ayahDetailModal.tab === 'meanings'
                      ? 'bg-[#C9A227] text-black'
                      : 'text-zinc-200'
                  }`}
                >
                  معاني الكلمات ({modalWordMeanings.length})
                </button>
              </div>

              {ayahDetailModal.tab === 'tafsir' ? (
                <div className="rounded-2xl border border-[#C9A227]/40 bg-[#0B0B0B] p-4">
                  <p className="text-sm leading-loose text-zinc-100">
                    {modalCleanTafsir}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {modalWordMeanings.length === 0 ? (
                    <div className="rounded-2xl border border-[#C9A227]/35 bg-[#0B0B0B] p-4 text-sm leading-relaxed text-zinc-200">
                      {modalCleanTafsir}
                    </div>
                  ) : (
                    modalWordMeanings.map((wm, idx) => (
                      <div
                        key={`${wm.word}-${idx}`}
                        className="rounded-2xl border border-[#C9A227]/40 bg-[#0B0B0B] p-3"
                      >
                        <p className="font-quran text-lg font-bold text-[#F3D56B]">
                          {wm.word}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-200">
                          {wm.meaning}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SINGLE COMPREHENSIVE "فهرس" DRAWER MODAL */}
      {indexOpen && (
        <div className="fixed inset-0 z-50 flex w-full items-end justify-center bg-black/90">
          <div className="animate-sheet-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t-2 border-x-2 border-[#C9A227] bg-[#050505] text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#C9A227]/35 px-4 py-3.5">
              <h3 className="text-sm font-bold text-[#FCE38A]">
                فهرس المصحف وأدوات القراءة
              </h3>
              <button
                type="button"
                onClick={() => setIndexOpen(false)}
                aria-label="إغلاق"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/60 text-[#F3D56B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Compact Quick Tools Grid Inside the Single Index Sheet */}
            <div className="space-y-2 border-b border-[#C9A227]/25 bg-[#0A0802] px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIndexOpen(false);
                    stopAudio();
                    setTestInitialSurah(pageEntries[0]?.surah.n || 1);
                    setTestInitialAyah(pageEntries[0]?.ayah.n || 1);
                    setTestOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] px-3 py-1.5 text-xs font-extrabold text-black"
                >
                  <Award className="h-4 w-4" />
                  <span>اختبر حفظك</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIndexOpen(false);
                    stopAudio();
                    setTeacherOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3 py-1.5 text-xs font-bold text-[#FCE38A]"
                >
                  <Mic className="h-4 w-4" />
                  <span>وضع المعلم</span>
                </button>
              </div>

              {/* Sheikh, Play Page, Download, Bookmark, Khatma, Font Size */}
              <div className="flex items-center gap-2">
                <select
                  aria-label="اختيار القارئ"
                  value={preferredReciter}
                  onChange={(e) => {
                    stopAudio();
                    onChangePreferredReciter(e.target.value as ReciterId);
                  }}
                  className="min-h-[36px] flex-1 rounded-xl border border-[#C9A227]/55 bg-black px-2.5 text-xs font-bold text-white outline-none"
                >
                  {RECITERS_30.map((r) => (
                    <option key={r.id} value={r.id}>
                      الشيخ {r.nameAr}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={togglePlayPage}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#C9A227] bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span>{isPlaying ? 'إيقاف' : 'تلاوة'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {pageEntries[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeSelectedEntry || pageEntries[0];
                      onToggleBookmark({
                        page: currentPage,
                        surahNumber: target.surah.n,
                        surahName: target.surah.name,
                        ayahNumber: target.ayah.n,
                        snippet: target.ayah.t.slice(0, 80),
                      });
                    }}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold ${
                      isCurrentPageBookmarked
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/50 text-white'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>{isCurrentPageBookmarked ? 'محفوظة' : 'علامة'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={togglePageKhatma}
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold ${
                    isPageCompletedInKhatma
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/50 text-white'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isPageCompletedInKhatma ? 'مقروءة' : 'تحديد مقروءة'}</span>
                </button>

                <div className="flex items-center rounded-xl border border-[#C9A227]/55 bg-black">
                  <button
                    type="button"
                    aria-label="تصغير الخط"
                    onClick={() => onChangeFontSize(Math.max(18, fontSize - 2))}
                    className="flex h-8 w-8 items-center justify-center text-[#C9A227]"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono-num px-1.5 text-xs font-bold">
                    {fontSize}
                  </span>
                  <button
                    type="button"
                    aria-label="تكبير الخط"
                    onClick={() => onChangeFontSize(Math.min(34, fontSize + 2))}
                    className="flex h-8 w-8 items-center justify-center text-[#C9A227]"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-Tabs inside Index Sheet */}
            <div className="grid grid-cols-5 gap-1 border-b border-[#C9A227]/25 px-3 py-2 text-[11px] font-bold">
              {(
                [
                  ['surah', 'السور'],
                  ['juz', 'الأجزاء'],
                  ['search', 'بحث'],
                  ['bookmarks', 'علامات'],
                  ['khatma', 'الختمة'],
                ] as Array<[IndexDrawerTab, string]>
              ).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setDrawerTab(tabKey)}
                  className={`min-h-[34px] rounded-xl px-1 transition-colors ${
                    drawerTab === tabKey
                      ? 'bg-[#C9A227] text-black'
                      : 'text-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {drawerTab === 'surah' && (
                <div className="space-y-3">
                  {/* Direct Page Jump */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const parsed = parseInt(pageInput, 10);
                      if (!Number.isNaN(parsed)) goToPage(parsed);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      placeholder="رقم الصفحة (1-604)"
                      className="font-mono-num w-32 rounded-xl border border-[#C9A227]/60 bg-[#0B0B0B] px-3 py-2 text-xs font-bold text-[#F3D56B] outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[36px] rounded-xl border border-[#C9A227] px-3 py-1.5 text-xs font-bold text-[#FCE38A]"
                    >
                      انتقال للصفحة
                    </button>
                  </form>

                  <input
                    type="text"
                    value={surahFilter}
                    onChange={(e) => setSurahFilter(e.target.value)}
                    placeholder="ابحث باسم السورة أو رقمها..."
                    className="w-full rounded-xl border border-[#C9A227]/60 bg-[#0B0B0B] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#C9A227]"
                  />

                  <div className="space-y-1.5">
                    {filteredSurahs.map((s) => {
                      const startPage =
                        s.ayahs[0]?.p || surahStartPages.get(s.n) || 1;
                      return (
                        <button
                          key={s.n}
                          type="button"
                          onClick={() => goToSurahById(s.n)}
                          className="flex min-h-[50px] w-full items-center justify-between rounded-2xl border border-[#C9A227]/30 bg-[#0A0904] px-3 py-2 text-right hover:border-[#C9A227]"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono-num flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/60 text-xs font-bold text-[#C9A227]">
                              {s.n}
                            </span>
                            <div>
                              <p className="font-quran text-base font-bold text-white">
                                {s.name}
                              </p>
                              <p className="text-[11px] text-zinc-400">
                                {s.type === 'Meccan' ? 'مكية' : 'مدنية'} ·{' '}
                                {s.ayahs.length} آية
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[#C9A227]">
                            ص {startPage}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {drawerTab === 'juz' && (
                <div className="grid grid-cols-3 gap-2">
                  {JUZ_START_PAGES.map((page, idx) => (
                    <button
                      key={idx + 1}
                      type="button"
                      onClick={() => goToPage(page)}
                      className="flex flex-col items-center justify-center rounded-2xl border border-[#C9A227]/50 bg-[#0A0904] p-3 text-center hover:bg-[#C9A227]/15"
                    >
                      <span className="text-xs font-bold text-white">
                        الجزء {toArabicDigits(idx + 1)}
                      </span>
                      <span className="mt-1 text-[11px] text-[#C9A227]">
                        ص {toArabicDigits(page)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {drawerTab === 'search' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="اكتب كلمة قرآنية أو رقم الآية (مثل 255)..."
                      autoFocus
                      className="w-full rounded-xl border border-[#C9A227]/60 bg-[#0B0B0B] py-2.5 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
                    />
                  </div>
                  {searchResults.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-400">
                      أدخل كلمة قرآنية أو رقم آية لعرض النتائج
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map(({surah, ayah}) => (
                        <button
                          key={ayah.id}
                          type="button"
                          onClick={() => {
                            setSelectedAyah({surah, ayah});
                            goToPage(ayah.p, ayah.id);
                          }}
                          className="w-full rounded-2xl border border-[#C9A227]/30 bg-[#0A0904] p-3 text-right hover:border-[#C9A227]"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#C9A227]">
                            <span>
                              {surah.name} — آية {toArabicDigits(ayah.n)}
                            </span>
                            <span>صفحة {toArabicDigits(ayah.p)}</span>
                          </div>
                          <p className="font-quran mt-1 text-base leading-loose text-white">
                            {ayah.t}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'bookmarks' && (
                <div className="space-y-2">
                  {bookmarks.length === 0 ? (
                    <p className="py-8 text-center text-xs text-zinc-400">
                      لا توجد علامات مرجعية محفوظة بعد.
                    </p>
                  ) : (
                    bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/30 bg-[#0A0904] p-3"
                      >
                        <button
                          type="button"
                          onClick={() => goToPage(bm.page)}
                          className="min-w-0 flex-1 text-right"
                        >
                          <p className="text-xs font-bold text-[#FCE38A]">
                            {bm.surahName} — آية {toArabicDigits(bm.ayahNumber)} — ص{' '}
                            {toArabicDigits(bm.page)}
                          </p>
                          <p className="font-quran mt-1 truncate text-sm text-zinc-300">
                            {bm.snippet}...
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveBookmark(bm.id)}
                          aria-label="حذف العلامة"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {drawerTab === 'khatma' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#C9A227] bg-[#0D0A02] p-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#C9A227]">تقدم الختمة</span>
                      <span className="font-mono-num text-[#FCE38A]">
                        {khatma.completedPages.length} / 604
                      </span>
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-[#C9A227]"
                        style={{
                          width: `${Math.round(
                            (khatma.completedPages.length / 604) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-300">
                      الورد اليومي: {Math.ceil(604 / khatma.targetDays)} صفحة
                      يوميًا
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() =>
                          onUpdateKhatma((prev) => ({...prev, targetDays: days}))
                        }
                        className={`min-h-[38px] rounded-xl border text-xs font-bold ${
                          khatma.targetDays === days
                            ? 'border-[#C9A227] bg-[#C9A227] text-black'
                            : 'border-[#C9A227]/40 text-white'
                        }`}
                      >
                        {days} يومًا
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      let nextUnread = 1;
                      for (let p = 1; p <= 604; p++) {
                        if (!khatma.completedPages.includes(p)) {
                          nextUnread = p;
                          break;
                        }
                      }
                      goToPage(nextUnread);
                    }}
                    className="min-h-[42px] w-full rounded-xl bg-[#C9A227] text-xs font-bold text-black"
                  >
                    الانتقال لأول صفحة غير مقروءة
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Teacher Mode Modal */}
      {teacherOpen && pageEntries.length > 0 && (
        <QuranTeacherModal
          entries={pageEntries}
          initialIndex={
            selectedAyah
              ? Math.max(
                  0,
                  pageEntries.findIndex(
                    (e) => e.ayah.id === selectedAyah.ayah.id,
                  ),
                )
              : 0
          }
          preferredReciter={preferredReciter}
          onClose={() => setTeacherOpen(false)}
        />
      )}

      {/* Memorization Test Modal */}
      {testOpen && pageEntries.length > 0 && (
        <QuranTestModal
          entries={pageEntries}
          allSurahs={surahs}
          initialSurahNumber={testInitialSurah}
          initialAyahNumber={testInitialAyah}
          currentPage={currentPage}
          lastRead={lastRead}
          onUpdateLastRead={onUpdateLastRead}
          history={testHistory}
          preferredReciter={preferredReciter}
          onSaveResult={onSaveTestResult}
          onClose={() => setTestOpen(false)}
        />
      )}

      {/* 30-Sheikh Ayah Repeater & Switcher Sheet */}
      {longPressTarget && (
        <AyahReciterSheet
          surah={longPressTarget.surah}
          ayah={longPressTarget.ayah}
          preferredReciter={preferredReciter}
          onSelectReciter={(id) => {
            stopAudio();
            onChangePreferredReciter(id);
          }}
          onClose={() => setLongPressTarget(null)}
        />
      )}
    </div>
  );
};
