import React, {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  X,
} from 'lucide-react';
import {getAllAppSections, OfflineSectionId} from '../data/appSections';
import {ReciterId} from '../types';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {
  BackgroundOfflineProgress,
  cancelFullOfflineBackgroundDownload,
  downloadSingleSectionOffline,
  getCurrentOfflineProgress,
  getDownloadedOfflineSections,
  isSectionBuiltInOfflineText,
  pauseFullOfflineBackgroundDownload,
  resumeFullOfflineBackgroundDownload,
  subscribeDownloadedSections,
  subscribeOfflineDownloadState,
} from '../utils/offlineAudioCache';

interface SectionOfflineButtonProps {
  sectionId: OfflineSectionId;
  preferredReciter: ReciterId;
  labelOverride?: string;
}

export const SectionOfflineButton: React.FC<SectionOfflineButtonProps> = ({
  sectionId,
  preferredReciter,
  labelOverride,
}) => {
  const isOnline = useOnlineStatus();
  const [downloadedSections, setDownloadedSections] = useState<
    OfflineSectionId[]
  >(() => getDownloadedOfflineSections());
  const [dlState, setDlState] = useState<BackgroundOfflineProgress>(() =>
    getCurrentOfflineProgress(),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeDownloadedSections(setDownloadedSections);
    const unsub2 = subscribeOfflineDownloadState(setDlState);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const sectionInfo = useMemo(
    () => getAllAppSections().find((s) => s.id === sectionId),
    [sectionId],
  );

  const isDownloaded = downloadedSections.includes(sectionId);
  const isThisActive =
    dlState.activeSectionId === sectionId ||
    Boolean(dlState.sections && dlState.sections.includes(sectionId));
  const isDownloadingThis = dlState.status === 'downloading' && isThisActive;
  const isPausedThis = dlState.status === 'paused' && isThisActive;
  const isOtherDownloading = dlState.status === 'downloading' && !isThisActive;
  const builtInTextOnly = isSectionBuiltInOfflineText(sectionId);
  const needsInternetNow = !isOnline && !builtInTextOnly;

  const handleDownload = async (forceRefresh: boolean) => {
    if (forceRefresh && !isOnline && !builtInTextOnly) return;
    if (!forceRefresh && needsInternetNow) return;
    setBusy(true);
    try {
      await downloadSingleSectionOffline(
        sectionId,
        preferredReciter,
        forceRefresh,
      );
    } finally {
      setBusy(false);
    }
  };

  if (isDownloadingThis) {
    return (
      <div className="space-y-2 rounded-2xl border border-[#C9A227] bg-[#100C03] p-2.5 text-white">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1.5 text-[#FCE38A]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A227]" />
            <span>
              جاري تحميل {labelOverride || sectionInfo?.labelAr || 'القسم'}...{' '}
              {dlState.percent}%
            </span>
          </span>
          <span className="font-mono-num text-[10px] text-zinc-300">
            {dlState.downloadedMb}/{dlState.totalMb} ميجا
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#C9A227]/20">
          <div
            className="h-full rounded-full bg-[#C9A227] transition-all duration-300"
            style={{width: `${dlState.percent}%`}}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => void pauseFullOfflineBackgroundDownload()}
            className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl border border-[#C9A227]/60 bg-black text-[11px] font-bold text-[#FCE38A]"
          >
            <Pause className="h-3 w-3" />
            <span>إيقاف مؤقت</span>
          </button>
          <button
            type="button"
            onClick={() => void cancelFullOfflineBackgroundDownload()}
            className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl border border-rose-500/50 bg-black text-[11px] font-bold text-rose-300"
          >
            <X className="h-3 w-3" />
            <span>إلغاء</span>
          </button>
        </div>
      </div>
    );
  }

  if (isPausedThis) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#C9A227]/80 bg-[#120E04] px-3 py-2 text-white">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-extrabold text-[#FCE38A]">
            التحميل متوقف مؤقتًا ({dlState.percent}%)
          </p>
          <p className="text-[10px] text-zinc-300">
            {dlState.pauseReason === 'offline' || !isOnline
              ? `باقي ${dlState.remainingMb} ميجا — متوقف لعدم وجود إنترنت`
              : `تم حفظ ${dlState.downloadedMb} من ${dlState.totalMb} ميجا`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={!isOnline}
            onClick={() =>
              void resumeFullOfflineBackgroundDownload(preferredReciter)
            }
            className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-[#C9A227] px-2.5 text-[11px] font-extrabold text-black disabled:opacity-50"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>استئناف</span>
          </button>
          <button
            type="button"
            onClick={() => void cancelFullOfflineBackgroundDownload()}
            aria-label="إلغاء التحميل"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/50 text-rose-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (isDownloaded) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/60 bg-emerald-950/25 px-3 py-2 text-emerald-200">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-emerald-200">
              تم التحميل ✓
            </p>
            <p className="truncate text-[10px] text-emerald-300/90">
              محفوظ دائمًا في IndexedDB — يعمل بدون إنترنت
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || isOtherDownloading || (!isOnline && !builtInTextOnly)}
          onClick={() => void handleDownload(true)}
          title={!isOnline && !builtInTextOnly ? 'يتطلب اتصال إنترنت للتحديث' : 'تحديث المحتوى'}
          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-emerald-400/60 bg-black/50 px-2.5 text-[11px] font-bold text-emerald-200 active:scale-95 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span>{!isOnline && !builtInTextOnly ? 'أوفلاين' : 'تحديث'}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || isOtherDownloading || needsInternetNow}
      onClick={() => void handleDownload(false)}
      className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-2xl border border-[#C9A227] bg-[#120E04] px-3.5 py-2 text-right text-[#FCE38A] transition active:scale-[0.98] disabled:border-amber-500/40 disabled:opacity-75"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-extrabold">
          {needsInternetNow
            ? `اتصل بالإنترنت لتحميل ${labelOverride || sectionInfo?.labelAr || 'القسم'}`
            : builtInTextOnly
              ? `تثبيت ${labelOverride || sectionInfo?.labelAr || 'القسم'} في الذاكرة المحلية`
              : `تحميل ${labelOverride || sectionInfo?.labelAr || 'القسم'} للعمل بدون نت`}
        </p>
        <p className="truncate text-[10px] text-zinc-300">
          {needsInternetNow
            ? 'المحتوى الأساسي متاح حاليًا — التحميل الصوتي يحتاج اتصالاً بالشبكة'
            : builtInTextOnly
              ? 'متاح للقراءة بدون نت · اضغط للتثبيت الدائم'
              : `الحجم التقديري: ${sectionInfo?.estimatedMb || 20} ميجا · حفظ دائم في IndexedDB`}
        </p>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#C9A227] text-black">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </span>
    </button>
  );
};
