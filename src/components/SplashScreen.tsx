import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({onComplete}) => {
  const [exiting, setExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setExiting(true);
    }, 2550);

    const doneTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, 3000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="golden-splash"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0, scale: 1.03}}
          transition={{duration: 0.45, ease: 'easeInOut'}}
          className="fixed inset-y-0 left-1/2 z-[100] flex w-full max-w-[390px] -translate-x-1/2 flex-col items-center justify-center overflow-hidden bg-[#000000]"
          aria-label="البرنامج الإسلامي الذهبي"
        >
          {/* Soft ambient golden halo behind full-screen splash artwork */}
          <motion.div
            initial={{opacity: 0, scale: 0.85}}
            animate={{opacity: [0.22, 0.58, 0.3], scale: [0.92, 1.05, 1]}}
            transition={{duration: 2.55, ease: 'easeInOut'}}
            className="pointer-events-none absolute h-[85vmin] w-[85vmin] rounded-full bg-[radial-gradient(circle,rgba(201,162,39,0.44)_0%,rgba(201,162,39,0.14)_45%,rgba(0,0,0,0)_72%)]"
          />

          {/* Full-screen centered splash artwork */}
          <motion.div
            initial={{opacity: 0, scale: 0.94}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.85, ease: [0.22, 1, 0.36, 1]}}
            className="relative flex h-full w-full max-w-[390px] items-center justify-center p-4"
          >
            <div className="relative flex aspect-square max-h-[80vh] w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[12%] bg-[#000000] shadow-[0_0_48px_rgba(201,162,39,0.28)]">
              <img
                src="/assets/aistudio/IMG-20261120-WA4940_5880b328.jpg"
                alt="البرنامج الإسلامي الذهبي"
                className="h-full w-full rounded-[12%] object-contain"
              />

              {/* Smooth golden shimmer sweep across artwork */}
              <motion.div
                initial={{x: '-130%', opacity: 0}}
                animate={{x: '140%', opacity: [0, 0.5, 0]}}
                transition={{delay: 0.35, duration: 1.9, ease: 'easeInOut'}}
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#FCE38A]/35 to-transparent"
              />
            </div>
          </motion.div>

          {/* Subtle golden title & progress bar at bottom (no buttons, no skip) */}
          <motion.div
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.3, duration: 0.6}}
            className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-2 px-6"
          >
            <p className="font-quran text-xl font-bold tracking-wide text-[#F3D56B] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] sm:text-2xl">
              البرنامج الإسلامي الذهبي
            </p>
            <div className="h-1 w-44 overflow-hidden rounded-full bg-[#C9A227]/20">
              <motion.div
                initial={{width: '0%'}}
                animate={{width: '100%'}}
                transition={{duration: 2.55, ease: 'linear'}}
                className="h-full rounded-full bg-gradient-to-r from-[#9A7415] via-[#FCE38A] to-[#C9A227]"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
