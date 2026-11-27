import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

const LOCAL_ALAFASY_SPLASH_URL = '/audio/splash-alafasy.mp3';
const REMOTE_ALAFASY_SPLASH_URL =
  'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3';

export const SplashScreen: React.FC<SplashScreenProps> = ({onComplete}) => {
  const [exiting, setExiting] = useState(false);
  const [showTexts, setShowTexts] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maxCeilingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finishSplash = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (maxCeilingTimerRef.current) {
      window.clearTimeout(maxCeilingTimerRef.current);
      maxCeilingTimerRef.current = null;
    }
    setExiting(true);
    window.setTimeout(() => {
      onCompleteRef.current();
    }, 180);
  }, []);

  const startAlafasyAudio = useCallback(
    (audio: HTMLAudioElement) => {
      if (finishedRef.current) return;
      audio.play().catch(() => {
        // Mobile autoplay blocked before gesture — wait cleanly after 2.5s animation completes
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    // Reveal the two lines right after the 2.5s slow-motion float-up completes
    const textTimer = window.setTimeout(() => {
      if (!cancelled) {
        setShowTexts(true);
      }
    }, 2500);

    // Hard safety ceiling so splash never blocks app entry
    maxCeilingTimerRef.current = window.setTimeout(() => {
      finishSplash();
    }, 9500);

    const audio = new Audio(LOCAL_ALAFASY_SPLASH_URL);
    audio.volume = 1;
    audio.preload = 'auto';
    audioRef.current = audio;

    let triedRemote = false;
    audio.onended = () => {
      finishSplash();
    };
    audio.onerror = () => {
      if (
        !triedRemote &&
        typeof navigator !== 'undefined' &&
        navigator.onLine
      ) {
        triedRemote = true;
        audio.src = REMOTE_ALAFASY_SPLASH_URL;
        audio.load();
        startAlafasyAudio(audio);
        return;
      }
      window.setTimeout(() => finishSplash(), 1800);
    };

    startAlafasyAudio(audio);

    return () => {
      cancelled = true;
      window.clearTimeout(textTimer);
      if (maxCeilingTimerRef.current) {
        window.clearTimeout(maxCeilingTimerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [finishSplash, startAlafasyAudio]);

  // If browser blocked autoplay without gesture, tapping once plays Alafasy immediately
  const handleSplashTap = () => {
    if (finishedRef.current) return;
    const audio = audioRef.current;
    if (audio && audio.paused) {
      startAlafasyAudio(audio);
    }
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="golden-splash"
          initial={{opacity: 1}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.18, ease: 'easeOut'}}
          onClick={handleSplashTap}
          className="fixed inset-0 z-[99999] flex w-full flex-col items-center justify-center overflow-hidden bg-[#000000] px-6 text-center select-none"
          aria-label="البرنامج الإسلامي الأزهري"
        >
          {/* Ambient golden glow synced with 2.5s slow-motion float */}
          <motion.div
            initial={{opacity: 0.25, scale: 0.9}}
            animate={{opacity: 0.65, scale: 1.15}}
            transition={{duration: 2.5, ease: 'easeOut'}}
            className="pointer-events-none absolute h-[82vmin] w-[82vmin] rounded-full bg-[radial-gradient(circle,rgba(218,175,45,0.46)_0%,rgba(201,162,39,0.16)_46%,rgba(0,0,0,0)_74%)]"
          />

          {/* Single Centered 1024x1024 High-Quality PNG Icon — floats smoothly up & scales 1.0 -> 1.15 over 2.5s */}
          <motion.div
            initial={{scale: 1, y: 0}}
            animate={{scale: 1.15, y: -34}}
            transition={{duration: 2.5, ease: 'easeOut'}}
            onAnimationComplete={() => setShowTexts(true)}
            className="relative flex flex-col items-center"
          >
            <div className="relative h-40 w-40 overflow-hidden rounded-[26%] border-2 border-[#D4AF37] bg-[#050505] shadow-[0_0_56px_rgba(212,175,55,0.52)] sm:h-44 sm:w-44">
              <img
                src="/pwa-1024x1024.png"
                alt="البرنامج الإسلامي الأزهري"
                className="h-full w-full object-cover"
              />
            </div>
          </motion.div>

          {/* Text revealed strictly once AFTER the 2.5s icon animation completes */}
          <motion.div
            initial={{opacity: 0, y: 12}}
            animate={showTexts ? {opacity: 1, y: -8} : {opacity: 0, y: 12}}
            transition={{duration: 0.45, ease: 'easeOut'}}
            className="relative z-10 mt-6 flex max-w-md flex-col items-center gap-2.5"
          >
            <p className="font-quran text-2xl leading-relaxed font-extrabold text-[#FCE38A] drop-shadow-[0_2px_14px_rgba(201,162,39,0.48)] sm:text-3xl">
              اللهم اجعل القرآن نور صدورنا
            </p>
            <p className="text-sm font-extrabold tracking-wide text-[#C9A227]">
              البرنامج الإسلامي الأزهري
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
