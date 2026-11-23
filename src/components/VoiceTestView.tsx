import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Award,
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
  XCircle,
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

interface EvaluatedAyahResult {
  ayah: CompactAyah;
  wordResults: Array<{
    raw: string;
    isMatch: boolean;
    hint: string | null;
  }>;
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
}

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

  const spokenNormSet = new Set(rawTokens.map((t) => t.norm));
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
      for (const forms of tokenFormsList) {
        if (forms.some((f) => spokenNormSet.has(f))) {
          wordHits += 1;
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

      const ratio = wordHits / tokens.length;
      const ayahScore =
        wordHits * 1.5 + bigramHits * 5 + (ratio >= 0.45 ? 4 : 0);

      if (
        (wordHits >= 2 || bigramHits >= 1 || (tokens.length <= 3 && wordHits >= 1)) &&
        ayahScore > 2
      ) {
        matchedRows.push({idx, score: ayahScore});
      }
    }

    if (matchedRows.length === 0) continue;

    // Group nearby matched ayahs into contiguous runs (gap <= 2) so distant false matches never span dozens of ayahs
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

  // Align spokenCursor to where the first matched ayah starts inside rawTokens
  const firstTokens = getAyahEffectiveTokens(
    bestSurah.n,
    bestSurah.ayahs[minIdx].n,
    bestSurah.ayahs[minIdx].t,
    spokenNormSet,
  );
  const firstTokenForms = firstTokens.slice(0, 3).flatMap(getNormalizedTokenForms);
  let spokenCursor = 0;
  for (let i = 0; i < rawTokens.length; i++) {
    if (firstTokenForms.includes(rawTokens[i].norm)) {
      spokenCursor = i;
      break;
    }
  }

  const targetAyahs = bestSurah.ayahs.slice(minIdx, maxIdx + 1);
  const evaluatedAyahs: EvaluatedAyahResult[] = [];
  let totalCorrectWords = 0;
  let totalWrongWords = 0;
  let correctAyahsCount = 0;
  let wrongAyahsCount = 0;

  for (const ayah of targetAyahs) {
    const tokens = getAyahEffectiveTokens(
      bestSurah.n,
      ayah.n,
      ayah.t,
      spokenNormSet,
    );
    const wordResults: EvaluatedAyahResult['wordResults'] = [];
    let ayahCorrect = 0;
    let ayahWrong = 0;

    for (const tok of tokens) {
      let matched = false;
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
          mistakeHint =
            check.wrongLetterHint || `نطقت «${candidateSpoken.raw}»`;
          spokenCursor += 1;
        } else {
          mistakeHint = 'كلمة لم تُنطق أو سقطت أثناء القراءة';
        }
      }

      if (matched) {
        ayahCorrect += 1;
        totalCorrectWords += 1;
      } else {
        ayahWrong += 1;
        totalWrongWords += 1;
      }

      wordResults.push({
        raw: tok.raw,
        isMatch: matched,
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

  return {
    surah: bestSurah,
    evaluatedAyahs,
    totalCorrectWords,
    totalWrongWords,
    correctAyahsCount,
    wrongAyahsCount,
    accuracyPercent,
  };
}

function getEncouragingFeedback(accuracyPercent: number): {
  headline: string;
  message: string;
  tone: 'emerald' | 'gold' | 'amber';
} {
  if (accuracyPercent >= 85) {
    return {
      headline: 'أحسنت ما شاء الله!',
      message:
        'تلاوة متقنة وصوت مبارك — حافظ على هذا المستوى الرائع وزادك الله نورًا بالقرآن.',
      tone: 'emerald',
    };
  }
  if (accuracyPercent >= 55) {
    return {
      headline: 'ممتاز، قرّبت جدًا من الإتقان!',
      message:
        'أداء جميل وباقي كلمات بسيطة — اضغط على أي كلمة حمراء لتسمع نطقها الصحيح بصوت الشيخ.',
      tone: 'gold',
    };
  }
  if (accuracyPercent >= 25) {
    return {
      headline: 'بداية طيبة وقرّبت!',
      message:
        'لا تتوقف، اضغط على الكلمات الحمراء اسمعها صح وكرّر القراءة، أنت قدّها بإذن الله.',
      tone: 'amber',
    };
  }
  return {
    headline: 'حاول تاني أنت قدّها!',
    message:
      'استمع للشيخ آية بآية واضغط على الكلمات الحمراء لتسمع النطق الصحيح ثم أعد التسجيل.',
    tone: 'amber',
  };
}

export const VoiceTestView: React.FC<VoiceTestViewProps> = ({
  preferredReciter,
}) => {
  const [surahs, setSurahs] = useState<CompactSurah[] | null>(null);
  const [loadingQuran, setLoadingQuran] = useState(true);
  const [selectedReciter, setSelectedReciter] =
    useState<ReciterId>(preferredReciter);

  const [phase, setPhase] = useState<'ready' | 'recording' | 'result'>('ready');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [micNote, setMicNote] = useState<string | null>(null);

  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserClip, setIsPlayingUserClip] = useState(false);
  const [playingSheikhAyahId, setPlayingSheikhAyahId] = useState<number | null>(
    null,
  );
  const [wordCorrectionInfo, setWordCorrectionInfo] = useState<{
    ayahId: number;
    expectedWord: string;
    hint: string | null;
  } | null>(null);
  const [outcome, setOutcome] = useState<DetectionOutcome | null>(null);

  const recRef = useRef<SpeechRecLike | null>(null);
  const isRecordingRef = useRef(false);
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
    if (!SpeechRec || !isRecordingRef.current) return;

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

    rec.onerror = () => {
      // Keep audio recording going smoothly
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
      if (isRecordingRef.current) {
        window.setTimeout(() => {
          if (isRecordingRef.current) {
            startSpeechRecognitionSession();
          }
        }, 120);
      }
    };

    try {
      recRef.current = rec;
      rec.start();
    } catch {
      // ignore restart race
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
    isRecordingRef.current = true;

    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        streamRef.current = stream;
        if (typeof MediaRecorder !== 'undefined') {
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              audioChunksRef.current.push(ev.data);
            }
          };
          recorder.onstop = () => {
            if (audioChunksRef.current.length > 0) {
              const blob = new Blob(audioChunksRef.current, {
                type: recorder.mimeType || 'audio/webm',
              });
              const url = URL.createObjectURL(blob);
              setRecordedAudioUrl(url);
            }
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          };
          mediaRecorderRef.current = recorder;
          recorder.start();
        }
      }
    } catch {
      setMicNote(
        'تعذر الوصول لمسجل الصوت — تأكد من إذن الميكروفون أو اكتب ما قرأته للمراجعة',
      );
    }

    startSpeechRecognitionSession();
    setPhase('recording');
  };

  const handleFinishRecording = () => {
    isRecordingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const textToEval = (
      transcriptRef.current ||
      liveTranscript ||
      manualText
    ).trim();
    if (surahs && surahs.length > 0) {
      const detected = detectSurahAndEvaluate(surahs, textToEval);
      setOutcome(detected);
    }
    setPhase('result');
  };

  const handleReset = () => {
    isRecordingRef.current = false;
    userAudioRef.current?.pause();
    sheikhAudioRef.current?.pause();
    setIsPlayingUserClip(false);
    setPlayingSheikhAyahId(null);
    setWordCorrectionInfo(null);
    setPhase('ready');
    setOutcome(null);
    setLiveTranscript('');
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
    hint: string | null,
  ) => {
    setWordCorrectionInfo({
      ayahId,
      expectedWord,
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

  const feedback = outcome
    ? getEncouragingFeedback(outcome.accuracyPercent)
    : null;

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <Mic className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#FCE38A]">
              سجّل صوتك واختبر تلاوتك الحرة
            </h2>
            <p className="text-[11px] text-zinc-300">
              اقرأ أي آية من أي سورة في المصحف — يتعرف التطبيق على الآيات ويصححها ويحفظ تسجيلك بصوتك
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#FCE38A]">
            <UserCheck className="h-4 w-4 text-[#C9A227]" />
            <span>الشيخ للمقارنة والتصحيح (30 قارئًا):</span>
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
            جاري تجهيز المصحف للتعرف التلقائي على تلاوتك...
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
              اقرأ أي آية من أي سورة
            </span>
          </button>

          <p className="mt-4 text-xs leading-relaxed text-zinc-300">
            اضغط «ابدأ التسجيل» واقرأ ما تشاء من القرآن الكريم، وعند الضغط على «إنهاء»
            سيُظهر لك تسجيلك الصوتي، السورة والآيات التي قرأتها، والصح والغلط مع سماع التصحيح.
          </p>

          <div className="mt-4 w-full space-y-2 border-t border-[#C9A227]/30 pt-3 text-right">
            <label
              htmlFor="manual-voice-test"
              className="block text-[11px] font-bold text-[#C9A227]"
            >
              أو اكتب ما قرأته لاختبار التعرف الفوري:
            </label>
            <div className="flex gap-2">
              <input
                id="manual-voice-test"
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="مثال: قل هو الله أحد الله الصمد..."
                className="min-h-[38px] flex-1 rounded-xl border border-[#C9A227]/50 bg-black px-3 text-xs text-white outline-none focus:border-[#C9A227]"
              />
              <button
                type="button"
                disabled={!manualText.trim()}
                onClick={() => {
                  if (surahs) {
                    setOutcome(detectSurahAndEvaluate(surahs, manualText));
                    setPhase('result');
                  }
                }}
                className="rounded-xl bg-[#C9A227] px-3 text-xs font-extrabold text-black disabled:opacity-40"
              >
                فحص
              </button>
            </div>
          </div>
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
              ما يُلتقط من تلاوتك الآن:
            </p>
            <p className="font-quran mt-1 text-base leading-relaxed text-white">
              {liveTranscript || 'اقرأ الآن بوضوح وتمهل...'}
            </p>
          </div>

          {micNote && <p className="text-xs text-rose-400">{micNote}</p>}

          <button
            type="button"
            onClick={handleFinishRecording}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-base font-extrabold text-black"
          >
            <Square className="h-5 w-5 fill-current" />
            <span>إنهاء</span>
          </button>
        </section>
      ) : (
        /* RESULTS SCREEN */
        <div className="space-y-4">
          {/* Recorded User Audio Clip Player First so user immediately hears their recording */}
          <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#0A0904] p-4 text-white">
            <h4 className="text-sm font-bold text-[#FCE38A]">
              تسجيل صوتك الآن (استمع لتلاوتك)
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
              <p className="text-xs text-zinc-400">
                سجّل بالميكروفون لسماع مقطعك الصوتي هنا.
              </p>
            )}
          </section>

          {outcome ? (
            <>
              {/* Detected Surah, Exact Ayah Range & Encouraging Feedback Banner */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-center text-white">
                <div className="flex items-center justify-center gap-2">
                  <Award className="h-6 w-6 text-[#FCE38A]" />
                  <div>
                    <h3 className="font-quran text-xl font-bold text-[#FCE38A]">
                      {outcome.surah.name}
                    </h3>
                    <p className="text-xs font-bold text-[#C9A227]">
                      {outcome.evaluatedAyahs.length === 1
                        ? `الآية ${toArabicDigits(outcome.evaluatedAyahs[0].ayah.n)}`
                        : `من الآية ${toArabicDigits(outcome.evaluatedAyahs[0].ayah.n)} إلى الآية ${toArabicDigits(outcome.evaluatedAyahs[outcome.evaluatedAyahs.length - 1].ayah.n)}`}
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

              {/* Word-by-word & Ayah-by-ayah Analysis with Clickable Red Words */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#FCE38A]">
                  <Sparkles className="h-4 w-4 text-[#C9A227]" />
                  <span>
                    اضغط على أي كلمة حمراء لتسمع نطقها الصحيح بصوت الشيخ{' '}
                    {activeSheikh.shortNameAr}:
                  </span>
                </h4>

                {outcome.evaluatedAyahs.map((item) => {
                  const isPlayingThis = playingSheikhAyahId === item.ayah.id;
                  const activeCorrection =
                    wordCorrectionInfo?.ayahId === item.ayah.id
                      ? wordCorrectionInfo
                      : null;
                  return (
                    <div
                      key={item.ayah.id}
                      className={`space-y-2.5 rounded-2xl border p-3.5 ${
                        item.isAyahCorrect
                          ? 'border-emerald-500/50 bg-[#04120A]'
                          : 'border-rose-500/50 bg-[#120505]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            item.isAyahCorrect
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {item.isAyahCorrect ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          <span>
                            الآية {toArabicDigits(item.ayah.n)} —{' '}
                            {item.isAyahCorrect
                              ? 'قراءة صحيحة'
                              : 'اضغط على الكلمة الحمراء لسماع الصحيح'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            togglePlaySheikhAyah(
                              outcome.surah.n,
                              item.ayah.n,
                              item.ayah.id,
                            )
                          }
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#C9A227] bg-black px-2.5 text-[11px] font-bold text-[#FCE38A]"
                        >
                          {isPlayingThis ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlayingThis ? 'إيقاف' : 'اسمع الآية'}</span>
                        </button>
                      </div>

                      <div className="font-quran flex flex-wrap gap-1.5 text-lg leading-loose">
                        {item.wordResults.map((w, wIdx) =>
                          w.isMatch ? (
                            <span
                              key={wIdx}
                              className="rounded-lg bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300"
                            >
                              {w.raw}
                            </span>
                          ) : (
                            <button
                              key={wIdx}
                              type="button"
                              onClick={() =>
                                handleTapWrongWord(
                                  outcome.surah.n,
                                  item.ayah.n,
                                  item.ayah.id,
                                  w.raw,
                                  w.hint,
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/70 bg-rose-500/25 px-1.5 py-0.5 text-rose-200 underline decoration-rose-400 active:scale-95"
                            >
                              <span>{w.raw}</span>
                              <Volume2 className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                            </button>
                          ),
                        )}
                      </div>

                      {activeCorrection && (
                        <div className="rounded-xl border border-[#C9A227]/60 bg-black/80 px-3 py-2 text-xs">
                          <p className="font-bold text-[#FCE38A]">
                            الكلمة الصحيحة: «{activeCorrection.expectedWord}» — جاري تشغيل النطق الصحيح بصوت الشيخ {activeSheikh.shortNameAr}
                          </p>
                          {activeCorrection.hint && (
                            <p className="mt-0.5 text-[11px] text-rose-300">
                              {activeCorrection.hint}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            </>
          ) : (
            <div className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-5 text-center text-white">
              <p className="text-sm font-bold text-[#FCE38A]">
                حاول تاني! لم يتم التقاط كلمات قرآنية واضحة للتعرف على السورة — اقرأ بصوت أوضح أو استمع لتسجيلك أعلاه.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-sm font-extrabold text-black"
          >
            <RotateCcw className="h-4 w-4" />
            <span>جرّب تلاوة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
};
