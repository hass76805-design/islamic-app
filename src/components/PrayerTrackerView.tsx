import React, {useMemo, useState} from 'react';
import {Check, Clock, Flame, X} from 'lucide-react';
import {
  DailyPrayerLog,
  PrayerTrackStatus,
  TrackablePrayer,
} from '../types';
import {getDateKey, getHijriParts} from '../utils/hijri';

interface PrayerTrackerViewProps {
  log: DailyPrayerLog;
  onSetStatus: (
    dateKey: string,
    prayer: TrackablePrayer,
    status: PrayerTrackStatus,
  ) => void;
}

const PRAYERS: Array<{key: TrackablePrayer; nameAr: string}> = [
  {key: 'fajr', nameAr: 'الفجر'},
  {key: 'dhuhr', nameAr: 'الظهر'},
  {key: 'asr', nameAr: 'العصر'},
  {key: 'maghrib', nameAr: 'المغرب'},
  {key: 'isha', nameAr: 'العشاء'},
];

const STATUS_META: Record<
  PrayerTrackStatus,
  {labelAr: string; cls: string}
> = {
  none: {
    labelAr: 'غير مسجلة',
    cls: 'border-[#C9A227]/40 bg-slate-50 text-slate-600 dark:bg-[#0B0B0B] dark:text-zinc-300',
  },
  ontime: {
    labelAr: 'في وقتها',
    cls: 'border-[#C9A227] bg-[#C9A227] text-black',
  },
  late: {
    labelAr: 'قضاء',
    cls: 'border-amber-500 bg-amber-500/20 text-amber-800 dark:text-[#F3D56B]',
  },
  missed: {
    labelAr: 'فاتت',
    cls: 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
};

export const PrayerTrackerView: React.FC<PrayerTrackerViewProps> = ({
  log,
  onSetStatus,
}) => {
  const today = useMemo(() => new Date(), []);
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey(today));

  const last7Days = useMemo(() => {
    const arr: Array<{key: string; date: Date; label: string; hijriDay: number}> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const hijri = getHijriParts(d);
      arr.push({
        key: getDateKey(d),
        date: d,
        label: hijri.weekdayAr,
        hijriDay: hijri.day,
      });
    }
    return arr;
  }, [today]);

  const dayRecord = log[selectedDateKey] || {
    fajr: 'none',
    dhuhr: 'none',
    asr: 'none',
    maghrib: 'none',
    isha: 'none',
  };

  const weeklyStats = useMemo(() => {
    let ontime = 0;
    let late = 0;
    const total = last7Days.length * 5;
    for (const day of last7Days) {
      const rec = log[day.key];
      if (!rec) continue;
      for (const p of PRAYERS) {
        if (rec[p.key] === 'ontime') ontime++;
        else if (rec[p.key] === 'late') late++;
      }
    }
    return {
      ontime,
      late,
      pct: Math.round(((ontime + late) / total) * 100),
    };
  }, [last7Days, log]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const rec = log[getDateKey(d)];
      const allDone =
        rec &&
        PRAYERS.every((p) => rec[p.key] === 'ontime' || rec[p.key] === 'late');
      if (allDone) {
        count++;
      } else if (i > 0) {
        break;
      }
    }
    return count;
  }, [log, today]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-3xl border-2 border-[#C9A227] bg-[#FFFDF6] p-5 text-slate-900 dark:bg-[#0D0A02] dark:text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]">
              سلسلة الالتزام
            </span>
            <Flame className="h-5 w-5 text-[#C9A227]" />
          </div>
          <p className="font-mono-num mt-2 text-3xl font-bold text-[#9A7415] dark:text-[#F3D56B]">
            {streak} يوم
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
            أيام متتالية بإتمام الصلوات الخمس
          </p>
        </div>

        <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            الالتزام الأسبوعي (آخر 7 أيام)
          </span>
          <p className="font-mono-num mt-2 text-3xl font-bold text-[#C9A227]">
            {weeklyStats.pct}%
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
            {weeklyStats.ontime} في وقتها · {weeklyStats.late} قضاء
          </p>
        </div>

        <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            تاريخ اليوم المحدد
          </span>
          <p className="font-mono-num mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {selectedDateKey}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
            اضغط على حالة كل صلاة للتحديث
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {last7Days.map((day) => {
          const isSelected = day.key === selectedDateKey;
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDateKey(day.key)}
              className={`flex min-h-[60px] min-w-[82px] flex-1 flex-col items-center rounded-2xl border-2 px-3 py-2.5 text-center transition-colors ${
                isSelected
                  ? 'border-[#C9A227] bg-[#C9A227] text-black'
                  : 'border-[#C9A227]/50 bg-white text-slate-900 hover:border-[#C9A227] dark:bg-[#050505] dark:text-white'
              }`}
            >
              <span className="text-[11px] opacity-80">{day.label}</span>
              <span className="font-mono-num mt-0.5 text-base font-bold">
                {day.hijriDay}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          الصلوات المفروضة ليوم {selectedDateKey}
        </h3>
        <div className="mt-4 space-y-2.5">
          {PRAYERS.map((p) => {
            const current = dayRecord[p.key] || 'none';
            return (
              <div
                key={p.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9A227]/25 px-4 py-3"
              >
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {p.nameAr}
                </span>
                <div className="flex flex-wrap gap-2">
                  {(['ontime', 'late', 'missed', 'none'] as PrayerTrackStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => onSetStatus(selectedDateKey, p.key, st)}
                        className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                          current === st
                            ? STATUS_META[st].cls
                            : 'border-[#C9A227]/40 text-slate-600 hover:border-[#C9A227] dark:text-zinc-300'
                        }`}
                      >
                        {st === 'ontime' && <Check className="h-3.5 w-3.5" />}
                        {st === 'late' && <Clock className="h-3.5 w-3.5" />}
                        {st === 'missed' && <X className="h-3.5 w-3.5" />}
                        <span>{STATUS_META[st].labelAr}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
