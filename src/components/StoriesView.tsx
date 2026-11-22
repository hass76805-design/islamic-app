import React, {useEffect, useMemo, useState} from 'react';
import {BookOpenText, Check, Copy, Search, Sparkles} from 'lucide-react';
import {ISLAMIC_STORIES} from '../data/storiesData';
import {StoryCategoryId} from '../types';
import {useHardwareBack} from '../utils/backNavigation';

interface StoriesViewProps {
  initialCategory?: StoryCategoryId;
}

export const StoriesView: React.FC<StoriesViewProps> = ({
  initialCategory = 'prophets',
}) => {
  const [activeCat, setActiveCat] = useState<StoryCategoryId>(initialCategory);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setActiveCat(initialCategory);
    setSelectedId(null);
  }, [initialCategory]);

  useHardwareBack(
    Boolean(selectedId && selectedId !== '__collapsed__'),
    () => setSelectedId('__collapsed__'),
  );

  const countsByCat = useMemo(() => {
    return {
      prophets: ISLAMIC_STORIES.filter((s) => s.category === 'prophets').length,
      sahaba: ISLAMIC_STORIES.filter((s) => s.category === 'sahaba').length,
      lessons: ISLAMIC_STORIES.filter((s) => s.category === 'lessons').length,
      repentance: ISLAMIC_STORIES.filter((s) => s.category === 'repentance').length,
    };
  }, []);

  const STORY_TABS: Array<{id: StoryCategoryId; labelAr: string; count: number}> = [
    {id: 'prophets', labelAr: 'قصص الأنبياء', count: countsByCat.prophets},
    {id: 'sahaba', labelAr: 'قصص الصحابة', count: countsByCat.sahaba},
    {id: 'lessons', labelAr: 'قصص وعبر ومواعظ', count: countsByCat.lessons},
    {id: 'repentance', labelAr: 'قصص الغفران والتوبة', count: countsByCat.repentance},
  ];

  const items = useMemo(() => {
    const q = search.trim();
    return ISLAMIC_STORIES.filter((s) => {
      if (!q && s.category !== activeCat) return false;
      if (!q) return true;
      return (
        s.titleAr.includes(q) ||
        s.summaryAr.includes(q) ||
        s.storyTextAr.includes(q) ||
        s.lessonAr.includes(q)
      );
    });
  }, [activeCat, search]);

  const handleCopy = async (id: string, title: string, text: string) => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${text}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Category Tabs */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <BookOpenText className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                موسوعة القصص الإسلامية الكاملة (للقراءة فقط)
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
                25 قصة للأنبياء · 100 قصة للصحابة الكرام · 30 قصة وعبرة · 20 قصة في الغفران والتوبة
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في القصص..."
              className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 py-2.5 pr-9 pl-4 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0D0D0D] dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {STORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSearch('');
                  setActiveCat(tab.id);
                  setSelectedId(null);
                }}
                className={`min-h-[42px] rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                  activeCat === tab.id && !search.trim()
                    ? 'border-[#C9A227] bg-[#C9A227] text-black'
                    : 'border-[#C9A227]/40 text-slate-700 hover:border-[#C9A227] dark:text-zinc-200'
                }`}
              >
                {tab.labelAr} ({tab.count})
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedId(selectedId === '__collapsed__' ? null : '__collapsed__')
            }
            className="min-h-[38px] rounded-xl border border-[#C9A227]/50 px-3 py-1.5 text-xs font-bold text-[#9A7415] hover:border-[#C9A227] dark:text-[#F3D56B]"
          >
            {selectedId === '__collapsed__'
              ? 'عرض كل القصص كاملة'
              : 'فهرس العناوين فقط'}
          </button>
        </div>
      </div>

      {/* Stories Reading Cards (Text Only - Zero Robot Voice) */}
      <div className="space-y-4">
        {items.map((story, idx) => {
          const isExpanded = selectedId === story.id || selectedId === null;
          return (
            <div
              key={story.id}
              className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono-num text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                    {String(idx + 1).padStart(2, '0')} · {story.eraOrPersonAr}
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {story.titleAr}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                    {story.summaryAr}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedId(selectedId === story.id ? '__collapsed__' : story.id)
                  }
                  className="min-h-[40px] rounded-xl border border-[#C9A227]/50 px-3.5 py-1.5 text-xs font-bold text-[#9A7415] hover:border-[#C9A227] dark:text-[#C9A227]"
                >
                  {isExpanded ? 'إخفاء أو تركيز' : 'اقرأ القصة كاملة'}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3 border-t border-[#C9A227]/25 pt-4">
                  <div className="space-y-3 text-base leading-[2] text-slate-800 dark:text-zinc-100">
                    {story.storyTextAr.split('\n\n').map((para, pIdx) => (
                      <p key={pIdx}>{para}</p>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9A227]/50 bg-[#C9A227]/10 p-3.5">
                    <div className="flex items-start gap-2 text-xs font-bold text-[#7A590C] dark:text-[#F3D56B]">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
                      <span>العِبرة المستفادة: {story.lessonAr}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(story.id, story.titleAr, story.storyTextAr)
                      }
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#C9A227]/50 px-3 py-1 text-xs font-bold text-slate-700 dark:text-white"
                    >
                      {copiedId === story.id ? (
                        <Check className="h-3.5 w-3.5 text-[#C9A227]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedId === story.id ? 'نُسخت' : 'نسخ القصة'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
