import React, {useMemo, useState} from 'react';
import {BookOpen, Heart, Search, Sparkles} from 'lucide-react';
import {NAMES_OF_ALLAH} from '../data/namesOfAllah';
import {useLocalStorage} from '../hooks/useLocalStorage';

const WHO_IS_ALLAH_SECTIONS = [
  {
    titleAr: 'توحيد الربوبية: الخالق المدبّر الرازق',
    descAr:
      'الله جل جلاله هو خالق السماوات والأرض وما بينهما، مالك الملك، يدبر الأمر من السماء إلى الأرض، يحيي ويميت، ويرزق كل دابة في البر والبحر، لا خالق غيره ولا رازق سواه.',
    evidenceAr: '﴿اللَّهُ خَالِقُ كُلِّ شَيْءٍ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ وَكِيلٌ﴾',
  },
  {
    titleAr: 'توحيد الألوهية: المستحق للعبادة وحده',
    descAr:
      'لا معبود بحق إلا الله، له تُصرف الصلاة والدعاء والخوف والرجاء والتوكل والاستغاثة والنذر، فمن أخلص قلبه لله ذاق حلاوة الإيمان والسكينة وتحرر من عبودية المخلوقين.',
    evidenceAr: '﴿وَإِلَٰهُكُمْ إِلَٰهٌ وَاحِدٌ لَّا إِلَٰهَ إِلَّا هُوَ الرَّحْمَٰنُ الرَّحِيمُ﴾',
  },
  {
    titleAr: 'توحيد الأسماء والصفات: الكمال المطلق والتنزيه',
    descAr:
      'لله الأسماء الحسنى والصفات العُلى على الوجه اللائق بجلاله وعظمته، من غير تحريف ولا تعطيل ولا تكييف ولا تمثيل؛ فهو السميع الذي لا تخفى عليه الأصوات، البصير الذي يرى دبيب النملة، العليم بما كان وما يكون.',
    evidenceAr: '﴿لَيْسَ كَمِثْلِهِ شَيْءٌ وَهُوَ السَّمِيعُ الْبَصِيرُ﴾',
  },
  {
    titleAr: 'الرحمة الواسعة والعفو وإجابة المضطر',
    descAr:
      'سبقَت رحمته غضبه، ووسعت كل شيء، يبسط يده بالليل ليتوب مسيء النهار، ويبسط يده بالنهار ليتوب مسيء الليل، قريب من الداعين يجيبهم إذا دعوه بصدق وإخلاص.',
    evidenceAr: '﴿وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ﴾',
  },
  {
    titleAr: 'صفات الجلال والجمال والعظمة',
    descAr:
      'الحي القيوم الذي لا يعتريه نوم ولا تعب، الأول قبل كل شيء والآخر بعد كل شيء، له الكبرياء في السماوات والأرض، لا يُسأل عما يفعل لعلمه وحكمته وعدله المطلق.',
    evidenceAr: '﴿هُوَ الْأَوَّلُ وَالْآخِرُ وَالظَّاهِرُ وَالْبَاطِنُ وَهُوَ بِكُلِّ شَيْءٍ عَلِيمٌ﴾',
  },
  {
    titleAr: 'ثمار معرفة الله بأسمائه الحسنى في قلب المؤمن',
    descAr:
      'من عرف ربه باسم «الرزاق» اطمأن قلبه وترك الحسد، ومن عرفه باسم «الغفور» جدد توبته ولم يقنط، ومن عرفه باسم «الرقيب» استحيا من معصيته، ومن عرفه باسم «الوكيل» واجه صعاب الحياة بقلب شجاع مطمئن.',
    evidenceAr: '﴿وَلِلَّهِ الْأَسْمَاءُ الْحُسْنَىٰ فَادْعُوهُ بِهَا﴾',
  },
];

export const WhoIsAllahView: React.FC = () => {
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
        String(item.number) === q
      );
    });
  }, [query, onlyFavs, favorites]);

  return (
    <div className="space-y-6">
      {/* Tawhid & Attributes Full Introduction Section */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-white p-6 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              من هو الله؟ — بالأسماء الحسنى والصفات العُلى
            </h2>
            <p className="font-quran mt-1 text-base font-bold text-[#9A7415] dark:text-[#F3D56B]">
              «قُلْ هُوَ اللَّهُ أَحَدٌ — اللَّهُ الصَّمَدُ — لَمْ يَلِدْ وَلَمْ يُولَدْ — وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ»
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-loose text-slate-700 dark:text-zinc-200">
          معرفة الله جل وعلا بأسمائه الحسنى وصفاته الكاملة هي أصل الدين وروح الإيمان وأعظم العلوم وأشرفها؛ إذ بشرف المعلوم يشرف العلم. وبقدر ما يعرف العبد ربه يزداد له حبًا وتعظيمًا وخشيةً ورجاءً ورضا وطمأنينة، وقد قال النبي ﷺ: «إن لله تسعةً وتسعين اسمًا مائة إلا واحدًا من أحصاها دخل الجنة».
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3">
          {WHO_IS_ALLAH_SECTIONS.map((sec) => (
            <div
              key={sec.titleAr}
              className="flex flex-col justify-between rounded-2xl border border-[#C9A227]/55 bg-slate-50/70 p-4 dark:bg-[#0B0B0B]"
            >
              <div>
                <h3 className="text-sm font-bold text-[#9A7415] dark:text-[#F3D56B]">
                  {sec.titleAr}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-zinc-200">
                  {sec.descAr}
                </p>
              </div>
              <p className="font-quran mt-3 border-t border-[#C9A227]/20 pt-2 text-sm font-bold text-[#C9A227]">
                {sec.evidenceAr}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-[#C9A227]" />
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              أسماء الله الحسنى التسعة والتسعون (99) — قراءة وشرح كامل
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              تدبر الاسم ومعناه وصفاته وأضف الأسماء التي تلامس قلبك إلى المفضلة
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو المعنى..."
              className="w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 py-2.5 pr-9 pl-4 text-sm text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0D0D0D] dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyFavs((f) => !f)}
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
              onlyFavs
                ? 'border-[#C9A227] bg-[#C9A227] text-black'
                : 'border-[#C9A227]/50 text-slate-700 dark:text-white'
            }`}
          >
            <Heart className="h-4 w-4" />
            <span>المفضلة ({favorites.length})</span>
          </button>
        </div>
      </div>

      {/* 99 Names Grid (Pure Reading - Zero Robot Audio) */}
      <div className="grid grid-cols-1 gap-3.5">
        {filtered.map((item) => {
          const isFav = favorites.includes(item.number);
          return (
            <div
              key={item.number}
              className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227]/80 bg-white p-5 transition-colors hover:border-[#C9A227] dark:bg-[#050505]"
            >
              <div>
                <div className="flex items-center justify-between">
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
                        : 'text-slate-400 hover:text-rose-500 dark:text-zinc-600'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <h3 className="font-quran mt-1 text-3xl font-bold text-[#C9A227]">
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
