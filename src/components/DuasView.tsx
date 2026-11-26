import React, {useMemo, useState} from 'react';
import {Check, Copy, Search, Share2} from 'lucide-react';
import {DUAS_LIBRARY} from '../data/duasData';
import {DuaCategoryId} from '../types';

const DUA_CATS: Array<{id: DuaCategoryId | 'all'; labelAr: string}> = [
  {id: 'all', labelAr: 'الكل'},
  {id: 'quranic', labelAr: 'أدعية قرآنية'},
  {id: 'prophetic', labelAr: 'أدعية نبوية'},
  {id: 'distress', labelAr: 'الكرب والهم'},
  {id: 'rizq', labelAr: 'الرزق والبركة'},
  {id: 'family', labelAr: 'الوالدين والذرية'},
  {id: 'travel', labelAr: 'السفر والمطر'},
  {id: 'ruqyah', labelAr: 'الرقية الشرعية'},
];

export const DuasView: React.FC = () => {
  const [cat, setCat] = useState<DuaCategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim();
    return DUAS_LIBRARY.filter((d) => {
      if (cat !== 'all' && d.category !== cat) return false;
      if (!q) return true;
      return (
        d.titleAr.includes(q) ||
        d.arabicText.includes(q) ||
        d.sourceAr.includes(q)
      );
    });
  }, [cat, search]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleShare = async (title: string, text: string, source: string, id: string) => {
    const payload = `${title}\n\n${text}\n\n(${source}) — البرنامج الإسلامي الذهبي`;
    if (navigator.share) {
      try {
        await navigator.share({title, text: payload});
        return;
      } catch {
        // ignore
      }
    }
    await handleCopy(id, payload);
  };

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              جوامع الأدعية المأثورة
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
              أدعية قرآنية ونبوية صحيحة كاملة للقراءة مع النسخ والمشاركة
            </p>
          </div>

          <div className="relative w-full">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الأدعية..."
              className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 py-2.5 pr-9 pl-4 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DUA_CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                cat === c.id
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/40 text-slate-800 hover:border-[#C9A227] dark:text-white'
              }`}
            >
              {c.labelAr}
            </button>
          ))}
        </div>
      </div>

      {/* Duas Grid */}
      <div className="grid grid-cols-1 gap-3.5">
        {filtered.map((d) => (
          <div
            key={d.id}
            className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227]/80 bg-white p-5 dark:bg-[#050505]"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#9A7415] dark:text-[#C9A227]">
                  {d.titleAr}
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  {d.sourceAr}
                </span>
              </div>
              <p className="font-quran mt-3 text-2xl leading-[2.1] text-slate-900 dark:text-white">
                {d.arabicText}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#C9A227]/20 pt-3.5">
              <button
                type="button"
                onClick={() => handleCopy(d.id, `${d.arabicText}\n(${d.sourceAr})`)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C9A227]/50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-[#C9A227]/15 dark:text-white"
              >
                {copiedId === d.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#C9A227]" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>نسخ</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleShare(d.titleAr, d.arabicText, d.sourceAr, d.id)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3.5 py-2 text-xs font-bold text-black hover:opacity-90"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>مشاركة</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
