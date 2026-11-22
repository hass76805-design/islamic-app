import React, {useMemo, useState} from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  Layers,
  Mic,
  Search,
} from 'lucide-react';
import {SCHOLARS_20} from '../data/scholarsData';
import {ScholarLecture} from '../types';

export const ScholarsView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [selectedLecture, setSelectedLecture] = useState<ScholarLecture>(SCHOLARS_20[0]);
  const [viewMode, setViewMode] = useState<'slides' | 'text'>('slides');
  const [slideIdx, setSlideIdx] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(SCHOLARS_20.map((s) => s.categoryAr)));
    return ['الكل', ...unique];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    return SCHOLARS_20.filter((item) => {
      if (activeCategory !== 'الكل' && !q && item.categoryAr !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.scholarNameAr.includes(q) ||
        item.lectureTitleAr.includes(q) ||
        item.transcriptAr.includes(q)
      );
    });
  }, [query, activeCategory]);

  const handleCopy = async (lecture: ScholarLecture) => {
    try {
      await navigator.clipboard.writeText(
        `${lecture.scholarNameAr} — ${lecture.lectureTitleAr}\n\n${lecture.transcriptAr}`,
      );
      setCopiedId(lecture.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <Mic className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                مكتبة دروس وخواطر 20 شيخًا وعالمًا
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
                دروس ومواعظ للشيخ الشعراوي وكشك وابن عثيمين و17 عالمًا — قراءة شاملة وعرض شرائح دون إنترنت
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الشيخ أو موضوع الدرس..."
              className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 py-2.5 pr-9 pl-4 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0D0D0D] dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setQuery('');
                setActiveCategory(cat);
              }}
              className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                activeCategory === cat && !query.trim()
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/40 text-slate-700 hover:border-[#C9A227] dark:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Active Lecture Reader & Slides */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9A227]/25 pb-4">
          <div>
            <span className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
              {selectedLecture.scholarNameAr} · {selectedLecture.scholarTitleAr}
            </span>
            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {selectedLecture.lectureTitleAr}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('slides')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                viewMode === 'slides'
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/40 text-slate-700 dark:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>بطاقات الفوائد</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('text')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                viewMode === 'text'
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/40 text-slate-700 dark:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>النص الكامل</span>
            </button>
          </div>
        </div>

        <div className="mt-4">
          {viewMode === 'slides' && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9A227] bg-[#FFFDF6] p-6 text-center text-slate-900 dark:bg-[#0D0A02] dark:text-white">
              <div className="islamic-pattern-bg pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative z-10 space-y-4 py-3">
                <p className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                  فائدة {slideIdx + 1} من {selectedLecture.keyPointsAr.length}
                </p>
                <h4 className="font-quran text-2xl font-bold text-[#7A5908] dark:text-[#F3D56B] sm:text-3xl">
                  {selectedLecture.keyPointsAr[slideIdx] || selectedLecture.lectureTitleAr}
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-300">
                  {selectedLecture.scholarNameAr} — {selectedLecture.categoryAr}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  {selectedLecture.keyPointsAr.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSlideIdx(idx)}
                      aria-label={`فائدة ${idx + 1}`}
                      className={`h-2.5 rounded-full transition-all ${
                        slideIdx === idx
                          ? 'w-8 bg-[#C9A227]'
                          : 'w-2.5 bg-slate-300 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3 rounded-2xl border border-[#C9A227]/35 bg-slate-50/60 p-4 dark:bg-[#0A0A0A]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                <BookOpen className="h-3.5 w-3.5" />
                <span>نص الدرس وخلاصة الفوائد</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy(selectedLecture)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[#C9A227]/50 px-3 py-1 text-xs font-bold text-slate-700 dark:text-white"
              >
                {copiedId === selectedLecture.id ? (
                  <Check className="h-3.5 w-3.5 text-[#C9A227]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedId === selectedLecture.id ? 'نُسخ النص' : 'نسخ النص'}</span>
              </button>
            </div>

            <p className="text-sm leading-loose text-slate-800 dark:text-zinc-100">
              {selectedLecture.transcriptAr}
            </p>

            <ul className="space-y-1.5 border-t border-[#C9A227]/20 pt-3 text-xs text-slate-700 dark:text-zinc-300">
              {selectedLecture.keyPointsAr.map((pt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-[#C9A227]">
                    {i + 1}.
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 20 Scholars Directory */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((item, idx) => {
          const isActive = selectedLecture.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedLecture(item);
                setSlideIdx(0);
              }}
              className={`flex min-h-[96px] flex-col justify-between rounded-3xl border-2 p-4 text-right transition-colors ${
                isActive
                  ? 'border-[#C9A227] bg-[#C9A227]/15 dark:bg-[#141004]'
                  : 'border-[#C9A227]/60 bg-white hover:border-[#C9A227] dark:bg-[#050505]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono-num text-[11px] font-bold text-[#9A7415] dark:text-[#C9A227]">
                    {String(idx + 1).padStart(2, '0')} · {item.categoryAr}
                  </span>
                  <h4 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {item.scholarNameAr}
                  </h4>
                </div>
                <span className="font-mono-num text-xs font-bold text-[#C9A227]">
                  {item.durationAr}
                </span>
              </div>

              <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                {item.lectureTitleAr}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
