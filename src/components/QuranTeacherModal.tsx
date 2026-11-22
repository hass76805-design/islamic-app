import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import {getAyahAudioUrl} from '../data/reciters';
import {CompactAyah, CompactSurah, ReciterId} from '../types';
import {
  compareArabicWords,
  tokenizeArabicAyah,
} from '../utils/recitationMatcher';
import {useHardwareBack} from '../utils/backNavigation';

interface AyahEntry {
  surah: CompactSurah;
  ayah: CompactAyah;
}

interface QuranTeacherModalProps {
  entries: AyahEntry[];
  initialIndex?: number;
  preferredReciter: ReciterId;
  onClose: () => void;
}

type WordEvalState = 'pending' | 'correct' | 'wrong';

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: {error: string}) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {transcript: string};
  }>;
}

export const QuranTeacherModal: React.FC<QuranTeacherModalProps> = ({
  entries,
  initialIndex = 0,
  preferredReciter,
  onClose,
}) => {
  useHardwareBack(true, onClose);
  const [ayahIdx, setAyahIdx] = useState(initialIndex);
  const currentEntry = entries[ayahIdx] || entries[0];

  const words = useMemo(() => {
    if (!currentEntry) return [];
    let text = currentEntry.ayah.t.replace(/[\uFEFF\u200B-\u200D]/g, '').trim();
    if (currentEntry.ayah.n === 1 && currentEntry.surah.n !== 1 && currentEntry.surah.n !== 9) {
      const parts = text.split(/\s+/);
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
          text = parts.slice(4).join(' ').trim();
        }
      }
    }
    return tokenizeArabicAyah(text);
  }, [currentEntry]);

  const [wordStates, setWordStates] = useState<WordEvalState[]>([]);
  const [cursor, setCursor] = useState(0);
  const [lastMistake, setLastMistake] = useState<{
    spoken: string;
    expected: string;
    hint: string | null;
  } | null>(null);
  const [completedAyahsCount, setCompletedAyahsCount] = useState(0);

  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [heardText, setHeardText] = useState('');
  const [manualInput, setManualInput] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const cursorRef = useRef(0);
  const processedPerResultRef = useRef<Record<number, number>>({});
  const restartTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setWordStates(words.map(() => 'pending'));
    setCursor(0);
    cursorRef.current = 0;
    processedPerResultRef.current = {};
    setLastMistake(null);
    setHeardText('');
  }, [words, ayahIdx]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
      }
      recognitionRef.current?.stop();
      audioRef.current?.pause();
    };
  }, []);

  const advanceToNextAyah = useCallback(() => {
    setCompletedAyahsCount((c) => c + 1);
    if (ayahIdx < entries.length - 1) {
      window.setTimeout(() => {
        setAyahIdx((i) => Math.min(entries.length - 1, i + 1));
      }, 900);
    } else {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current?.stop();
    }
  }, [ayahIdx, entries.length]);

  const evaluateWordSequence = useCallback(
    (spokenWords: string[]) => {
      if (words.length === 0) return;
      let idx = cursorRef.current;

      for (const spoken of spokenWords) {
        if (idx >= words.length) break;
        const target = words[idx];
        const check = compareArabicWords(
          spoken,
          target.norm,
          target.hamzaNorm,
          target.altVariants,
        );

        if (check.isMatch) {
          setWordStates((prev) => {
            const copy = [...prev];
            copy[idx] = 'correct';
            return copy;
          });
          setLastMistake(null);
          idx += 1;
          cursorRef.current = idx;
          setCursor(idx);

          if (idx >= words.length) {
            advanceToNextAyah();
            break;
          }
        } else {
          setWordStates((prev) => {
            const copy = [...prev];
            copy[idx] = 'wrong';
            return copy;
          });
          setLastMistake({
            spoken,
            expected: target.raw,
            hint: check.wrongLetterHint,
          });
        }
      }
    },
    [words, advanceToNextAyah],
  );

  const startMic = () => {
    setMicError(null);
    const SpeechRec =
      (window as unknown as {SpeechRecognition?: new () => SpeechRecognitionInstance})
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicError(
        'متصفحك لا يدعم التعرف الصوتي المباشر. يمكنك استخدام حقل التسميع الكتابي بالأسفل أو تجربة متصفح Chrome.',
      );
      return;
    }

    const isMobileUA =
      typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    try {
      const rec = new SpeechRec();
      rec.lang = 'ar-SA';
      rec.continuous = !isMobileUA;
      rec.interimResults = true;

      rec.onresult = (event) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const seg = event.results[i];
          const segText = seg[0]?.transcript || '';
          if (segText) {
            fullTranscript += (fullTranscript ? ' ' : '') + segText;
          }
          if (i < event.resultIndex) continue;

          const tokens = segText.trim().split(/\s+/).filter(Boolean);
          const already = processedPerResultRef.current[i] || 0;
          if (seg.isFinal) {
            if (tokens.length > already) {
              evaluateWordSequence(tokens.slice(already));
              processedPerResultRef.current[i] = tokens.length;
            }
          } else if (tokens.length - 1 > already) {
            evaluateWordSequence(tokens.slice(already, tokens.length - 1));
            processedPerResultRef.current[i] = tokens.length - 1;
          }
        }
        setHeardText(fullTranscript.trim());
      };

      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setMicError('يرجى السماح بصلاحية الميكروفون لتشغيل التسميع الصوتي.');
          listeningRef.current = false;
          setListening(false);
        }
      };

      rec.onend = () => {
        if (!listeningRef.current) return;
        processedPerResultRef.current = {};
        if (restartTimerRef.current !== null) {
          window.clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = window.setTimeout(() => {
          if (!listeningRef.current) return;
          try {
            rec.start();
          } catch {
            listeningRef.current = false;
            setListening(false);
          }
        }, 120);
      };

      recognitionRef.current = rec;
      listeningRef.current = true;
      processedPerResultRef.current = {};
      setListening(true);
      rec.start();
    } catch {
      setMicError('تعذر بدء الميكروفون.');
    }
  };

  const stopMic = () => {
    listeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    setListening(false);
    recognitionRef.current?.stop();
  };

  const playCorrectAyahAudio = () => {
    if (!currentEntry) return;
    const url = getAyahAudioUrl(
      preferredReciter,
      currentEntry.surah.n,
      currentEntry.ayah.n,
    );
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
  };

  if (!currentEntry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2">
      <div className="flex max-h-[94vh] w-full max-w-[400px] flex-col overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C9A227]/30 bg-black px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold text-[#F3D56B]">
              وضع المعلم — التسميع الصوتي التفاعلي
            </h2>
            <p className="text-xs text-zinc-300">
              {currentEntry.surah.name} · الآية {currentEntry.ayah.n} · مكتمل{' '}
              {completedAyahsCount} آية
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#F3D56B] hover:bg-[#C9A227]/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {/* Mic Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9A227]/50 bg-slate-50 p-4 dark:bg-[#0B0B0B]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={listening ? stopMic : startMic}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-colors ${
                  listening
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-[#C9A227] text-black hover:opacity-90'
                }`}
              >
                {listening ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    <span>إيقاف الميكروفون</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    <span>ابدأ التسميع بصوتك</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={playCorrectAyahAudio}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#C9A227] px-3.5 py-2.5 text-xs font-bold text-[#9A7415] hover:bg-[#C9A227]/15 dark:text-[#F3D56B]"
              >
                <Volume2 className="h-4 w-4" />
                <span>سماع النطق الصحيح</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setWordStates(words.map(() => 'pending'));
                setCursor(0);
                cursorRef.current = 0;
                processedPerResultRef.current = {};
                setLastMistake(null);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227]/40 px-3 py-2 text-xs font-bold text-slate-600 dark:text-zinc-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>إعادة الآية</span>
            </button>
          </div>

          {micError && (
            <div className="flex items-start gap-2 rounded-2xl border border-[#C9A227] bg-amber-50 p-3.5 text-xs font-semibold text-amber-900 dark:bg-[#141004] dark:text-[#F3D56B]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          {/* Word-by-Word Highlighted Ayah */}
          <div className="mushaf-surface rounded-3xl border-2 border-[#C9A227] p-6">
            <div className="font-quran flex flex-wrap gap-2.5 text-2xl leading-[2.3] sm:text-3xl">
              {words.map((w, idx) => {
                const state = wordStates[idx] || 'pending';
                const isCurrent = idx === cursor;
                return (
                  <span
                    key={`${ayahIdx}-${idx}`}
                    className={`rounded-xl border px-2.5 py-1 transition-colors ${
                      state === 'correct'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                        : state === 'wrong'
                        ? 'border-rose-500 bg-rose-600/25 text-rose-700 dark:text-rose-300'
                        : isCurrent
                        ? 'border-[#C9A227] bg-[#C9A227]/20 text-slate-900 dark:text-[#F3D56B]'
                        : 'border-transparent text-slate-900 dark:text-white'
                    }`}
                  >
                    {w.raw}
                  </span>
                );
              })}
            </div>

            {cursor >= words.length && words.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span>أحسنت! تم إتمام الآية بنجاح</span>
              </div>
            )}
          </div>

          {/* Mistake Feedback Box */}
          {lastMistake && (
            <div className="rounded-2xl border border-rose-500 bg-rose-50 p-4 dark:bg-rose-950/40">
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                انتبه! حدث خطأ في النطق:
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                الكلمة الصحيحة هي:{' '}
                <strong className="font-quran text-xl text-slate-900 dark:text-[#F3D56B]">
                  {lastMistake.expected}
                </strong>{' '}
                {lastMistake.hint && <span>({lastMistake.hint})</span>}
              </p>
            </div>
          )}

          {/* Heard transcript + Manual fallback input */}
          <div className="space-y-3 rounded-2xl border border-[#C9A227]/40 bg-slate-50 p-4 dark:bg-[#0B0B0B]">
            {heardText && (
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                <strong>ما سمعه المعلم:</strong> {heardText}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const tokens = manualInput.trim().split(/\s+/).filter(Boolean);
                if (tokens.length > 0) {
                  evaluateWordSequence(tokens);
                  setManualInput('');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="أو اكتب الكلمة التالية للتسميع السريع..."
                className="flex-1 rounded-xl border border-[#C9A227]/50 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#050505] dark:text-white"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-bold text-black hover:opacity-90"
              >
                تحقق
              </button>
            </form>
          </div>
        </div>

        {/* Footer Ayah Navigation */}
        <div className="flex items-center justify-between border-t border-[#C9A227]/30 px-5 py-3.5">
          <button
            type="button"
            disabled={ayahIdx <= 0}
            onClick={() => setAyahIdx((i) => Math.max(0, i - 1))}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#C9A227]/50 px-3.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 dark:text-white"
          >
            <ChevronRight className="h-4 w-4" />
            <span>الآية السابقة</span>
          </button>

          <span className="font-mono-num text-xs font-bold text-[#C9A227]">
            {ayahIdx + 1} / {entries.length}
          </span>

          <button
            type="button"
            disabled={ayahIdx >= entries.length - 1}
            onClick={() => setAyahIdx((i) => Math.min(entries.length - 1, i + 1))}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[#C9A227] px-3.5 py-2 text-xs font-bold text-black disabled:opacity-40"
          >
            <span>الآية التالية</span>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
