import React, {useState} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Droplets,
  Sparkles,
} from 'lucide-react';
import {
  DAILY_PRAYERS_RAKAAT,
  EducationStep,
  PRAYER_STEPS,
  WUDU_STEPS,
} from '../data/prayerEducation';
import {useHardwareBack} from '../utils/backNavigation';

type GuideTab = 'wudu' | 'prayer' | 'rakaat';

export const PrayerEducationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GuideTab>('prayer');
  const [selectedStep, setSelectedStep] = useState<EducationStep | null>(null);

  useHardwareBack(!!selectedStep, () => setSelectedStep(null));

  const activeSteps = activeTab === 'wudu' ? WUDU_STEPS : PRAYER_STEPS;

  const openStepByOffset = (delta: number) => {
    if (!selectedStep) return;
    const list = selectedStep.id.startsWith('wudu-') ? WUDU_STEPS : PRAYER_STEPS;
    const idx = list.findIndex((s) => s.id === selectedStep.id);
    if (idx === -1) return;
    const next = list[idx + delta];
    if (next) {
      setSelectedStep(next);
    }
  };

  if (selectedStep) {
    const list = selectedStep.id.startsWith('wudu-') ? WUDU_STEPS : PRAYER_STEPS;
    const idx = list.findIndex((s) => s.id === selectedStep.id);
    const hasPrev = idx > 0;
    const hasNext = idx < list.length - 1;

    return (
      <div className="space-y-4 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C9A227]/35 pb-3">
          <button
            type="button"
            onClick={() => setSelectedStep(null)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3.5 py-2 text-xs font-bold text-[#FCE38A] hover:bg-[#C9A227] hover:text-black"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة للخطوات</span>
          </button>

          <span className="rounded-xl border border-[#C9A227]/60 bg-[#141004] px-3 py-1 text-xs font-bold text-[#F3D56B]">
            الخطوة {selectedStep.stepNumber} من {list.length}
          </span>
        </div>

        {/* Clean Modest Illustration on Top */}
        <div className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-black">
          <img
            src={selectedStep.image}
            alt={selectedStep.imageAltAr}
            referrerPolicy="no-referrer"
            className="aspect-[4/3] max-h-[360px] w-full object-cover"
          />
        </div>

        {/* Respectful Step-by-Step Detailed Explanation Underneath */}
        <div className="space-y-4 rounded-2xl border border-[#C9A227]/45 bg-[#0A0803] p-5">
          <div>
            <h3 className="font-quran text-2xl font-bold text-[#FCE38A] sm:text-3xl">
              {selectedStep.stepNumber}. {selectedStep.titleAr}
            </h3>
            <p className="mt-1.5 text-sm font-semibold text-zinc-200">
              {selectedStep.summaryAr}
            </p>
          </div>

          {selectedStep.spokenWordsAr && (
            <div className="rounded-2xl border-2 border-[#C9A227] bg-[#141004] p-4 text-center">
              <p className="text-xs font-bold text-[#C9A227]">
                ما يُقال باللسان في هذه الخطوة:
              </p>
              <p className="font-quran mt-2 text-xl leading-[2.1] font-bold text-[#FCE38A] sm:text-2xl">
                {selectedStep.spokenWordsAr}
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <h4 className="text-sm font-bold text-[#F3D56B]">
              الشرح المفصل خطوة بخطوة:
            </h4>
            <ul className="space-y-2.5 text-sm leading-relaxed text-zinc-100">
              {selectedStep.detailsAr.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-[#C9A227]/25 bg-black/60 p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#C9A227]/45 bg-black/75 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227]">
              <Sparkles className="h-4 w-4" />
              <span>أدب ونصيحة مهمة:</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-200">
              {selectedStep.etiquetteTipAr}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => openStepByOffset(-1)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A227] bg-black px-4 py-2 text-xs font-bold text-[#FCE38A] hover:bg-[#C9A227] hover:text-black disabled:opacity-40"
          >
            <ArrowRight className="h-4 w-4" />
            <span>الخطوة السابقة</span>
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => openStepByOffset(1)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-4 py-2 text-xs font-extrabold text-black hover:opacity-90 disabled:opacity-40"
          >
            <span>الخطوة التالية</span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl bg-[#000000] p-2 text-white sm:p-4">
      {/* Header Banner */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-gradient-to-br from-[#0A0803] via-[#050401] to-[#120D03] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-quran text-2xl font-bold text-[#FCE38A] sm:text-3xl">
              تعليم الوضوء والصلاة بالتفصيل بالحرف
            </h2>
            <p className="mt-1 text-xs text-zinc-300">
              شرح واضح مصور خطوة بخطوة بأسلوب محترم ومؤدب وفق السنة النبوية الصحيحة
            </p>
          </div>
          <span className="rounded-2xl border border-[#C9A227] bg-[#141004] px-3.5 py-2 text-xs font-bold text-[#F3D56B]">
            15 خطوة مصورة ومشروحة
          </span>
        </div>

        {/* 3 Neat Sub-Section Buttons */}
        <div className="mt-4 grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('prayer')}
            className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-bold ${
              activeTab === 'prayer'
                ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/60 bg-black text-[#FCE38A] hover:border-[#C9A227]'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>تعليم الصلاة بالتفصيل (8 خطوات)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wudu')}
            className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-bold ${
              activeTab === 'wudu'
                ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/60 bg-black text-[#FCE38A] hover:border-[#C9A227]'
            }`}
          >
            <Droplets className="h-4 w-4" />
            <span>تعليم الوضوء الصحيح (7 خطوات)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rakaat')}
            className={`flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-bold ${
              activeTab === 'rakaat'
                ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/60 bg-black text-[#FCE38A] hover:border-[#C9A227]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>عدد ركعات الصلوات الخمس</span>
          </button>
        </div>
      </div>

      {activeTab === 'rakaat' ? (
        <div className="grid grid-cols-1 gap-3.5">
          {DAILY_PRAYERS_RAKAAT.map((p) => (
            <div
              key={p.nameAr}
              className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-[#080703] p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-[#FCE38A]">
                    {p.nameAr}
                  </h3>
                  <span className="rounded-xl bg-[#C9A227] px-3 py-1 text-xs font-extrabold text-black">
                    {p.rakaatAr}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">
                  {p.recitationStyleAr}
                </p>
              </div>
              <p className="mt-4 border-t border-[#C9A227]/30 pt-3 text-xs text-zinc-300">
                {p.sunnahAr}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activeSteps.map((step) => (
            <article
              key={step.id}
              className="flex flex-col overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#080703]"
            >
              {/* Illustration */}
              <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#C9A227]/45 bg-black">
                <img
                  src={step.image}
                  alt={step.imageAltAr}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <span className="font-mono-num absolute top-3 right-3 rounded-xl border border-[#FCE38A] bg-black/90 px-3 py-1 text-xs font-bold text-[#FCE38A]">
                  الخطوة {step.stepNumber}
                </span>
              </div>

              {/* Respectful Step-by-Step Explanation Underneath */}
              <div className="flex flex-1 flex-col justify-between space-y-3 p-5">
                <div className="space-y-2.5">
                  <h3 className="text-lg font-bold text-[#FCE38A]">
                    {step.stepNumber}. {step.titleAr}
                  </h3>
                  <p className="text-xs font-semibold leading-relaxed text-zinc-200">
                    {step.summaryAr}
                  </p>

                  {step.spokenWordsAr && (
                    <div className="rounded-2xl border border-[#C9A227]/55 bg-[#141004] px-3.5 py-2.5">
                      <p className="text-[11px] font-bold text-[#C9A227]">
                        الأذكار والأقوال في هذه الخطوة:
                      </p>
                      <p className="font-quran mt-1 line-clamp-2 text-base font-bold text-[#FCE38A]">
                        {step.spokenWordsAr}
                      </p>
                    </div>
                  )}

                  <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-300">
                    {step.detailsAr.map((d, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A227]" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-[#C9A227]/25 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStep(step)}
                    className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3.5 py-2 text-xs font-bold text-[#FCE38A] hover:bg-[#C9A227] hover:text-black"
                  >
                    <span>عرض الشرح الكامل والذكر بالتشكيل</span>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
