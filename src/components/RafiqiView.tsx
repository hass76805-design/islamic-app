import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Check,
  Download,
  HeartHandshake,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  matchRafiqiWordFromSpeech,
  RAFIQI_WORDS_30,
  RafiqiWordEntry,
} from '../data/rafiqiData';
import {
  getAyahAudioUrl,
  getReciterById,
  RECITERS_30,
} from '../data/reciters';
import {ReciterId} from '../types';
import {cacheBatchUrls} from '../utils/offlineAudioCache';

interface RafiqiViewProps {
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

function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export const RafiqiView: React.FC<RafiqiViewProps> = ({preferredReciter}) => {
  const [selectedReciter, setSelectedReciter] =
    useState<ReciterId>(preferredReciter);
  const [activeWord, setActiveWord] = useState<RafiqiWordEntry>(
    RAFIQI_WORDS_30[0],
  );
  const [userMessage, setUserMessage] = useState('');
  const [heardSpeech, setHeardSpeech] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [isPlayingAyah, setIsPlayingAyah] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<SpeechRecLike | null>(null);

  const activeSheikh = useMemo(
    () => getReciterById(selectedReciter),
    [selectedReciter],
  );

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakFriendlyReply = (text: string) => {
    if (
      !voiceReplyEnabled ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ar-SA';
      utter.rate = 0.96;
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find((v) => v.lang.startsWith('ar'));
      if (arVoice) utter.voice = arVoice;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore speechSynthesis failure on unsupported devices
    }
  };

  const playAyahForEntry = (
    entry: RafiqiWordEntry,
    reciterId: ReciterId = selectedReciter,
  ) => {
    setAudioNote(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    const url = getAyahAudioUrl(reciterId, entry.surahNumber, entry.ayahNumber);

    audio.pause();
    audio.src = url;
    setIsPlayingAyah(true);
    audio.onended = () => setIsPlayingAyah(false);
    audio.onerror = () => {
      setIsPlayingAyah(false);
      setAudioNote(
        'اضغط «تحميل الـ 30 آية بدون نت» عند توفر الاتصال لحفظ تلاوة هذا الشيخ أوفلاين',
      );
    };
    audio.play().catch(() => {
      setIsPlayingAyah(false);
    });
  };

  const handleSelectWord = (entry: RafiqiWordEntry, withVoiceReply = false) => {
    setActiveWord(entry);
    setAudioNote(null);
    if (withVoiceReply) {
      speakFriendlyReply(entry.replyAr);
    }
    playAyahForEntry(entry, selectedReciter);
  };

  const togglePlayPauseAyah = () => {
    const audio = audioRef.current;
    if (audio && isPlayingAyah) {
      audio.pause();
      setIsPlayingAyah(false);
      return;
    }
    playAyahForEntry(activeWord, selectedReciter);
  };

  const processUserDialogue = (spoken: string) => {
    const trimmed = spoken.trim();
    if (!trimmed) return;
    setHeardSpeech(trimmed);
    const matched = matchRafiqiWordFromSpeech(trimmed);
    setActiveWord(matched);
    speakFriendlyReply(matched.replyAr);
    window.setTimeout(() => {
      playAyahForEntry(matched, selectedReciter);
    }, 600);
  };

  const handleToggleMic = () => {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    const SpeechRec =
      (window as unknown as {SpeechRecognition?: new () => SpeechRecLike})
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecLike;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRec) {
      setAudioNote('اكتب كلمتك أو اختر من الـ 30 كلمة الذهبية أدناه');
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    audioRef.current?.pause();
    setIsPlayingAyah(false);

    const rec = new SpeechRec();
    rec.lang = 'ar-SA';
    rec.continuous = false;
    rec.interimResults = true;

    let lastTranscript = '';
    rec.onresult = (e) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        full += (full ? ' ' : '') + (e.results[i][0]?.transcript || '');
      }
      lastTranscript = full.trim();
      setHeardSpeech(lastTranscript);
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      if (lastTranscript) {
        processUserDialogue(lastTranscript);
      }
    };

    try {
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const handleDownload30AyahsOffline = async () => {
    const urls = RAFIQI_WORDS_30.map((w) =>
      getAyahAudioUrl(selectedReciter, w.surahNumber, w.ayahNumber),
    );
    setBatchProgress({done: 0, total: urls.length});
    await cacheBatchUrls(urls, (done, total) => {
      setBatchProgress({done, total});
    });
    setBatchProgress(null);
    setOfflineReady(true);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Companion Header + Human Voice Mic */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <HeartHandshake className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#FCE38A]">
                رفيقي — الرفيق الإيماني الناطق
              </h2>
              <p className="text-[11px] text-zinc-300">
                تحدث معي أو اختر كلمة من 30 كلمة لتسمع آيتها بصوت شيخك
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVoiceReplyEnabled((v) => !v)}
            aria-label={voiceReplyEnabled ? 'كتم الرد الصوتي' : 'تفعيل الرد الصوتي'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              voiceReplyEnabled
                ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                : 'border-zinc-700 bg-black text-zinc-400'
            }`}
          >
            {voiceReplyEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Talk to Companion Controls */}
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-4 text-center">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border-2 transition-transform active:scale-95 ${
              listening
                ? 'animate-pulse border-emerald-400 bg-emerald-500 text-black'
                : 'border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] to-[#C9A227] text-black'
            }`}
          >
            {listening ? (
              <MicOff className="h-7 w-7" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
            <span className="text-[10px] font-extrabold">
              {listening ? 'أسمعك...' : 'تحدث الآن'}
            </span>
          </button>

          {heardSpeech && (
            <p className="mt-2.5 rounded-xl border border-[#C9A227]/40 bg-black px-3 py-1.5 text-xs font-semibold text-[#F3D56B]">
              قلت: «{heardSpeech}»
            </p>
          )}

          {/* Written Input Alternative */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (userMessage.trim()) {
                processUserDialogue(userMessage);
                setUserMessage('');
              }
            }}
            className="mt-3 flex w-full items-center gap-2"
          >
            <input
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="اكتب ما في قلبك (مثل: حزين، محتاج رزق، خايف)..."
              className="min-h-[40px] flex-1 rounded-xl border border-[#C9A227]/50 bg-black px-3 text-xs text-white outline-none focus:border-[#C9A227]"
            />
            <button
              type="submit"
              aria-label="إرسال لرفيقي"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C9A227] text-black"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* 30 Reciters Selector + Offline Pack */}
        <div className="mt-3 space-y-2 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 shrink-0 text-[#C9A227]" />
            <label
              htmlFor="rafiqi-reciter-select"
              className="text-xs font-bold text-[#FCE38A]"
            >
              القارئ المخصص للآيات (30 قارئًا):
            </label>
          </div>
          <select
            id="rafiqi-reciter-select"
            value={selectedReciter}
            onChange={(e) => {
              const nextReciter = e.target.value as ReciterId;
              setSelectedReciter(nextReciter);
              setOfflineReady(false);
              playAyahForEntry(activeWord, nextReciter);
            }}
            className="min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-3 text-xs font-bold text-white outline-none"
          >
            {RECITERS_30.map((r) => (
              <option key={r.id} value={r.id}>
                الشيخ {r.nameAr} — {r.styleAr}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!!batchProgress}
            onClick={handleDownload30AyahsOffline}
            className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3 text-xs font-bold text-[#FCE38A] disabled:opacity-60"
          >
            {batchProgress ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : offlineReady ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>
              {batchProgress
                ? `جاري تحميل الـ 30 آية (${batchProgress.done}/${batchProgress.total})`
                : offlineReady
                ? 'تم حفظ الـ 30 آية بدون نت لهذا الشيخ'
                : 'تحميل آيات رفيقي الـ 30 للعمل بدون نت'}
            </span>
          </button>
        </div>
      </section>

      {/* Active Reply & Dedicated Ayah Card */}
      <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#070501] p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A227] px-3 py-1 text-xs font-extrabold text-black">
            <Sparkles className="h-3.5 w-3.5" />
            <span>كلمة: {activeWord.wordAr}</span>
          </span>
          <span className="text-[11px] font-bold text-[#FCE38A]">
            {activeWord.surahNameAr} · الآية {toArabicDigits(activeWord.ayahNumber)}
          </span>
        </div>

        <p className="rounded-2xl border border-[#C9A227]/35 bg-[#0D0A02] p-3 text-xs leading-relaxed text-zinc-100">
          «{activeWord.replyAr}»
        </p>

        <div className="rounded-2xl border-2 border-[#C9A227] bg-black p-4 text-center">
          <p className="font-quran text-xl leading-[2.2] font-bold text-[#FCE38A]">
            {activeWord.ayahTextAr}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={togglePlayPauseAyah}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-4 text-xs font-extrabold text-black"
            >
              {isPlayingAyah ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>
                {isPlayingAyah
                  ? 'إيقاف التلاوة'
                  : `اسمع الآية بصوت ${activeSheikh.shortNameAr}`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => speakFriendlyReply(activeWord.replyAr)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227] bg-[#120E04] px-3 text-xs font-bold text-[#FCE38A]"
            >
              <Volume2 className="h-4 w-4" />
              <span>اسمع رد رفيقي</span>
            </button>
          </div>

          {audioNote && (
            <p className="mt-2 text-[11px] font-semibold text-[#C9A227]">
              {audioNote}
            </p>
          )}
        </div>
      </section>

      {/* 30 Golden Words Grid */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#FCE38A]">
            الـ 30 كلمة في رفيقي — اضغط الكلمة لسماع آيتها
          </h3>
          <span className="font-mono-num text-xs font-bold text-[#C9A227]">
            {toArabicDigits(RAFIQI_WORDS_30.length)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {RAFIQI_WORDS_30.map((entry) => {
            const isSelected = activeWord.id === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleSelectWord(entry, false)}
                className={`flex min-h-[46px] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition-colors ${
                  isSelected
                    ? 'border-2 border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/45 bg-slate-50/70 text-slate-900 hover:border-[#C9A227] dark:bg-[#0A0904] dark:text-white'
                }`}
              >
                <span className="text-xs font-extrabold">{entry.wordAr}</span>
                <span
                  className={`mt-0.5 text-[9px] font-bold ${
                    isSelected ? 'text-black/80' : 'text-[#C9A227]'
                  }`}
                >
                  {entry.surahNameAr}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
