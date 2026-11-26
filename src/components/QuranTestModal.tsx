import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowRight,
  Award,
  Check,
  Clock,
  List,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import {LastReadPosition} from '../App';
import {getAyahAudioUrl, getReciterById, RECITERS_30} from '../data/reciters';
import {
  CompactAyah,
  CompactSurah,
  MemorizationTestResult,
  ReciterId,
} from '../types';
import {useHardwareBack} from '../utils/backNavigation';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {resolveOfflinePlayableUrl} from '../utils/offlineAudioCache';
import {
  compareArabicWords,
  tokenizeArabicAyah,
} from '../utils/recitationMatcher';
import {
  playSheikhSingleWord,
  stopSheikhWordPlayback,
} from '../utils/sheikhWordAudio';

interface AyahEntry {
  surah: CompactSurah;
  ayah: CompactAyah;
}

interface QuranTestModalProps {
  entries: AyahEntry[];
  allSurahs?: CompactSurah[] | null;
  initialSurahNumber?: number;
  initialAyahNumber?: number;
  currentPage: number;
  lastRead?: LastReadPosition;
  onUpdateLastRead?: (
    surahNumber: number,
    ayahNumber: number,
    page: number,
  ) => void;
  history: MemorizationTestResult[];
  preferredReciter?: ReciterId;
  onSaveResult: (res: MemorizationTestResult, ayahNumber?: number) => void;
  onClose: () => void;
}

interface MistakeLog {
  ayahNumber: number;
  expectedWord: string;
  spokenWord: string;
  hint: string | null;
}

interface HaltedMistakeState {
  ayahIdx: number;
  wordIdx: number;
  key: string;
  ayahEntry: AyahEntry;
  expectedWord: string;
  spokenWord: string;
  hint: string | null;
}

interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{isFinal: boolean; 0: {transcript: string}}>;
      }) => void)
    | null;
  onerror: ((e: {error: string}) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function normSearch(t: string): string {
  return t
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function formatTimerMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stripLeadingBasmalah(rawText: string): string {
  const cleaned = rawText.replace(/[\uFEFF\u200B-\u200D]/g, '').trim();
  const parts = cleaned.split(/\s+/);
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
      return parts.slice(4).join(' ').trim();
    }
  }
  return cleaned;
}

function toArabicDigits(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

export const QuranTestModal: React.FC<QuranTestModalProps> = ({
  entries,
  allSurahs,
  initialSurahNumber = 1,
  initialAyahNumber = 1,
  currentPage,
  lastRead,
  onUpdateLastRead,
  history,
  preferredReciter = 'alafasy',
  onSaveResult,
  onClose,
}) => {
  const isOnline = useOnlineStatus();
  // Use initialSurahNumber when explicitly opened from a Surah (> 1), otherwise restore saved position
  const [selectedSurahNum, setSelectedSurahNum] = useState<number>(() => {
    if (initialSurahNumber && initialSurahNumber > 1) {
      return initialSurahNumber;
    }
    try {
      const saved = window.localStorage.getItem('alzahabi_last_test_position');
      if (saved) {
        const parsed = JSON.parse(saved) as {surah?: number};
        if (parsed.surah && parsed.surah >= 1 && parsed.surah <= 114) {
          return parsed.surah;
        }
      }
    } catch {
      // ignore
    }
    return lastRead?.surahNumber || initialSurahNumber || 1;
  });

  const [startAyahNum, setStartAyahNum] = useState<number>(() => {
    if (initialSurahNumber && initialSurahNumber > 1) {
      return initialAyahNumber || 1;
    }
    try {
      const saved = window.localStorage.getItem('alzahabi_last_test_position');
      if (saved) {
        const parsed = JSON.parse(saved) as {ayah?: number};
        if (parsed.ayah && parsed.ayah >= 1) {
          return parsed.ayah;
        }
      }
    } catch {
      // ignore
    }
    return lastRead?.ayahNumber || initialAyahNumber || 1;
  });

  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [surahSearchInput, setSurahSearchInput] = useState('');
  const [ayahSearchInput, setAyahSearchInput] = useState('');

  // Real Sheikh audio state (NO speechSynthesis)
  const [correctionSheikh, setCorrectionSheikh] = useState<ReciterId>(() => {
    try {
      const saved = window.localStorage.getItem('alzahabi_test_sheikh') as ReciterId | null;
      if (saved && RECITERS_30.some((r) => r.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return preferredReciter || 'husary';
  });
  const [sheikhModalOpen, setSheikhModalOpen] = useState(false);
  const [isPlayingCorrection, setIsPlayingCorrection] = useState(false);
  const [correctingNotice, setCorrectingNotice] = useState<string | null>(null);
  const [correctionDetail, setCorrectionDetail] = useState<{
    ayahNumber: number;
    expectedWord: string;
    spokenWord?: string;
    hint?: string | null;
    sheikhNameAr: string;
  } | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ignoreMicAudioRef = useRef(false);

  const selectCorrectionSheikh = useCallback((id: ReciterId) => {
    setCorrectionSheikh(id);
    try {
      window.localStorage.setItem('alzahabi_test_sheikh', id);
    } catch {
      // ignore
    }
  }, []);

  // Load ALL remaining ayahs of the selected Surah so user can keep reading without cutoff
  const activeEntries = useMemo<AyahEntry[]>(() => {
    if (allSurahs && allSurahs.length > 0) {
      const targetSurah =
        allSurahs.find((s) => s.n === selectedSurahNum) || allSurahs[0];
      const clampedStart = Math.max(
        1,
        Math.min(targetSurah.ayahs.length, startAyahNum),
      );
      const startIndex = targetSurah.ayahs.findIndex(
        (a) => a.n === clampedStart,
      );
      const idx = startIndex >= 0 ? startIndex : 0;
      return targetSurah.ayahs.slice(idx).map((ayah) => ({
        surah: targetSurah,
        ayah,
      }));
    }
    return entries;
  }, [allSurahs, selectedSurahNum, startAyahNum, entries]);

  const currentSurahObj = useMemo(() => {
    if (allSurahs && allSurahs.length > 0) {
      return allSurahs.find((s) => s.n === selectedSurahNum) || allSurahs[0];
    }
    return entries[0]?.surah;
  }, [allSurahs, selectedSurahNum, entries]);

  // Save last test position cleanly
  useEffect(() => {
    try {
      window.localStorage.setItem(
        'alzahabi_last_test_position',
        JSON.stringify({surah: selectedSurahNum, ayah: startAyahNum}),
      );
    } catch {
      // ignore
    }
    const targetPage = activeEntries[0]?.ayah.p || currentPage;
    onUpdateLastRead?.(selectedSurahNum, startAyahNum, targetPage);
  }, [selectedSurahNum, startAyahNum, activeEntries, currentPage, onUpdateLastRead]);

  const filteredSurahsList = useMemo(() => {
    if (!allSurahs) return [];
    const q = normSearch(surahSearchInput);
    if (!q) return allSurahs;
    return allSurahs.filter(
      (s) =>
        normSearch(s.name).includes(q) ||
        String(s.n) === surahSearchInput.trim(),
    );
  }, [allSurahs, surahSearchInput]);

  const ayahSearchResults = useMemo(() => {
    if (!allSurahs) return [];
    const raw = ayahSearchInput.trim();
    if (!raw) return [];

    const num = parseInt(raw, 10);
    if (!Number.isNaN(num) && String(num) === raw) {
      const hits: AyahEntry[] = [];
      for (const s of allSurahs) {
        const found = s.ayahs.find((a) => a.n === num);
        if (found) {
          hits.push({surah: s, ayah: found});
          if (hits.length >= 40) break;
        }
      }
      return hits;
    }

    const q = normSearch(raw);
    if (q.length < 2) return [];
    const hits: AyahEntry[] = [];
    for (const s of allSurahs) {
      const surahMatch = normSearch(s.name).includes(q);
      for (const a of s.ayahs) {
        if (surahMatch || normSearch(a.t).includes(q)) {
          hits.push({surah: s, ayah: a});
          if (hits.length >= 45) return hits;
        }
      }
    }
    return hits;
  }, [allSurahs, ayahSearchInput]);

  const preparedAyahs = useMemo(() => {
    return activeEntries.map((entry) => {
      let text = entry.ayah.t.replace(/[\uFEFF\u200B-\u200D]/g, '').trim();
      if (
        entry.ayah.n === 1 &&
        entry.surah.n !== 1 &&
        entry.surah.n !== 9
      ) {
        text = stripLeadingBasmalah(text);
      }
      const tokens = tokenizeArabicAyah(text);
      return {
        ...entry,
        tokens,
      };
    });
  }, [activeEntries]);

  const [tasmeeStarted, setTasmeeStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ayahIdx, setAyahIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [revealedMap, setRevealedMap] = useState<
    Record<string, 'correct' | 'hint' | 'wrong'>
  >({});
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);
  const [latestMistake, setLatestMistake] = useState<MistakeLog | null>(null);
  const [haltedMistake, setHaltedMistake] =
    useState<HaltedMistakeState | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [finishedScore, setFinishedScore] = useState<number | null>(null);
  const [completedAllSurah, setCompletedAllSurah] = useState(false);

  const [answerInput, setAnswerInput] = useState('');
  const [showTypingBar, setShowTypingBar] = useState(false);
  const [listening, setListening] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<
    'idle' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  useHardwareBack(true, onClose);
  useHardwareBack(indexModalOpen, () => setIndexModalOpen(false));
  useHardwareBack(searchModalOpen, () => setSearchModalOpen(false));
  useHardwareBack(sheikhModalOpen, () => setSheikhModalOpen(false));

  const recRef = useRef<SpeechRecLike | null>(null);
  const listeningRef = useRef(false);
  const pausedByUserRef = useRef(false);
  const shouldKeepListeningRef = useRef(false);
  const processedPerResultRef = useRef<Record<number, number>>({});
  const wordsBoxScrollRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    ayahIdx: 0,
    wordIdx: 0,
    revealedMap: {} as Record<string, 'correct' | 'hint' | 'wrong'>,
    mistakes: [] as MistakeLog[],
    latestMistake: null as MistakeLog | null,
    haltedMistake: null as HaltedMistakeState | null,
    hintsUsed: 0,
    finishedScore: null as number | null,
    isPaused: false,
  });

  stateRef.current = {
    ayahIdx,
    wordIdx,
    revealedMap,
    mistakes,
    latestMistake,
    haltedMistake,
    hintsUsed,
    finishedScore,
    isPaused,
  };

  const currentAyah = preparedAyahs[ayahIdx] || preparedAyahs[0];
  const revealedCount = Object.keys(revealedMap).length;
  const correctWordsCount = useMemo(
    () => Object.values(revealedMap).filter((v) => v === 'correct').length,
    [revealedMap],
  );

  // Group revealed words by Ayah so they render in continuous Medinan Mushaf flow (side-by-side + golden circle badge)
  const revealedAyahGroups = useMemo(() => {
    const groups: Array<{
      ayahIdx: number;
      ayahEntry: (typeof preparedAyahs)[number];
      words: Array<{
        key: string;
        wordIdx: number;
        raw: string;
        status: 'correct' | 'hint' | 'wrong';
      }>;
      isAyahComplete: boolean;
    }> = [];

    for (let a = 0; a <= Math.min(ayahIdx, preparedAyahs.length - 1); a++) {
      const entry = preparedAyahs[a];
      if (!entry) continue;
      const words: Array<{
        key: string;
        wordIdx: number;
        raw: string;
        status: 'correct' | 'hint' | 'wrong';
      }> = [];
      let allCorrect = entry.tokens.length > 0;
      for (let w = 0; w < entry.tokens.length; w++) {
        const key = `${a}-${w}`;
        const st = revealedMap[key];
        if (!st) {
          allCorrect = false;
          continue;
        }
        if (st === 'wrong') {
          allCorrect = false;
        }
        words.push({
          key,
          wordIdx: w,
          raw: entry.tokens[w].raw,
          status: st,
        });
      }
      if (words.length > 0) {
        const hasActiveHaltHere = haltedMistake?.ayahIdx === a;
        const reachedEndOfAyah =
          words.length === entry.tokens.length && !hasActiveHaltHere;
        groups.push({
          ayahIdx: a,
          ayahEntry: entry,
          words,
          isAyahComplete: reachedEndOfAyah || (a < ayahIdx && allCorrect),
        });
      }
    }
    return groups;
  }, [ayahIdx, preparedAyahs, revealedMap, haltedMistake]);

  // Keep newest word visible inside fixed Mushaf box without moving the screen
  useEffect(() => {
    const el = wordsBoxScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [revealedCount, haltedMistake]);

  const releaseMic = useCallback(() => {
    shouldKeepListeningRef.current = false;
    listeningRef.current = false;
    ignoreMicAudioRef.current = false;
    setListening(false);
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!tasmeeStarted || isPaused || finishedScore !== null) return;
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [tasmeeStarted, isPaused, finishedScore]);

  useEffect(() => {
    pausedByUserRef.current = false;
    releaseMic();
    setTasmeeStarted(false);
    setIsPaused(false);
    setAyahIdx(0);
    setWordIdx(0);
    setRevealedMap({});
    setMistakes([]);
    setLatestMistake(null);
    setHaltedMistake(null);
    setHintsUsed(0);
    setFinishedScore(null);
    setCompletedAllSurah(false);
    setElapsedSec(0);
    setLiveTranscript('');
    setCorrectionDetail(null);
    setCorrectingNotice(null);
  }, [selectedSurahNum, startAyahNum, releaseMic]);

  useEffect(() => {
    return () => {
      releaseMic();
      stopSheikhWordPlayback();
      audioRef.current?.pause();
    };
  }, [releaseMic]);

  // Only ends when the user explicitly clicks "انهاء الاختبار"
  const finishTest = useCallback(
    (
      finalMistakes: MistakeLog[],
      finalHints: number,
      finalMap: Record<string, 'correct' | 'hint' | 'wrong'>,
    ) => {
      pausedByUserRef.current = true;
      setIsPaused(false);
      releaseMic();

      const entriesCount = Object.keys(finalMap).length;
      const correctCount = Object.values(finalMap).filter(
        (v) => v === 'correct',
      ).length;
      const denominator = Math.max(1, entriesCount);
      const rawScore =
        entriesCount === 0
          ? 0
          : Math.round(
              ((correctCount - finalHints * 0.5) / denominator) * 100,
            );
      const score = Math.max(0, Math.min(100, rawScore));
      setFinishedScore(score);

      const firstSurah = preparedAyahs[0]?.surah;
      const resolvedPage = preparedAyahs[0]?.ayah.p || currentPage;
      if (firstSurah) {
        onSaveResult(
          {
            id: `res_${Date.now()}`,
            surahNumber: firstSurah.n,
            surahName: firstSurah.name,
            page: resolvedPage,
            score,
            totalWords: entriesCount,
            mistakesCount: finalMistakes.length,
            hintsUsed: finalHints,
            date: new Date().toLocaleDateString('ar-EG'),
          },
          preparedAyahs[0]?.ayah.n || 1,
        );
      }
    },
    [currentPage, onSaveResult, preparedAyahs, releaseMic],
  );

  // Word-by-word continuous matcher: marks mistakes red & keeps continuing seamlessly without stopping
  const processWords = useCallback(
    (spokenTokens: string[]) => {
      const snap = stateRef.current;
      if (
        preparedAyahs.length === 0 ||
        snap.finishedScore !== null ||
        snap.isPaused ||
        ignoreMicAudioRef.current
      ) {
        return;
      }

      let aIdx = snap.ayahIdx;
      let wIdx = snap.wordIdx;
      const nextMap = {...snap.revealedMap};
      const nextMistakes = [...snap.mistakes];
      let lastErr: MistakeLog | null = snap.latestMistake;
      let finishedAll = false;

      const advanceCursor = () => {
        wIdx++;
        while (
          aIdx < preparedAyahs.length &&
          wIdx >= preparedAyahs[aIdx].tokens.length
        ) {
          aIdx++;
          wIdx = 0;
        }
      };

      for (let tIdx = 0; tIdx < spokenTokens.length; tIdx++) {
        const spoken = spokenTokens[tIdx];
        while (
          aIdx < preparedAyahs.length &&
          wIdx >= preparedAyahs[aIdx].tokens.length
        ) {
          aIdx++;
          wIdx = 0;
        }
        if (aIdx >= preparedAyahs.length) {
          finishedAll = true;
          break;
        }

        const targetAyah = preparedAyahs[aIdx];
        const expected = targetAyah.tokens[wIdx];
        const check = compareArabicWords(
          spoken,
          expected.norm,
          expected.hamzaNorm,
          expected.altVariants,
        );
        const key = `${aIdx}-${wIdx}`;

        if (check.isMatch) {
          nextMap[key] = 'correct';
          lastErr = null;
          advanceCursor();
        } else {
          // Check up to 2 words ahead so if the reader skipped a word, we mark skipped word red and stay in sync
          let lookaheadMatched = false;
          let probeA = aIdx;
          let probeW = wIdx;
          const skippedCoords: Array<{a: number; w: number}> = [];

          for (let step = 1; step <= 2; step++) {
            probeW++;
            while (
              probeA < preparedAyahs.length &&
              probeW >= preparedAyahs[probeA].tokens.length
            ) {
              probeA++;
              probeW = 0;
            }
            if (probeA >= preparedAyahs.length) break;

            const prevA = step === 1 ? aIdx : skippedCoords[step - 2]?.a ?? aIdx;
            const prevW = step === 1 ? wIdx : skippedCoords[step - 2]?.w ?? wIdx;
            skippedCoords.push({a: prevA, w: prevW});

            const aheadToken = preparedAyahs[probeA].tokens[probeW];
            const aheadCheck = compareArabicWords(
              spoken,
              aheadToken.norm,
              aheadToken.hamzaNorm,
              aheadToken.altVariants,
            );
            if (aheadCheck.isMatch) {
              for (const sc of skippedCoords) {
                const sAyah = preparedAyahs[sc.a];
                const sTok = sAyah?.tokens[sc.w];
                const sKey = `${sc.a}-${sc.w}`;
                if (sAyah && sTok && !nextMap[sKey]) {
                  nextMap[sKey] = 'wrong';
                  nextMistakes.push({
                    ayahNumber: sAyah.ayah.n,
                    expectedWord: sTok.raw,
                    spokenWord: '—',
                    hint: 'سقطت الكلمة أثناء القراءة',
                  });
                }
              }
              nextMap[`${probeA}-${probeW}`] = 'correct';
              aIdx = probeA;
              wIdx = probeW;
              advanceCursor();
              lastErr = null;
              lookaheadMatched = true;
              break;
            }
          }

          if (!lookaheadMatched) {
            // Mark word red and KEEP GOING so the reader continues uninterrupted
            nextMap[key] = 'wrong';
            const errItem: MistakeLog = {
              ayahNumber: targetAyah.ayah.n,
              expectedWord: expected.raw,
              spokenWord: spoken,
              hint: check.wrongLetterHint,
            };
            nextMistakes.push(errItem);
            lastErr = errItem;
            advanceCursor();
          }
        }
      }

      if (aIdx >= preparedAyahs.length) {
        finishedAll = true;
      }

      setRevealedMap(nextMap);
      setMistakes(nextMistakes);
      setLatestMistake(lastErr);
      setHaltedMistake(null);
      if (!lastErr) {
        setCorrectionDetail(null);
      }
      setAyahIdx(Math.min(aIdx, Math.max(0, preparedAyahs.length - 1)));
      setWordIdx(wIdx);
      if (finishedAll) {
        setCompletedAllSurah(true);
      }
    },
    [preparedAyahs],
  );

  const startContinuousRecognition = useCallback(() => {
    setMicError(null);
    pausedByUserRef.current = false;
    shouldKeepListeningRef.current = true;

    const SpeechRec =
      (window as unknown as {SpeechRecognition?: new () => SpeechRecLike})
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecLike;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicPermissionState('unsupported');
      setShowTypingBar(true);
      return;
    }

    if (listeningRef.current && recRef.current) {
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onaudiostart = () => {
      setMicPermissionState('granted');
    };

    rec.onresult = (e) => {
      setMicPermissionState('granted');
      let fullTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        const segment = e.results[i];
        const segText = segment[0]?.transcript || '';
        if (segText) {
          fullTranscript += (fullTranscript ? ' ' : '') + segText;
        }
        if (i < e.resultIndex) continue;

        const tokens = segText.trim().split(/\s+/).filter(Boolean);
        const already = processedPerResultRef.current[i] || 0;

        if (ignoreMicAudioRef.current || pausedByUserRef.current) {
          processedPerResultRef.current[i] = tokens.length;
          continue;
        }

        if (segment.isFinal) {
          if (tokens.length > already) {
            processWords(tokens.slice(already));
            processedPerResultRef.current[i] = tokens.length;
          }
        } else if (tokens.length > already) {
          if (tokens.length - 1 > already) {
            processWords(tokens.slice(already, tokens.length - 1));
            processedPerResultRef.current[i] = tokens.length - 1;
          }
          const snap = stateRef.current;
          const currentAlready = processedPerResultRef.current[i] || 0;
          if (
            tokens.length > currentAlready &&
            snap.finishedScore === null &&
            !snap.isPaused
          ) {
            const targetAyah = preparedAyahs[snap.ayahIdx];
            const expected = targetAyah?.tokens[snap.wordIdx];
            const trailingToken = tokens[tokens.length - 1];
            if (expected && trailingToken) {
              const check = compareArabicWords(
                trailingToken,
                expected.norm,
                expected.hamzaNorm,
                expected.altVariants,
              );
              if (check.isMatch) {
                processWords([trailingToken]);
                processedPerResultRef.current[i] = tokens.length;
              }
            }
          }
        }
      }
      setLiveTranscript(fullTranscript.trim());
    };

    rec.onerror = (err) => {
      if (err.error === 'no-speech' || err.error === 'aborted') {
        return;
      }
      if (
        err.error === 'network' ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      ) {
        shouldKeepListeningRef.current = false;
        setShowTypingBar(true);
        setMicError(
          'يرجى الاتصال بالإنترنت للتعرف التلقائي على الصوت، أو اكتب الآية أدناه للتصحيح.',
        );
        listeningRef.current = false;
        setListening(false);
      } else if (
        err.error === 'not-allowed' ||
        err.error === 'service-not-allowed'
      ) {
        shouldKeepListeningRef.current = false;
        setMicPermissionState('denied');
        setShowTypingBar(true);
        setMicError('يرجى السماح بالميكروفون أو الكتابة أدناه للتصحيح.');
        listeningRef.current = false;
        setListening(false);
      } else if (err.error === 'audio-capture') {
        setMicError('تأكد من اتصال الميكروفون ثم اضغط مرة أخرى.');
      }
    };

    // Keep continuous mic open even after pauses unless user clicked Stop
    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
      if (
        shouldKeepListeningRef.current &&
        !pausedByUserRef.current &&
        stateRef.current.finishedScore === null
      ) {
        window.setTimeout(() => {
          if (
            shouldKeepListeningRef.current &&
            !pausedByUserRef.current &&
            stateRef.current.finishedScore === null &&
            !listeningRef.current
          ) {
            try {
              processedPerResultRef.current = {};
              listeningRef.current = true;
              setListening(true);
              rec.start();
            } catch {
              listeningRef.current = false;
              setListening(false);
            }
          }
        }, 120);
      }
    };

    try {
      processedPerResultRef.current = {};
      recRef.current = rec;
      listeningRef.current = true;
      setListening(true);
      setMicPermissionState('granted');
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setShowTypingBar(true);
    }
  }, [preparedAyahs, processWords]);

  // Silent start: open continuous mic immediately
  const handleStartSilently = useCallback(() => {
    setMicError(null);
    setAudioErr(null);
    setIsPaused(false);
    pausedByUserRef.current = false;
    setTasmeeStarted(true);
    startContinuousRecognition();
  }, [startContinuousRecognition]);

  const handleTogglePauseResume = useCallback(() => {
    if (!stateRef.current.isPaused) {
      // Switch to Stop / Paused
      pausedByUserRef.current = true;
      shouldKeepListeningRef.current = false;
      setIsPaused(true);
      releaseMic();
    } else {
      // Stop any correction audio and resume from exact paused position
      stopSheikhWordPlayback();
      audioRef.current?.pause();
      ignoreMicAudioRef.current = false;
      setIsPlayingCorrection(false);
      setCorrectingNotice(null);
      pausedByUserRef.current = false;
      setIsPaused(false);
      startContinuousRecognition();
    }
  }, [releaseMic, startContinuousRecognition]);

  // Tap red word or "الشيخ يصححلي" -> Plays real Sheikh MP3 without closing/restarting mic (NO mic beep!)
  const playCorrectionAyah = (
    reciterId: ReciterId,
    ayahOverride?: AyahEntry,
    wordToExplain?: string,
    hintToExplain?: string | null,
    spokenWord?: string,
  ) => {
    const target = ayahOverride || currentAyah || preparedAyahs[0];
    if (!target) return;
    setAudioErr(null);
    selectCorrectionSheikh(reciterId);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    if (
      isPlayingCorrection &&
      reciterId === correctionSheikh &&
      !ayahOverride &&
      !wordToExplain
    ) {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = 1;
      ignoreMicAudioRef.current = false;
      setIsPlayingCorrection(false);
      setCorrectingNotice(null);
      return;
    }

    stopSheikhWordPlayback();
    // Mute transcript processing while Sheikh recites instead of stopping/restarting mic (prevents beep!)
    ignoreMicAudioRef.current = true;

    const activeObj = getReciterById(reciterId);
    setCorrectingNotice(
      wordToExplain
        ? `الشيخ ${activeObj.shortNameAr} ينطق: «${wordToExplain}»`
        : `تلاوة الآية ${toArabicDigits(target.ayah.n)} بصوت الشيخ ${activeObj.shortNameAr}`,
    );

    if (wordToExplain) {
      setCorrectionDetail({
        ayahNumber: target.ayah.n,
        expectedWord: wordToExplain,
        spokenWord,
        hint:
          hintToExplain ||
          'انتبه لمخارج الحروف والهمزة والمد وحركات التشكيل كما يقرأها الشيخ.',
        sheikhNameAr: activeObj.shortNameAr,
      });
    }

    const releaseMute = () => {
      audio.playbackRate = 1;
      ignoreMicAudioRef.current = false;
      setIsPlayingCorrection(false);
      setCorrectingNotice(null);
    };

    const rawUrl = getAyahAudioUrl(reciterId, target.surah.n, target.ayah.n);
    setIsPlayingCorrection(true);
    void resolveOfflinePlayableUrl(rawUrl).then((playableUrl) => {
      audio.src = playableUrl;
      audio.playbackRate = wordToExplain ? 0.88 : 1;
      audio.onended = releaseMute;
      audio.onerror = () => {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        setAudioErr(
          offline
            ? wordToExplain
              ? `يرجى الاتصال بالإنترنت لسماع صوت الشيخ — الصح هو: «${wordToExplain}»`
              : 'يرجى الاتصال بالإنترنت لسماع التلاوة (أو حمّل قسم اختبار الحفظ للعمل بدون نت)'
            : wordToExplain
              ? `الصح هو: «${wordToExplain}» — تعذر تشغيل الصوت، تأكد من التحميل أو الاتصال`
              : 'تعذر تشغيل التلاوة حاليًا — تحقق من التحميل أو اختر شيخًا آخر',
        );
        releaseMute();
      };
      audio.play().catch(() => {
        setAudioErr(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'يرجى الاتصال بالإنترنت لسماع صوت الشيخ'
            : 'تعذر تشغيل الصوت حاليًا',
        );
        releaseMute();
      });
    });
  };

  // Pronounces ONLY the specific wrong word in the Sheikh's real voice
  const playSingleCorrectWord = (
    ayahEntry: AyahEntry & {tokens: Array<{raw: string}>},
    targetWordIdx: number,
    expectedWord: string,
    hint?: string | null,
    spokenWord?: string,
  ) => {
    setAudioErr(null);
    audioRef.current?.pause();
    ignoreMicAudioRef.current = true;
    const activeObj = getReciterById(correctionSheikh);
    setIsPlayingCorrection(true);
    setCorrectingNotice(
      `الشيخ ${activeObj.shortNameAr} ينطق الكلمة الصح: «${expectedWord}»`,
    );
    setCorrectionDetail({
      ayahNumber: ayahEntry.ayah.n,
      expectedWord,
      spokenWord,
      hint:
        hint ||
        'استمع لنطق الكلمة فقط بصوت الشيخ ثم كررها أو اضغط «تكملة».',
      sheikhNameAr: activeObj.shortNameAr,
    });

    const releaseWordMute = () => {
      ignoreMicAudioRef.current = false;
      setIsPlayingCorrection(false);
      setCorrectingNotice(null);
    };

    void playSheikhSingleWord({
      reciterId: correctionSheikh,
      surahNumber: ayahEntry.surah.n,
      ayahNumber: ayahEntry.ayah.n,
      ayahTokens: ayahEntry.tokens.map((t) => t.raw),
      targetWordIdx,
      onEnd: releaseWordMute,
      onError: () => {
        setAudioErr(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? `يرجى الاتصال بالإنترنت لنطق الكلمة — الكلمة الصح: «${expectedWord}»`
            : `تعذر نطق الكلمة الآن — الكلمة الصح: «${expectedWord}»`,
        );
        releaseWordMute();
      },
    });
  };

  const handleSheikhCorrectMe = () => {
    const targetMistake =
      haltedMistake ||
      latestMistake ||
      (mistakes.length > 0 ? mistakes[mistakes.length - 1] : null);
    if (targetMistake) {
      const targetEntry =
        preparedAyahs.find(
          (a) =>
            a.ayah.n ===
            ('ayahEntry' in targetMistake
              ? targetMistake.ayahEntry.ayah.n
              : targetMistake.ayahNumber),
        ) ||
        currentAyah ||
        preparedAyahs[0];
      if (targetEntry) {
        if ('wordIdx' in targetMistake) {
          playSingleCorrectWord(
            targetEntry,
            targetMistake.wordIdx,
            targetMistake.expectedWord,
            targetMistake.hint,
            targetMistake.spokenWord,
          );
        } else {
          playCorrectionAyah(
            correctionSheikh,
            targetEntry,
            targetMistake.expectedWord,
            targetMistake.hint,
            targetMistake.spokenWord,
          );
        }
        return;
      }
    }

    const fallbackEntry = currentAyah || preparedAyahs[0];
    if (!fallbackEntry) return;
    const expectedToken =
      fallbackEntry.tokens[wordIdx] || fallbackEntry.tokens[0];
    playCorrectionAyah(
      correctionSheikh,
      fallbackEntry,
      expectedToken?.raw,
      'ردد مع الشيخ بتأنٍّ مع مراعاة أحكام التجويد والهمزات والمدود.',
    );
  };

  const resetTest = () => {
    pausedByUserRef.current = false;
    releaseMic();
    stopSheikhWordPlayback();
    audioRef.current?.pause();
    setIsPlayingCorrection(false);
    setCorrectingNotice(null);
    setCorrectionDetail(null);
    setTasmeeStarted(false);
    setIsPaused(false);
    setAyahIdx(0);
    setWordIdx(0);
    setRevealedMap({});
    setMistakes([]);
    setLatestMistake(null);
    setHaltedMistake(null);
    setHintsUsed(0);
    setFinishedScore(null);
    setCompletedAllSurah(false);
    setElapsedSec(0);
    setLiveTranscript('');
  };

  const selectSurahById = (surahId: number) => {
    setSelectedSurahNum(surahId);
    setStartAyahNum(1);
    setIndexModalOpen(false);
    setSurahSearchInput('');
  };

  const goNextPassage = () => {
    if (allSurahs && selectedSurahNum < 114) {
      setSelectedSurahNum(selectedSurahNum + 1);
      setStartAyahNum(1);
    } else {
      setSelectedSurahNum(1);
      setStartAyahNum(1);
    }
  };

  const activeSheikhObj = getReciterById(correctionSheikh);
  const coreFourSheikhs = useMemo(
    () =>
      (['husary', 'minshawi', 'abdulbasit', 'muaiqly'] as ReciterId[]).map((id) =>
        getReciterById(id),
      ),
    [],
  );
  const otherSheikhs = useMemo(
    () =>
      RECITERS_30.filter(
        (r) => !['husary', 'minshawi', 'abdulbasit', 'muaiqly'].includes(r.id),
      ),
    [],
  );

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-y-auto bg-[#000000] text-white"
    >
      {/* FIXED COMPACT TOP HEADER: Back | Surah | Timer | فهرس | بحث */}
      <header className="flex shrink-0 items-center justify-between gap-1.5 border-b border-[#C9A227]/40 bg-[#050401] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="العودة"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C9A227]/75 text-[#FCE38A]"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="font-quran truncate text-sm font-bold text-[#FCE38A]">
              {currentSurahObj?.name || 'سورة الفاتحة'}
            </h2>
            <p className="text-[10px] font-bold text-[#C9A227]">
              من الآية {toArabicDigits(startAyahNum)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="font-mono-num flex items-center gap-1 rounded-xl border border-[#C9A227]/55 bg-[#0D0A02] px-2 py-1.5 text-[11px] font-bold text-[#F3D56B]">
            <Clock className="h-3 w-3 text-[#C9A227]" />
            <span>{formatTimerMMSS(elapsedSec)}</span>
          </div>

          {allSurahs && allSurahs.length > 0 && finishedScore === null && (
            <>
              <button
                type="button"
                onClick={() => setIndexModalOpen(true)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[#C9A227] bg-[#120E04] px-2 py-1 text-[11px] font-bold text-[#FCE38A]"
              >
                <List className="h-3.5 w-3.5 text-[#C9A227]" />
                <span>فهرس</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                aria-label="بحث عن الآية"
                className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[#C9A227] bg-[#120E04] px-2 py-1 text-[11px] font-bold text-[#FCE38A]"
              >
                <Search className="h-3.5 w-3.5 text-[#C9A227]" />
                <span>بحث</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* DEDICATED TOP ACTION BUTTONS: تغيير الشيخ + الشيخ يصححلي */}
      {finishedScore === null && (
        <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-[#C9A227]/45 bg-[#080602] px-2.5 py-2">
          <button
            type="button"
            onClick={() => setSheikhModalOpen(true)}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-[#120E04] px-2.5 py-1.5 text-xs font-bold text-[#FCE38A]"
          >
            <UserCheck className="h-4 w-4 shrink-0 text-[#C9A227]" />
            <span className="truncate">
              تغيير الشيخ ({activeSheikhObj.shortNameAr})
            </span>
          </button>

          <button
            type="button"
            onClick={handleSheikhCorrectMe}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border-2 border-[#C9A227] bg-[#C9A227]/18 px-2.5 py-1.5 text-xs font-extrabold text-[#FCE38A]"
          >
            {isPlayingCorrection ? (
              <Pause className="h-4 w-4 shrink-0 text-[#C9A227]" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-[#C9A227]" />
            )}
            <span className="truncate">الشيخ يصححلي</span>
          </button>
        </div>
      )}

      {/* FULL-SCREEN STEADY TEST BOX (مربع الاختبار يملي الشاشة كلها) */}
      <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#040301]">
        {finishedScore !== null ? (
          /* RESULTS SPLIT INTO TWO SECTIONS: GREEN (CORRECT AYAHS) & RED (WRONG AYAHS + LISTEN BUTTON) */
          (() => {
            const evaluatedAyahSummary = preparedAyahs
              .map((entry, a) => {
                const words = entry.tokens.map((tok, w) => ({
                  key: `${a}-${w}`,
                  raw: tok.raw,
                  status: revealedMap[`${a}-${w}`] || null,
                }));
                const touchedCount = words.filter((w) => w.status !== null).length;
                if (touchedCount === 0) return null;
                const wrongWordsInAyah = words.filter((w) => w.status === 'wrong');
                const isFullyCorrect =
                  wrongWordsInAyah.length === 0 &&
                  touchedCount === entry.tokens.length;
                return {
                  ayahIdx: a,
                  entry,
                  words,
                  isCorrect: isFullyCorrect,
                };
              })
              .filter(Boolean) as Array<{
              ayahIdx: number;
              entry: (typeof preparedAyahs)[number];
              words: Array<{
                key: string;
                raw: string;
                status: 'correct' | 'hint' | 'wrong' | null;
              }>;
              isCorrect: boolean;
            }>;

            const correctAyahsList = evaluatedAyahSummary.filter(
              (item) => item.isCorrect,
            );
            const wrongAyahsList = evaluatedAyahSummary.filter(
              (item) => !item.isCorrect,
            );

            return (
              <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto touch-pan-y p-4">
                <div className="space-y-4">
                  {/* Top Summary Header */}
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#C9A227] bg-[#C9A227]/15">
                      <Award className="h-7 w-7 text-[#FCE38A]" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-[#C9A227]">
                      نتيجة اختبار الحفظ — {currentSurahObj?.name}
                    </p>
                    <p className="font-mono-num mt-1 text-5xl font-bold text-[#F3D56B]">
                      {finishedScore}%
                    </p>
                  </div>

                  {/* GREEN SECTION: الايات اللي قريتها صح */}
                  <section className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-950/25 p-3 text-right">
                    <h3 className="text-xs font-extrabold text-emerald-300">
                      الايات اللي قريتها صح ✅ ({toArabicDigits(correctAyahsList.length)})
                    </h3>
                    {correctAyahsList.length === 0 ? (
                      <p className="mt-2 text-[11px] text-zinc-400">
                        لم تكتمل آيات صحيحة بالكامل في هذه المحاولة
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {correctAyahsList.map((item) => (
                          <div
                            key={`ok-${item.entry.ayah.id}`}
                            className="rounded-xl border border-emerald-500/35 bg-black/50 px-3 py-2"
                          >
                            <p className="font-quran text-lg leading-loose text-emerald-300">
                              {item.entry.ayah.t}{' '}
                              <span className="font-mono-num inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-emerald-400/60 px-1 text-[11px] text-emerald-300">
                                {toArabicDigits(item.entry.ayah.n)}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* RED SECTION: الايات اللي غلطت فيها */}
                  <section className="rounded-2xl border-2 border-rose-500/60 bg-rose-950/25 p-3 text-right">
                    <h3 className="text-xs font-extrabold text-rose-300">
                      الايات اللي غلطت فيها ❌ ({toArabicDigits(wrongAyahsList.length)})
                    </h3>
                    {wrongAyahsList.length === 0 ? (
                      <p className="mt-2 text-[11px] font-bold text-emerald-300">
                        ما شاء الله! لا توجد أي أخطاء
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2.5">
                        {wrongAyahsList.map((item) => (
                          <div
                            key={`err-${item.entry.ayah.id}`}
                            className="rounded-xl border border-rose-500/45 bg-[#0C0505] p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-quran flex-1 text-lg leading-loose text-white">
                                {item.words.map((w) => (
                                  <span
                                    key={w.key}
                                    className={
                                      w.status === 'wrong'
                                        ? 'mx-0.5 rounded bg-rose-600/35 px-1 font-bold text-rose-400 underline decoration-rose-400'
                                        : w.status === 'correct'
                                          ? 'text-emerald-300'
                                          : 'text-zinc-500'
                                    }
                                  >
                                    {w.raw}{' '}
                                  </span>
                                ))}
                                <span className="font-mono-num inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-rose-400/60 px-1 text-[11px] text-rose-300">
                                  {toArabicDigits(item.entry.ayah.n)}
                                </span>
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  playCorrectionAyah(
                                    correctionSheikh,
                                    item.entry,
                                  )
                                }
                                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-[#C9A227] bg-[#141004] px-2.5 py-1 text-[11px] font-extrabold text-[#FCE38A]"
                              >
                                <Volume2 className="h-3.5 w-3.5 text-[#C9A227]" />
                                <span>🔊 اسمعها صح</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Bottom Metrics Summary */}
                  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#C9A227]/45 bg-[#0B0802] p-3 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">عدد الصح</p>
                      <p className="font-mono-num text-base font-extrabold text-emerald-400">
                        {correctWordsCount} كلمة ({correctAyahsList.length} آية)
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">عدد الغلط</p>
                      <p className="font-mono-num text-base font-extrabold text-rose-400">
                        {mistakes.length} كلمة ({wrongAyahsList.length} آية)
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">النسبة %</p>
                      <p className="font-mono-num text-base font-extrabold text-[#FCE38A]">
                        {finishedScore}%
                      </p>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <p className="text-center text-[11px] text-zinc-500">
                      آخر الدرجات:{' '}
                      {history
                        .slice(0, 3)
                        .map((h) => `${h.surahName} (${h.score}%)`)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid shrink-0 grid-cols-2 gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={resetTest}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border-2 border-[#C9A227] bg-black text-sm font-bold text-[#F3D56B]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>إعادة الاختبار</span>
                  </button>
                  <button
                    type="button"
                    onClick={goNextPassage}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-[#C9A227] text-sm font-extrabold text-black"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>السورة التالية</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : !tasmeeStarted ? (
          /* PRE-START: BIG CENTER GOLD "ابدأ القراءة" BUTTON */
          <div className="flex flex-1 flex-col items-center justify-between p-5 text-center">
            <div className="w-full space-y-1.5 border-b border-[#C9A227]/30 pb-3">
              <p className="font-quran text-2xl font-bold text-[#FCE38A]">
                {currentSurahObj?.name || 'سورة الفاتحة'}
              </p>
              <p className="text-xs font-semibold text-zinc-300">
                اقرأ من الآية {toArabicDigits(startAyahNum)} باستمرار حتى تضغط
                «انهاء الاختبار»
              </p>
              {!isOnline && (
                <p className="mt-2 rounded-xl border border-[#C9A227]/55 bg-[#120E04] px-3 py-1.5 text-[11px] font-bold text-[#FCE38A]">
                  ملاحظة أوفلاين: الميكروفون الصوتي يحتاج إنترنت — يمكنك بدء الاختبار واستخدام الكتابة والمراجعة اليدوية أو سماع التلاوات المحفوظة.
                </p>
              )}
            </div>

            {/* HUGE CENTER GOLD "ابدأ القراءة" BUTTON */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleStartSilently}
                className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full border-4 border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black shadow-[0_0_45px_rgba(201,162,39,0.5)] active:scale-95"
              >
                <Mic className="h-12 w-12 stroke-[2.4]" />
                <span className="text-2xl font-extrabold leading-none">
                  ابدأ القراءة
                </span>
                <span className="text-[11px] font-bold text-black/85">
                  الميكروفون يستمر معك بدون انقطاع
                </span>
              </button>
              <p className="max-w-[270px] text-xs font-semibold leading-relaxed text-zinc-300">
                تظهر الآيات كلمة بكلمة مع صوتك، وإن أخطأت تتلون الكلمة بالأحمر
                ويستمر الاختبار دون توقف
              </p>
            </div>

            <div className="flex w-full items-center justify-between border-t border-[#C9A227]/30 pt-3">
              <button
                type="button"
                onClick={() => setSheikhModalOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C9A227]/60 bg-black px-3 py-1.5 text-xs font-bold text-[#FCE38A]"
              >
                <UserCheck className="h-4 w-4 text-[#C9A227]" />
                <span>الشيخ: {activeSheikhObj.shortNameAr}</span>
              </button>

              <span className="text-[11px] font-bold text-[#C9A227]">
                دقة الهمزة والتجويد
              </span>
            </div>
          </div>
        ) : (
          /* ACTIVE CONTINUOUS RECITATION: MEDINAN MUSHAF CONTINUOUS FLOW + CENTER STOP/LISTEN/RESUME */
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Top Status Strip inside Box */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#C9A227]/35 bg-[#0A0802] px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 font-bold">
                {isPaused ? (
                  <span className="flex items-center gap-1.5 text-[#FCE38A]">
                    <Pause className="h-4 w-4 text-[#C9A227]" />
                    <span>إيقاف مؤقت — اسمع الآية صح أو اضغط كمل</span>
                  </span>
                ) : listening ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Mic className="h-4 w-4" />
                    <span>أسمعك باستمرار — اقرأ متواصلاً</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={startContinuousRecognition}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#C9A227] px-2 py-0.5 text-[#FCE38A]"
                  >
                    <MicOff className="h-3.5 w-3.5 text-rose-400" />
                    <span>إعادة فتح الميكروفون</span>
                  </button>
                )}
              </div>

              <span className="font-mono-num text-[11px] font-bold text-[#C9A227]">
                الآية {toArabicDigits(currentAyah?.ayah.n || startAyahNum)} ·{' '}
                {revealedCount} كلمة
              </span>
            </div>

            {/* Medinan Mushaf Continuous Inline Stream */}
            <div
              ref={wordsBoxScrollRef}
              className="min-h-0 flex-1 overflow-y-auto touch-pan-y p-3.5"
            >
              {revealedAyahGroups.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="font-quran text-2xl font-bold text-[#FCE38A]">
                    ابدأ القراءة الآن بصوت واضح
                  </p>
                  <p className="mt-2 max-w-[270px] text-xs leading-relaxed text-zinc-400">
                    تظهر الآيات كلمة بكلمة مع صوتك؛ وإذا وقفت أو أخطأت يستمر
                    الميكروفون مفتوحاً ويعلم الخطأ بالأحمر
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#C9A227]/45 bg-[#080602] p-4 shadow-inner">
                  {/* Mushaf Surah Banner */}
                  <div className="mb-3 border-b border-[#C9A227]/30 pb-2 text-center">
                    <span className="font-quran text-lg font-bold text-[#FCE38A]">
                      {currentSurahObj?.name}
                    </span>
                  </div>

                  {/* Continuous Justified Quranic Paragraph */}
                  <p
                    dir="rtl"
                    className="font-quran text-justify text-[25px] leading-[2.45] tracking-normal text-white sm:text-[27px]"
                  >
                    {revealedAyahGroups.map((group) => (
                      <span key={`ayah-grp-${group.ayahEntry.ayah.id}`}>
                        {group.words.map((w) => {
                          if (w.status === 'wrong') {
                            return (
                              <span
                                key={w.key}
                                className="mx-0.5 inline-flex flex-wrap items-center gap-1 align-baseline"
                              >
                                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-600/30 px-1.5 py-0.5 font-bold text-rose-400 ring-1 ring-rose-500/70">
                                  <span>{w.raw}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    playSingleCorrectWord(
                                      group.ayahEntry,
                                      w.wordIdx,
                                      w.raw,
                                    )
                                  }
                                  title="نطق الكلمة الصح فقط بصوت الشيخ"
                                  aria-label={`نطق كلمة ${w.raw} بصوت الشيخ`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#FCE38A] bg-[#141004] text-[#FCE38A] shadow"
                                >
                                  <Volume2 className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            );
                          }
                          return (
                            <span key={w.key} className="text-emerald-300">
                              {w.raw}{' '}
                            </span>
                          );
                        })}
                        {group.isAyahComplete && (
                          <span
                            className="font-mono-num mx-1 inline-flex h-[1.45em] min-w-[1.45em] items-center justify-center rounded-full border border-[#C9A227] bg-[#161103] px-1 align-middle text-[0.55em] font-bold leading-none text-[#FCE38A]"
                          >
                            {toArabicDigits(group.ayahEntry.ayah.n)}
                          </span>
                        )}{' '}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {completedAllSurah && (
                <div className="mt-4 rounded-2xl border border-[#C9A227] bg-[#141004] p-3 text-center text-xs font-bold text-[#FCE38A]">
                  ما شاء الله! أتممت السورة — اضغط «انهاء الاختبار» لعرض
                  النتيجة الكاملة
                </div>
              )}
            </div>

            {/* CENTER TOGGLE CONTROL BAR: إيقاف مؤقت / Stop  <->  اسمع الاية صح + كمل */}
            <div className="shrink-0 space-y-2 border-t border-[#C9A227]/45 bg-[#080602] px-3.5 py-2.5">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePauseResume}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-sm font-extrabold transition-all active:scale-95 ${
                    isPaused
                      ? 'border-emerald-400 bg-emerald-600 text-white'
                      : 'border-[#C9A227] bg-[#161104] text-[#FCE38A]'
                  }`}
                >
                  <span>
                    {isPaused ? '▶️ كمل' : '⏸️ إيقاف مؤقت / Stop'}
                  </span>
                </button>

                {isPaused && currentAyah && (
                  <button
                    type="button"
                    onClick={() =>
                      playCorrectionAyah(correctionSheikh, currentAyah)
                    }
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-[#FCE38A] bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-3 text-xs font-extrabold text-black active:scale-95"
                  >
                    <span>
                      {isPlayingCorrection
                        ? '⏸️ إيقاف الصوت'
                        : '🔊 اسمع الاية صح'}
                    </span>
                  </button>
                )}
              </div>

              {correctionDetail && (
                <div className="rounded-2xl border-2 border-[#C9A227] bg-[#120E04] px-3 py-2 text-center">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#C9A227]">
                    <span>
                      تصحيح الشيخ {correctionDetail.sheikhNameAr} (آية{' '}
                      {toArabicDigits(correctionDetail.ayahNumber)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCorrectionDetail(null)}
                      className="text-[10px] text-zinc-400 underline"
                    >
                      إخفاء
                    </button>
                  </div>
                  <p className="mt-1 text-sm font-bold text-white">
                    الصح بالتجويد:{' '}
                    <span className="font-quran text-xl font-bold text-emerald-400">
                      «{correctionDetail.expectedWord}»
                    </span>
                  </p>
                  {correctionDetail.hint && (
                    <p className="mt-0.5 text-[11px] font-semibold text-[#FCE38A]">
                      {correctionDetail.hint}
                    </p>
                  )}
                </div>
              )}

              {correctingNotice && !correctionDetail && (
                <p className="rounded-xl border border-[#C9A227] bg-[#141004] px-3 py-1.5 text-center text-xs font-bold text-[#FCE38A]">
                  {correctingNotice}
                </p>
              )}

              {liveTranscript && listening && !isPaused && (
                <p className="truncate text-center text-[11px] text-zinc-400">
                  المسموع: «{liveTranscript}»
                </p>
              )}

              {(micError || audioErr) && (
                <p className="text-center text-xs font-bold text-rose-400">
                  {micError || audioErr}
                </p>
              )}

              {(showTypingBar ||
                micPermissionState === 'denied' ||
                micPermissionState === 'unsupported') && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const tokens = answerInput
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean);
                    if (tokens.length > 0) {
                      processWords(tokens);
                      setAnswerInput('');
                    }
                  }}
                  className="flex w-full gap-2"
                >
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="اكتب الكلمات هنا للتحقق..."
                    className="flex-1 rounded-xl border border-[#C9A227] bg-black px-3 py-2 text-xs text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[36px] rounded-xl bg-[#C9A227] px-3 text-xs font-bold text-black"
                  >
                    تحقق
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM ACTION: "انهاء الاختبار" DURING ACTIVE TEST */}
      {finishedScore === null && tasmeeStarted && (
        <footer className="shrink-0 border-t border-[#C9A227]/60 bg-[#050401] px-3 py-2.5">
          <button
            type="button"
            onClick={() => finishTest(mistakes, hintsUsed, revealedMap)}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-base font-extrabold text-black shadow-[0_0_24px_rgba(201,162,39,0.35)]"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>انهاء الاختبار</span>
          </button>
        </footer>
      )}

      {/* DEDICATED SURAH INDEX MODAL (فهرس 114 سورة) */}
      {indexModalOpen && allSurahs && (
        <div className="fixed inset-0 z-[60] flex w-full items-end justify-center bg-black/90">
          <div className="animate-sheet-up flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t-2 border-x-2 border-[#C9A227] bg-[#050401] p-4 text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/35 pb-3">
              <h3 className="text-sm font-bold text-[#FCE38A]">
                فهرس السور للاختبار (114 سورة)
              </h3>
              <button
                type="button"
                onClick={() => setIndexModalOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#F3D56B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={surahSearchInput}
              onChange={(e) => setSurahSearchInput(e.target.value)}
              placeholder="ابحث باسم السورة أو رقمها..."
              className="mt-3 rounded-xl border border-[#C9A227]/55 bg-black px-3 py-2 text-xs text-white outline-none focus:border-[#C9A227]"
            />

            <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto touch-pan-y">
              {filteredSurahsList.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => selectSurahById(s.n)}
                  className={`flex min-h-[46px] w-full items-center justify-between rounded-2xl border px-3 py-2 text-right text-xs font-bold ${
                    selectedSurahNum === s.n
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/35 bg-[#0A0904] text-white'
                  }`}
                >
                  <span className="font-quran text-base">
                    {s.n}. {s.name}
                  </span>
                  <span>{s.ayahs.length} آية</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED SEARCH AYAH MODAL (بحث بالاسم أو الرقم أو النص) */}
      {searchModalOpen && allSurahs && (
        <div className="fixed inset-0 z-[60] flex w-full items-end justify-center bg-black/90">
          <div className="animate-sheet-up flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t-2 border-x-2 border-[#C9A227] bg-[#050401] p-4 text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/35 pb-3">
              <h3 className="text-sm font-bold text-[#FCE38A]">
                بحث عن الآية بالاسم أو الرقم أو الكلمة
              </h3>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#F3D56B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
              <input
                type="text"
                value={ayahSearchInput}
                onChange={(e) => setAyahSearchInput(e.target.value)}
                placeholder="اكتب كلمة من الآية، اسم السورة، أو رقم الآية (255)..."
                autoFocus
                className="w-full rounded-xl border border-[#C9A227]/60 bg-black py-2.5 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
              />
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto touch-pan-y">
              {ayahSearchResults.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-400">
                  اكتب حرفين أو رقم الآية للبحث المباشر والانتقال للاختبار
                </p>
              ) : (
                ayahSearchResults.map(({surah, ayah}) => (
                  <button
                    key={ayah.id}
                    type="button"
                    onClick={() => {
                      setSelectedSurahNum(surah.n);
                      setStartAyahNum(ayah.n);
                      setSearchModalOpen(false);
                    }}
                    className="w-full rounded-2xl border border-[#C9A227]/35 bg-[#0A0904] p-3 text-right hover:border-[#C9A227]"
                  >
                    <p className="text-[11px] font-bold text-[#C9A227]">
                      {surah.name} — الآية {ayah.n}
                    </p>
                    <p className="font-quran mt-1 text-base leading-relaxed text-white">
                      {ayah.t}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHEIKH PICKER OVERLAY: الحصري - المنشاوي - عبد الباسط - ماهر المعيقلي */}
      {sheikhModalOpen && (
        <div className="fixed inset-0 z-[60] flex w-full items-end justify-center bg-black/90">
          <div className="animate-sheet-up flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t-2 border-x-2 border-[#C9A227] bg-[#050401] p-4 text-white">
            <div className="flex items-center justify-between border-b border-[#C9A227]/35 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#FCE38A]">
                  تغيير الشيخ للتصحيح والتجويد
                </h3>
                <p className="text-[11px] text-zinc-400">
                  اختر القارئ المعتمد عند الضغط على «الشيخ يصححلي»
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheikhModalOpen(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#F3D56B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto touch-pan-y">
              <p className="text-[11px] font-bold text-[#C9A227]">
                الشيوخ الأساسيون للتصحيح:
              </p>
              {coreFourSheikhs.map((r) => {
                const isSelected = correctionSheikh === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex min-h-[52px] w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 ${
                      isSelected
                        ? 'border-2 border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/55 bg-[#0D0A02] text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectCorrectionSheikh(r.id);
                        setSheikhModalOpen(false);
                      }}
                      className="flex flex-1 items-center justify-between text-right text-xs font-bold"
                    >
                      <div>
                        <p className="text-sm font-extrabold">{r.shortNameAr}</p>
                        <p
                          className={`text-[10px] ${
                            isSelected ? 'text-black/80' : 'text-[#C9A227]'
                          }`}
                        >
                          {r.nameAr} · {r.styleAr}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => playCorrectionAyah(r.id)}
                      aria-label={`استماع لصوت ${r.shortNameAr}`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        isSelected
                          ? 'border-black/40 bg-black/15 text-black'
                          : 'border-[#C9A227]/50 bg-black text-[#FCE38A]'
                      }`}
                    >
                      {isPlayingCorrection && isSelected ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}

              <p className="pt-2 text-[11px] font-bold text-zinc-400">
                قراء آخرون:
              </p>
              {otherSheikhs.map((r) => {
                const isSelected = correctionSheikh === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex min-h-[46px] w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 ${
                      isSelected
                        ? 'border-2 border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/35 bg-black text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectCorrectionSheikh(r.id);
                        setSheikhModalOpen(false);
                      }}
                      className="flex flex-1 items-center justify-between text-right text-xs font-bold"
                    >
                      <div>
                        <p>{r.nameAr}</p>
                        <p
                          className={`text-[10px] ${
                            isSelected ? 'text-black/75' : 'text-[#C9A227]'
                          }`}
                        >
                          {r.styleAr}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => playCorrectionAyah(r.id)}
                      aria-label={`استماع لصوت ${r.shortNameAr}`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                        isSelected
                          ? 'border-black/40 bg-black/15 text-black'
                          : 'border-[#C9A227]/50 bg-black text-[#FCE38A]'
                      }`}
                    >
                      {isPlayingCorrection && isSelected ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
