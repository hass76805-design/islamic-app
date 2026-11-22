import React, {useMemo, useState} from 'react';
import {Check, Copy, MoonStar, Search} from 'lucide-react';
import {DREAMS_DICTIONARY} from '../data/dreamsData';

export const DreamsView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(DREAMS_DICTIONARY.map((d) => d.categoryAr)));
    return ['الكل', ...unique];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    return DREAMS_DICTIONARY.filter((d) => {
      if (activeCategory !== 'الكل' && !q && d.categoryAr !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        d.symbolAr.includes(q) ||
        d.interpretationAr.includes(q) ||
        d.detailAr.includes(q) ||
        d.categoryAr.includes(q)
      );
    });
  }, [query, activeCategory]);

  const handleCopy = async (id: string, title: string, detail: string) => {
    try {
      await navigator.clipboard.writeText(`${title}\n${detail}`);
      setCopiedId(id);
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
              <MoonStar className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                تفسير الأحلام والرؤى — بحث شامل
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
                دليل تعبير الرؤى وفق ضوابط أهل العلم ويعمل بالكامل بدون إنترنت
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن رمز الحلم (الماء، الكعبة، الطيران)..."
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

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-8 text-center dark:bg-[#050505]">
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">
            لم يتم العثور على رمز مطابق لبحثك — جرب كلمة أخرى أو تصفح الأقسام.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227]/80 bg-white p-5 transition-colors hover:border-[#C9A227] dark:bg-[#050505]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {item.symbolAr}
                  </h3>
                  <span className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                    {item.categoryAr}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-[#9A7415] dark:text-[#F3D56B]">
                  {item.interpretationAr}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
                  {item.detailAr}
                </p>
              </div>

              <div className="mt-4 flex justify-end border-t border-[#C9A227]/20 pt-3">
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      item.id,
                      `${item.symbolAr}: ${item.interpretationAr}`,
                      item.detailAr,
                    )
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
                      <span>نسخ التفسير</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
