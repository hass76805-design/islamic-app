import {App} from '@capacitor/app';
import {Capacitor, type PermissionState as CapPermissionState, registerPlugin} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {LocalNotifications} from '@capacitor/local-notifications';

export type RealPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type AppPermissionKey =
  | 'notifications'
  | 'location'
  | 'exactAlarm'
  | 'battery'
  | 'overlay'
  | 'doNotDisturb';

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

interface SystemPermissionsNativePlugin {
  checkSpecialPermissions(): Promise<
    Partial<Record<AppPermissionKey, string>>
  >;
  requestOverlayPermission(): Promise<
    Partial<Record<AppPermissionKey, string>>
  >;
  requestBatteryOptimization(): Promise<
    Partial<Record<AppPermissionKey, string>>
  >;
  requestExactAlarmPermission(): Promise<
    Partial<Record<AppPermissionKey, string>>
  >;
  requestDoNotDisturbPermission(): Promise<
    Partial<Record<AppPermissionKey, string>>
  >;
  openAppSettings(): Promise<Partial<Record<AppPermissionKey, string>>>;
}

const SystemPermissions = registerPlugin<SystemPermissionsNativePlugin>(
  'SystemPermissions',
);

interface LegacyNativeAdhanBridge {
  getPermissionStatus?: () => Partial<
    Record<AppPermissionKey, boolean | string>
  >;
  requestAllPermissions?: () => Promise<
    Partial<Record<AppPermissionKey, boolean | string>>
  >;
  requestPermission?: (key: AppPermissionKey) => Promise<boolean | string>;
  openAppSettings?: () => Promise<boolean> | boolean;
}

function getLegacyNativeBridge(): LegacyNativeAdhanBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {AlZahabiAdhan?: LegacyNativeAdhanBridge};
  return win.AlZahabiAdhan || null;
}

export function isNativeCapacitorAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function isNativeCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function hasSystemPermissionsPlugin(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('SystemPermissions')
    );
  } catch {
    return false;
  }
}

function mapCapacitorPermission(
  state: CapPermissionState | string | undefined,
): RealPermissionStatus {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  if (state === 'prompt' || state === 'prompt-with-rationale') return 'prompt';
  return 'prompt';
}

export function formatPermissionStatusAr(status: RealPermissionStatus): string {
  if (status === 'granted') return 'مفعل ✓';
  if (status === 'denied') return 'محظور - افتح الإعدادات';
  if (status === 'unsupported') return 'يتطلب تطبيق أندرويد';
  return 'غير مفعل - اضغط للتفعيل';
}

export function formatShortPermissionBadgeAr(
  status: RealPermissionStatus,
): string {
  if (status === 'granted') return 'مفعل ✓';
  if (status === 'denied') return 'محظور - افتح الإعدادات';
  if (status === 'unsupported') return 'يتطلب أندرويد';
  return 'غير مفعل - اضغط للتفعيل';
}

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
  if (val) {
    getOrCreateGlobalAudioContext();
  }
}

export function isSessionAudioUnlocked(): boolean {
  return Boolean(
    sessionGlobalAudioContext && sessionGlobalAudioContext.state === 'running',
  );
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
  if (val === 'prompt' || val === 'default' || val === 'prompt-with-rationale') {
    return 'prompt';
  }
  return null;
}

export const INITIAL_REAL_PERMISSION_SNAPSHOT: RealPermissionSnapshot = {
  notifications: {
    key: 'notifications',
    status: 'prompt',
    granted: false,
    nameAr: 'إذن الإشعارات (POST_NOTIFICATIONS)',
    descAr: 'إظهار إشعارات الأذان والتنبيهات المسبقة من النظام حتى عند إغلاق التطبيق',
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  },
  location: {
    key: 'location',
    status: 'prompt',
    granted: false,
    nameAr: 'إذن الموقع الجغرافي (ACCESS_FINE_LOCATION)',
    descAr: 'حساب مواقيت الصلاة واتجاه القبلة بدقة حسب موقعك الفعلي',
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  },
  exactAlarm: {
    key: 'exactAlarm',
    status: 'prompt',
    granted: false,
    nameAr: 'إذن المنبه الدقيق (SCHEDULE_EXACT_ALARM)',
    descAr: 'تشغيل الأذان في اللحظة المحددة تمامًا دون تأخير من نظام أندرويد',
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  },
  battery: {
    key: 'battery',
    status: 'prompt',
    granted: false,
    nameAr: 'تجاهل تحسين البطارية (IGNORE_BATTERY_OPTIMIZATIONS)',
    descAr: 'منع أندرويد من إيقاف خدمة الأذان والتنبيهات عند إطفاء الشاشة',
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  },
  overlay: {
    key: 'overlay',
    status: 'prompt',
    granted: false,
    nameAr: 'العرض فوق التطبيقات (SYSTEM_ALERT_WINDOW)',
    descAr: 'إظهار شاشة «الأذان الآن» فوق قفل الشاشة والتطبيقات الأخرى وقت الصلاة',
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  },
  doNotDisturb: {
    key: 'doNotDisturb',
    status: 'prompt',
    granted: false,
    nameAr: 'تجاوز عدم الإزعاج (ACCESS_NOTIFICATION_POLICY)',
    descAr: 'السماح بإسماع الأذان وقت الصلاة حتى مع تفعيل وضع عدم الإزعاج',
    badgeLabelAr: 'غير مفعل - اضغط للتفعيل',
  },
};

export async function readRealPermissionsSnapshot(): Promise<RealPermissionSnapshot> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return INITIAL_REAL_PERMISSION_SNAPSHOT;
  }

  const native = isNativeCapacitor();
  const nativeAndroid = isNativeCapacitorAndroid();
  const legacyStatus = getLegacyNativeBridge()?.getPermissionStatus?.() || {};

  let specialNativeStatus: Partial<Record<AppPermissionKey, string>> = {};
  if (hasSystemPermissionsPlugin()) {
    try {
      specialNativeStatus = await SystemPermissions.checkSpecialPermissions();
    } catch {
      specialNativeStatus = {};
    }
  }

  // 1. Notifications (POST_NOTIFICATIONS via @capacitor/local-notifications or Browser Notification API)
  let notifStatus: RealPermissionStatus = 'unsupported';
  const specialNotif = normalizeBridgeStatus(specialNativeStatus.notifications);
  const legacyNotif = normalizeBridgeStatus(legacyStatus.notifications);
  if (native && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const capNotif = await LocalNotifications.checkPermissions();
      notifStatus = mapCapacitorPermission(capNotif.display);
      if (notifStatus !== 'granted' && specialNotif === 'granted') {
        notifStatus = 'granted';
      }
    } catch {
      notifStatus = specialNotif || legacyNotif || 'prompt';
    }
  } else if (specialNotif) {
    notifStatus = specialNotif;
  } else if (legacyNotif) {
    notifStatus = legacyNotif;
  } else if ('Notification' in window) {
    const perm = Notification.permission;
    notifStatus =
      perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt';
  } else {
    const permState = await queryBrowserPermission('notifications');
    if (permState) notifStatus = permState;
  }

  // 2. Location (ACCESS_FINE_LOCATION via @capacitor/geolocation or Browser Geolocation)
  let locStatus: RealPermissionStatus = 'unsupported';
  const specialLoc = normalizeBridgeStatus(specialNativeStatus.location);
  const legacyLoc = normalizeBridgeStatus(legacyStatus.location);
  if (native && Capacitor.isPluginAvailable('Geolocation')) {
    try {
      const capLoc = await Geolocation.checkPermissions();
      const mapped = mapCapacitorPermission(capLoc.location);
      const mappedCoarse = mapCapacitorPermission(capLoc.coarseLocation);
      if (mapped === 'granted' || mappedCoarse === 'granted') {
        locStatus = 'granted';
      } else if (mapped === 'denied') {
        locStatus = 'denied';
      } else {
        locStatus = 'prompt';
      }
    } catch {
      locStatus = specialLoc || legacyLoc || 'prompt';
    }
  } else if (specialLoc) {
    locStatus = specialLoc;
  } else if (legacyLoc) {
    locStatus = legacyLoc;
  } else if ('geolocation' in navigator) {
    const geoState = await queryBrowserPermission('geolocation');
    if (geoState === 'granted') locStatus = 'granted';
    else if (geoState === 'denied') locStatus = 'denied';
    else locStatus = 'prompt';
  }

  // 3. Exact Alarm (SCHEDULE_EXACT_ALARM via @capacitor/local-notifications / Android AlarmManager)
  let exactAlarmStatus: RealPermissionStatus = nativeAndroid
    ? 'prompt'
    : 'unsupported';
  const specialExact = normalizeBridgeStatus(specialNativeStatus.exactAlarm);
  const legacyExact = normalizeBridgeStatus(legacyStatus.exactAlarm);
  if (nativeAndroid && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const exact = await LocalNotifications.checkExactNotificationSetting();
      exactAlarmStatus = mapCapacitorPermission(exact.exact_alarm);
    } catch {
      exactAlarmStatus = specialExact || legacyExact || 'prompt';
    }
  } else if (specialExact) {
    exactAlarmStatus = specialExact;
  } else if (legacyExact) {
    exactAlarmStatus = legacyExact;
  }

  // 4. Battery Optimization Exemption (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
  let batteryStatus: RealPermissionStatus = nativeAndroid
    ? 'prompt'
    : 'unsupported';
  const specialBattery = normalizeBridgeStatus(specialNativeStatus.battery);
  const legacyBattery = normalizeBridgeStatus(legacyStatus.battery);
  if (specialBattery) {
    batteryStatus = specialBattery;
  } else if (legacyBattery) {
    batteryStatus = legacyBattery;
  }

  // 5. Display Over Other Apps (SYSTEM_ALERT_WINDOW)
  let overlayStatus: RealPermissionStatus = nativeAndroid
    ? 'prompt'
    : 'unsupported';
  const specialOverlay = normalizeBridgeStatus(specialNativeStatus.overlay);
  const legacyOverlay = normalizeBridgeStatus(legacyStatus.overlay);
  if (specialOverlay) {
    overlayStatus = specialOverlay;
  } else if (legacyOverlay) {
    overlayStatus = legacyOverlay;
  }

  // 6. Do Not Disturb Policy Access (ACCESS_NOTIFICATION_POLICY)
  let dndStatus: RealPermissionStatus = nativeAndroid ? 'prompt' : 'unsupported';
  const specialDnd = normalizeBridgeStatus(specialNativeStatus.doNotDisturb);
  const legacyDnd = normalizeBridgeStatus(legacyStatus.doNotDisturb);
  if (specialDnd) {
    dndStatus = specialDnd;
  } else if (legacyDnd) {
    dndStatus = legacyDnd;
  }

  return {
    notifications: {
      ...INITIAL_REAL_PERMISSION_SNAPSHOT.notifications,
      status: notifStatus,
      granted: notifStatus === 'granted',
      badgeLabelAr: formatShortPermissionBadgeAr(notifStatus),
    },
    location: {
      ...INITIAL_REAL_PERMISSION_SNAPSHOT.location,
      status: locStatus,
      granted: locStatus === 'granted',
      badgeLabelAr: formatShortPermissionBadgeAr(locStatus),
    },
    exactAlarm: {
      ...INITIAL_REAL_PERMISSION_SNAPSHOT.exactAlarm,
      status: exactAlarmStatus,
      granted: exactAlarmStatus === 'granted',
      badgeLabelAr: formatShortPermissionBadgeAr(exactAlarmStatus),
    },
    battery: {
      ...INITIAL_REAL_PERMISSION_SNAPSHOT.battery,
      status: batteryStatus,
      granted: batteryStatus === 'granted',
      badgeLabelAr: formatShortPermissionBadgeAr(batteryStatus),
    },
    overlay: {
      ...INITIAL_REAL_PERMISSION_SNAPSHOT.overlay,
      status: overlayStatus,
      granted: overlayStatus === 'granted',
      badgeLabelAr: formatShortPermissionBadgeAr(overlayStatus),
    },
    doNotDisturb: {
      ...INITIAL_REAL_PERMISSION_SNAPSHOT.doNotDisturb,
      status: dndStatus,
      granted: dndStatus === 'granted',
      badgeLabelAr: formatShortPermissionBadgeAr(dndStatus),
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
    for (const permName of ['notifications', 'geolocation']) {
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

  // Re-sync real OS permissions when returning from Android System Dialogs / Settings
  if (isNativeCapacitor() && Capacitor.isPluginAvailable('App')) {
    try {
      const stateHandlePromise = App.addListener('appStateChange', ({isActive}) => {
        if (isActive) onChange();
      });
      const resumeHandlePromise = App.addListener('resume', () => {
        onChange();
      });
      cleanups.push(() => {
        void stateHandlePromise.then((h) => h.remove()).catch(() => {});
        void resumeHandlePromise.then((h) => h.remove()).catch(() => {});
      });
    } catch {
      // ignore if App plugin listener unavailable
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
  if (isNativeCapacitor() && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') {
        await ensureNativeAdhanChannels();
        return 'granted';
      }
      const res = await LocalNotifications.requestPermissions();
      const mapped = mapCapacitorPermission(res.display);
      if (mapped === 'granted') {
        await ensureNativeAdhanChannels();
      }
      return mapped;
    } catch {
      // fall through
    }
  }

  const bridge = getLegacyNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('notifications').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

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

async function ensureNativeAdhanChannels() {
  if (!isNativeCapacitorAndroid() || !Capacitor.isPluginAvailable('LocalNotifications')) {
    return;
  }
  try {
    await LocalNotifications.createChannel({
      id: 'adhan_channel',
      name: 'الأذان ومواقيت الصلاة',
      description: 'تنبيهات الأذان والإقامة والتنبيه قبل الصلاة',
      importance: 5,
      visibility: 1,
      lights: true,
      lightColor: '#C9A227',
      vibration: true,
    });
  } catch {
    // ignore channel creation errors
  }
}

export async function requestRealLocationPermission(
  onSuccessCoords?: (coords: {latitude: number; longitude: number}) => void,
): Promise<RealPermissionStatus> {
  if (isNativeCapacitor() && Capacitor.isPluginAvailable('Geolocation')) {
    try {
      const res = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation'],
      });
      const granted =
        res.location === 'granted' || res.coarseLocation === 'granted';
      if (granted) {
        if (onSuccessCoords) {
          try {
            const pos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 9000,
            });
            onSuccessCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          } catch {
            // ignore GPS fix timeout when permission itself succeeded
          }
        }
        return 'granted';
      }
      if (res.location === 'denied') return 'denied';
      return 'prompt';
    } catch {
      // fall through to web geolocation
    }
  }

  const bridge = getLegacyNativeBridge();
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

export async function requestRealExactAlarmPermission(): Promise<RealPermissionStatus> {
  if (isNativeCapacitorAndroid() && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const before = await LocalNotifications.checkExactNotificationSetting();
      if (before.exact_alarm === 'granted') return 'granted';
      const after = await LocalNotifications.changeExactNotificationSetting();
      return mapCapacitorPermission(after.exact_alarm);
    } catch {
      // fall through
    }
  }

  if (hasSystemPermissionsPlugin()) {
    try {
      const snap = await SystemPermissions.requestExactAlarmPermission();
      return normalizeBridgeStatus(snap.exactAlarm) || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  return isNativeCapacitorAndroid() ? 'prompt' : 'unsupported';
}

export async function requestRealBatteryPersistencePermission(): Promise<RealPermissionStatus> {
  if (hasSystemPermissionsPlugin()) {
    try {
      const snap = await SystemPermissions.requestBatteryOptimization();
      return normalizeBridgeStatus(snap.battery) || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  const bridge = getLegacyNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('battery').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }

  return isNativeCapacitorAndroid() ? 'prompt' : 'unsupported';
}

export async function requestRealOverlayPermission(): Promise<RealPermissionStatus> {
  if (hasSystemPermissionsPlugin()) {
    try {
      const snap = await SystemPermissions.requestOverlayPermission();
      return normalizeBridgeStatus(snap.overlay) || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  const bridge = getLegacyNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('overlay').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }

  return isNativeCapacitorAndroid() ? 'prompt' : 'unsupported';
}

export async function requestRealDoNotDisturbPermission(): Promise<RealPermissionStatus> {
  if (hasSystemPermissionsPlugin()) {
    try {
      const snap = await SystemPermissions.requestDoNotDisturbPermission();
      return normalizeBridgeStatus(snap.doNotDisturb) || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  const bridge = getLegacyNativeBridge();
  if (bridge?.requestPermission) {
    const res = await bridge.requestPermission('doNotDisturb').catch(() => null);
    if (res === true || res === 'granted') return 'granted';
    if (res === false || res === 'denied') return 'denied';
  }

  return isNativeCapacitorAndroid() ? 'prompt' : 'unsupported';
}

export async function requestPermissionByKey(
  key: AppPermissionKey,
  onGpsCoords?: (coords: {latitude: number; longitude: number}) => void,
): Promise<RealPermissionStatus> {
  switch (key) {
    case 'notifications':
      return requestRealNotificationPermission();
    case 'location':
      return requestRealLocationPermission(onGpsCoords);
    case 'exactAlarm':
      return requestRealExactAlarmPermission();
    case 'battery':
      return requestRealBatteryPersistencePermission();
    case 'overlay':
      return requestRealOverlayPermission();
    case 'doNotDisturb':
      return requestRealDoNotDisturbPermission();
  }
}

export async function requestAllRealPermissions(
  onGpsCoords?: (coords: {latitude: number; longitude: number}) => void,
): Promise<RealPermissionSnapshot> {
  // 1. Notifications (LocalNotifications.requestPermissions)
  await requestRealNotificationPermission();

  // 2. Geolocation (Geolocation.requestPermissions)
  await requestRealLocationPermission(onGpsCoords);

  // 3. Exact Alarm (SCHEDULE_EXACT_ALARM) — only on native Android when not yet granted
  if (isNativeCapacitorAndroid()) {
    const current = await readRealPermissionsSnapshot();
    if (!current.exactAlarm.granted) {
      await requestRealExactAlarmPermission();
    }
    if (!current.battery.granted) {
      await requestRealBatteryPersistencePermission();
    }
    if (!current.overlay.granted) {
      await requestRealOverlayPermission();
    }
  }

  const bridge = getLegacyNativeBridge();
  if (bridge?.requestAllPermissions) {
    await bridge.requestAllPermissions().catch(() => undefined);
  }

  return readRealPermissionsSnapshot();
}

export async function openNativeOrBrowserSettings(): Promise<boolean> {
  if (hasSystemPermissionsPlugin()) {
    try {
      await SystemPermissions.openAppSettings();
      return true;
    } catch {
      // fall through
    }
  }
  const bridge = getLegacyNativeBridge();
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
  '١. على هاتف Android: افتح الإعدادات ← التطبيقات ← تسبيح ← الأذونات، واسمح بالإشعارات والموقع.',
  '٢. في إعدادات التطبيق نفسه: افتح «التنبيهات والتذكيرات» (Alarms & reminders) واسمح بها، ومن قسم «البطارية» اختر «غير مقيد» (Unrestricted)، ومن «الظهور في الأعلى» اسمح بالتراكب.',
  '٣. في متصفح Chrome على الويب: اضغط أيقونة القفل/الإعدادات بجانب العنوان واختر السماح بالإشعارات والموقع.',
];
