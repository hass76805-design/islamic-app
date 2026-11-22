import React, {useMemo, useState} from 'react';
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {FIQH_FULL_QA, FIQH_QUIZ_QUESTIONS} from '../data/fiqhFullData';
import {FiqhCategoryId} from '../types';

const FIQH_TABS: Array<{id: FiqhCategoryId; labelAr: string}> = [
  {id: 'wudu', labelAr: 'الوضوء والطهارة'},
  {id: 'prayer', labelAr: 'أحكام الصلاة'},
  {id: 'zakat', labelAr: 'أحكام الزكاة'},
  {id: 'fasting', labelAr: 'أحكام الصيام'},
  {id: 'hajj', labelAr: 'الحج والعمرة'},
  {id: 'manners', labelAr: 'المعاملات والآداب'},
];

export const FiqhView: React.FC = () => {
  const [mode, setMode] = useState<'qa' | 'quiz'>('qa');
  const [activeCat, setActiveCat] = useState<FiqhCategoryId>('wudu');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>('w-1');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);

  const items = useMemo(() => {
    const q = search.trim();
    return FIQH_FULL_QA.filter((item) => {
      if (q) {
        return item.questionAr.includes(q) || item.answerAr.includes(q);
      }
      return item.category === activeCat;
    });
  }, [activeCat, search]);

  const handleCopy = async (id: string, q: string, a: string) => {
    try {
      await navigator.clipboard.writeText(`${q}\n\n${a}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const currentQuestion = FIQH_QUIZ_QUESTIONS[quizIndex];
  const chosenForCurrent = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined;

  const correctCount = useMemo(() => {
    return FIQH_QUIZ_QUESTIONS.filter(
      (q) => selectedAnswers[q.id] === q.correctIndex,
    ).length;
  }, [selectedAnswers]);

  const quizScore = Math.round((correctCount / FIQH_QUIZ_QUESTIONS.length) * 100);

  const resetQuiz = () => {
    setQuizIndex(0);
    setSelectedAnswers({});
    setQuizFinished(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Mode Switcher */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              الفقه الإسلامي الشامل + مسابقة أسئلة الفقه
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
              جميع مسائل الطهارة والصلاة والزكاة والصيام والحج والمعاملات مع اختبار تفاعلي
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('qa')}
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                mode === 'qa'
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 text-slate-700 dark:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>المسائل الفقهية</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('quiz')}
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                mode === 'quiz'
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 text-slate-700 dark:text-white'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>مسابقة أسئلة الفقه</span>
            </button>
          </div>
        </div>

        {mode === 'qa' && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {FIQH_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setActiveCat(tab.id);
                    }}
                    className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      activeCat === tab.id && !search.trim()
                        ? 'border-[#C9A227] bg-[#C9A227] text-black'
                        : 'border-[#C9A227]/40 text-slate-700 hover:border-[#C9A227] dark:text-zinc-200'
                    }`}
                  >
                    {tab.labelAr}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث في المسائل الفقهية..."
                  className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 py-2.5 pr-9 pl-4 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0D0D0D] dark:text-white"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {mode === 'qa' ? (
        <div className="space-y-3">
          {items.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-3xl border-2 border-[#C9A227]/80 bg-white dark:bg-[#050505]"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-right"
                >
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {item.questionAr}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#C9A227] transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[#C9A227]/25 px-5 pt-4 pb-5">
                    <p className="text-sm leading-loose text-slate-700 dark:text-zinc-200">
                      {item.answerAr}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                        الدليل: {item.evidenceAr}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(item.id, item.questionAr, item.answerAr)
                        }
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C9A227]/50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-[#C9A227]/15 dark:text-[#F3D56B]"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#C9A227]" />
                            <span>تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>نسخ الفائدة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : quizFinished ? (
        /* Quiz Final Score */
        <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-6 text-center dark:bg-[#050505]">
          <Award className="mx-auto h-14 w-14 text-[#C9A227]" />
          <p className="mt-2 text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
            النتيجة النهائية لمسابقة الفقه
          </p>
          <p className="font-mono-num mt-2 text-5xl font-bold text-slate-900 dark:text-[#F3D56B]">
            {quizScore} / 100
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
            أجبت بشكل صحيح عن {correctCount} من أصل {FIQH_QUIZ_QUESTIONS.length} أسئلة
          </p>

          <button
            type="button"
            onClick={resetQuiz}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#C9A227] px-6 py-2.5 text-sm font-bold text-black hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            <span>إعادة المسابقة</span>
          </button>

          <div className="mt-6 space-y-3 text-right">
            {FIQH_QUIZ_QUESTIONS.map((q, idx) => {
              const userAns = selectedAnswers[q.id];
              const isRight = userAns === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-4 ${
                    isRight
                      ? 'border-emerald-500/60 bg-emerald-950/10'
                      : 'border-rose-500/60 bg-rose-950/15'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {idx + 1}. {q.questionAr}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#9A7415] dark:text-[#F3D56B]">
                    الإجابة الصحيحة: {q.options[q.correctIndex]}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                    {q.explanationAr}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Active Quiz Question */
        currentQuestion && (
          <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-6 dark:bg-[#050505]">
            <div className="flex items-center justify-between border-b border-[#C9A227]/25 pb-3 text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
              <span>
                السؤال {quizIndex + 1} من {FIQH_QUIZ_QUESTIONS.length}
              </span>
              <span className="font-mono-num">
                إجابات صحيحة: {correctCount}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              {currentQuestion.questionAr}
            </h3>

            <div className="mt-4 space-y-2.5">
              {currentQuestion.options.map((opt, idx) => {
                const answered = chosenForCurrent !== undefined;
                const isSelected = chosenForCurrent === idx;
                const isCorrect = idx === currentQuestion.correctIndex;
                let styleClass =
                  'border-[#C9A227]/45 bg-slate-50/70 text-slate-900 hover:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white';
                if (answered) {
                  if (isCorrect) {
                    styleClass =
                      'border-emerald-500 bg-emerald-600/20 text-emerald-900 dark:text-emerald-200';
                  } else if (isSelected && !isCorrect) {
                    styleClass =
                      'border-rose-500 bg-rose-600/20 text-rose-900 dark:text-rose-200';
                  }
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={answered}
                    onClick={() =>
                      setSelectedAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: idx,
                      }))
                    }
                    className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-right text-sm font-bold transition-colors ${styleClass}`}
                  >
                    <span>{opt}</span>
                    {answered && isCorrect && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                    {answered && isSelected && !isCorrect && (
                      <XCircle className="h-5 w-5 text-rose-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {chosenForCurrent !== undefined && (
              <div className="mt-4 rounded-2xl border border-[#C9A227]/60 bg-[#C9A227]/10 p-4">
                <p className="text-xs font-bold text-[#9A7415] dark:text-[#F3D56B]">
                  {chosenForCurrent === currentQuestion.correctIndex
                    ? 'إجابة صحيحة! أحسنت'
                    : 'إجابة غير صحيحة'}
                </p>
                <p className="mt-1 text-sm text-slate-800 dark:text-zinc-200">
                  {currentQuestion.explanationAr}
                </p>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (quizIndex < FIQH_QUIZ_QUESTIONS.length - 1) {
                        setQuizIndex((i) => i + 1);
                      } else {
                        setQuizFinished(true);
                      }
                    }}
                    className="min-h-[42px] rounded-xl bg-[#C9A227] px-5 py-2 text-xs font-bold text-black hover:opacity-90"
                  >
                    {quizIndex < FIQH_QUIZ_QUESTIONS.length - 1
                      ? 'السؤال التالي'
                      : 'عرض النتيجة النهائية'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
