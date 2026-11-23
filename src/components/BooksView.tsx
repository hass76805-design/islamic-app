import React, {useMemo, useState} from 'react';
import {
  BookMarked,
  BookOpen,
  Check,
  Copy,
  Heart,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  BUKHARI_BOOKS,
  BUKHARI_HADITHS,
  CLASSIC_BOOKS,
} from '../data/bukhariData';
import {useLocalStorage} from '../hooks/useLocalStorage';

type BooksTab = 'bukhari' | 'nawawi' | 'riyad';

function normalizeAr(text: string): string {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export const BooksView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BooksTab>('bukhari');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useLocalStorage<string[]>(
    'alzahabi_bukhari_favs_v1',
    [],
  );

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const toggleFav = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev],
    );
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard failures
    }
  };

  const filteredBukhari = useMemo(() => {
    const qRaw = query.trim();
    const qNorm = normalizeAr(qRaw);
    const numQuery = parseInt(qRaw, 10);
    const isNumSearch = !Number.isNaN(numQuery) && String(numQuery) === qRaw;

    return BUKHARI_HADITHS.filter((h) => {
      if (selectedBookId === 'favs' && !favSet.has(h.id)) return false;
      if (
        selectedBookId !== 'all' &&
        selectedBookId !== 'favs' &&
        h.bookId !== selectedBookId
      ) {
        return false;
      }
      if (!qRaw) return true;
      if (isNumSearch) return h.hadithNumber === numQuery;

      return (
        normalizeAr(h.textAr).includes(qNorm) ||
        normalizeAr(h.bookNameAr).includes(qNorm) ||
        normalizeAr(h.chapterAr).includes(qNorm) ||
        normalizeAr(h.narratorAr).includes(qNorm) ||
        normalizeAr(h.benefitAr).includes(qNorm)
      );
    });
  }, [selectedBookId, query, favSet]);

  const activeClassicBook = useMemo(() => {
    if (activeTab === 'bukhari') return null;
    const book = CLASSIC_BOOKS.find((b) => b.id === activeTab);
    if (!book) return null;
    const qNorm = normalizeAr(query);
    if (!qNorm) return book;
    return {
      ...book,
      entries: book.entries.filter(
        (e) =>
          normalizeAr(e.titleAr).includes(qNorm) ||
          normalizeAr(e.textAr).includes(qNorm) ||
          normalizeAr(e.narratorAr).includes(qNorm),
      ),
    };
  }, [activeTab, query]);

  return (
    <div className="space-y-4 pb-4">
      {/* Header & Tabs */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <BookOpen className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              صحيح البخاري والكتب الإسلامية
            </h2>
            <p className="text-[11px] text-[#9A7415] dark:text-[#C9A227]">
              مرتب حسب أبواب صحيح البخاري مع البحث والمفضلة بدون نت
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-[#C9A227]/40 p-1">
          {(
            [
              ['bukhari', 'صحيح البخاري'],
              ['nawawi', 'الأربعون النووية'],
              ['riyad', 'رياض الصالحين'],
            ] as Array<[BooksTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[38px] rounded-xl px-1.5 py-1.5 text-[11px] font-bold transition-colors ${
                activeTab === id
                  ? 'bg-[#C9A227] text-black'
                  : 'text-slate-700 dark:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeTab === 'bukhari'
                ? 'ابحث بكلمة من الحديث، الراوي، الباب، أو رقم الحديث...'
                : 'ابحث في أحاديث الكتاب...'
            }
            className="min-h-[42px] w-full rounded-xl border border-[#C9A227]/65 bg-slate-50 py-2 pr-9 pl-3 text-xs font-bold text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white"
          />
        </div>
      </div>

      {activeTab === 'bukhari' ? (
        <>
          {/* 22 Bukhari Books Horizontal Filter & Select */}
          <div className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-white p-3.5 dark:bg-[#050505]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#9A7415] dark:text-[#FCE38A]">
                فهرس كتب صحيح البخاري ({toArabicDigits(BUKHARI_BOOKS.length)} كتابًا)
              </span>
              <span className="font-mono-num text-[11px] font-bold text-[#C9A227]">
                النتائج: {toArabicDigits(filteredBukhari.length)}
              </span>
            </div>

            <select
              aria-label="تصفية حسب كتاب من صحيح البخاري"
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none dark:bg-[#0B0B0B] dark:text-white"
            >
              <option value="all">
                جميع الكتب والأبواب ({BUKHARI_HADITHS.length} حديثًا مختارًا)
              </option>
              <option value="favs">
                الأحاديث المحفوظة في المفضلة ({favorites.length})
              </option>
              {BUKHARI_BOOKS.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.order}. {book.titleAr} — {book.subtitleAr}
                </option>
              ))}
            </select>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedBookId('all')}
                className={`min-h-[34px] shrink-0 rounded-xl border px-3 text-[11px] font-bold ${
                  selectedBookId === 'all'
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/40 text-slate-700 dark:text-zinc-200'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setSelectedBookId('favs')}
                className={`min-h-[34px] shrink-0 rounded-xl border px-3 text-[11px] font-bold ${
                  selectedBookId === 'favs'
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/40 text-slate-700 dark:text-zinc-200'
                }`}
              >
                المفضلة ({toArabicDigits(favorites.length)})
              </button>
              {BUKHARI_BOOKS.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBookId(book.id)}
                  className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-xl border px-3 text-[11px] font-bold ${
                    selectedBookId === book.id
                      ? 'border-[#C9A227] bg-[#C9A227] text-black'
                      : 'border-[#C9A227]/40 text-slate-700 dark:text-zinc-200'
                  }`}
                >
                  {book.titleAr}
                </button>
              ))}
            </div>
          </div>

          {/* Bukhari Hadiths Cards */}
          {filteredBukhari.length === 0 ? (
            <div className="rounded-3xl border-2 border-[#C9A227]/50 bg-white p-6 text-center dark:bg-[#050505]">
              <BookMarked className="mx-auto h-8 w-8 text-[#C9A227]" />
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                لا توجد أحاديث مطابقة للبحث الحالي
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBukhari.map((hadith) => {
                const isFav = favSet.has(hadith.id);
                const isCopied = copiedId === hadith.id;
                const copyText = `${hadith.bookNameAr} — حديث رقم ${hadith.hadithNumber}\nعن ${hadith.narratorAr}:\n${hadith.textAr}\nالفائدة: ${hadith.benefitAr}`;

                return (
                  <article
                    key={hadith.id}
                    className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-[#C9A227]/25 pb-2.5">
                      <div className="min-w-0">
                        <span className="inline-block rounded-lg border border-[#C9A227]/60 bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-bold text-[#9A7415] dark:text-[#FCE38A]">
                          {hadith.bookNameAr}
                        </span>
                        <p className="mt-1 text-xs font-bold text-slate-700 dark:text-zinc-300">
                          {hadith.chapterAr}
                        </p>
                      </div>
                      <span className="font-mono-num shrink-0 rounded-xl bg-[#C9A227] px-2.5 py-1 text-xs font-extrabold text-black">
                        #{hadith.hadithNumber}
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-[#9A7415] dark:text-[#C9A227]">
                      عن {hadith.narratorAr}:
                    </p>

                    <p className="font-quran rounded-2xl border border-[#C9A227]/35 bg-slate-50/70 p-3.5 text-lg leading-[2.1] text-slate-900 dark:bg-[#0A0904] dark:text-[#FCE38A]">
                      {hadith.textAr}
                    </p>

                    <div className="flex items-start gap-2 rounded-2xl border border-[#C9A227]/30 bg-[#C9A227]/10 p-3 text-xs leading-relaxed text-slate-800 dark:text-zinc-200">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
                      <div>
                        <strong className="text-[#9A7415] dark:text-[#F3D56B]">
                          الفائدة والتوجيه:{' '}
                        </strong>
                        <span>{hadith.benefitAr}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleFav(hadith.id)}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                          isFav
                            ? 'border-[#C9A227] bg-[#C9A227] text-black'
                            : 'border-[#C9A227]/50 text-[#9A7415] dark:text-[#FCE38A]'
                        }`}
                      >
                        <Heart className="h-3.5 w-3.5" />
                        <span>{isFav ? 'محفوظ' : 'مفضلة'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCopy(hadith.id, copyText)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C9A227]/50 px-3 text-xs font-bold text-slate-700 dark:text-white"
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-[#C9A227]" />
                        )}
                        <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        activeClassicBook && (
          <div className="space-y-3">
            <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
              <h3 className="text-sm font-bold text-[#9A7415] dark:text-[#FCE38A]">
                {activeClassicBook.titleAr}
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
                {activeClassicBook.authorAr} · {activeClassicBook.descAr}
              </p>
            </div>

            {activeClassicBook.entries.map((entry) => {
              const isCopied = copiedId === entry.id;
              return (
                <article
                  key={entry.id}
                  className="space-y-2.5 rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {entry.titleAr}
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(
                          entry.id,
                          `${entry.titleAr}\nعن ${entry.narratorAr}:\n${entry.textAr}`,
                        )
                      }
                      className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-xl border border-[#C9A227]/50 px-2.5 text-[11px] font-bold text-[#C9A227]"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{isCopied ? 'نُسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] font-bold text-[#C9A227]">
                    عن {entry.narratorAr}:
                  </p>
                  <p className="font-quran rounded-2xl border border-[#C9A227]/35 bg-slate-50/70 p-3.5 text-lg leading-[2.1] text-slate-900 dark:bg-[#0A0904] dark:text-[#FCE38A]">
                    {entry.textAr}
                  </p>
                </article>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
