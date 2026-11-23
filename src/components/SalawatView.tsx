import React, {useMemo, useRef, useState} from 'react';
import {
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {useLocalStorage} from '../hooks/useLocalStorage';

interface SalawatFormula {
  id: string;
  titleAr: string;
  textAr: string;
  virtueAr: string;
}

const SALAWAT_FORMULAS: SalawatFormula[] = [
  {
    id: 'short',
    titleAr: 'الصلاة المختصرة المباركة',
    textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    virtueAr: 'من صلى عليَّ صلاة واحدة صلى الله عليه بها عشرًا (صحيح مسلم)',
  },
  {
    id: 'ibrahimiyyah',
    titleAr: 'الصلاة الإبراهيمية الكاملة',
    textAr:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    virtueAr: 'أفضل صيغة علّمها النبي ﷺ لأصحابه رضي الله عنهم (متفق عليه)',
  },
  {
    id: 'kafiyah',
    titleAr: 'صيغة تفريج الهموم وغفران الذنوب',
    textAr: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ صَلَاةً تَرْضَاهَا لَهُ وَتَرْضَى بِهَا عَنَّا',
    virtueAr: 'قيل لأبي بن كعب: إذن تُكفى همَّك ويُغفر لك ذنبُك (الترمذي)',
  },
  {
    id: 'friday',
    titleAr: 'صلاة يوم الجمعة وليلة الجمعة',
    textAr: 'صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ وَسَلَّمَ تَسْلِيمًا كَثِيرًا',
    virtueAr: 'فأكثروا عليَّ من الصلاة فيه، فإن صلاتكم معروضة عليَّ (أبو داود)',
  },
];

const TARGET_OPTIONS = [10, 33, 100, 1000, 0] as const;

interface SalawatStats {
  count: number;
  cycles: number;
  totalAllTime: number;
  target: number;
}

function playGoldenBeadAudio(isLapComplete: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext})
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (isLapComplete) {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.16, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.48);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(698.46, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // ignore WebAudio restrictions
  }
}

export const SalawatView: React.FC = () => {
  const [stats, setStats] = useLocalStorage<SalawatStats>(
    'alzahabi_salawat_stats_v1',
    {
      count: 0,
      cycles: 0,
      totalAllTime: 0,
      target: 33,
    },
  );
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('short');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceSpeakEnabled, setVoiceSpeakEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const lastTapRef = useRef(0);

  const activeFormula = useMemo(
    () =>
      SALAWAT_FORMULAS.find((f) => f.id === selectedFormulaId) ||
      SALAWAT_FORMULAS[0],
    [selectedFormulaId],
  );

  const speakSalawat = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find((v) => v.lang.startsWith('ar'));
      if (arVoice) u.voice = arVoice;
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  };

  const handleRosaryTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 80) return;
    lastTapRef.current = now;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(14);
      } catch {
        // ignore
      }
    }

    let completedCycleNow = false;
    setStats((prev) => {
      const target = prev.target;
      let nextCount = prev.count + 1;
      let nextCycles = prev.cycles;
      if (target > 0 && nextCount >= target) {
        nextCount = 0;
        nextCycles += 1;
        completedCycleNow = true;
      }
      if (soundEnabled) {
        playGoldenBeadAudio(completedCycleNow);
      }
      return {
        ...prev,
        count: nextCount,
        cycles: nextCycles,
        totalAllTime: prev.totalAllTime + 1,
      };
    });

    if (voiceSpeakEnabled) {
      speakSalawat('اللهم صل وسلم على نبينا محمد');
    }
  };

  const beadCount = 33;
  const activeBeadIndex =
    stats.target > 0
      ? Math.round((stats.count / stats.target) * beadCount)
      : stats.count % beadCount;

  return (
    <div className="space-y-4 pb-4">
      {/* Header Verse */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-center text-white">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A227]/60 bg-[#C9A227]/15 px-3 py-1 text-[11px] font-bold text-[#FCE38A]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>صلِّ على الحبيب المصطفى ﷺ</span>
        </span>
        <p className="font-quran mt-3 text-lg leading-loose font-bold text-[#FCE38A]">
          ﴿إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ ۚ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا﴾
        </p>
      </div>

      {/* Golden Rosary Interactive Ring */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-4 text-white">
        {/* Top Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TARGET_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setStats((s) => ({...s, target: t, count: 0}))
                }
                className={`font-mono-num min-h-[32px] rounded-xl border px-2.5 text-xs font-bold ${
                  stats.target === t
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/40 bg-black text-zinc-300'
                }`}
              >
                {t === 0 ? 'مفتوح' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              aria-label="صوت حبات السبحة"
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                soundEnabled
                  ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                  : 'border-zinc-700 bg-black text-zinc-400'
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
              onClick={() =>
                setStats((s) => ({...s, count: 0}))
              }
              aria-label="تصفير العداد"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C9A227]/50 bg-black text-[#F3D56B]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Golden Beads Circle + Tap Center */}
        <div className="my-5 flex flex-col items-center justify-center">
          <div className="relative flex h-64 w-64 items-center justify-center">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 260 260">
              <circle
                cx="130"
                cy="130"
                r="114"
                fill="none"
                stroke="rgba(201,162,39,0.22)"
                strokeWidth="2"
              />
              {Array.from({length: beadCount}).map((_, i) => {
                const angleRad = ((i / beadCount) * 360 - 90) * (Math.PI / 180);
                const cx = 130 + 114 * Math.cos(angleRad);
                const cy = 130 + 114 * Math.sin(angleRad);
                const lit = i < activeBeadIndex;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={lit ? 5.2 : 4}
                    fill={lit ? '#FCE38A' : '#1F1A0B'}
                    stroke="#C9A227"
                    strokeWidth={lit ? 1.5 : 1}
                  />
                );
              })}
            </svg>

            <button
              type="button"
              onClick={handleRosaryTap}
              className="z-10 flex h-44 w-44 flex-col items-center justify-center gap-1 rounded-full border-4 border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] via-[#C9A227] to-[#9A7415] p-3 text-center text-black shadow-[0_0_40px_rgba(201,162,39,0.4)] active:scale-95"
            >
              <span className="font-mono-num text-4xl font-extrabold leading-none">
                {stats.count}
              </span>
              {stats.target > 0 && (
                <span className="font-mono-num text-xs font-bold text-black/75">
                  من {stats.target}
                </span>
              )}
              <span className="font-quran mt-1 text-sm font-bold leading-tight">
                صلِّ على محمد ﷺ
              </span>
            </button>
          </div>

          <p className="font-quran mt-3 text-center text-base font-bold text-[#FCE38A]">
            {activeFormula.textAr}
          </p>
        </div>

        {/* Stats Row + Voice Toggle */}
        <div className="grid grid-cols-3 gap-2 border-t border-[#C9A227]/30 pt-3 text-center">
          <div className="rounded-2xl border border-[#C9A227]/40 bg-[#0A0904] p-2">
            <span className="text-[10px] text-zinc-400">الدورات المكتملة</span>
            <p className="font-mono-num text-base font-bold text-[#FCE38A]">
              {stats.cycles}
            </p>
          </div>
          <div className="rounded-2xl border border-[#C9A227]/40 bg-[#0A0904] p-2">
            <span className="text-[10px] text-zinc-400">الإجمالي الكلي</span>
            <p className="font-mono-num text-base font-bold text-[#C9A227]">
              {stats.totalAllTime}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVoiceSpeakEnabled((v) => !v)}
            className={`rounded-2xl border p-2 text-center ${
              voiceSpeakEnabled
                ? 'border-[#C9A227] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/40 bg-[#0A0904] text-[#FCE38A]'
            }`}
          >
            <span className="block text-[10px] font-bold">نطق بالصوت</span>
            <span className="text-xs font-extrabold">
              {voiceSpeakEnabled ? 'مفعّل' : 'مغلق'}
            </span>
          </button>
        </div>
      </section>

      {/* Authentic Salawat Formulas */}
      <section className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <h3 className="text-sm font-bold text-slate-900 dark:text-[#FCE38A]">
          صيغ الصلاة على النبي ﷺ وفضلها
        </h3>
        {SALAWAT_FORMULAS.map((formula) => {
          const isSelected = selectedFormulaId === formula.id;
          const isCopied = copiedId === formula.id;
          return (
            <div
              key={formula.id}
              className={`space-y-2 rounded-2xl border p-3.5 ${
                isSelected
                  ? 'border-2 border-[#C9A227] bg-[#C9A227]/12 dark:bg-[#141004]'
                  : 'border-[#C9A227]/40 bg-slate-50/70 dark:bg-[#0A0904]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]">
                  {formula.titleAr}
                </h4>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => speakSalawat(formula.textAr)}
                    aria-label="استماع للصيغة"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#C9A227]"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(formula.textAr);
                        setCopiedId(formula.id);
                        window.setTimeout(() => setCopiedId(null), 1600);
                      } catch {
                        // ignore
                      }
                    }}
                    aria-label="نسخ الصيغة"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#C9A227]"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <p className="font-quran text-base leading-loose text-slate-900 dark:text-white">
                {formula.textAr}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                {formula.virtueAr}
              </p>

              <button
                type="button"
                onClick={() => setSelectedFormulaId(formula.id)}
                className={`min-h-[34px] w-full rounded-xl border text-xs font-bold ${
                  isSelected
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/50 text-[#9A7415] dark:text-[#FCE38A]'
                }`}
              >
                {isSelected ? 'الصيغة النشطة على السبحة' : 'اعتماد هذه الصيغة'}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
};
