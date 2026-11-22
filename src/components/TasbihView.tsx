import React, {useCallback, useRef, useState} from 'react';
import {RotateCcw, Volume2, VolumeX, Vibrate} from 'lucide-react';
import {useLocalStorage} from '../hooks/useLocalStorage';

const PRESET_DHIKRS = [
  'سُبْحَانَ اللَّهِ',
  'الْحَمْدُ لِلَّهِ',
  'اللَّهُ أَكْبَرُ',
  'لَا إِلَٰهَ إِلَّا اللَّهُ',
  'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ',
  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
  'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
  'اللَّهُمَّ صَلِّ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ',
];

export const TasbihView: React.FC = () => {
  const [selectedDhikr, setSelectedDhikr] = useLocalStorage('tasbih_dhikr', PRESET_DHIKRS[0]);
  const [customInput, setCustomInput] = useState('');
  const [count, setCount] = useLocalStorage('tasbih_count', 0);
  const [target, setTarget] = useLocalStorage<number>('tasbih_target', 33);
  const [cycles, setCycles] = useLocalStorage('tasbih_cycles', 0);
  const [lifetimeTotal, setLifetimeTotal] = useLocalStorage('tasbih_lifetime', 0);
  const [soundEnabled, setSoundEnabled] = useLocalStorage('tasbih_sound', true);
  const [vibrateEnabled, setVibrateEnabled] = useLocalStorage('tasbih_vibrate', true);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playClickTone = useCallback(
    (isCycleComplete: boolean) => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as {webkitAudioContext: typeof AudioContext})
              .webkitAudioContext;
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isCycleComplete ? 880 : 560, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + (isCycleComplete ? 0.18 : 0.06),
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (isCycleComplete ? 0.18 : 0.06));
      } catch {
        // ignore
      }
    },
    [soundEnabled],
  );

  const handleTap = () => {
    const next = count + 1;
    const hitTarget = target > 0 && next >= target;

    if (vibrateEnabled && navigator.vibrate) {
      navigator.vibrate(hitTarget ? [30, 40, 30] : 15);
    }
    playClickTone(hitTarget);

    setLifetimeTotal((t) => t + 1);
    if (hitTarget) {
      setCount(0);
      setCycles((c) => c + 1);
    } else {
      setCount(next);
    }
  };

  const progress = target > 0 ? Math.min(100, (count / target) * 100) : 100;
  const ringR = 104;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc - (progress / 100) * ringCirc;

  return (
    <div className="space-y-5">
      {/* Dhikr Phrase Selector */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap gap-2">
          {PRESET_DHIKRS.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => {
                setSelectedDhikr(phrase);
                setCount(0);
              }}
              className={`min-h-[38px] rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                selectedDhikr === phrase
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/40 text-slate-800 hover:border-[#C9A227] dark:text-white'
              }`}
            >
              {phrase}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (customInput.trim()) {
              setSelectedDhikr(customInput.trim());
              setCustomInput('');
              setCount(0);
            }
          }}
          className="mt-3 flex gap-2"
        >
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="أو اكتب ذكرًا مخصصًا..."
            className="flex-1 rounded-xl border border-[#C9A227]/60 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white"
          />
          <button
            type="submit"
            className="min-h-[40px] rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-bold text-black hover:opacity-90"
          >
            تعيين
          </button>
        </form>
      </div>

      {/* Main Tactile Tasbih Counter */}
      <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-gradient-to-b from-[#0A0803] via-[#050401] to-[#0E0B03] p-6 text-white sm:p-8">
        <div className="islamic-pattern-bg pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative z-10 flex w-full items-center justify-between">
          <div className="flex gap-1.5 rounded-xl border border-[#C9A227]/40 p-1">
            {[33, 99, 100, 0].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTarget(t);
                  setCount(0);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  target === t
                    ? 'bg-[#C9A227] text-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {t === 0 ? 'مفتوح' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label="تبديل الصوت"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                soundEnabled
                  ? 'border-[#C9A227] text-[#C9A227]'
                  : 'border-zinc-700 text-zinc-500'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setVibrateEnabled((v) => !v)}
              aria-label="تبديل الاهتزاز"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                vibrateEnabled
                  ? 'border-[#C9A227] text-[#C9A227]'
                  : 'border-zinc-700 text-zinc-500'
              }`}
            >
              <Vibrate className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCount(0);
                setCycles(0);
              }}
              aria-label="تصفير العداد"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/50 text-white hover:bg-[#C9A227]/15"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h2 className="font-quran relative z-10 mt-6 text-center text-2xl font-bold text-[#F3D56B] sm:text-3xl">
          {selectedDhikr}
        </h2>

        <button
          type="button"
          onClick={handleTap}
          className="group relative z-10 my-6 flex h-60 w-60 items-center justify-center rounded-full transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A227]"
          aria-label="تسبيح"
        >
          <svg className="h-full w-full -rotate-90" viewBox="0 0 240 240">
            <circle
              cx="120"
              cy="120"
              r={ringR}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(201,162,39,0.22)"
              strokeWidth="12"
            />
            <circle
              cx="120"
              cy="120"
              r={ringR}
              fill="none"
              stroke="#C9A227"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringOffset}
              className="transition-all duration-150"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono-num text-6xl font-bold text-white">
              {count}
            </span>
            {target > 0 && (
              <span className="mt-1 text-xs font-bold text-[#C9A227]">
                من {target}
              </span>
            )}
            <span className="mt-3 text-xs text-zinc-400">اضغط للتسبيح</span>
          </div>
        </button>

        <div className="relative z-10 grid w-full grid-cols-2 gap-3 border-t border-[#C9A227]/25 pt-4 text-center">
          <div>
            <span className="text-xs text-zinc-400">الدورات المكتملة</span>
            <p className="font-mono-num mt-0.5 text-xl font-bold text-[#F3D56B]">
              {cycles}
            </p>
          </div>
          <div>
            <span className="text-xs text-zinc-400">إجمالي التسبيحات</span>
            <p className="font-mono-num mt-0.5 text-xl font-bold text-white">
              {lifetimeTotal.toLocaleString('en-US')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
