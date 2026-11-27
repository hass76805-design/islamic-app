import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Volume2} from 'lucide-react';
import {
  readCachedSheikhAudioObjectUrl,
  resolveSheikhHumanVoiceUrl,
  SPLASH_QURAN_LIGHT_DUA_TEXT,
} from '../utils/rafiqiVoice';

interface SplashScreenProps {
  onComplete: () => void;
}

const SPOKEN_PLAIN_DUA = 'اللهم اجعل القرآن نور صدورنا';

export const SplashScreen: React.FC<SplashScreenProps> = ({onComplete}) => {
  const [exiting, setExiting] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [duaPlaying, setDuaPlaying] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const idleExitTimerRef = useRef<number | null>(null);
  const maxCeilingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finishSplash = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (idleExitTimerRef.current) {
      window.clearTimeout(idleExitTimerRef.current);
      idleExitTimerRef.current = null;
    }
    if (maxCeilingTimerRef.current) {
      window.clearTimeout(maxCeilingTimerRef.current);
      maxCeilingTimerRef.current = null;
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore speechSynthesis cancel failure
    }
    setExiting(true);
    window.setTimeout(() => {
      onCompleteRef.current();
    }, 150);
  }, []);

  const speakArabicFallback = useCallback(() => {
    if (finishedRef.current) return false;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(SPOKEN_PLAIN_DUA);
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('ar-eg')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('ar-sa')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }
      utterance.lang = arabicVoice?.lang || 'ar-EG';
      utterance.rate = 0.88;
      utterance.pitch = 0.85;
      utterance.volume = 1;

      let started = false;
      utterance.onstart = () => {
        started = true;
        setNeedsTapToPlay(false);
        setDuaPlaying(true);
        if (idleExitTimerRef.current) {
          window.clearTimeout(idleExitTimerRef.current);
          idleExitTimerRef.current = null;
        }
      };
      utterance.onend = () => {
        setDuaPlaying(false);
        finishSplash();
      };
      utterance.onerror = () => {
        setDuaPlaying(false);
        finishSplash();
      };

      window.speechSynthesis.speak(utterance);

      // If browser blocks speechSynthesis without throwing, proceed smoothly
      idleExitTimerRef.current = window.setTimeout(() => {
        if (!started && !finishedRef.current) {
          finishSplash();
        }
      }, 3200);
      return true;
    } catch {
      return false;
    }
  }, [finishSplash]);

  const attemptPlayAudio = useCallback(
    (audio: HTMLAudioElement) => {
      if (finishedRef.current) return;
      audio
        .play()
        .then(() => {
          setNeedsTapToPlay(false);
          setDuaPlaying(true);
          if (idleExitTimerRef.current) {
            window.clearTimeout(idleExitTimerRef.current);
            idleExitTimerRef.current = null;
          }
        })
        .catch(() => {
          // Strict mobile autoplay block: let user tap OR enter app cleanly
          setNeedsTapToPlay(true);
          if (!idleExitTimerRef.current) {
            idleExitTimerRef.current = window.setTimeout(() => {
              finishSplash();
            }, 3400);
          }
        });
    },
    [finishSplash],
  );

  useEffect(() => {
    let cancelled = false;

    const liftTimer = window.setTimeout(() => {
      if (!cancelled) setLifted(true);
    }, 320);

    // Safety ceiling so splash never hangs indefinitely on any device
    maxCeilingTimerRef.current = window.setTimeout(() => {
      finishSplash();
    }, 9500);

    // Start resolving the real Sheikh voice immediately (offline IDB first, then TTS API)
    const resolveVoicePromise = (async () => {
      let src = await readCachedSheikhAudioObjectUrl(SPLASH_QURAN_LIGHT_DUA_TEXT);
      if (!src && typeof navigator !== 'undefined' && navigator.onLine) {
        const warmPromise = resolveSheikhHumanVoiceUrl(SPLASH_QURAN_LIGHT_DUA_TEXT);
        src = await Promise.race<string | null>([
          warmPromise,
          new Promise<null>((resolve) =>
            window.setTimeout(() => resolve(null), 4200),
          ),
        ]);
      }
      return src;
    })();

    const audioStartTimer = window.setTimeout(() => {
      void (async () => {
        const src = await resolveVoicePromise;
        if (cancelled || finishedRef.current) return;

        if (src) {
          const audio = new Audio(src);
          audio.volume = 1;
          audio.preload = 'auto';
          audioRef.current = audio;

          audio.onended = () => {
            setDuaPlaying(false);
            finishSplash();
          };
          audio.onerror = () => {
            setDuaPlaying(false);
            if (!speakArabicFallback()) {
              window.setTimeout(() => finishSplash(), 1800);
            }
          };

          attemptPlayAudio(audio);
          return;
        }

        // First offline launch (or no TTS backend): speak ONLY "اللهم اجعل القرآن نور صدورنا"
        // Never play unrelated post-adhan or Azan MP3s on startup.
        if (!speakArabicFallback()) {
          idleExitTimerRef.current = window.setTimeout(() => {
            finishSplash();
          }, 2400);
        }
      })();
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(liftTimer);
      window.clearTimeout(audioStartTimer);
      if (idleExitTimerRef.current) {
        window.clearTimeout(idleExitTimerRef.current);
      }
      if (maxCeilingTimerRef.current) {
        window.clearTimeout(maxCeilingTimerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
    };
  }, [attemptPlayAudio, finishSplash, speakArabicFallback]);

  const handleSplashTap = () => {
    if (finishedRef.current) return;
    if (audioRef.current && audioRef.current.paused) {
      attemptPlayAudio(audioRef.current);
    } else if (needsTapToPlay) {
      speakArabicFallback();
    }
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="golden-splash"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.15, ease: 'easeOut'}}
          onClick={handleSplashTap}
          className="fixed inset-0 z-[100] flex w-full flex-col items-center justify-center overflow-hidden bg-[#000000] px-6 text-center select-none"
          aria-label="البرنامج الإسلامي الذهبي"
        >
          {/* Ambient golden glow */}
          <motion.div
            initial={{opacity: 0, scale: 0.8}}
            animate={{opacity: [0.22, 0.55, 0.32], scale: [0.92, 1.08, 1]}}
            transition={{duration: 2.2, ease: 'easeInOut'}}
            className="pointer-events-none absolute h-[78vmin] w-[78vmin] rounded-full bg-[radial-gradient(circle,rgba(201,162,39,0.4)_0%,rgba(201,162,39,0.12)_48%,rgba(0,0,0,0)_74%)]"
          />

          {/* Centered App Icon that animates upward */}
          <motion.div
            initial={{opacity: 0, scale: 0.88, y: 12}}
            animate={
              lifted
                ? {opacity: 1, scale: 0.9, y: -36}
                : {opacity: 1, scale: 1, y: 16}
            }
            transition={{duration: 0.7, ease: [0.22, 1, 0.36, 1]}}
            className="relative flex flex-col items-center"
          >
            <div className="relative h-36 w-36 overflow-hidden rounded-[26%] border-2 border-[#C9A227] bg-[#050505] shadow-[0_0_50px_rgba(201,162,39,0.38)] sm:h-40 sm:w-40">
              <img
                src="/pwa-512x512.png"
                alt="البرنامج الإسلامي الذهبي"
                className="h-full w-full object-cover"
              />
              <motion.div
                initial={{x: '-130%', opacity: 0}}
                animate={{x: '140%', opacity: [0, 0.5, 0]}}
                transition={{delay: 0.25, duration: 1.8, ease: 'easeInOut'}}
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#FCE38A]/35 to-transparent"
              />
            </div>
          </motion.div>

          {/* Revealed underneath once icon moves upward */}
          <motion.div
            initial={{opacity: 0, y: 18}}
            animate={lifted ? {opacity: 1, y: -12} : {opacity: 0, y: 18}}
            transition={{duration: 0.6, ease: [0.22, 1, 0.36, 1]}}
            className="relative z-10 flex max-w-md flex-col items-center gap-3"
          >
            <p className="font-quran text-2xl leading-relaxed font-extrabold text-[#FCE38A] drop-shadow-[0_2px_14px_rgba(201,162,39,0.45)] sm:text-3xl">
              اللهم اجعل القرآن نور صدورنا
            </p>
            <p className="text-sm font-extrabold tracking-wide text-[#C9A227]">
              البرنامج الإسلامي الذهبي
            </p>

            {duaPlaying ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A227]/45 bg-[#120E04] px-3 py-1 text-[11px] font-bold text-[#F3D56B]">
                <Volume2 className="h-3.5 w-3.5 animate-pulse text-[#FCE38A]" />
                <span>جاري تلاوة الدعاء بصوت الشيخ...</span>
              </span>
            ) : needsTapToPlay ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCE38A]/65 bg-[#C9A227]/18 px-3.5 py-1 text-[11px] font-extrabold text-[#FCE38A]">
                <Volume2 className="h-3.5 w-3.5" />
                <span>اضغط هنا لسماع الدعاء بصوت الشيخ</span>
              </span>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
