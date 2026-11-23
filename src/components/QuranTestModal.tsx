import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
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
import {
  compareArabicWords,
  tokenizeArabicAyah,
} from '../utils/recitationMatcher';

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
    if (!tasmeeStarted || finishedScore !== null) return;
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [tasmeeStarted, finishedScore]);

  useEffect(() => {
    releaseMic();
    setTasmeeStarted(false);
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
      audioRef.current?.pause();
    };
  }, [releaseMic]);

  // Only ends when the user explicitly clicks "إنهاء القراءة"
  const finishTest = useCallback(
    (
      finalMistakes: MistakeLog[],
      finalHints: number,
      finalMap: Record<string, 'correct' | 'hint' | 'wrong'>,
    ) => {
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

  // Word-by-word matcher: halts immediately on mistake, keeps mic open, and never advances ayah until resolved
  const processWords = useCallback(
    (spokenTokens: string[]) => {
      const snap = stateRef.current;
      if (
        preparedAyahs.length === 0 ||
        snap.finishedScore !== null ||
        ignoreMicAudioRef.current
      ) {
        return;
      }

      let aIdx = snap.ayahIdx;
      let wIdx = snap.wordIdx;
      const nextMap = {...snap.revealedMap};
      const nextMistakes = [...snap.mistakes];
      let lastErr: MistakeLog | null = snap.latestMistake;
      let nextHalted: HaltedMistakeState | null = snap.haltedMistake;
      let finishedAll = false;
      let startTokenOffset = 0;

      // If currently halted on a wrong word, wait until user says that word right (or presses "تكملة")
      if (nextHalted) {
        const haltedEntry = preparedAyahs[nextHalted.ayahIdx];
        const haltedExpected = haltedEntry?.tokens[nextHalted.wordIdx];
        if (!haltedEntry || !haltedExpected) {
          nextHalted = null;
        } else {
          let resolvedAt = -1;
          for (let idx = 0; idx < spokenTokens.length; idx++) {
            const check = compareArabicWords(
              spokenTokens[idx],
              haltedExpected.norm,
              haltedExpected.hamzaNorm,
              haltedExpected.altVariants,
            );
            if (check.isMatch) {
              resolvedAt = idx;
              break;
            }
          }
          if (resolvedAt === -1) {
            // Stay halted right on this red word without advancing or closing mic
            return;
          }
          nextMap[nextHalted.key] = 'correct';
          lastErr = null;
          aIdx = nextHalted.ayahIdx;
          wIdx = nextHalted.wordIdx + 1;
          if (wIdx >= haltedEntry.tokens.length) {
            aIdx++;
            wIdx = 0;
          }
          nextHalted = null;
          startTokenOffset = resolvedAt + 1;
        }
      }

      for (let tIdx = startTokenOffset; tIdx < spokenTokens.length; tIdx++) {
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
          wIdx++;
          if (wIdx >= targetAyah.tokens.length) {
            aIdx++;
            wIdx = 0;
          }
        } else {
          // Highlight word in red and HALT right here (never advance ayah until corrected or user taps "تكملة")
          nextMap[key] = 'wrong';
          const errItem: MistakeLog = {
            ayahNumber: targetAyah.ayah.n,
            expectedWord: expected.raw,
            spokenWord: spoken,
            hint: check.wrongLetterHint,
          };
          nextMistakes.push(errItem);
          lastErr = errItem;
          nextHalted = {
            ayahIdx: aIdx,
            wordIdx: wIdx,
            key,
            ayahEntry: targetAyah,
            expectedWord: expected.raw,
            spokenWord: spoken,
            hint: check.wrongLetterHint,
          };
          break;
        }
      }

      if (aIdx >= preparedAyahs.length && !nextHalted) {
        finishedAll = true;
      }

      setRevealedMap(nextMap);
      setMistakes(nextMistakes);
      setLatestMistake(lastErr);
      setHaltedMistake(nextHalted);
      if (!lastErr && !nextHalted) {
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

    // Keep single continuous open session (never stop/restart to avoid mic beep)
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

        // While Sheikh correction MP3 is playing, consume indices without evaluating Sheikh's voice
        if (ignoreMicAudioRef.current) {
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
            !snap.haltedMistake
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
        err.error === 'not-allowed' ||
        err.error === 'service-not-allowed'
      ) {
        setMicPermissionState('denied');
        setShowTypingBar(true);
        setMicError('يرجى السماح بالميكروفون أو الكتابة أدناه للتصحيح.');
        listeningRef.current = false;
        setListening(false);
      } else if (err.error === 'audio-capture') {
        setMicError('تأكد من اتصال الميكروفون ثم اضغط مرة أخرى.');
      }
    };

    // Single continuous session: never auto-restart in onend (prevents mic beep sound)
    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
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

  // Silent start: open continuous mic immediately with ZERO cue/beep sound
  const handleStartSilently = useCallback(() => {
    setMicError(null);
    setAudioErr(null);
    setTasmeeStarted(true);
    startContinuousRecognition();
  }, [startContinuousRecognition]);

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

    // Mute transcript processing while Sheikh recites instead of stopping/restarting mic (prevents beep!)
    ignoreMicAudioRef.current = true;

    const activeObj = getReciterById(reciterId);
    setCorrectingNotice(
      wordToExplain
        ? `الشيخ ${activeObj.shortNameAr} ينطق بالتجويد: «${wordToExplain}»`
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

    audio.src = getAyahAudioUrl(reciterId, target.surah.n, target.ayah.n);
    audio.playbackRate = wordToExplain ? 0.88 : 1;
    setIsPlayingCorrection(true);
    audio.onended = releaseMute;
    audio.onerror = () => {
      setAudioErr(
        wordToExplain
          ? `الصح هو: «${wordToExplain}» — تعذر تشغيل الصوت، تأكد من الاتصال`
          : 'تعذر تشغيل التلاوة حاليًا — تحقق من الاتصال أو اختر شيخًا آخر',
      );
      releaseMute();
    };
    audio.play().catch(() => {
      setAudioErr('تعذر تشغيل الصوت حاليًا');
      releaseMute();
    });
  };

  // User clicks "تكملة" beside the red word: stops Sheikh playback cleanly, unmutes mic (or opens silently if needed), and advances past the reviewed mistake
  const handleContinueAfterMistake = useCallback(() => {
    audioRef.current?.pause();
    ignoreMicAudioRef.current = false;
    setIsPlayingCorrection(false);
    setCorrectingNotice(null);
    setCorrectionDetail(null);

    const halted = stateRef.current.haltedMistake;
    if (halted) {
      let nextAyah = halted.ayahIdx;
      let nextWord = halted.wordIdx + 1;
      const entry = preparedAyahs[nextAyah];
      if (entry && nextWord >= entry.tokens.length) {
        nextAyah++;
        nextWord = 0;
      }
      setHaltedMistake(null);
      setLatestMistake(null);
      if (nextAyah >= preparedAyahs.length) {
        setCompletedAllSurah(true);
        setAyahIdx(Math.max(0, preparedAyahs.length - 1));
        setWordIdx(0);
      } else {
        setAyahIdx(nextAyah);
        setWordIdx(nextWord);
      }
    }

    if (!listeningRef.current) {
      startContinuousRecognition();
    }
  }, [preparedAyahs, startContinuousRecognition]);

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
        playCorrectionAyah(
          correctionSheikh,
          targetEntry,
          targetMistake.expectedWord,
          targetMistake.hint,
          targetMistake.spokenWord,
        );
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
    releaseMic();
    audioRef.current?.pause();
    setIsPlayingCorrection(false);
    setCorrectingNotice(null);
    setCorrectionDetail(null);
    setTasmeeStarted(false);
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
      className="fixed inset-y-0 left-1/2 z-50 flex h-dvh w-full max-w-[400px] -translate-x-1/2 flex-col overflow-y-auto border-x border-[#C9A227]/60 bg-[#000000] text-white"
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
          /* RESULTS + ALL MISTAKES SCREEN */
          <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto touch-pan-y p-4">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#C9A227] bg-[#C9A227]/15">
                <Award className="h-8 w-8 text-[#FCE38A]" />
              </div>
              <p className="mt-2.5 text-xs font-bold text-[#C9A227]">
                نتيجة اختبار الحفظ — {currentSurahObj?.name}
              </p>
              <p className="font-mono-num mt-1 text-5xl font-bold text-[#F3D56B]">
                {finishedScore}
                <span className="text-xl text-[#C9A227]">/100</span>
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-200">
                <span>
                  كلمات صحيحة:{' '}
                  <strong className="font-mono-num text-emerald-400">
                    {correctWordsCount}
                  </strong>
                </span>
                <span>
                  الأخطاء:{' '}
                  <strong className="font-mono-num text-rose-400">
                    {mistakes.length}
                  </strong>
                </span>
                <span>
                  المدة:{' '}
                  <strong className="font-mono-num text-[#F3D56B]">
                    {formatTimerMMSS(elapsedSec)}
                  </strong>
                </span>
              </div>

              {mistakes.length > 0 ? (
                <div className="mt-5 w-full space-y-2 border-t border-[#C9A227]/35 pt-3.5 text-right">
                  <h3 className="text-xs font-bold text-rose-400">
                    قائمة الغلطات ({mistakes.length}) — اضغط «استمع» لسماع الشيخ:
                  </h3>
                  {mistakes.map((m, idx) => {
                    const targetEntry = preparedAyahs.find(
                      (a) => a.ayah.n === m.ayahNumber,
                    );
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/45 bg-[#0C0505] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs">
                            <span className="text-zinc-400">
                              آية {toArabicDigits(m.ayahNumber)}:{' '}
                            </span>
                            <span className="font-bold text-rose-400 line-through">
                              {m.spokenWord}
                            </span>{' '}
                            ←{' '}
                            <span className="font-quran text-lg font-bold text-emerald-400">
                              {m.expectedWord}
                            </span>
                          </p>
                          {m.hint && (
                            <p className="mt-0.5 text-[10px] font-semibold text-rose-300">
                              {m.hint}
                            </p>
                          )}
                        </div>
                        {targetEntry && (
                          <button
                            type="button"
                            onClick={() =>
                              playCorrectionAyah(
                                correctionSheikh,
                                targetEntry,
                                m.expectedWord,
                              )
                            }
                            className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-[#C9A227] px-2.5 py-1 text-[11px] font-bold text-[#FCE38A]"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>استمع</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/25 px-4 py-3 text-sm font-bold text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>ما شاء الله! قراءة متقنة بدون أي أخطاء</span>
                </div>
              )}

              {history.length > 0 && (
                <p className="mt-4 text-[11px] text-zinc-500">
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
        ) : !tasmeeStarted ? (
          /* PRE-START: BIG CENTER GOLD "ابدأ" BUTTON (SILENT MIC — ZERO BEEP) */
          <div className="flex flex-1 flex-col items-center justify-between p-5 text-center">
            <div className="w-full space-y-1.5 border-b border-[#C9A227]/30 pb-3">
              <p className="font-quran text-2xl font-bold text-[#FCE38A]">
                {currentSurahObj?.name || 'سورة الفاتحة'}
              </p>
              <p className="text-xs font-semibold text-zinc-300">
                اقرأ من الآية {toArabicDigits(startAyahNum)} باستمرار حتى تضغط
                «إنهاء القراءة»
              </p>
            </div>

            {/* HUGE CENTER GOLD "ابدأ" BUTTON */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleStartSilently}
                className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full border-4 border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black shadow-[0_0_45px_rgba(201,162,39,0.5)] active:scale-95"
              >
                <Mic className="h-12 w-12 stroke-[2.4]" />
                <span className="text-3xl font-extrabold leading-none">
                  ابدأ
                </span>
                <span className="text-[11px] font-bold text-black/85">
                  اضغط لفتح الميكروفون بصمت
                </span>
              </button>
              <p className="max-w-[270px] text-xs font-semibold leading-relaxed text-zinc-300">
                عند الضغط يُفتح الميكروفون بصمت تام وتظهر الآيات أمامك بنظام
                المصحف الشريف على سرعة تلاوتك
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
          /* ACTIVE CONTINUOUS RECITATION: MEDINAN MUSHAF CONTINUOUS FLOW + MISTAKE HALT */
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Top Status Strip inside Box */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#C9A227]/35 bg-[#0A0802] px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 font-bold">
                {haltedMistake ? (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <Volume2 className="h-4 w-4" />
                    <span>توقفت القراءة عند الخطأ — استمع أو اضغط تكملة</span>
                  </span>
                ) : listening ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Mic className="h-4 w-4" />
                    <span>أسمعك الآن — اقرأ باستمرار</span>
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

            {/* Medinan Mushaf Continuous Inline Stream (NO separated boxes; inline golden ayah circles) */}
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
                    تظهر الآيات أمامك متصلة على شكل المصحف الشريف حسب سرعة صوتك،
                    وإذا أخطأت يتعلم الخطأ بالأحمر لتستمع له ثم تضغط «تكملة»
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

                  {/* Continuous Justified Quranic Paragraph (NO square boxes around words) */}
                  <p
                    dir="rtl"
                    className="font-quran text-justify text-[25px] leading-[2.45] tracking-normal text-white sm:text-[27px]"
                  >
                    {revealedAyahGroups.map((group) => (
                      <span key={`ayah-grp-${group.ayahEntry.ayah.id}`}>
                        {group.words.map((w) => {
                          const isHaltedWord = haltedMistake?.key === w.key;
                          if (w.status === 'wrong') {
                            return (
                              <span
                                key={w.key}
                                className="mx-0.5 inline-flex flex-wrap items-center gap-1 align-baseline"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    playCorrectionAyah(
                                      correctionSheikh,
                                      group.ayahEntry,
                                      w.raw,
                                      isHaltedWord
                                        ? haltedMistake?.hint
                                        : undefined,
                                      isHaltedWord
                                        ? haltedMistake?.spokenWord
                                        : undefined,
                                    )
                                  }
                                  title="اضغط لسماع الشيخ ينطقها صحيحًا"
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600/25 px-1.5 py-0.5 font-bold text-rose-400 underline decoration-rose-400 decoration-2 underline-offset-4"
                                >
                                  <span>{w.raw}</span>
                                  <Volume2 className="h-3.5 w-3.5 shrink-0" />
                                </button>
                                {isHaltedWord && (
                                  <button
                                    type="button"
                                    onClick={handleContinueAfterMistake}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#C9A227] px-2 py-0.5 font-sans text-xs font-extrabold text-black shadow"
                                  >
                                    <Play className="h-3 w-3 fill-black" />
                                    <span>تكملة</span>
                                  </button>
                                )}
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
                  ما شاء الله! أتممت السورة — اضغط «إنهاء القراءة» لعرض
                  النتيجة والغلطات
                </div>
              )}
            </div>

            {/* Live Instant Mistake / Sheikh Correction Footer Inside Box */}
            <div className="shrink-0 space-y-2 border-t border-[#C9A227]/35 bg-[#080602] px-3.5 py-2.5">
              {haltedMistake && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-rose-500/70 bg-rose-950/35 px-3 py-2">
                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-xs font-bold text-rose-300">
                      خطأ في الآية {toArabicDigits(haltedMistake.ayahEntry.ayah.n)} — اضغط الكلمة الحمراء للاستماع
                    </p>
                    <p className="mt-0.5 text-xs text-white">
                      الصحيح:{' '}
                      <span className="font-quran text-base font-bold text-emerald-400">
                        «{haltedMistake.expectedWord}»
                      </span>
                      {haltedMistake.hint && (
                        <span className="block text-[10px] text-[#FCE38A]">
                          {haltedMistake.hint}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        playCorrectionAyah(
                          correctionSheikh,
                          haltedMistake.ayahEntry,
                          haltedMistake.expectedWord,
                          haltedMistake.hint,
                          haltedMistake.spokenWord,
                        )
                      }
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#C9A227] bg-black px-2.5 text-xs font-bold text-[#FCE38A]"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>اسمعها صح</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueAfterMistake}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#C9A227] px-3 text-xs font-extrabold text-black"
                    >
                      <Play className="h-3.5 w-3.5 fill-black" />
                      <span>تكملة</span>
                    </button>
                  </div>
                </div>
              )}

              {correctionDetail && !haltedMistake && (
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

              {correctingNotice && !correctionDetail && !haltedMistake && (
                <p className="rounded-xl border border-[#C9A227] bg-[#141004] px-3 py-1.5 text-center text-xs font-bold text-[#FCE38A]">
                  {correctingNotice}
                </p>
              )}

              {liveTranscript && listening && !haltedMistake && (
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

      {/* FIXED BOTTOM ACTION: ONLY SHOWS "إنهاء القراءة" DURING ACTIVE TEST */}
      {finishedScore === null && tasmeeStarted && (
        <footer className="shrink-0 border-t border-[#C9A227]/60 bg-[#050401] px-3 py-2.5">
          <button
            type="button"
            onClick={() => finishTest(mistakes, hintsUsed, revealedMap)}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-base font-extrabold text-black shadow-[0_0_24px_rgba(201,162,39,0.35)]"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>إنهاء القراءة</span>
          </button>
        </footer>
      )}

      {/* DEDICATED SURAH INDEX MODAL (فهرس 114 سورة) */}
      {indexModalOpen && allSurahs && (
        <div className="fixed inset-y-0 left-1/2 z-[60] flex w-full max-w-[400px] -translate-x-1/2 items-end justify-center bg-black/90">
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
        <div className="fixed inset-y-0 left-1/2 z-[60] flex w-full max-w-[400px] -translate-x-1/2 items-end justify-center bg-black/90">
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
        <div className="fixed inset-y-0 left-1/2 z-[60] flex w-full max-w-[400px] -translate-x-1/2 items-end justify-center bg-black/90">
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
