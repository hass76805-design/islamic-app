import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
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
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {resolveOfflinePlayableUrl} from '../utils/offlineAudioCache';
import {
  generatePersonalizedSheikhReply,
  resolveSheikhHumanVoiceUrl,
} from '../utils/rafiqiVoice';

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
  const isOnline = useOnlineStatus();
  const [selectedReciter, setSelectedReciter] =
    useState<ReciterId>(preferredReciter);
  const [activeWord, setActiveWord] = useState<RafiqiWordEntry>(
    RAFIQI_WORDS_30[0],
  );
  const [activeReplyText, setActiveReplyText] = useState<string>(
    RAFIQI_WORDS_30[0].replyAr,
  );
  const [userMessage, setUserMessage] = useState('');
  const [heardSpeech, setHeardSpeech] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [isPlayingAyah, setIsPlayingAyah] = useState(false);
  const [isPlayingSheikhReply, setIsPlayingSheikhReply] = useState(false);
  const [isPreparingSheikhVoice, setIsPreparingSheikhVoice] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);

  const ayahAudioRef = useRef<HTMLAudioElement | null>(null);
  const sheikhAudioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<SpeechRecLike | null>(null);
  const playbackTokenRef = useRef<number>(0);

  const activeSheikh = useMemo(
    () => getReciterById(selectedReciter),
    [selectedReciter],
  );

  const stopAllRafiqiAudio = () => {
    playbackTokenRef.current += 1;
    if (ayahAudioRef.current) {
      ayahAudioRef.current.onended = null;
      ayahAudioRef.current.onerror = null;
      ayahAudioRef.current.pause();
      ayahAudioRef.current.currentTime = 0;
    }
    if (sheikhAudioRef.current) {
      sheikhAudioRef.current.onended = null;
      sheikhAudioRef.current.onerror = null;
      sheikhAudioRef.current.pause();
      sheikhAudioRef.current.currentTime = 0;
    }
    setIsPlayingAyah(false);
    setIsPlayingSheikhReply(false);
    setIsPreparingSheikhVoice(false);
  };

  useEffect(() => {
    return () => {
      stopAllRafiqiAudio();
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const playAyahAndWait = async (
    entry: RafiqiWordEntry,
    reciterId: ReciterId,
    token: number,
  ): Promise<boolean> => {
    if (token !== playbackTokenRef.current) return false;
    setAudioNote(null);

    if (sheikhAudioRef.current) {
      sheikhAudioRef.current.onended = null;
      sheikhAudioRef.current.onerror = null;
      sheikhAudioRef.current.pause();
    }
    setIsPlayingSheikhReply(false);

    if (!ayahAudioRef.current) {
      ayahAudioRef.current = new Audio();
    }
    const audio = ayahAudioRef.current;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();

    const rawUrl = getAyahAudioUrl(
      reciterId,
      entry.surahNumber,
      entry.ayahNumber,
    );
    const playableUrl = await resolveOfflinePlayableUrl(rawUrl);
    if (token !== playbackTokenRef.current) return false;

    return new Promise<boolean>((resolve) => {
      setIsPlayingAyah(true);
      audio.src = playableUrl;
      audio.onended = () => {
        setIsPlayingAyah(false);
        resolve(token === playbackTokenRef.current);
      };
      audio.onerror = () => {
        setIsPlayingAyah(false);
        setAudioNote(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'يرجى الاتصال بالإنترنت لسماع التلاوة (أو حمّل قسم رفيقي للعمل بدون نت)'
            : 'تعذر تشغيل التلاوة حاليًا',
        );
        resolve(false);
      };
      audio.play().catch(() => {
        setIsPlayingAyah(false);
        resolve(false);
      });
    });
  };

  const playSheikhHumanVoiceAndWait = async (
    textToSpeak: string,
    token: number,
    preloadedUrlPromise?: Promise<string | null>,
    fallbackAyahReplyText?: string,
  ): Promise<boolean> => {
    if (!voiceReplyEnabled || token !== playbackTokenRef.current) return false;

    if (ayahAudioRef.current) {
      ayahAudioRef.current.onended = null;
      ayahAudioRef.current.onerror = null;
      ayahAudioRef.current.pause();
    }
    setIsPlayingAyah(false);
    setIsPreparingSheikhVoice(true);

    let wavUrl = await (preloadedUrlPromise ||
      resolveSheikhHumanVoiceUrl(textToSpeak));

    // Offline resilience: if custom dynamic reply isn't cached offline, fall back to the Ayah's cached Sheikh reply in IndexedDB
    if (
      !wavUrl &&
      fallbackAyahReplyText &&
      fallbackAyahReplyText.trim() !== textToSpeak.trim()
    ) {
      const fallbackUrl = await resolveSheikhHumanVoiceUrl(fallbackAyahReplyText);
      if (fallbackUrl && token === playbackTokenRef.current) {
        wavUrl = fallbackUrl;
        setActiveReplyText(fallbackAyahReplyText);
      }
    }

    setIsPreparingSheikhVoice(false);

    if (token !== playbackTokenRef.current) return false;
    if (!wavUrl) {
      setAudioNote(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'أنت بالوضع الأوفلاين — لم يتم تحميل صوت الشيخ لهذه الآية بعد، يمكنك قراءة الرد أعلاه أو تحميل قسم رفيقي عند توفر الإنترنت'
          : 'تعذر تشغيل صوت الشيخ حاليًا — تأكد من الاتصال أو تحميل قسم رفيقي للعمل بدون نت',
      );
      return false;
    }

    if (!sheikhAudioRef.current) {
      sheikhAudioRef.current = new Audio();
    }
    const sheikhAudio = sheikhAudioRef.current;
    sheikhAudio.onended = null;
    sheikhAudio.onerror = null;
    sheikhAudio.pause();

    return new Promise<boolean>((resolve) => {
      setIsPlayingSheikhReply(true);
      sheikhAudio.src = wavUrl;
      sheikhAudio.onended = () => {
        setIsPlayingSheikhReply(false);
        resolve(token === playbackTokenRef.current);
      };
      sheikhAudio.onerror = () => {
        setIsPlayingSheikhReply(false);
        setAudioNote('تعذر تشغيل صوت الشيخ حاليًا');
        resolve(false);
      };
      sheikhAudio.play().catch(() => {
        setIsPlayingSheikhReply(false);
        resolve(false);
      });
    });
  };

  /**
   * Plays the Quran Ayah FIRST until it finishes completely (`onended`),
   * pauses briefly, and then speaks the Sheikh's human guidance according to that Ayah.
   */
  const playAyahThenSheikh = async (
    entry: RafiqiWordEntry,
    reciterId: ReciterId,
    replyText: string,
    fallbackReplyText: string,
  ): Promise<void> => {
    stopAllRafiqiAudio();
    const token = playbackTokenRef.current;

    const preloadPromise = voiceReplyEnabled
      ? resolveSheikhHumanVoiceUrl(replyText)
      : undefined;

    await playAyahAndWait(entry, reciterId, token);
    if (token !== playbackTokenRef.current || !voiceReplyEnabled) return;

    await new Promise<void>((r) => window.setTimeout(r, 320));
    if (token !== playbackTokenRef.current || !voiceReplyEnabled) return;

    await playSheikhHumanVoiceAndWait(
      replyText,
      token,
      preloadPromise,
      fallbackReplyText,
    );
  };

  const playSheikhReplyOnly = (textToSpeak: string) => {
    if (isPlayingSheikhReply) {
      stopAllRafiqiAudio();
      return;
    }
    stopAllRafiqiAudio();
    const token = playbackTokenRef.current;
    void playSheikhHumanVoiceAndWait(
      textToSpeak,
      token,
      undefined,
      activeWord.replyAr,
    );
  };

  const handleSelectWord = (entry: RafiqiWordEntry) => {
    setActiveWord(entry);
    setActiveReplyText(entry.replyAr);
    setAudioNote(null);
    void playAyahThenSheikh(entry, selectedReciter, entry.replyAr, entry.replyAr);
  };

  const togglePlayPauseAyah = () => {
    if (isPlayingAyah || isPlayingSheikhReply || isPreparingSheikhVoice) {
      stopAllRafiqiAudio();
      return;
    }
    void playAyahThenSheikh(
      activeWord,
      selectedReciter,
      activeReplyText,
      activeWord.replyAr,
    );
  };

  /**
   * When the user speaks or writes to Rafiqi:
   * 1) Stop any current audio cleanly (never overlap).
   * 2) Play the matched Quran Ayah FIRST and wait for it to finish completely.
   * 3) Meanwhile prepare the Sheikh's warm human response tailored to the Ayah.
   * 4) After the Ayah finishes + a calm pause, play the real human Sheikh's voice reply.
   */
  const processUserDialogue = async (spoken: string) => {
    const trimmed = spoken.trim();
    if (!trimmed) return;

    stopAllRafiqiAudio();
    const token = playbackTokenRef.current;

    setHeardSpeech(trimmed);
    const matched = matchRafiqiWordFromSpeech(trimmed);
    setActiveWord(matched);
    setActiveReplyText(matched.replyAr);

    const preparedSheikhPromise: Promise<{
      replyText: string;
      audioUrl: string | null;
    }> = (async () => {
      const replyText = await generatePersonalizedSheikhReply(trimmed, matched);
      const audioUrl = voiceReplyEnabled
        ? await resolveSheikhHumanVoiceUrl(replyText)
        : null;
      return {replyText, audioUrl};
    })();

    // Step 1: Recite the Quran Ayah FIRST (zero overlap with Sheikh voice)
    await playAyahAndWait(matched, selectedReciter, token);
    if (token !== playbackTokenRef.current) return;

    // Brief calm breath pause between Quran recitation and Sheikh guidance
    await new Promise<void>((r) => window.setTimeout(r, 350));
    if (token !== playbackTokenRef.current) return;

    const prepared = await preparedSheikhPromise;
    if (token !== playbackTokenRef.current) return;

    setActiveReplyText(prepared.replyText);

    // Step 2: Speak the Sheikh's real human voice reply AFTER the Ayah ends (according to the Ayah)
    if (voiceReplyEnabled) {
      await playSheikhHumanVoiceAndWait(
        prepared.replyText,
        token,
        Promise.resolve(prepared.audioUrl),
        matched.replyAr,
      );
    }
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

    stopAllRafiqiAudio();

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
    rec.onerror = (err) => {
      setListening(false);
      if (
        err.error === 'network' ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      ) {
        setAudioNote(
          'أنت حاليًا في وضع الأوفلاين — الميكروفون يحتاج إنترنت، لكن يمكنك كتابة كلمتك أو اختيار أي كلمة بالأسفل ليتلو الآية ثم يحدثك الشيخ وفقها.',
        );
      }
    };
    rec.onend = () => {
      setListening(false);
      if (lastTranscript) {
        void processUserDialogue(lastTranscript);
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

  return (
    <div className="space-y-4 pb-4">
      {/* Companion Header + Human Sheikh Voice Mic */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <HeartHandshake className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#FCE38A]">
                رفيقي — بصوت الشيخ الحقيقي
              </h2>
              <p className="text-[11px] text-zinc-300">
                تحدث معي لأتلو لك الآية أولًا ثم أحدثك بصوت شيخ حقيقي بدون تداخل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (voiceReplyEnabled) {
                stopAllRafiqiAudio();
              }
              setVoiceReplyEnabled((v) => !v);
            }}
            aria-label={voiceReplyEnabled ? 'كتم صوت الشيخ' : 'تفعيل صوت الشيخ'}
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

        {!isOnline && (
          <div className="mt-3 rounded-2xl border border-[#C9A227]/60 bg-[#120E04] px-3 py-2 text-[11px] font-bold leading-relaxed text-[#FCE38A]">
            أنت بدون إنترنت: التعرف الصوتي المباشر وتوليد الردود الجديدة يتطلبان اتصالاً بالإنترنت — أما الـ 30 كلمة الذهبية وقراءة الآيات والأصوات المحفوظة مسبقًا فتعمل معك أوفلاين.
          </div>
        )}

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
                const msg = userMessage;
                setUserMessage('');
                void processUserDialogue(msg);
              }
            }}
            className="mt-3 flex w-full items-center gap-2"
          >
            <input
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="احكِ للشيخ ما في قلبك (مثل: حزين، محتاج رزق، خايف)..."
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

        {/* 30 Reciters Selector */}
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
              void playAyahThenSheikh(
                activeWord,
                nextReciter,
                activeReplyText,
                activeWord.replyAr,
              );
            }}
            className="min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-3 text-xs font-bold text-white outline-none"
          >
            {RECITERS_30.map((r) => (
              <option key={r.id} value={r.id}>
                الشيخ {r.nameAr} — {r.styleAr}
              </option>
            ))}
          </select>
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

        <div className="rounded-2xl border-2 border-[#C9A227] bg-black p-4 text-center">
          <p className="font-quran text-xl leading-[2.2] font-bold text-[#FCE38A]">
            {activeWord.ayahTextAr}
          </p>

          <p className="mt-3 rounded-2xl border border-[#C9A227]/35 bg-[#0D0A02] p-3 text-xs leading-relaxed text-zinc-100">
            «{activeReplyText}»
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
                  : `اسمع الآية بصوت ${activeSheikh.shortNameAr} ثم رد الشيخ`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => playSheikhReplyOnly(activeReplyText)}
              disabled={isPreparingSheikhVoice}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227] bg-[#120E04] px-3 text-xs font-bold text-[#FCE38A] disabled:opacity-70"
            >
              {isPreparingSheikhVoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlayingSheikhReply ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              <span>
                {isPreparingSheikhVoice
                  ? 'جاري تجهيز صوت الشيخ...'
                  : isPlayingSheikhReply
                    ? 'إيقاف صوت الشيخ'
                    : 'اسمع تعليق الشيخ'}
              </span>
            </button>
          </div>

          {(isPlayingAyah || isPreparingSheikhVoice || isPlayingSheikhReply) && (
            <p className="mt-2.5 rounded-xl border border-[#C9A227]/40 bg-[#120E04] px-3 py-1.5 text-[11px] font-bold text-[#FCE38A]">
              {isPlayingAyah
                ? 'جاري تلاوة الآية الآن — سيتحدث الشيخ وفق الآية فور انتهائها...'
                : isPreparingSheikhVoice
                  ? 'انتهت الآية — جاري تجهيز صوت الشيخ حسب الآية...'
                  : 'الشيخ يحدثك الآن على حسب الآية الكريمة'}
            </p>
          )}

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
            الـ 30 كلمة في رفيقي — اضغط لسماع الآية ثم حديث الشيخ
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
                onClick={() => handleSelectWord(entry)}
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
