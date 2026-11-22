import React, {useMemo, useState} from 'react';
import {Calendar, ChevronLeft, ChevronRight, Sparkles} from 'lucide-react';
import {
  formatGregorianAr,
  getDateKey,
  getHijriMonthGrid,
  getHijriParts,
  HIJRI_MONTHS_AR,
  ISLAMIC_OCCASIONS,
  WEEKDAYS_AR,
} from '../utils/hijri';

export const HijriCalendarView: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const todayHijri = useMemo(() => getHijriParts(today), [today]);
  const todayKey = getDateKey(today);

  const [viewYear, setViewYear] = useState(todayHijri.year);
  const [viewMonth, setViewMonth] = useState(todayHijri.month);
  const [convertDateStr, setConvertDateStr] = useState(todayKey);

  const monthGrid = useMemo(
    () => getHijriMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const convertedHijri = useMemo(() => {
    if (!convertDateStr) return null;
    const [y, m, d] = convertDateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return {
      hijri: getHijriParts(dt),
      gregorian: formatGregorianAr(dt),
    };
  }, [convertDateStr]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const monthOccasions = useMemo(
    () => ISLAMIC_OCCASIONS.filter((o) => o.month === viewMonth),
    [viewMonth],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5">
        {/* Monthly Hijri Grid */}
        <section className="rounded-3xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9A227]/30 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {HIJRI_MONTHS_AR[viewMonth - 1]} {viewYear} هـ
              </h2>
              <p className="mt-0.5 text-xs text-[#9A7415] dark:text-[#C9A227]">
                اليوم: {todayHijri.weekdayAr} {todayHijri.day} {todayHijri.monthNameAr}{' '}
                {todayHijri.year} هـ
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="الشهر السابق"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/60 text-slate-700 hover:bg-[#C9A227]/15 dark:text-[#C9A227]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewYear(todayHijri.year);
                  setViewMonth(todayHijri.month);
                }}
                className="min-h-[40px] rounded-xl bg-[#C9A227] px-3 py-2 text-xs font-bold text-black hover:opacity-90"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="الشهر التالي"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/60 text-slate-700 hover:bg-[#C9A227]/15 dark:text-[#C9A227]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
            {WEEKDAYS_AR.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({length: monthGrid.firstWeekday}).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-16 rounded-2xl sm:h-20" />
            ))}
            {monthGrid.days.map((cell) => {
              const cellKey = getDateKey(cell.gregorianDate);
              const isToday = cellKey === todayKey;
              return (
                <div
                  key={cell.hijriDay}
                  className={`flex h-16 flex-col items-center justify-center rounded-2xl border p-1 text-center transition-colors sm:h-20 ${
                    isToday
                      ? 'border-2 border-[#C9A227] bg-[#C9A227] text-black'
                      : cell.occasion
                      ? 'border-2 border-[#C9A227] bg-[#C9A227]/15'
                      : cell.isWhiteDay
                      ? 'border-[#C9A227]/70 bg-slate-50 dark:bg-[#111]'
                      : 'border-[#C9A227]/30 bg-slate-50/50 dark:bg-[#0B0B0B]'
                  }`}
                >
                  <span
                    className={`font-mono-num text-base font-bold sm:text-lg ${
                      isToday ? 'text-black' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {cell.hijriDay}
                  </span>
                  <span
                    className={`font-mono-num text-[10px] ${
                      isToday
                        ? 'font-bold text-black/80'
                        : 'text-slate-500 dark:text-[#C9A227]'
                    }`}
                  >
                    {cell.gregorianDate.getDate()}/{cell.gregorianDate.getMonth() + 1}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#C9A227]/25 pt-3 text-xs text-slate-600 dark:text-zinc-300">
            <span>الأيام البيض: 13 · 14 · 15 من كل شهر هجري</span>
            <span>·</span>
            <span>المناسبات الإسلامية مميزة بإطار ذهبي</span>
          </div>
        </section>

        {/* Side Column */}
        <aside className="space-y-4">
          <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
            <div className="flex items-center gap-2 text-[#C9A227]">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                مناسبات هذا الشهر
              </h3>
            </div>
            {monthOccasions.length === 0 ? (
              <p className="mt-3 text-xs text-slate-600 dark:text-zinc-300">
                تستمر فيه الأيام البيض (13 و14 و15) وصيام الإثنين والخميس.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {monthOccasions.map((occ) => (
                  <div
                    key={`${occ.month}-${occ.day}`}
                    className="rounded-2xl border border-[#C9A227]/50 bg-slate-50 p-3.5 dark:bg-[#0B0B0B]"
                  >
                    <p className="text-sm font-bold text-[#9A7415] dark:text-[#F3D56B]">
                      {occ.day} {HIJRI_MONTHS_AR[occ.month - 1]} — {occ.titleAr}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                      {occ.descriptionAr}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
            <div className="flex items-center gap-2 text-[#C9A227]">
              <Calendar className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                محوّل التاريخ (ميلادي ← هجري)
              </h3>
            </div>
            <input
              type="date"
              value={convertDateStr}
              onChange={(e) => setConvertDateStr(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[#C9A227]/60 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#C9A227] dark:bg-[#0B0B0B] dark:text-white"
            />
            {convertedHijri && (
              <div className="mt-4 rounded-2xl border-2 border-[#C9A227] bg-[#FFFDF6] p-4 text-slate-900 dark:bg-[#0D0A02] dark:text-white">
                <p className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
                  التاريخ الهجري الموافق
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-[#F3D56B]">
                  {convertedHijri.hijri.weekdayAr} {convertedHijri.hijri.day}{' '}
                  {convertedHijri.hijri.monthNameAr} {convertedHijri.hijri.year} هـ
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-300">
                  {convertedHijri.gregorian}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
