export type RealPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type AppPermissionKey =
  | 'notifications'
  | 'backgroundAudio'
  | 'bootStartup'
  | 'exactAlarm'
  | 'doNotDisturb'
  | 'battery'
  | 'location'
  | 'overlay';

export interface PermissionEntryState {
  key: AppPermissionKey;
  status: RealPermissionStatus;
  granted: boolean;
  nameAr: string;
  descAr: string;
  badgeLabelAr: string;
}

export type RealPermissionSnapshot = Record<
  AppPermissionKey,
  PermissionEntryState
>;

interface NativeAdhanBridge {
  getPermissionStatus?: () => Partial<
    Record<AppPermissionKey, boolean | string>
  >;
  requestAllPermissions?: () => Promise<
    Partial<Record<AppPermissionKey, boolean | string>>
  >;
  requestPermission?: (key: AppPermissionKey) => Promise<boolean | string>;
  openAppSettings?: () => Promise<boolean> | boolean;
}

function getNativeBridge(): NativeAdhanBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {AlZahabiAdhan?: NativeAdhanBridge};
  return win.AlZahabiAdhan || null;
}

export function formatPermissionStatusAr(status: RealPermissionStatus): string {
  if (status === 'granted') return 'مفعل';
  if (status === 'denied') return 'غير مفعل - اضغط للتفعيل';
  if (status === 'unsupported') return 'غير مدعوم على هذا الجهاز';
  return 'غير مفعل - اضغط للتفعيل';
}

export function formatShortPermissionBadgeAr(
  status: RealPermissionStatus,
): string {
  if (status === 'granted') return 'مفعل';
  return 'غير مفعل - اضغط للتفعيل';
}

let sessionAudioUnlocked = false;
let sessionWakeLockGranted = false;
let sessionGlobalAudioContext: AudioContext | null = null;

export function getOrCreateGlobalAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext})
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sessionGlobalAudioContext) {
    sessionGlobalAudioContext = new AudioCtx();
  }
  if (sessionGlobalAudioContext.state === 'suspended') {
    sessionGlobalAudioContext.resume().catch(() => {});
  }
  return sessionGlobalAudioContext;
}

export function setSessionAudioUnlocked(val: boolean) {
  sessionAudioUnlocked = val;
  if (val) {
    getOrCreateGlobalAudioContext();
  }
}

export function isSessionAudioUnlocked(): boolean {
  if (sessionAudioUnlocked) return true;
  if (sessionGlobalAudioContext && sessionGlobalAudioContext.state === 'running') {
    return true;
  }
  return false;
}

async function queryBrowserPermission(
  name: string,
): Promise<PermissionState | null> {
  if (
    typeof navigator === 'undefined' ||
    !('permissions' in navigator) ||
    typeof navigator.permissions?.query !== 'function'
  ) {
    return null;
  }
  try {
    const res = await navigator.permissions.query({
      name: name as PermissionName,
    });
    return res.state;
  } catch {
    return null;
  }
}

function normalizeBridgeStatus(
  val: boolean | string | undefined,
): RealPermissionStatus | null {
  if (val === true || val === 'granted') return 'granted';
  if (val === false || val === 'denied') return 'denied';
  if (val === 'prompt' || val === 'default') return 'prompt';
  return null;
}

export async function readRealPermissionsSnapshot(): Promise<RealPermissionSnapshot> {
  const fallback = (
    key: AppPermissionKey,
    nameAr: string,
    descAr: string,
  ): PermissionEntryState => ({
    key,
    status: 'prompt',
    granted: false,
    nameAr,
    descAr,
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  });

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      notifications: fallback('notifications', 'إذن الإشعارات', 'إشعار الأذان والتنبيهات المسبقة'),
      backgroundAudio: fallback('backgroundAudio', 'إذن الصوت في الخلفية', 'استمرار الصوت عند قفل الهاتف'),
      bootStartup: fallback('bootStartup', 'إذن التشغيل عند بدء التشغيل', 'إعادة جدولة الأذان تلقائيًا'),
      exactAlarm: fallback('exactAlarm', 'إذن التنبيه الدقيق', 'جدولة الأذان في اللحظة المحددة دون تأخير'),
      doNotDisturb: fallback('doNotDisturb', 'إذن عدم الإزعاج', 'تنبيه الأذان بصوت حتى لو الهاتف صامت'),
      battery: fallback('battery', 'إذن البطارية', 'منع النظام من إيقاف مؤذن الخلفية'),
      location: fallback('location', 'إذن الموقع (GPS)', 'حساب مواقيت الصلاة والقبلة تلقائيًا'),
      overlay: fallback('overlay', 'إذن إبقاء الشاشة نشطة', 'إبقاء شاشة الأذان والمصحف مستمرة'),
    };
  }

  const nativeStatus = getNativeBridge()?.getPermissionStatus?.() || {};

  // 1. Notifications
  let notifStatus: RealPermissionStatus = 'unsupported';
  const nativeNotif = normalizeBridgeStatus(nativeStatus.notifications);
  if (nativeNotif) {
    notifStatus = nativeNotif;
  } else if ('Notification' in window) {
    const perm = Notification.permission;
    notifStatus =
      perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt';
  } else {
    const permState = await queryBrowserPermission('notifications');
    if (permState) notifStatus = permState;
  }

  // 2. Background Audio & AudioContext Keep-Alive
  let bgAudioStatus: RealPermissionStatus = 'prompt';
  const nativeAudio = normalizeBridgeStatus(nativeStatus.backgroundAudio);
  if (nativeAudio) {
    bgAudioStatus = nativeAudio;
  } else {
    const ctx = sessionGlobalAudioContext;
    const isRunning = ctx && ctx.state === 'running';
    if (sessionAudioUnlocked || isRunning) {
      bgAudioStatus = 'granted';
    } else {
      bgAudioStatus = 'prompt';
    }
  }

  // 3. Boot / Startup & Background Sync
  let bootStatus: RealPermissionStatus = 'prompt';
  const nativeBoot = normalizeBridgeStatus(nativeStatus.bootStartup);
  if (nativeBoot) {
    bootStatus = nativeBoot;
  } else if ('serviceWorker' in navigator) {
    const periodicState = await queryBrowserPermission('periodic-background-sync');
    if (periodicState === 'granted' || navigator.serviceWorker.controller) {
      bootStatus = 'granted';
    } else if (periodicState === 'denied') {
      bootStatus = 'denied';
    } else {
      bootStatus = 'prompt';
    }
  } else {
    bootStatus = 'unsupported';
  }

  // 4. Do Not Disturb / Notification & Audio Priority
  let dndStatus: RealPermissionStatus = 'prompt';
  const nativeDnd = normalizeBridgeStatus(nativeStatus.doNotDisturb);
  if (nativeDnd) {
    dndStatus = nativeDnd;
  } else {
    // In Web PWA: if notification is granted and audio unlocked, sound priority is fully available
    if (notifStatus === 'granted' && bgAudioStatus === 'granted') {
      dndStatus = 'granted';
    } else if (notifStatus === 'denied') {
      dndStatus = 'denied';
    } else {
      dndStatus = 'prompt';
    }
  }

  // 5. Battery Optimization / Persistent Storage Keep-Alive
  let batteryStatus: RealPermissionStatus = 'prompt';
  const nativeBattery = normalizeBridgeStatus(nativeStatus.battery);
  if (nativeBattery) {
    batteryStatus = nativeBattery;
  } else {
    let persisted = false;
    if (navigator.storage && typeof navigator.storage.persisted === 'function') {
      persisted = await navigator.storage.persisted().catch(() => false);
    }
    const periodicState = await queryBrowserPermission('periodic-background-sync');
    if (persisted || periodicState === 'granted') {
      batteryStatus = 'granted';
    } else if (periodicState === 'denied' && !persisted) {
      batteryStatus = 'denied';
    } else {
      batteryStatus = 'prompt';
    }
  }

  // 6. Geolocation (GPS)
  let locStatus: RealPermissionStatus =
    'geolocation' in navigator ? 'prompt' : 'unsupported';
  const nativeLoc = normalizeBridgeStatus(nativeStatus.location);
  if (nativeLoc) {
    locStatus = nativeLoc;
  } else if ('geolocation' in navigator) {
    const geoState = await queryBrowserPermission('geolocation');
    if (geoState === 'granted') locStatus = 'granted';
    else if (geoState === 'denied') locStatus = 'denied';
    else locStatus = 'prompt';
  }

  // 7. Screen WakeLock / Live Screen Overlay
  let overlayStatus: RealPermissionStatus = 'prompt';
  const nativeOverlay = normalizeBridgeStatus(nativeStatus.overlay);
  if (nativeOverlay) {
    overlayStatus = nativeOverlay;
  } else {
    const navWithLock = navigator as Navigator & {
      wakeLock?: {
        request: (type: 'screen') => Promise<{release?: () => Promise<void>}>;
      };
    };
    const wakeSupported = Boolean(navWithLock.wakeLock);
    if (sessionWakeLockGranted) {
      overlayStatus = 'granted';
    } else if (!wakeSupported && notifStatus === 'unsupported') {
      overlayStatus = 'unsupported';
    } else {
      overlayStatus = 'prompt';
    }
  }

  return {
    notifications: {
      key: 'notifications',
      status: notifStatus,
      granted: notifStatus === 'granted',
      nameAr: 'إذن الإشعارات',
      descAr: 'إرسال إشعار الأذان وتنبيه اقتراب الصلاة عند الموعد المضبوط',
      badgeLabelAr: formatShortPermissionBadgeAr(notifStatus),
    },
    backgroundAudio: {
      key: 'backgroundAudio',
      status: bgAudioStatus,
      granted: bgAudioStatus === 'granted',
      nameAr: 'إذن الصوت في الخلفية',
      descAr: 'تشغيل صوت المؤذن والشيخ وتنبيه الصلاة حتى لو الهاتف مقفول',
      badgeLabelAr: formatShortPermissionBadgeAr(bgAudioStatus),
    },
    bootStartup: {
      key: 'bootStartup',
      status: bootStatus,
      granted: bootStatus === 'granted',
      nameAr: 'إذن التشغيل عند بدء التشغيل',
      descAr: 'جدولة مواقيت الصلوات وتحديث التنبيهات تلقائيًا فور تشغيل الهاتف',
      badgeLabelAr: formatShortPermissionBadgeAr(bootStatus),
    },
    doNotDisturb: {
      key: 'doNotDisturb',
      status: dndStatus,
      granted: dndStatus === 'granted',
      nameAr: 'إذن عدم الإزعاج وتجاوز الصامت',
      descAr: 'إسماع صوت الأذان وتنبيه الصلاة بأعلى جودة حتى في الوضع الصامت',
      badgeLabelAr: formatShortPermissionBadgeAr(dndStatus),
    },
    battery: {
      key: 'battery',
      status: batteryStatus,
      granted: batteryStatus === 'granted',
      nameAr: 'إذن البطارية وتجاهل التوفير',
      descAr: 'منع نظام أندرويد وiOS من إغلاق تطبيق الأذان في الخلفية لتوفير الطاقة',
      badgeLabelAr: formatShortPermissionBadgeAr(batteryStatus),
    },
    location: {
      key: 'location',
      status: locStatus,
      granted: locStatus === 'granted',
      nameAr: 'إذن الموقع الجغرافي (GPS)',
      descAr: 'تحديد إحداثيات مدينتك تلقائيًا لحساب مواقيت الأذان وبوصلة القبلة',
      badgeLabelAr: formatShortPermissionBadgeAr(locStatus),
    },
    exactAlarm: {
      key: 'exactAlarm',
      status: bootStatus,
      granted: bootStatus === 'granted',
      nameAr: 'إذن التنبيه الدقيق (Exact Alarms)',
      descAr: 'جدولة الأذان وتنبيهات الصلاة في الدقيقة واللحظة المضبوطة بدقة',
      badgeLabelAr: formatShortPermissionBadgeAr(bootStatus),
    },
    overlay: {
      key: 'overlay',
      status: overlayStatus,
      granted: overlayStatus === 'granted',
      nameAr: 'إذن إبقاء الشاشة نشطة (WakeLock)',
      descAr: 'إبقاء شاشة المؤذن والمصحف نشطة أثناء القراءة والاستماع',
      badgeLabelAr: formatShortPermissionBadgeAr(overlayStatus),
    },
  };
}

export function subscribePermissionChanges(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return () => {};
  }

  const cleanups: Array<() => void> = [];

  if (
    'permissions' in navigator &&
    typeof navigator.permissions?.query === 'function'
  ) {
    for (const permName of [
      'notifications',
      'geolocation',
      'periodic-background-sync',
    ]) {
      navigator.permissions
        .query({name: permName as PermissionName})
        .then((status) => {
          const handler = () => onChange();
          if (typeof status.addEventListener === 'function') {
            status.addEventListener('change', handler);
            cleanups.push(() => status.removeEventListener('change', handler));
          } else {
            status.onchange = handler;
            cleanups.push(() => {
              status.onchange = null;
            });
          }
        })
        .catch(() => {});
    }
  }

  const onVisibleOrFocus = () => {
    if (document.visibilityState === 'visible') {
      onChange();
    }
  };
  document.addEventListener('visibilitychange', onVisibleOrFocus);
  window.addEventListener('focus', onVisibleOrFocus);

  return () => {
    for (const fn of cleanups) fn();
    document.removeEventListener('visibilitychange', onVisibleOrFocus);
    window.removeEventListener('focus', onVisibleOrFocus);
  };
}

export async function requestRealNotificationPermission(): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('notifications').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  try {
    const result = await Notification.requestPermission();
    return result === 'granted'
      ? 'granted'
      : result === 'denied'
        ? 'denied'
        : 'prompt';
  } catch {
    const fallback = window.Notification.permission as NotificationPermission;
    return fallback === 'granted'
      ? 'granted'
      : fallback === 'denied'
        ? 'denied'
        : 'prompt';
  }
}

export async function requestRealBackgroundAudioPermission(): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('backgroundAudio').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
  }
  try {
    const ctx = getOrCreateGlobalAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    sessionAudioUnlocked = true;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
    return 'granted';
  } catch {
    return 'prompt';
  }
}

export async function requestRealBootStartupPermission(): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('bootStartup').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const regWithSync = reg as ServiceWorkerRegistration & {
        sync?: {register: (tag: string) => Promise<void>};
        periodicSync?: {
          register: (tag: string, opts: {minInterval: number}) => Promise<void>;
        };
      };
      await regWithSync.sync
        ?.register('adhan-background-check')
        .catch(() => {});
      await regWithSync.periodicSync
        ?.register('adhan-background-check', {minInterval: 15 * 60 * 1000})
        .catch(() => {});
      reg.active?.postMessage({type: 'PREWARM_MUEZZIN_SOUNDS'});
      reg.active?.postMessage({type: 'CHECK_DUE_ADHAN_ALERTS'});
      return 'granted';
    } catch {
      return 'prompt';
    }
  }
  return 'unsupported';
}

export async function requestRealDoNotDisturbPermission(): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('doNotDisturb').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }
  await requestRealNotificationPermission();
  await requestRealBackgroundAudioPermission();
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
    ? 'granted'
    : 'prompt';
}

export async function requestRealBatteryPersistencePermission(): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('battery').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }
  if (typeof navigator === 'undefined') return 'unsupported';
  let persisted = false;
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    persisted = await navigator.storage.persist().catch(() => false);
  }
  await requestRealBootStartupPermission();
  const periodicState = await queryBrowserPermission('periodic-background-sync');
  if (persisted || periodicState === 'granted') return 'granted';
  if (periodicState === 'denied') return 'denied';
  return 'prompt';
}

export async function requestRealLocationPermission(
  onSuccessCoords?: (coords: {latitude: number; longitude: number}) => void,
): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('location').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported';
  }
  return new Promise<RealPermissionStatus>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccessCoords?.({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        resolve('granted');
      },
      async (err) => {
        if (err && err.code === 1) {
          resolve('denied');
          return;
        }
        const geoState = await queryBrowserPermission('geolocation');
        if (geoState === 'granted') resolve('granted');
        else if (geoState === 'denied') resolve('denied');
        else resolve('prompt');
      },
      {enableHighAccuracy: true, timeout: 9000, maximumAge: 180000},
    );
  });
}

export async function requestRealWakeLockPermission(): Promise<RealPermissionStatus> {
  const bridge = getNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('overlay').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
  }
  if (typeof navigator === 'undefined') return 'unsupported';
  const navWithLock = navigator as Navigator & {
    wakeLock?: {request: (type: 'screen') => Promise<{release?: () => Promise<void>}>};
  };
  if (navWithLock.wakeLock) {
    try {
      const sentinel = await navWithLock.wakeLock.request('screen');
      sessionWakeLockGranted = true;
      await sentinel.release?.().catch(() => {});
      return 'granted';
    } catch {
      sessionWakeLockGranted = false;
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return 'denied';
  }
  return 'prompt';
}

export async function requestRealExactAlarmPermission(): Promise<RealPermissionStatus> {
  await requestRealNotificationPermission();
  await requestRealBootStartupPermission();
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
    ? 'granted'
    : 'prompt';
}

export async function requestAllRealPermissions(
  onGpsCoords?: (coords: {latitude: number; longitude: number}) => void,
): Promise<RealPermissionSnapshot> {
  const bridge = getNativeBridge();
  if (bridge?.requestAllPermissions) {
    await bridge.requestAllPermissions().catch(() => undefined);
  }
  await requestRealNotificationPermission();
  await requestRealBackgroundAudioPermission();
  await requestRealLocationPermission(onGpsCoords);
  await requestRealBootStartupPermission();
  await requestRealBatteryPersistencePermission();
  await requestRealDoNotDisturbPermission();
  await requestRealWakeLockPermission();
  return readRealPermissionsSnapshot();
}

export async function openNativeOrBrowserSettings(): Promise<boolean> {
  const bridge = getNativeBridge();
  if (bridge?.openAppSettings) {
    try {
      const opened = await bridge.openAppSettings();
      if (opened) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export const OPEN_SETTINGS_STEPS_AR = [
  '١. في متصفح Chrome على الهاتف: اضغط على أيقونة القفل أو الإعدادات بجانب شريط العنوان أعلى الشاشة.',
  '٢. اختر «الأذونات» (Permissions) ثم فعّل «الإشعارات» (Notifications) و«الموقع الجغرافي» (Location) إلى «السماح» (Allow).',
  '٣. في إعدادات هاتف Android للتطبيق المثبّت: افتح الإعدادات ← التطبيقات ← تسبيح (أو Chrome) ← الأذونات، واسمح بالإشعارات والموقع، ومن قسم البطارية اختر «غير مقيد» (Unrestricted) ليصل الأذان في موعده والتليفون مقفول.',
];
