import React, {useMemo, useState} from 'react';
import {Heart, Search} from 'lucide-react';
import {NAMES_OF_ALLAH} from '../data/namesOfAllah';
import {useLocalStorage} from '../hooks/useLocalStorage';

export const NamesOfAllahView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useLocalStorage<number[]>('allah_names_favs', []);
  const [onlyFavs, setOnlyFavs] = useState(false);

  const toggleFav = (num: number) => {
    setFavorites((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num],
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    return NAMES_OF_ALLAH.filter((item) => {
      if (onlyFavs && !favorites.includes(item.number)) return false;
      if (!q) return true;
      return (
        item.name.includes(q) ||
        item.meaningAr.includes(q) ||
        item.descriptionAr.includes(q) ||
        item.transliteration.toLowerCase().includes(q.toLowerCase()) ||
        String(item.number) === q
      );
    });
  }, [query, onlyFavs, favorites]);

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-[#F3D56B]">
            أسماء الله الحسنى (99 اسمًا)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-300">
            «لِلَّهِ تِسْعَةٌ وَتِسْعُونَ اسْمًا مِائَةً إِلَّا وَاحِدًا مَنْ أَحْصَاهَا دَخَلَ الْجَنَّةَ»
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو المعنى..."
              className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 py-2.5 pr-9 pl-4 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyFavs((f) => !f)}
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
              onlyFavs
                ? 'border-[#C9A227] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/50 text-slate-700 hover:border-[#C9A227] dark:text-white'
            }`}
          >
            <Heart className="h-4 w-4" />
            <span>المفضلة ({favorites.length})</span>
          </button>
        </div>
      </div>

      {/* Grid of Names */}
      <div className="grid grid-cols-1 gap-3.5">
        {filtered.map((item) => {
          const isFav = favorites.includes(item.number);
          return (
            <div
              key={item.number}
              className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227]/75 bg-white p-5 transition-colors hover:border-[#C9A227] dark:bg-[#050505]"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="font-mono-num text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                    {String(item.number).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleFav(item.number)}
                    aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                      isFav
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'text-slate-400 hover:text-rose-500 dark:text-zinc-500'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <h3 className="font-quran mt-1 text-3xl font-bold text-[#9A7415] dark:text-[#F3D56B]">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                  {item.meaningAr}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                  {item.descriptionAr}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
