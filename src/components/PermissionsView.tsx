import React, {useCallback, useEffect, useState} from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Cpu,
  Layers,
  MapPin,
  Moon,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  AppPermissionKey,
  OPEN_SETTINGS_STEPS_AR,
  openNativeOrBrowserSettings,
  readRealPermissionsSnapshot,
  RealPermissionSnapshot,
  requestAllRealPermissions,
  requestRealBackgroundAudioPermission,
  requestRealBatteryPersistencePermission,
  requestRealBootStartupPermission,
  requestRealDoNotDisturbPermission,
  requestRealLocationPermission,
  requestRealNotificationPermission,
  requestRealWakeLockPermission,
  subscribePermissionChanges,
} from '../utils/permissions';

interface PermissionsViewProps {
  onBack?: () => void;
  onRequestGps?: () => void;
  onActivateAdhanEngine?: () => Promise<void> | void;
}

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  onRequestGps,
  onActivateAdhanEngine,
}) => {
  const [snapshot, setSnapshot] = useState<RealPermissionSnapshot | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [requestingAll, setRequestingAll] = useState(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const refreshPermissions = useCallback(async () => {
    const next = await readRealPermissionsSnapshot();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    void refreshPermissions();
    const unsub = subscribePermissionChanges(() => {
      void refreshPermissions();
    });
    return unsub;
  }, [refreshPermissions]);

  const handleRequestSingle = async (key: AppPermissionKey) => {
    setLoadingKey(key);
    setStatusMsg(null);
    try {
      if (key === 'notifications') {
        const res = await requestRealNotificationPermission();
        if (res === 'denied') {
          setShowSettingsGuide(true);
        }
      } else if (key === 'backgroundAudio') {
        await requestRealBackgroundAudioPermission();
        if (onActivateAdhanEngine) {
          await onActivateAdhanEngine();
        }
      } else if (key === 'bootStartup') {
        await requestRealBootStartupPermission();
      } else if (key === 'doNotDisturb') {
        await requestRealDoNotDisturbPermission();
      } else if (key === 'battery') {
        await requestRealBatteryPersistencePermission();
      } else if (key === 'location') {
        onRequestGps?.();
        const res = await requestRealLocationPermission();
        if (res === 'denied') {
          setShowSettingsGuide(true);
        }
      } else if (key === 'overlay') {
        await requestRealWakeLockPermission();
      }
      await refreshPermissions();
    } finally {
      setLoadingKey(null);
    }
  };

  const handleRequestAll = async () => {
    setRequestingAll(true);
    setStatusMsg(null);
    try {
      const next = await requestAllRealPermissions();
      setSnapshot(next);
      if (onActivateAdhanEngine) {
        await onActivateAdhanEngine();
      }
      const hasDenied = Object.values(next).some((p) => p.status === 'denied');
      if (hasDenied) {
        setShowSettingsGuide(true);
        setStatusMsg('بعض الأذونات محظورة في النظام، اضغط «افتح الإعدادات واسمح» بالأسفل');
      } else {
        setStatusMsg('تم تفعيل جميع أذونات النظام الحقيقية بنجاح!');
      }
    } finally {
      setRequestingAll(false);
    }
  };

  const grantedCount = snapshot
    ? Object.values(snapshot).filter((p) => p.granted).length
    : 0;
  const totalCount = snapshot ? Object.values(snapshot).length : 7;
  const allGranted = grantedCount === totalCount;

  const getIcon = (key: AppPermissionKey) => {
    switch (key) {
      case 'notifications':
        return <BellRing className="h-5 w-5" />;
      case 'backgroundAudio':
        return <Volume2 className="h-5 w-5" />;
      case 'bootStartup':
        return <Cpu className="h-5 w-5" />;
      case 'doNotDisturb':
        return <Moon className="h-5 w-5" />;
      case 'battery':
        return <Zap className="h-5 w-5" />;
      case 'location':
        return <MapPin className="h-5 w-5" />;
      case 'overlay':
        return <Layers className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Top Banner Card */}
      <div className="rounded-3xl border-2 border-[#C9A227] bg-[#0A0802] p-4 text-white shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-[#FCE38A]">
                أذونات التطبيق الحقيقية
              </h2>
              <p className="mt-0.5 text-xs text-zinc-300">
                أذونات النظام الفعلية للعمل في الخلفية، وإطلاق الأذان والتنبيهات المسبقة بدقة حتى لو الهاتف مقفول أو صامت.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#C9A227]/40 bg-black/60 px-3.5 py-2.5">
          <span className="text-xs font-bold text-zinc-300">
            حالة الأذونات المسموحة:
          </span>
          <span
            className={`rounded-xl px-2.5 py-1 text-xs font-extrabold ${
              allGranted
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
            }`}
          >
            {grantedCount} من {totalCount} مفعلة
          </span>
        </div>

        {/* One-Click Request All Button */}
        <button
          type="button"
          disabled={requestingAll}
          onClick={handleRequestAll}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#FCE38A] via-[#C9A227] to-[#9A7415] px-4 text-xs font-extrabold text-black shadow-lg active:scale-[0.98] disabled:opacity-60"
        >
          {requestingAll ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>جاري طلب أذونات النظام...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>تفعيل جميع الأذونات بنقرة واحدة</span>
            </>
          )}
        </button>

        {statusMsg && (
          <p className="mt-2 text-center text-xs font-bold text-[#FCE38A]">
            {statusMsg}
          </p>
        )}
      </div>

      {/* Permissions List */}
      <div className="space-y-2.5">
        {snapshot &&
          (
            [
              'notifications',
              'backgroundAudio',
              'bootStartup',
              'doNotDisturb',
              'battery',
              'location',
              'overlay',
            ] as const
          ).map((key) => {
            const entry = snapshot[key];
            const isLoading = loadingKey === key;
            const isGranted = entry.granted;
            return (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#C9A227]/40 bg-[#0F0D05] p-3.5 text-white transition-all hover:border-[#C9A227]"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      isGranted
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400'
                        : 'border-red-500/60 bg-red-950/40 text-red-400'
                    }`}
                  >
                    {getIcon(key)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-extrabold text-[#FCE38A]">
                        {entry.nameAr}
                      </h3>
                      {isGranted && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                      {entry.descAr}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleRequestSingle(key)}
                    className={`min-h-[42px] min-w-[145px] rounded-xl px-3.5 text-xs font-extrabold transition-all active:scale-95 ${
                      isGranted
                        ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] hover:bg-emerald-500'
                        : 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.45)] hover:bg-red-500 animate-pulse'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>جاري التحقق...</span>
                      </span>
                    ) : isGranted ? (
                      <span className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>مفعل</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">
                        <ShieldAlert className="h-4 w-4" />
                        <span>غير مفعل - اضغط للتفعيل</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Settings Recovery Guide */}
      <div className="rounded-3xl border border-[#C9A227]/40 bg-[#0B0903] p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
              <Settings className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-bold text-[#FCE38A]">
              إعدادات الهاتف والأذونات المقفلة
            </h3>
          </div>
          <button
            type="button"
            onClick={async () => {
              const opened = await openNativeOrBrowserSettings();
              if (!opened) setShowSettingsGuide((v) => !v);
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#C9A227] bg-black px-3 text-xs font-bold text-[#FCE38A] active:scale-95"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>افتح الإعدادات واسمح</span>
          </button>
        </div>

        {showSettingsGuide && (
          <div className="mt-3 space-y-2 rounded-2xl border border-red-500/40 bg-red-950/20 p-3 text-xs leading-relaxed text-zinc-200">
            <p className="font-extrabold text-red-200">
              إذا رفض النظام إظهار نافذة السماح التلقائية، اتبع الخطوات التالية:
            </p>
            <ol className="space-y-1 text-[11px] text-zinc-300">
              {OPEN_SETTINGS_STEPS_AR.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
