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
}

function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function formatTimerMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  let bestMatchedAyahIndices: number[] = [];

  for (const surah of surahs) {
    let surahScore = 0;
    const matchedIndices: number[] = [];

    for (let idx = 0; idx < surah.ayahs.length; idx++) {
      const ayah = surah.ayahs[idx];
      const tokens = tokenizeArabicAyah(ayah.t);
      if (tokens.length === 0) continue;

      let wordHits = 0;
      for (const tok of tokens) {
        if (spokenNormSet.has(tok.norm)) {
          wordHits += 1;
        }
      }

      let bigramHits = 0;
      for (let i = 0; i < tokens.length - 1; i++) {
        if (spokenBigrams.has(`${tokens[i].norm}|${tokens[i + 1].norm}`)) {
          bigramHits += 1;
        }
      }

      const ratio = wordHits / tokens.length;
      const ayahScore = wordHits * 1.5 + bigramHits * 4 + (ratio >= 0.45 ? 3 : 0);
      if (wordHits >= 2 || bigramHits >= 1 || (tokens.length <= 3 && wordHits >= 1)) {
        if (ayahScore > 2) {
          matchedIndices.push(idx);
          surahScore += ayahScore;
        }
      }
    }

    if (surahScore > bestScore && matchedIndices.length > 0) {
      bestScore = surahScore;
      bestSurah = surah;
      bestMatchedAyahIndices = matchedIndices;
    }
  }

  if (bestMatchedAyahIndices.length === 0) {
    // Fallback to Al-Fatihah if unrecognizable
    bestSurah = surahs[0];
    bestMatchedAyahIndices = bestSurah.ayahs.map((_, i) => i);
  }

  const minIdx = Math.max(0, Math.min(...bestMatchedAyahIndices));
  const maxIdx = Math.min(
    bestSurah.ayahs.length - 1,
    Math.max(
      ...bestMatchedAyahIndices,
      minIdx + Math.min(3, bestSurah.ayahs.length - 1 - minIdx),
    ),
  );

  // Evaluate word-by-word greedily across contiguous ayah range
  const targetAyahs = bestSurah.ayahs.slice(minIdx, maxIdx + 1);
  let spokenCursor = 0;
  const evaluatedAyahs: EvaluatedAyahResult[] = [];
  let totalCorrectWords = 0;
  let totalWrongWords = 0;
  let correctAyahsCount = 0;
  let wrongAyahsCount = 0;

  for (const ayah of targetAyahs) {
    const tokens = tokenizeArabicAyah(ayah.t);
    const wordResults: EvaluatedAyahResult['wordResults'] = [];
    let ayahCorrect = 0;
    let ayahWrong = 0;

    for (const tok of tokens) {
      let matched = false;
      let mistakeHint: string | null = null;

      // Look ahead slightly in spoken tokens to align naturally
      const searchEnd = Math.min(rawTokens.length, spokenCursor + 4);
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
          mistakeHint = check.wrongLetterHint;
          spokenCursor += 1;
        } else {
          mistakeHint = 'كلمة ناقصة أو لم تُسمع بوضوح';
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

    const isAyahCorrect = ayahCorrect >= ayahWrong && ayahCorrect > 0;
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

  return {
    surah: bestSurah,
    evaluatedAyahs,
    totalCorrectWords,
    totalWrongWords,
    correctAyahsCount,
    wrongAyahsCount,
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
  const [outcome, setOutcome] = useState<DetectionOutcome | null>(null);

  const recRef = useRef<SpeechRecLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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

  const startRecording = async () => {
    setMicNote(null);
    setLiveTranscript('');
    transcriptRef.current = '';
    setElapsedSec(0);
    setOutcome(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    // 1) Start microphone audio capture (MediaRecorder) so we play user's actual voice at the end
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

    // 2) Start Arabic SpeechRecognition to auto-identify the Surah & evaluate words
    const SpeechRec =
      (window as unknown as {SpeechRecognition?: new () => SpeechRecLike})
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecLike;
        }
      ).webkitSpeechRecognition;

    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = 'ar-SA';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let full = '';
        for (let i = 0; i < e.results.length; i++) {
          const seg = e.results[i][0]?.transcript || '';
          if (seg) full += (full ? ' ' : '') + seg;
        }
        transcriptRef.current = full.trim();
        setLiveTranscript(transcriptRef.current);
      };
      rec.onerror = () => {
        // Keep audio recording going
      };
      try {
        recRef.current = rec;
        rec.start();
      } catch {
        // ignore
      }
    }

    setPhase('recording');
  };

  const handleFinishRecording = () => {
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

    const textToEval = (transcriptRef.current || liveTranscript || manualText).trim();
    if (surahs && surahs.length > 0) {
      const detected = detectSurahAndEvaluate(surahs, textToEval);
      setOutcome(detected);
    }
    setPhase('result');
  };

  const handleReset = () => {
    userAudioRef.current?.pause();
    sheikhAudioRef.current?.pause();
    setIsPlayingUserClip(false);
    setPlayingSheikhAyahId(null);
    setPhase('ready');
    setOutcome(null);
    setLiveTranscript('');
    transcriptRef.current = '';
    setElapsedSec(0);
  };

  const togglePlaySheikhAyah = (surahNum: number, ayahNum: number, ayahId: number) => {
    if (!sheikhAudioRef.current) {
      sheikhAudioRef.current = new Audio();
    }
    const audio = sheikhAudioRef.current;
    if (playingSheikhAyahId === ayahId) {
      audio.pause();
      setPlayingSheikhAyahId(null);
      return;
    }
    userAudioRef.current?.pause();
    setIsPlayingUserClip(false);

    audio.src = getAyahAudioUrl(selectedReciter, surahNum, ayahNum);
    setPlayingSheikhAyahId(ayahId);
    audio.onended = () => setPlayingSheikhAyahId(null);
    audio.onerror = () => setPlayingSheikhAyahId(null);
    audio.play().catch(() => setPlayingSheikhAyahId(null));
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

  const isEncouragingSuccess =
    outcome &&
    outcome.totalCorrectWords >= outcome.totalWrongWords &&
    outcome.totalCorrectWords > 0;

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <Mic className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#FCE38A]">
              اختبر صوتك وتلاوتك الحرة
            </h2>
            <p className="text-[11px] text-zinc-300">
              اقرأ أي سورة تلقائيًا — التطبيق يتعرف على السورة ويصحح الآيات ويحفظ تسجيلك
            </p>
          </div>
        </div>

        {/* 30 Reciters Picker */}
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
              اقرأ أي سورة تحبها
            </span>
          </button>

          <p className="mt-4 text-xs leading-relaxed text-zinc-300">
            اضغط «ابدأ التسجيل» ثم اقرأ من أي سورة؛ وعند الضغط على «إنهاء»
            سيُحدد التطبيق السورة تلقائيًا ويعرض الآيات الصح والغلط مع المقطع
            الصوتي بصوتك.
          </p>

          {/* Optional typed fallback */}
          <div className="mt-4 w-full space-y-2 border-t border-[#C9A227]/30 pt-3 text-right">
            <label
              htmlFor="manual-voice-test"
              className="block text-[11px] font-bold text-[#C9A227]"
            >
              أو اكتب الآية لاختبار المطابقة الفوري بدون ميكروفون:
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
          {outcome ? (
            <>
              {/* Detected Surah & Encouraging Feedback Banner */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-center text-white">
                <div className="flex items-center justify-center gap-2">
                  <Award className="h-6 w-6 text-[#FCE38A]" />
                  <h3 className="font-quran text-xl font-bold text-[#FCE38A]">
                    تم التعرف تلقائيًا: {outcome.surah.name}
                  </h3>
                </div>

                <div
                  className={`rounded-2xl border p-3.5 text-sm font-bold leading-relaxed ${
                    isEncouragingSuccess
                      ? 'border-emerald-500/60 bg-emerald-950/35 text-emerald-300'
                      : 'border-[#C9A227] bg-[#141004] text-[#FCE38A]'
                  }`}
                >
                  {isEncouragingSuccess
                    ? 'ممتاز، كمل! قراءتك جميلة ومبشرة بالخير، استمر في المداومة والتلاوة لتزداد إتقانًا وخشوعًا.'
                    : 'حاول تشتغل على نفسك أكتر، أنت قدها! استمع للشيخ وردد وراءه وسوف تتحسن قراءتك سريعًا بإذن الله.'}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-2.5">
                    <span className="text-zinc-300">الكلمات الصحيحة</span>
                    <p className="font-mono-num text-lg font-extrabold text-emerald-400">
                      {toArabicDigits(outcome.totalCorrectWords)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-2.5">
                    <span className="text-zinc-300">كلمات تحتاج مراجعة</span>
                    <p className="font-mono-num text-lg font-extrabold text-rose-400">
                      {toArabicDigits(outcome.totalWrongWords)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Word-by-word & Ayah-by-ayah Analysis */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#FCE38A]">
                  <Sparkles className="h-4 w-4 text-[#C9A227]" />
                  <span>تفصيل الآيات الصح والغلط (اضغط للاستماع للشيخ {activeSheikh.shortNameAr}):</span>
                </h4>

                {outcome.evaluatedAyahs.map((item) => {
                  const isPlayingThis = playingSheikhAyahId === item.ayah.id;
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
                            {item.isAyahCorrect ? 'آية صحيحة' : 'تحتاج مراجعة'}
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
                          <span>{isPlayingThis ? 'إيقاف' : 'اسمع الشيخ'}</span>
                        </button>
                      </div>

                      <div className="font-quran flex flex-wrap gap-1.5 text-lg leading-loose">
                        {item.wordResults.map((w, wIdx) => (
                          <span
                            key={wIdx}
                            className={`rounded-lg px-1.5 py-0.5 ${
                              w.isMatch
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/25 text-rose-300 underline decoration-rose-400'
                            }`}
                          >
                            {w.raw}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          ) : (
            <div className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-5 text-center text-white">
              <p className="text-sm font-bold text-[#FCE38A]">
                لم يُسمع نص واضح للتعرف على السورة — حاول القراءة بصوت أوضح أو استمع لتسجيلك أدناه.
              </p>
            </div>
          )}

          {/* Recorded User Audio Clip Player */}
          <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#0A0904] p-4 text-white">
            <h4 className="text-sm font-bold text-[#FCE38A]">
              المقطع الصوتي بتاعي بصوتي
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

          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-sm font-extrabold text-black"
          >
            <RotateCcw className="h-4 w-4" />
            <span>اختبار تلاوة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
};
