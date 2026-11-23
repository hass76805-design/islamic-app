import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  getAyahAudioUrl,
  getReciterById,
  RECITERS_30,
} from '../data/reciters';
import {CompactAyah, CompactSurah, ReciterId} from '../types';
import {loadOfflineJson} from '../utils/offlineAudioCache';
import {
  AyahWordToken,
  compareArabicWords,
  normalizeQuranWord,
  tokenizeArabicAyah,
} from '../utils/recitationMatcher';

interface VoiceTestViewProps {
  preferredReciter: ReciterId;
}

interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
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

interface EvaluatedWordResult {
  raw: string;
  isMatch: boolean;
  spokenWord: string | null;
  hint: string | null;
}

interface EvaluatedAyahResult {
  ayah: CompactAyah;
  wordResults: EvaluatedWordResult[];
  correctCount: number;
  wrongCount: number;
  isAyahCorrect: boolean;
}

interface DetectionOutcome {
  surah: CompactSurah;
  evaluatedAyahs: EvaluatedAyahResult[];
  totalCorrectWords: number;
  totalWrongWords: number;
  correctAyahsCount: number;
  wrongAyahsCount: number;
  accuracyPercent: number;
  pageLabel: string;
  mistakesList: Array<{
    ayahId: number;
    ayahNum: number;
    expectedWord: string;
    spokenWord: string | null;
    hint: string | null;
  }>;
}

const ENCOURAGEMENT_POOLS: Record<
  'high' | 'good' | 'mid' | 'retry',
  Array<{headline: string; message: string}>
> = {
  high: [
    {
      headline: 'ما شاء الله، تلاوة مباركة ومُتقنة!',
      message:
        'أداء ممتاز ونطق سليم لحروف القرآن — بارك الله فيك وزادك تثبيتًا ونورًا.',
    },
    {
      headline: 'أحسنت يا حافظ كتاب الله!',
      message:
        'تلاوتك جميلة ومتزنة جدًا — استمر على هذا الورد اليومي المميز.',
    },
    {
      headline: 'رائع جدًا — قراءة متقنة!',
      message:
        'أكرمك الله بالقرآن وجعلك من أهل الله وخاصته، أداء يفرح القلب.',
    },
  ],
  good: [
    {
      headline: 'ممتاز، قرّبت جدًا من الإتقان!',
      message:
        'قراءة جميلة ولا ينقصك إلا كلمات يسيرة — اضغط على أي كلمة حمراء لتسمع نطقها بالشيخ.',
    },
    {
      headline: 'أحسنت يا بطل — خطوة رائعة!',
      message:
        'صوتك واضح وتلاوتك موفقة — راجع الكلمات الحمراء وستصل إلى ١٠٠٪ فورًا.',
    },
    {
      headline: 'تقدّم ممتاز — استمر!',
      message:
        'أداؤك طيّب ومبشّر — استمع لتصحيح الكلمات المعلّمة بالأحمر وجرّب مرة أخرى.',
    },
  ],
  mid: [
    {
      headline: 'بداية طيبة وقرّبت كثيرًا!',
      message:
        'المهم أنك تقرأ وتتعلّم — اضغط على الكلمات الحمراء اسمعها صح وكرّرها وستتقنها بإذن الله.',
    },
    {
      headline: 'مجهود جميل ومأجور عليه!',
      message:
        'الماهر بالقرآن مع السفرة الكرام، والذي يتتعتع فيه له أجران — استمع للشيخ وكمّل.',
    },
    {
      headline: 'خطوة مباركة على طريق الحفظ!',
      message:
        'اضغط على الكلمات الحمراء في المصحف أدناه لتسمع نطقها الصحيح بصوت الشيخ.',
    },
  ],
  retry: [
    {
      headline: 'حاول مرة أخرى — أنت قدّها بإذن الله!',
      message:
        'اسمع الآية من الشيخ واضغط على الكلمات الحمراء كلمة بكلمة ثم سجّل تلاوتك من جديد.',
    },
    {
      headline: 'لا تتوقف — كل تكرار يثبت الحفظ!',
      message:
        'قراءة القرآن تحتاج صبرًا وتكرارًا — استمع للشيخ ثم اقرأ بتأنٍ ووضوح.',
    },
    {
      headline: 'نور على نور — واصل المحاولة!',
      message:
        'راجع التشكيل والكلمات الحمراء بصوت الشيخ وستلاحظ تحسنًا كبيرًا في المرة القادمة.',
    },
  ],
};

function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function formatTimerMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNormalizedTokenForms(tok: AyahWordToken): string[] {
  const forms = new Set<string>();
  if (tok.norm) forms.add(tok.norm);
  for (const v of tok.altVariants) {
    const nv = normalizeQuranWord(v);
    if (nv) forms.add(nv);
  }
  return Array.from(forms);
}

// Lightweight Levenshtein distance <= 1 check for mild ASR Arabic typos (e.g., س/ص, ت/ط, missing dot)
function isNearArabicWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 3) {
    return false;
  }
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else {
        i++;
        j++;
      }
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

const BASMALAH_NORM_PREFIX = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

function getAyahEffectiveTokens(
  surahNum: number,
  ayahNum: number,
  ayahText: string,
  spokenNormSet: Set<string>,
): AyahWordToken[] {
  const tokens = tokenizeArabicAyah(ayahText);
  if (
    surahNum !== 1 &&
    surahNum !== 9 &&
    ayahNum === 1 &&
    tokens.length > 4
  ) {
    const startsWithBasmalah = BASMALAH_NORM_PREFIX.every((w, i) =>
      getNormalizedTokenForms(tokens[i]).includes(w),
    );
    const userRecitedBasmalah =
      spokenNormSet.has('بسم') && spokenNormSet.has('الرحمن');
    if (startsWithBasmalah && !userRecitedBasmalah) {
      return tokens.slice(4);
    }
  }
  return tokens;
}

function buildOutcomeForAyahRange(
  surah: CompactSurah,
  startIdx: number,
  endIdx: number,
  rawTokens: Array<{raw: string; norm: string}>,
  spokenCursorStart: number,
): DetectionOutcome {
  const spokenNormSet = new Set(rawTokens.map((t) => t.norm));
  let spokenCursor = spokenCursorStart;
  const targetAyahs = surah.ayahs.slice(startIdx, endIdx + 1);
  const evaluatedAyahs: EvaluatedAyahResult[] = [];
  const mistakesList: DetectionOutcome['mistakesList'] = [];

  let totalCorrectWords = 0;
  let totalWrongWords = 0;
  let correctAyahsCount = 0;
  let wrongAyahsCount = 0;

  for (const ayah of targetAyahs) {
    const tokens = getAyahEffectiveTokens(
      surah.n,
      ayah.n,
      ayah.t,
      spokenNormSet,
    );
    const wordResults: EvaluatedWordResult[] = [];
    let ayahCorrect = 0;
    let ayahWrong = 0;

    for (const tok of tokens) {
      let matched = false;
      let spokenMatchedWord: string | null = null;
      let mistakeHint: string | null = null;

      const searchEnd = Math.min(rawTokens.length, spokenCursor + 5);
      for (let probe = spokenCursor; probe < searchEnd; probe++) {
        const res = compareArabicWords(
          rawTokens[probe].raw,
          tok.norm,
          tok.hamzaNorm,
          tok.altVariants,
        );
        if (res.isMatch) {
          matched = true;
          spokenMatchedWord = rawTokens[probe].raw;
          spokenCursor = probe + 1;
          break;
        }
      }

      if (!matched) {
        const candidateSpoken = rawTokens[spokenCursor];
        if (candidateSpoken) {
          const check = compareArabicWords(
            candidateSpoken.raw,
            tok.norm,
            tok.hamzaNorm,
            tok.altVariants,
          );
          mistakeHint = check.wrongLetterHint;
          spokenMatchedWord = candidateSpoken.raw;
          spokenCursor += 1;
        } else {
          mistakeHint = 'سقطت الكلمة أو لم تُسمع بوضوح أثناء التلاوة';
          spokenMatchedWord = null;
        }
      }

      if (matched) {
        ayahCorrect += 1;
        totalCorrectWords += 1;
      } else {
        ayahWrong += 1;
        totalWrongWords += 1;
        mistakesList.push({
          ayahId: ayah.id,
          ayahNum: ayah.n,
          expectedWord: tok.raw,
          spokenWord: spokenMatchedWord,
          hint: mistakeHint,
        });
      }

      wordResults.push({
        raw: tok.raw,
        isMatch: matched,
        spokenWord: spokenMatchedWord,
        hint: mistakeHint,
      });
    }

    const isAyahCorrect = ayahWrong === 0 && ayahCorrect > 0;
    if (isAyahCorrect) {
      correctAyahsCount += 1;
    } else {
      wrongAyahsCount += 1;
    }

    evaluatedAyahs.push({
      ayah,
      wordResults,
      correctCount: ayahCorrect,
      wrongCount: ayahWrong,
      isAyahCorrect,
    });
  }

  const totalWords = totalCorrectWords + totalWrongWords;
  const accuracyPercent =
    totalWords > 0 ? Math.round((totalCorrectWords / totalWords) * 100) : 0;

  const pages = Array.from(new Set(targetAyahs.map((a) => a.p))).sort(
    (a, b) => a - b,
  );
  const pageLabel =
    pages.length === 1
      ? `صفحة ${toArabicDigits(pages[0])}`
      : `صفحات ${toArabicDigits(pages[0])} - ${toArabicDigits(pages[pages.length - 1])}`;

  return {
    surah,
    evaluatedAyahs,
    totalCorrectWords,
    totalWrongWords,
    correctAyahsCount,
    wrongAyahsCount,
    accuracyPercent,
    pageLabel,
    mistakesList,
  };
}

function detectSurahAndEvaluate(
  surahs: CompactSurah[],
  transcript: string,
): DetectionOutcome | null {
  const rawTokens = transcript
    .trim()
    .split(/\s+/)
    .map((w) => ({raw: w, norm: normalizeQuranWord(w)}))
    .filter((w) => w.norm.length > 0);

  if (rawTokens.length === 0 || surahs.length === 0) return null;

  const spokenNorms = rawTokens.map((t) => t.norm);
  const spokenNormSet = new Set(spokenNorms);
  const spokenBigrams = new Set<string>();
  for (let i = 0; i < rawTokens.length - 1; i++) {
    spokenBigrams.add(`${rawTokens[i].norm}|${rawTokens[i + 1].norm}`);
  }

  let bestSurah: CompactSurah = surahs[0];
  let bestScore = -1;
  let bestClusterIndices: number[] = [];

  for (const surah of surahs) {
    const matchedRows: Array<{idx: number; score: number}> = [];

    for (let idx = 0; idx < surah.ayahs.length; idx++) {
      const ayah = surah.ayahs[idx];
      const tokens = getAyahEffectiveTokens(
        surah.n,
        ayah.n,
        ayah.t,
        spokenNormSet,
      );
      if (tokens.length === 0) continue;

      const tokenFormsList = tokens.map(getNormalizedTokenForms);

      let wordHits = 0;
      let nearHits = 0;
      for (const forms of tokenFormsList) {
        if (forms.some((f) => spokenNormSet.has(f))) {
          wordHits += 1;
        } else if (
          forms.some((f) => spokenNorms.some((sn) => isNearArabicWord(f, sn)))
        ) {
          nearHits += 1;
        }
      }

      let bigramHits = 0;
      for (let i = 0; i < tokenFormsList.length - 1; i++) {
        let matchedPair = false;
        for (const f1 of tokenFormsList[i]) {
          for (const f2 of tokenFormsList[i + 1]) {
            if (spokenBigrams.has(`${f1}|${f2}`)) {
              matchedPair = true;
              break;
            }
          }
          if (matchedPair) break;
        }
        if (matchedPair) bigramHits += 1;
      }

      const effectiveHits = wordHits + nearHits * 0.7;
      const ratio = effectiveHits / tokens.length;
      const ayahScore =
        wordHits * 2 + nearHits * 1.1 + bigramHits * 6 + (ratio >= 0.35 ? 4 : 0);

      if (
        (effectiveHits >= 1.7 ||
          bigramHits >= 1 ||
          (tokens.length <= 4 && wordHits >= 1) ||
          (rawTokens.length === 1 && wordHits >= 1)) &&
        ayahScore >= 2
      ) {
        matchedRows.push({idx, score: ayahScore});
      }
    }

    if (matchedRows.length === 0) continue;

    const clusters: Array<{indices: number[]; score: number}> = [];
    let currentCluster = {
      indices: [matchedRows[0].idx],
      score: matchedRows[0].score,
    };
    for (let i = 1; i < matchedRows.length; i++) {
      const prevIdx =
        currentCluster.indices[currentCluster.indices.length - 1];
      if (matchedRows[i].idx - prevIdx <= 2) {
        currentCluster.indices.push(matchedRows[i].idx);
        currentCluster.score += matchedRows[i].score;
      } else {
        clusters.push(currentCluster);
        currentCluster = {
          indices: [matchedRows[i].idx],
          score: matchedRows[i].score,
        };
      }
    }
    clusters.push(currentCluster);

    const topCluster = clusters.reduce((best, cur) =>
      cur.score > best.score ? cur : best,
    );

    if (topCluster.score > bestScore) {
      bestScore = topCluster.score;
      bestSurah = surah;
      bestClusterIndices = topCluster.indices;
    }
  }

  if (bestClusterIndices.length === 0) {
    return null;
  }

  const minIdx = Math.max(0, bestClusterIndices[0]);
  const maxIdx = Math.min(
    bestSurah.ayahs.length - 1,
    bestClusterIndices[bestClusterIndices.length - 1],
  );

  const firstTokens = getAyahEffectiveTokens(
    bestSurah.n,
    bestSurah.ayahs[minIdx].n,
    bestSurah.ayahs[minIdx].t,
    spokenNormSet,
  );
  const firstTokenForms = firstTokens
    .slice(0, 3)
    .flatMap(getNormalizedTokenForms);
  let spokenCursor = 0;
  for (let i = 0; i < rawTokens.length; i++) {
    if (
      firstTokenForms.some(
        (f) => f === rawTokens[i].norm || isNearArabicWord(f, rawTokens[i].norm),
      )
    ) {
      spokenCursor = i;
      break;
    }
  }

  return buildOutcomeForAyahRange(
    bestSurah,
    minIdx,
    maxIdx,
    rawTokens,
    spokenCursor,
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : '');
    };
    reader.onerror = () => reject(new Error('Failed to encode audio'));
    reader.readAsDataURL(blob);
  });
}

const QUICK_SURAHS_PICKS = [1, 112, 113, 114, 108, 103, 97, 87];

export const VoiceTestView: React.FC<VoiceTestViewProps> = ({
  preferredReciter,
}) => {
  const [surahs, setSurahs] = useState<CompactSurah[] | null>(null);
  const [loadingQuran, setLoadingQuran] = useState(true);
  const [selectedReciter, setSelectedReciter] =
    useState<ReciterId>(preferredReciter);

  const [phase, setPhase] = useState<
    'ready' | 'recording' | 'analyzing' | 'result'
  >('ready');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micNote, setMicNote] = useState<string | null>(null);
  const [attemptNum, setAttemptNum] = useState(0);

  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserClip, setIsPlayingUserClip] = useState(false);
  const [playingSheikhAyahId, setPlayingSheikhAyahId] = useState<number | null>(
    null,
  );
  const [wordCorrectionInfo, setWordCorrectionInfo] = useState<{
    ayahId: number;
    ayahNum: number;
    expectedWord: string;
    spokenWord: string | null;
    hint: string | null;
  } | null>(null);
  const [outcome, setOutcome] = useState<DetectionOutcome | null>(null);
  const [lastRecognizedText, setLastRecognizedText] = useState('');
  const [manualSurahNum, setManualSurahNum] = useState(1);

  const recRef = useRef<SpeechRecLike | null>(null);
  const isRecordingRef = useRef(false);
  const speechFailedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const finalizedTranscriptRef = useRef('');
  const transcriptRef = useRef('');
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const sheikhAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    loadOfflineJson<CompactSurah[]>('/data/quran.json')
      .then((data) => {
        if (active) {
          setSurahs(data);
          setLoadingQuran(false);
        }
      })
      .catch(() => {
        if (active) setLoadingQuran(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      userAudioRef.current?.pause();
      sheikhAudioRef.current?.pause();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  const activeSheikh = useMemo(
    () => getReciterById(selectedReciter),
    [selectedReciter],
  );

  const startSpeechRecognitionSession = () => {
    const SpeechRec =
      (window as unknown as {SpeechRecognition?: new () => SpeechRecLike})
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecLike;
        }
      ).webkitSpeechRecognition;
    if (!SpeechRec || !isRecordingRef.current || speechFailedRef.current) return;

    const rec = new SpeechRec();
    rec.lang = 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;

    let sessionFinal = '';
    rec.onresult = (e) => {
      let currentFinal = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const resItem = e.results[i];
        const seg = resItem[0]?.transcript || '';
        if (!seg) continue;
        if (resItem.isFinal) {
          currentFinal += (currentFinal ? ' ' : '') + seg;
        } else {
          interim += (interim ? ' ' : '') + seg;
        }
      }
      sessionFinal = currentFinal;
      const combined = [finalizedTranscriptRef.current, sessionFinal, interim]
        .filter(Boolean)
        .join(' ')
        .trim();
      transcriptRef.current = combined;
      setLiveTranscript(combined);
    };

    rec.onerror = (ev) => {
      // On mobile browsers where getUserMedia holds hardware focus, don't infinite-restart SpeechRec
      if (
        ev.error === 'audio-capture' ||
        ev.error === 'not-allowed' ||
        ev.error === 'service-not-allowed'
      ) {
        speechFailedRef.current = true;
      }
    };

    rec.onend = () => {
      if (sessionFinal) {
        finalizedTranscriptRef.current = [
          finalizedTranscriptRef.current,
          sessionFinal,
        ]
          .filter(Boolean)
          .join(' ')
          .trim();
      }
      if (isRecordingRef.current && !speechFailedRef.current) {
        window.setTimeout(() => {
          if (isRecordingRef.current && !speechFailedRef.current) {
            startSpeechRecognitionSession();
          }
        }, 180);
      }
    };

    try {
      recRef.current = rec;
      rec.start();
    } catch {
      speechFailedRef.current = true;
    }
  };

  const startRecording = async () => {
    setMicNote(null);
    setLiveTranscript('');
    finalizedTranscriptRef.current = '';
    transcriptRef.current = '';
    setElapsedSec(0);
    setOutcome(null);
    setWordCorrectionInfo(null);
    speechFailedRef.current = false;
    isRecordingRef.current = true;

    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
        if (typeof MediaRecorder !== 'undefined') {
          audioChunksRef.current = [];
          const preferredMime = MediaRecorder.isTypeSupported?.(
            'audio/webm;codecs=opus',
          )
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported?.('audio/mp4')
              ? 'audio/mp4'
              : '';
          const recorder = preferredMime
            ? new MediaRecorder(stream, {mimeType: preferredMime})
            : new MediaRecorder(stream);
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              audioChunksRef.current.push(ev.data);
            }
          };
          mediaRecorderRef.current = recorder;
          recorder.start(250);
        }
      }
    } catch {
      setMicNote('يرجى السماح بصلاحية الميكروفون من المتصفح لتسجيل صوتك');
    }

    startSpeechRecognitionSession();
    setPhase('recording');
  };

  const handleFinishRecording = async () => {
    isRecordingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }

    setPhase('analyzing');

    // Finalize recorded audio blob cleanly
    const recordedBlob: Blob | null = await new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        const mimeType = recorder.mimeType || 'audio/webm';
        recorder.onstop = () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          if (audioChunksRef.current.length > 0) {
            resolve(new Blob(audioChunksRef.current, {type: mimeType}));
          } else {
            resolve(null);
          }
        };
        recorder.stop();
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioChunksRef.current.length > 0) {
          resolve(new Blob(audioChunksRef.current, {type: 'audio/webm'}));
        } else {
          resolve(null);
        }
      }
    });

    if (recordedBlob && recordedBlob.size > 0) {
      const url = URL.createObjectURL(recordedBlob);
      setRecordedAudioUrl(url);
    }

    let finalText = (transcriptRef.current || liveTranscript).trim();

    // Always try server-side high-accuracy Quran transcription when online & we have recorded audio
    // especially critical on mobile browsers where SpeechRecognition conflicts with MediaRecorder
    if (
      recordedBlob &&
      recordedBlob.size > 400 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      try {
        const audioBase64 = await blobToBase64(recordedBlob);
        if (audioBase64) {
          const resp = await fetch('/api/transcribe-quran', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              audioBase64,
              mimeType: recordedBlob.type || 'audio/webm',
            }),
          });
          if (resp.ok) {
            const json = (await resp.json()) as {
              ok?: boolean;
              text?: string;
            };
            if (json.ok && json.text && json.text.trim().length > 0) {
              finalText = json.text.trim();
            }
          }
        }
      } catch {
        // Fall back smoothly to local transcript
      }
    }

    setLastRecognizedText(finalText);
    setAttemptNum((c) => c + 1);

    if (surahs && surahs.length > 0 && finalText) {
      const detected = detectSurahAndEvaluate(surahs, finalText);
      setOutcome(detected);
    } else {
      setOutcome(null);
    }
    setPhase('result');
  };

  const evaluateManualSurahChoice = (surahNum: number) => {
    if (!surahs) return;
    const surah = surahs.find((s) => s.n === surahNum);
    if (!surah) return;
    setManualSurahNum(surahNum);
    setAttemptNum((c) => c + 1);
    const endIdx = Math.min(surah.ayahs.length - 1, 6);
    const rawTokens = lastRecognizedText
      .trim()
      .split(/\s+/)
      .map((w) => ({raw: w, norm: normalizeQuranWord(w)}))
      .filter((w) => w.norm.length > 0);
    setOutcome(buildOutcomeForAyahRange(surah, 0, endIdx, rawTokens, 0));
  };

  const handleReset = () => {
    isRecordingRef.current = false;
    speechFailedRef.current = false;
    userAudioRef.current?.pause();
    sheikhAudioRef.current?.pause();
    setIsPlayingUserClip(false);
    setPlayingSheikhAyahId(null);
    setWordCorrectionInfo(null);
    setPhase('ready');
    setOutcome(null);
    setLiveTranscript('');
    setLastRecognizedText('');
    finalizedTranscriptRef.current = '';
    transcriptRef.current = '';
    setElapsedSec(0);
  };

  const togglePlaySheikhAyah = (
    surahNum: number,
    ayahNum: number,
    ayahId: number,
    forcePlay = false,
  ) => {
    if (!sheikhAudioRef.current) {
      sheikhAudioRef.current = new Audio();
    }
    const audio = sheikhAudioRef.current;
    if (!forcePlay && playingSheikhAyahId === ayahId) {
      audio.pause();
      setPlayingSheikhAyahId(null);
      return;
    }
    userAudioRef.current?.pause();
    setIsPlayingUserClip(false);

    audio.pause();
    audio.currentTime = 0;
    audio.src = getAyahAudioUrl(selectedReciter, surahNum, ayahNum);
    setPlayingSheikhAyahId(ayahId);
    audio.onended = () => setPlayingSheikhAyahId(null);
    audio.onerror = () => setPlayingSheikhAyahId(null);
    audio.play().catch(() => setPlayingSheikhAyahId(null));
  };

  const handleTapWrongWord = (
    surahNum: number,
    ayahNum: number,
    ayahId: number,
    expectedWord: string,
    spokenWord: string | null,
    hint: string | null,
  ) => {
    setWordCorrectionInfo({
      ayahId,
      ayahNum,
      expectedWord,
      spokenWord,
      hint,
    });
    togglePlaySheikhAyah(surahNum, ayahNum, ayahId, true);
  };

  const toggleUserRecording = () => {
    if (!recordedAudioUrl) return;
    if (!userAudioRef.current) {
      userAudioRef.current = new Audio();
    }
    const audio = userAudioRef.current;
    if (isPlayingUserClip) {
      audio.pause();
      setIsPlayingUserClip(false);
      return;
    }
    sheikhAudioRef.current?.pause();
    setPlayingSheikhAyahId(null);
    audio.src = recordedAudioUrl;
    setIsPlayingUserClip(true);
    audio.onended = () => setIsPlayingUserClip(false);
    audio.play().catch(() => setIsPlayingUserClip(false));
  };

  const feedback = useMemo(() => {
    if (!outcome) return null;
    const tier =
      outcome.accuracyPercent >= 85
        ? 'high'
        : outcome.accuracyPercent >= 55
          ? 'good'
          : outcome.accuracyPercent >= 25
            ? 'mid'
            : 'retry';
    const pool = ENCOURAGEMENT_POOLS[tier];
    const picked = pool[attemptNum % pool.length];
    const tone: 'emerald' | 'gold' | 'amber' =
      tier === 'high' ? 'emerald' : tier === 'good' ? 'gold' : 'amber';
    return {...picked, tone};
  }, [outcome, attemptNum]);

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <Mic className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#FCE38A]">
              سجّل صوتك واختبر قراءتك
            </h2>
            <p className="text-[11px] text-zinc-300">
              اقرأ أي آية من أي سورة — يعرض لك السورة والصفحة بالمصحف والصح والغلط مع سماع التصحيح
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#FCE38A]">
            <UserCheck className="h-4 w-4 text-[#C9A227]" />
            <span>الشيخ للتصحيح وسماع النطق الصحيح:</span>
          </div>
          <select
            aria-label="اختيار الشيخ للتصحيح"
            value={selectedReciter}
            onChange={(e) => setSelectedReciter(e.target.value as ReciterId)}
            className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
          >
            {RECITERS_30.map((r) => (
              <option key={r.id} value={r.id}>
                الشيخ {r.nameAr} — {r.styleAr}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loadingQuran ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-8 text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A227]" />
          <p className="mt-2 text-xs font-bold text-[#FCE38A]">
            جاري تجهيز المصحف الكامل للتعرف على تلاوتك...
          </p>
        </div>
      ) : phase === 'ready' ? (
        <section className="flex flex-col items-center rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-6 text-center text-white">
          <button
            type="button"
            onClick={() => void startRecording()}
            className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full border-4 border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black shadow-[0_0_40px_rgba(201,162,39,0.45)] active:scale-95"
          >
            <Mic className="h-12 w-12 stroke-[2.4]" />
            <span className="text-xl font-extrabold leading-tight">
              ابدأ التسجيل
            </span>
            <span className="text-[11px] font-bold text-black/80">
              اقرأ أي آيات تحبها
            </span>
          </button>

          <p className="mt-4 text-xs leading-relaxed text-zinc-300">
            اضغط «ابدأ التسجيل» واقرأ ما تحفظ من المصحف ثم اضغط «إنهاء» —
            سيعرض لك تسجيلك، السورة، رقم الصفحة، والآيات كما في المصحف بالظبط.
          </p>
        </section>
      ) : phase === 'recording' ? (
        <section className="flex flex-col items-center space-y-4 rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-5 text-center text-white">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-950/40 px-4 py-1.5 text-xs font-bold text-emerald-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            <span>جاري تسجيل صوتك · {formatTimerMMSS(elapsedSec)}</span>
          </div>

          <div className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full border-4 border-[#FCE38A] bg-[#C9A227]/20 text-[#FCE38A]">
            <Mic className="h-12 w-12" />
          </div>

          <div className="min-h-[76px] w-full rounded-2xl border border-[#C9A227]/45 bg-black p-3 text-right">
            <p className="text-[10px] font-bold text-[#C9A227]">
              ما يُلتقط الآن:
            </p>
            <p className="font-quran mt-1 text-base leading-relaxed text-white">
              {liveTranscript || 'تفضل بالقراءة بتأنٍ ووضوح...'}
            </p>
          </div>

          {micNote && <p className="text-xs text-[#FCE38A]">{micNote}</p>}

          <button
            type="button"
            onClick={() => void handleFinishRecording()}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-base font-extrabold text-black"
          >
            <Square className="h-5 w-5 fill-current" />
            <span>إنهاء</span>
          </button>
        </section>
      ) : phase === 'analyzing' ? (
        <section className="flex flex-col items-center space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-8 text-center text-white">
          <Loader2 className="h-10 w-10 animate-spin text-[#FCE38A]" />
          <p className="text-sm font-extrabold text-[#FCE38A]">
            جاري مطابقة تلاوتك مع المصحف وتحديد السورة والصفحة...
          </p>
          <p className="text-xs text-zinc-400">
            لحظات قليلة وتظهر النتيجة والتصحيح الكامل
          </p>
        </section>
      ) : (
        /* RESULTS SCREEN */
        <div className="space-y-4">
          {/* 1. User's Recorded Clip Player */}
          <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#0A0904] p-4 text-white">
            <h4 className="text-sm font-bold text-[#FCE38A]">
              تسجيل صوتك (استمع لقراءتك الآن)
            </h4>
            {recordedAudioUrl ? (
              <div className="space-y-2.5">
                <audio
                  controls
                  src={recordedAudioUrl}
                  className="h-10 w-full rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleUserRecording}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-extrabold text-black"
                  >
                    {isPlayingUserClip ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span>
                      {isPlayingUserClip ? 'إيقاف صوتي' : 'تشغيل صوتي'}
                    </span>
                  </button>

                  <a
                    href={recordedAudioUrl}
                    download="my-quran-recitation.webm"
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black text-xs font-bold text-[#FCE38A]"
                  >
                    <Download className="h-4 w-4" />
                    <span>حفظ التسجيل</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-300">
                انتهى التسجيل — راجع النتيجة وتلاوة المصحف أدناه.
              </p>
            )}
          </section>

          {outcome ? (
            <>
              {/* 2. Detected Surah + Ayah Range + Mushaf Page + Varied Encouraging Message */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-center text-white">
                <div className="flex items-center justify-center gap-2">
                  <Award className="h-6 w-6 shrink-0 text-[#FCE38A]" />
                  <div>
                    <h3 className="font-quran text-2xl font-bold text-[#FCE38A]">
                      {outcome.surah.name}
                    </h3>
                    <p className="text-xs font-bold text-[#C9A227]">
                      {outcome.evaluatedAyahs.length === 1
                        ? `الآية ${toArabicDigits(outcome.evaluatedAyahs[0].ayah.n)}`
                        : `من الآية ${toArabicDigits(outcome.evaluatedAyahs[0].ayah.n)} إلى الآية ${toArabicDigits(outcome.evaluatedAyahs[outcome.evaluatedAyahs.length - 1].ayah.n)}`}{' '}
                      ·{' '}
                      <span className="text-[#FCE38A]">
                        {outcome.pageLabel}
                      </span>
                    </p>
                  </div>
                </div>

                {feedback && (
                  <div
                    className={`rounded-2xl border p-3.5 text-sm leading-relaxed ${
                      feedback.tone === 'emerald'
                        ? 'border-emerald-500/60 bg-emerald-950/35 text-emerald-200'
                        : feedback.tone === 'gold'
                          ? 'border-[#C9A227] bg-[#141004] text-[#FCE38A]'
                          : 'border-amber-500/60 bg-amber-950/30 text-amber-200'
                    }`}
                  >
                    <p className="text-base font-extrabold">
                      {feedback.headline}
                    </p>
                    <p className="mt-1 text-xs font-semibold">
                      {feedback.message}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-2.5">
                    <span className="text-[11px] text-zinc-300">كلمات صح</span>
                    <p className="font-mono-num text-lg font-extrabold text-emerald-400">
                      {toArabicDigits(outcome.totalCorrectWords)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-2.5">
                    <span className="text-[11px] text-zinc-300">كلمات غلط</span>
                    <p className="font-mono-num text-lg font-extrabold text-rose-400">
                      {toArabicDigits(outcome.totalWrongWords)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#C9A227]/40 bg-[#141004] p-2.5">
                    <span className="text-[11px] text-zinc-300">نسبة الدقة</span>
                    <p className="font-mono-num text-lg font-extrabold text-[#FCE38A]">
                      {toArabicDigits(outcome.accuracyPercent)}٪
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. MUSHAF-STYLE FLOWING AYAH DISPLAY WITH CLICKABLE RED WORDS & GOLDEN VERSE CIRCLES */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#070501] p-4 text-white">
                <div className="flex items-center justify-between border-b border-[#C9A227]/35 pb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#FCE38A]">
                    <BookOpen className="h-4 w-4 text-[#C9A227]" />
                    <span>
                      {outcome.surah.name} — {outcome.pageLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      togglePlaySheikhAyah(
                        outcome.surah.n,
                        outcome.evaluatedAyahs[0].ayah.n,
                        outcome.evaluatedAyahs[0].ayah.id,
                      )
                    }
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#C9A227] bg-black px-2.5 text-[11px] font-bold text-[#FCE38A]"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-[#C9A227]" />
                    <span>اسمع من {activeSheikh.shortNameAr}</span>
                  </button>
                </div>

                {/* Flowing RTL Mushaf Layout */}
                <div
                  dir="rtl"
                  className="font-quran rounded-2xl border border-[#C9A227]/45 bg-[#020202] p-4 text-right text-xl leading-[2.45]"
                >
                  {outcome.evaluatedAyahs.map((item) => (
                    <React.Fragment key={item.ayah.id}>
                      {item.wordResults.map((w, wIdx) =>
                        w.isMatch ? (
                          <span
                            key={`${item.ayah.id}-${wIdx}`}
                            className="text-emerald-200"
                          >
                            {w.raw}{' '}
                          </span>
                        ) : (
                          <button
                            key={`${item.ayah.id}-${wIdx}`}
                            type="button"
                            onClick={() =>
                              handleTapWrongWord(
                                outcome.surah.n,
                                item.ayah.n,
                                item.ayah.id,
                                w.raw,
                                w.spokenWord,
                                w.hint,
                              )
                            }
                            className="mx-0.5 inline-flex items-center gap-0.5 rounded-md border-b-2 border-rose-500 bg-rose-500/20 px-1 text-rose-300 active:scale-95"
                          >
                            <span>{w.raw}</span>
                          </button>
                        ),
                      )}
                      {/* Authentic Golden Circular Verse Number Badge ﴿١﴾ */}
                      <button
                        type="button"
                        onClick={() =>
                          togglePlaySheikhAyah(
                            outcome.surah.n,
                            item.ayah.n,
                            item.ayah.id,
                          )
                        }
                        aria-label={`استماع للآية ${item.ayah.n}`}
                        className={`mx-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-extrabold align-middle ${
                          playingSheikhAyahId === item.ayah.id
                            ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                            : 'border-[#C9A227] bg-[#141004] text-[#FCE38A]'
                        }`}
                      >
                        {toArabicDigits(item.ayah.n)}
                      </button>{' '}
                    </React.Fragment>
                  ))}
                </div>

                {wordCorrectionInfo && (
                  <div className="rounded-2xl border-2 border-[#FCE38A] bg-[#141004] p-3 text-xs">
                    <p className="font-extrabold text-[#FCE38A]">
                      {wordCorrectionInfo.spokenWord
                        ? `غلطت في «${wordCorrectionInfo.spokenWord}» ← والصح «${wordCorrectionInfo.expectedWord}»`
                        : `الكلمة الصحيحة هي «${wordCorrectionInfo.expectedWord}» (الآية ${toArabicDigits(wordCorrectionInfo.ayahNum)})`}
                    </p>
                    {wordCorrectionInfo.hint && (
                      <p className="mt-1 text-[11px] text-rose-300">
                        {wordCorrectionInfo.hint}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-300">
                      جاري تشغيل النطق الصحيح للآية بصوت الشيخ{' '}
                      {activeSheikh.shortNameAr}...
                    </p>
                  </div>
                )}
              </section>

              {/* 4. EXPLICIT MISTAKE BREAKDOWN: انت غلطت في كذا والصح كذا */}
              <section className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#FCE38A]">
                  <Sparkles className="h-4 w-4 text-[#C9A227]" />
                  <span>التفصيل الدقيق (ما قرأته صح وما يحتاج تصحيحًا):</span>
                </div>

                {outcome.mistakesList.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/50 bg-emerald-950/30 p-3 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>
                      ممتاز! لم تُرصد أي أخطاء في الآيات المقروءة — بارك الله في قراءتك.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outcome.mistakesList.slice(0, 12).map((m, idx) => (
                      <div
                        key={`${m.ayahId}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/40 bg-[#120505] px-3 py-2.5 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-bold text-rose-200">
                            الآية {toArabicDigits(m.ayahNum)}:{' '}
                            {m.spokenWord ? (
                              <>
                                غلطت في{' '}
                                <span className="text-rose-400 underline">
                                  «{m.spokenWord}»
                                </span>{' '}
                                ← والصح{' '}
                                <span className="text-[#FCE38A]">
                                  «{m.expectedWord}»
                                </span>
                              </>
                            ) : (
                              <>
                                نسيت كلمة{' '}
                                <span className="text-[#FCE38A]">
                                  «{m.expectedWord}»
                                </span>
                              </>
                            )}
                          </p>
                          {m.hint && (
                            <p className="text-[10px] text-zinc-400">{m.hint}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleTapWrongWord(
                              outcome.surah.n,
                              m.ayahNum,
                              m.ayahId,
                              m.expectedWord,
                              m.spokenWord,
                              m.hint,
                            )
                          }
                          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl bg-[#C9A227] px-2.5 text-[11px] font-extrabold text-black"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>اسمع الصح</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            /* Friendly Surah Selector when audio was recorded silently or speech recognition was unavailable */
            <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
              <div className="space-y-1 text-center">
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  تم حفظ صوتك! اختر السورة التي قرأتها للمراجعة الفورية
                </h3>
                <p className="text-[11px] text-zinc-300">
                  استمع لتسجيلك أعلاه واضغط على السورة لعرض المصحف كاملًا والتصحيح بصوت الشيخ
                </p>
              </div>

              {surahs && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_SURAHS_PICKS.map((sNum) => {
                      const sObj = surahs.find((x) => x.n === sNum);
                      if (!sObj) return null;
                      return (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => evaluateManualSurahChoice(sNum)}
                          className="min-h-[36px] rounded-xl border border-[#C9A227]/60 bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                        >
                          {sObj.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <select
                      aria-label="اختر السورة للمراجعة"
                      value={manualSurahNum}
                      onChange={(e) => setManualSurahNum(Number(e.target.value))}
                      className="min-h-[40px] flex-1 rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
                    >
                      {surahs.map((s) => (
                        <option key={s.n} value={s.n}>
                          {s.n}. {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => evaluateManualSurahChoice(manualSurahNum)}
                      className="min-h-[40px] rounded-xl bg-[#C9A227] px-4 text-xs font-extrabold text-black"
                    >
                      عرض ومراجعة
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-sm font-extrabold text-black"
          >
            <RotateCcw className="h-4 w-4" />
            <span>جرّب تسجيلًا جديدًا</span>
          </button>
        </div>
      )}
    </div>
  );
};
