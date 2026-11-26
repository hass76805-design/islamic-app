import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  HardDrive,
  Loader2,
  Pause,
  Play,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {
  AUDIO_SECTIONS_CATALOG,
  AudioCatalogItem,
  AudioSectionKey,
  checkIfDownloaded,
  deleteDownload,
  downloadSection,
  downloadSingle,
  getPendingDownloadQueue,
  getStorageUsage,
  getWifiOnlySetting,
  queueDownloadWhenOnline,
  resolveDownloadedAudioSrc,
  setWifiOnlySetting,
  StorageUsageSummary,
  subscribeDownloadsChanged,
} from '../services/downloadManager';

export const OfflineDownloadsView: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () => new Set(getPendingDownloadQueue()),
  );
  const [usage, setUsage] = useState<StorageUsageSummary | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<AudioSectionKey, boolean>
  >({
    lectures: true,
    quran_audio: true,
    nasheed: false,
    khutab: false,
  });
  const [sectionProgress, setSectionProgress] = useState<
    Partial<Record<AudioSectionKey | 'all', number>>
  >({});
  const [downloadingItemIds, setDownloadingItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [wifiOnly, setWifiOnly] = useState<boolean>(() => getWifiOnlySetting());

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSourceLabel, setPlaySourceLabel] = useState<string>('');
  const [offlinePromptItem, setOfflinePromptItem] =
    useState<AudioCatalogItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const [summary, checks] = await Promise.all([
      getStorageUsage(),
      Promise.all(
        AUDIO_SECTIONS_CATALOG.flatMap((s) => s.items).map(async (item) => ({
          id: item.id,
          ok: await checkIfDownloaded(item.id),
        })),
      ),
    ]);
    setUsage(summary);
    setDownloadedIds(
      new Set(checks.filter((c) => c.ok).map((c) => c.id)),
    );
    setPendingIds(new Set(getPendingDownloadQueue()));
    setWifiOnly(getWifiOnlySetting());
  }, []);

  useEffect(() => {
    void refreshState();
    const unsub = subscribeDownloadsChanged(() => {
      void refreshState();
    });
    return () => {
      unsub();
    };
  }, [refreshState]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const totalCatalogMb = useMemo(
    () =>
      Number(
        AUDIO_SECTIONS_CATALOG.flatMap((s) => s.items)
          .reduce((sum, i) => sum + i.estimatedMb, 0)
          .toFixed(1),
      ),
    [],
  );

  const handleDownloadSection = async (sectionId: AudioSectionKey | 'all') => {
    if (!isOnline) {
      showToast('اتصل بالإنترنت لتحميل المقاطع وحفظها أوفلاين');
      return;
    }
    setSectionProgress((prev) => ({...prev, [sectionId]: 1}));
    const res = await downloadSection(sectionId, (p) => {
      setSectionProgress((prev) => ({...prev, [sectionId]: p.percent}));
    });
    setSectionProgress((prev) => {
      const next = {...prev};
      delete next[sectionId];
      return next;
    });
    await refreshState();
    showToast(
      `تم تحميل ${res.successCount} من ${res.totalCount} ملفًا في audio-cache-v1 ✓`,
    );
  };

  const handleDownloadSingle = async (item: AudioCatalogItem) => {
    if (!isOnline && !item.url.startsWith('/')) {
      setOfflinePromptItem(item);
      return;
    }
    setDownloadingItemIds((prev) => new Set(prev).add(item.id));
    const ok = await downloadSingle(item);
    setDownloadingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    await refreshState();
    if (ok) {
      showToast(`تم حفظ «${item.title}» للاستماع أوفلاين ✓`);
    } else {
      showToast('تعذر التحميل حاليًا — حاول مرة أخرى عند توفر اتصال مستقر');
    }
  };

  const handleDelete = async (target: string | AudioSectionKey | 'all') => {
    await deleteDownload(target);
    if (playingId && (target === 'all' || target === playingId)) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
    await refreshState();
    showToast('تم حذف الملفات المحمّلة لتوفير المساحة');
  };

  const handlePlayItem = async (item: AudioCatalogItem) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    if (playingId === item.id && isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const isItemDownloaded =
      downloadedIds.has(item.id) || (await checkIfDownloaded(item.id));

    if (!isItemDownloaded && !isOnline && !item.url.startsWith('/')) {
      setOfflinePromptItem(item);
      return;
    }

    const resolved = await resolveDownloadedAudioSrc(item.url);
    setPlayingId(item.id);
    setIsPlaying(true);
    setPlaySourceLabel(
      resolved.cached || isItemDownloaded
        ? 'يعمل أوفلاين من audio-cache-v1 ✓'
        : 'بث مباشر أونلاين',
    );
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      if (!isOnline) {
        setOfflinePromptItem(item);
      } else {
        showToast('تعذر تشغيل هذا الملف حاليًا');
      }
    };
    audio.src = resolved.src;
    audio.play().catch(() => {
      setIsPlaying(false);
      if (!isOnline) setOfflinePromptItem(item);
    });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header & Storage Summary */}
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#060604] p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-[#FCE38A]" />
              <h2 className="text-base font-extrabold text-[#FCE38A]">
                التحميلات والمكتبة الأوفلاين
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              حمّل المحاضرات والقرآن الصوتي والأناشيد والخطب في{' '}
              <span className="font-mono-num text-[#C9A227]">audio-cache-v1</span>{' '}
              لتعمل بدون نت في أي وقت.
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
              isOnline
                ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                : 'border-[#C9A227]/60 bg-[#1A1303] text-[#FCE38A]'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span>متصل</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>أوفلاين</span>
              </>
            )}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-[#C9A227]/40 bg-black/70 p-3">
            <p className="text-[11px] text-zinc-400">مساحة التخزين المستخدمة</p>
            <p className="font-mono-num mt-0.5 text-base font-extrabold text-[#FCE38A]">
              {usage ? `${usage.totalMb} MB` : '0 MB'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#C9A227]/40 bg-black/70 p-3">
            <p className="text-[11px] text-zinc-400">الملفات المحمّلة</p>
            <p className="font-mono-num mt-0.5 text-base font-extrabold text-emerald-300">
              {usage
                ? `${usage.downloadedCount} / ${usage.totalItemsCount}`
                : '0'}
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={sectionProgress.all !== undefined}
            onClick={() => void handleDownloadSection('all')}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-3 text-xs font-extrabold text-black active:scale-95 disabled:opacity-60"
          >
            {sectionProgress.all !== undefined ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري التحميل {sectionProgress.all}%</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>تحميل الكل ({totalCatalogMb} MB)</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete('all')}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-rose-500/60 bg-rose-950/30 px-3 text-xs font-extrabold text-rose-300 active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            <span>حذف الكل</span>
          </button>
        </div>

        {/* Wifi Only Quick Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !wifiOnly;
            setWifiOnlySetting(next);
            setWifiOnly(next);
          }}
          className="mt-2.5 flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-[#C9A227]/35 bg-[#0C0B06] px-3.5 py-2 text-right"
        >
          <span className="text-xs font-bold text-zinc-200">
            تحميل تلقائي على واي فاي فقط
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
              wifiOnly
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {wifiOnly ? 'مفعّل ✓' : 'متاح على الكل'}
          </span>
        </button>

        {playingId && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/60 bg-[#141004] px-3 py-2 text-xs">
            <span className="truncate font-bold text-[#FCE38A]">
              {playSourceLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!audioRef.current) return;
                if (isPlaying) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                } else {
                  audioRef.current.play().catch(() => {});
                  setIsPlaying(true);
                }
              }}
              className="shrink-0 rounded-xl bg-[#C9A227] px-2.5 py-1 font-extrabold text-black"
            >
              {isPlaying ? 'إيقاف مؤقت' : 'استئناف'}
            </button>
          </div>
        )}
      </section>

      {toastMsg && (
        <div className="rounded-2xl border border-emerald-500/60 bg-emerald-950/60 px-3.5 py-2.5 text-center text-xs font-bold text-emerald-200">
          {toastMsg}
        </div>
      )}

      {/* 4 Audio Sections */}
      {AUDIO_SECTIONS_CATALOG.map((section) => {
        const secPercent = sectionProgress[section.id];
        const isSecDownloading = secPercent !== undefined;
        const secSizeMb = Number(
          section.items.reduce((s, i) => s + i.estimatedMb, 0).toFixed(1),
        );
        const downloadedInSec = section.items.filter((i) =>
          downloadedIds.has(i.id),
        ).length;
        const allSecDownloaded =
          section.items.length > 0 && downloadedInSec === section.items.length;
        const isExpanded = expandedSections[section.id];

        return (
          <section
            key={section.id}
            className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-white dark:bg-[#050505]"
          >
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-[#FCE38A]">
                      {section.titleAr}
                    </h3>
                    {allSecDownloaded && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>محمل ✓</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    {section.subtitleAr}
                  </p>
                  <p className="font-mono-num mt-1 text-[11px] font-bold text-[#9A7415] dark:text-[#C9A227]">
                    الحجم الكلي: {secSizeMb} MB · المحمّل: {downloadedInSec}/
                    {section.items.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      [section.id]: !prev[section.id],
                    }))
                  }
                  aria-label="عرض المقاطع"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C9A227]/50 text-[#C9A227]"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {isSecDownloading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-[#C9A227]">
                    <span>جاري تحميل القسم...</span>
                    <span className="font-mono-num">{secPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#FCE38A] to-[#C9A227] transition-all"
                      style={{width: `${secPercent}%`}}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSecDownloading}
                  onClick={() => void handleDownloadSection(section.id)}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[#C9A227] px-3 text-xs font-extrabold text-black active:scale-95 disabled:opacity-60"
                >
                  {isSecDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>تحميل القسم كامل</span>
                </button>

                <button
                  type="button"
                  disabled={downloadedInSec === 0}
                  onClick={() => void handleDelete(section.id)}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-rose-500/50 bg-rose-950/20 px-3 text-xs font-bold text-rose-400 active:scale-95 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف التحميلات</span>
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="divide-y divide-[#C9A227]/20 border-t border-[#C9A227]/25">
                {section.items.map((item) => {
                  const isDownloaded = downloadedIds.has(item.id);
                  const isItemBusy = downloadingItemIds.has(item.id);
                  const isQueued = pendingIds.has(item.id);
                  const isThisPlaying = playingId === item.id && isPlaying;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2.5 px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => void handlePlayItem(item)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-right active:opacity-80"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                            isThisPlaying
                              ? 'border-[#FCE38A] bg-[#C9A227] text-black'
                              : 'border-[#C9A227]/60 bg-[#C9A227]/12 text-[#C9A227]'
                          }`}
                        >
                          {isThisPlaying ? (
                            <Pause className="h-4 w-4 fill-current" />
                          ) : (
                            <Play className="h-4 w-4 fill-current" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            {isDownloaded && (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400">
                                محمل ✓
                              </span>
                            )}
                            {!isDownloaded && isQueued && (
                              <span className="rounded-full bg-[#C9A227]/20 px-2 py-0.5 text-[10px] font-bold text-[#FCE38A]">
                                سينزّل تلقائيًا
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                            {item.speaker} ·{' '}
                            <span className="font-mono-num">{item.duration}</span> ·{' '}
                            <span className="font-mono-num">{item.estimatedMb} MB</span>
                          </p>
                        </div>
                      </button>

                      {isDownloaded ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          aria-label={`حذف ${item.title}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 text-rose-400 active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isItemBusy}
                          onClick={() => void handleDownloadSingle(item)}
                          className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-[#C9A227] bg-[#C9A227]/15 px-2.5 text-[11px] font-extrabold text-[#9A7415] active:scale-95 dark:text-[#FCE38A]"
                        >
                          {isItemBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span>تحميل فردي</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Offline Un-downloaded Track Notice Modal */}
      {offlinePromptItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-3xl border-2 border-[#C9A227] bg-[#080602] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227]/60 bg-[#C9A227]/15 text-[#FCE38A]">
                  <WifiOff className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#FCE38A]">
                    {offlinePromptItem.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {offlinePromptItem.speaker} · {offlinePromptItem.estimatedMb} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOfflinePromptItem(null)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C9A227]/40 text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="rounded-2xl border border-[#C9A227]/40 bg-black/70 p-3.5 text-sm font-bold leading-relaxed text-[#FCE38A]">
              المحتوى ده مش متحمل - اتصل بالنت وحمله عشان تسمعه اوفلاين
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  const item = offlinePromptItem;
                  setOfflinePromptItem(null);
                  if (navigator.onLine) {
                    void handleDownloadSingle(item);
                  } else {
                    queueDownloadWhenOnline(item.id);
                    showToast('تمت الجدولة: سيتم التحميل تلقائيًا فور عودة الإنترنت ✓');
                  }
                }}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-3 text-xs font-extrabold text-black active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>
                  {isOnline ? 'تحميل الآن' : 'تحميل عند عودة النت'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = offlinePromptItem;
                  setOfflinePromptItem(null);
                  if (navigator.onLine) {
                    void handleDownloadSingle(item);
                  } else {
                    showToast('شغّل الواي فاي أو البيانات ثم اضغط تحميل الآن');
                  }
                }}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[#C9A227]/60 px-3 text-xs font-extrabold text-[#FCE38A] active:scale-95"
              >
                <span>تحميل الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
