import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Compass, MapPin, Navigation, RotateCw} from 'lucide-react';
import {UserLocation} from '../types';
import {
  computeDistanceToKaabaKm,
  computeQiblaBearing,
  KAABA_COORDS,
} from '../utils/prayerTimes';

interface QiblaViewProps {
  location: UserLocation;
  onRequestGps: () => void;
  gpsLoading: boolean;
}

function projectEquirectangular(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 720;
  const y = ((90 - lat) / 180) * 360;
  return [x, y];
}

function computeGeodesicPath(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  steps = 48,
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const p1 = toRad(lat1);
  const l1 = toRad(lon1);
  const p2 = toRad(lat2);
  const l2 = toRad(lon2);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((p2 - p1) / 2) ** 2 +
          Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2,
      ),
    );

  if (d < 0.0001) {
    const [x, y] = projectEquirectangular(lat1, lon1);
    return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  const pts: string[] = [];
  let prevX: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    const [px, py] = projectEquirectangular(lat, lon);
    const cmd = prevX !== null && Math.abs(px - prevX) > 300 ? 'M' : i === 0 ? 'M' : 'L';
    pts.push(`${cmd} ${px.toFixed(1)} ${py.toFixed(1)}`);
    prevX = px;
  }
  return pts.join(' ');
}

const WORLD_LANDMASS_PATHS = [
  'M 42 54 L 105 40 L 185 45 L 222 72 L 200 105 L 178 130 L 154 150 L 172 174 L 195 180 L 160 175 L 130 142 L 108 118 L 78 90 L 42 74 Z',
  'M 195 182 L 238 190 L 285 215 L 270 258 L 240 315 L 216 335 L 204 285 L 188 228 Z',
  'M 332 95 L 352 62 L 395 48 L 432 62 L 425 96 L 398 112 L 368 112 L 340 108 Z',
  'M 326 116 L 372 114 L 418 122 L 452 156 L 444 204 L 418 258 L 392 285 L 370 245 L 352 198 L 322 170 L 315 138 Z',
  'M 418 118 L 448 112 L 485 110 L 535 72 L 620 55 L 675 76 L 640 120 L 605 152 L 568 175 L 540 185 L 512 162 L 488 188 L 462 155 L 430 158 L 418 138 Z',
  'M 548 195 L 575 198 L 598 206 L 568 214 Z M 605 190 L 628 194 L 622 212 L 604 206 Z',
  'M 575 232 L 635 224 L 664 256 L 642 292 L 595 286 L 568 262 Z',
];

export const QiblaView: React.FC<QiblaViewProps> = ({
  location,
  onRequestGps,
  gpsLoading,
}) => {
  const [heading, setHeading] = useState<number>(0);
  const [sensorActive, setSensorActive] = useState(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState<'regional' | 'world'>('regional');

  const smoothedHeadingRef = useRef<number | null>(null);
  const hasAbsoluteRef = useRef<boolean>(false);

  const qiblaBearing = useMemo(
    () => computeQiblaBearing(location.latitude, location.longitude),
    [location.latitude, location.longitude],
  );

  const distanceKm = useMemo(
    () => computeDistanceToKaabaKm(location.latitude, location.longitude),
    [location.latitude, location.longitude],
  );

  const relativeAngle = ((qiblaBearing - heading) % 360 + 360) % 360;
  const angularDiff = Math.min(relativeAngle, 360 - relativeAngle);
  const isAligned = angularDiff <= 4;

  useEffect(() => {
    const applySmoothedHeading = (rawDeg: number) => {
      const normalized = ((rawDeg % 360) + 360) % 360;
      const prev = smoothedHeadingRef.current;
      if (prev === null) {
        smoothedHeadingRef.current = normalized;
        setHeading(normalized);
        return;
      }
      // Shortest signed angular delta across 0/360 boundary
      const delta = ((normalized - prev + 540) % 360) - 180;
      const next = ((prev + delta * 0.25) % 360 + 360) % 360;
      smoothedHeadingRef.current = next;
      setHeading(next);
    };

    const getScreenOffset = () => {
      const screenOrientationAngle =
        typeof window !== 'undefined' ? window.screen?.orientation?.angle : undefined;
      if (typeof screenOrientationAngle === 'number') {
        return screenOrientationAngle;
      }
      const legacyOrientation =
        typeof window !== 'undefined'
          ? (window as unknown as {orientation?: number}).orientation
          : undefined;
      return typeof legacyOrientation === 'number' ? legacyOrientation : 0;
    };

    const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => {
      const webkitHeading = (event as unknown as {webkitCompassHeading?: number})
        .webkitCompassHeading;
      if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
        hasAbsoluteRef.current = true;
        applySmoothedHeading(webkitHeading + getScreenOffset());
        setSensorActive(true);
      } else if (typeof event.alpha === 'number') {
        hasAbsoluteRef.current = true;
        applySmoothedHeading(360 - event.alpha + getScreenOffset());
        setSensorActive(true);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const webkitHeading = (event as unknown as {webkitCompassHeading?: number})
        .webkitCompassHeading;
      if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
        applySmoothedHeading(webkitHeading + getScreenOffset());
        setSensorActive(true);
      } else if (!hasAbsoluteRef.current && typeof event.alpha === 'number') {
        applySmoothedHeading(360 - event.alpha + getScreenOffset());
        setSensorActive(true);
      }
    };

    window.addEventListener(
      'deviceorientationabsolute',
      handleAbsoluteOrientation as EventListener,
    );
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener(
        'deviceorientationabsolute',
        handleAbsoluteOrientation as EventListener,
      );
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const requestCompassPermission = async () => {
    setSensorError(null);
    const devOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof devOrientation?.requestPermission === 'function') {
      try {
        const res = await devOrientation.requestPermission();
        if (res === 'granted') {
          setSensorActive(true);
        } else {
          setSensorError('تم رفض إذن مستشعر البوصلة. يمكنك استخدام الشريط اليدوي أدناه.');
        }
      } catch {
        setSensorError('تعذر تفعيل مستشعر الاتجاه على هذا الجهاز.');
      }
    } else {
      setSensorError(
        'مستشعر البوصلة يعمل تلقائيًا على الهواتف المدعومة. على الحاسوب يمكنك تجربة التدوير عبر شريط المعايرة أدناه.',
      );
    }
  };

  const [userX, userY] = projectEquirectangular(location.latitude, location.longitude);
  const [kaabaX, kaabaY] = projectEquirectangular(
    KAABA_COORDS.latitude,
    KAABA_COORDS.longitude,
  );
  const geodesicD = computeGeodesicPath(
    location.latitude,
    location.longitude,
    KAABA_COORDS.latitude,
    KAABA_COORDS.longitude,
  );

  const midX = (userX + kaabaX) / 2;
  const midY = (userY + kaabaY) / 2;
  const spanX = Math.max(150, Math.min(640, Math.abs(userX - kaabaX) * 2.2 + 90));
  const spanY = spanX / 2;
  const vbX = Math.max(0, Math.min(720 - spanX, midX - spanX / 2));
  const vbY = Math.max(0, Math.min(360 - spanY, midY - spanY / 2));
  const viewBox =
    mapZoom === 'world'
      ? '0 0 720 360'
      : `${vbX.toFixed(1)} ${vbY.toFixed(1)} ${spanX.toFixed(1)} ${spanY.toFixed(1)}`;

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Live Qibla Compass Card */}
      <section className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              بوصلة القبلة
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
              {location.city} · زاوية القبلة{' '}
              <span className="font-mono-num font-bold text-[#C9A227]">
                {qiblaBearing.toFixed(1)}°
              </span>{' '}
              من الشمال · البوصلة تعمل بدون نت 100%
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestGps}
            disabled={gpsLoading}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227] px-3 py-2 text-xs font-bold text-[#9A7415] hover:bg-[#C9A227]/15 dark:text-[#F3D56B]"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>{gpsLoading ? 'تحديد...' : 'تحديث GPS'}</span>
          </button>
        </div>

        {/* Compass Dial */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div
            className={`relative flex h-64 w-64 items-center justify-center rounded-full border-4 transition-colors duration-300 ${
              isAligned
                ? 'border-[#C9A227] bg-[#C9A227]/15'
                : 'border-[#C9A227]/60 bg-slate-50 dark:bg-[#0B0B0B]'
            }`}
          >
            <svg
              viewBox="0 0 240 240"
              className="h-full w-full transition-transform duration-150"
              style={{transform: `rotate(${-heading}deg)`}}
            >
              {Array.from({length: 36}).map((_, i) => {
                const angle = i * 10;
                const major = i % 9 === 0;
                return (
                  <line
                    key={i}
                    x1="120"
                    y1={major ? '12' : '16'}
                    x2="120"
                    y2="24"
                    stroke={major ? '#C9A227' : 'currentColor'}
                    strokeWidth={major ? '2.5' : '1.2'}
                    className={major ? '' : 'text-slate-400 dark:text-zinc-700'}
                    transform={`rotate(${angle} 120 120)`}
                  />
                );
              })}
              <text x="120" y="38" textAnchor="middle" className="fill-slate-900 dark:fill-[#F3D56B] text-xs font-bold">
                ش N
              </text>
              <text x="206" y="124" textAnchor="middle" className="fill-slate-400 text-xs font-bold">
                E
              </text>
              <text x="120" y="212" textAnchor="middle" className="fill-slate-400 text-xs font-bold">
                S
              </text>
              <text x="34" y="124" textAnchor="middle" className="fill-slate-400 text-xs font-bold">
                W
              </text>
            </svg>

            {/* Qibla Pointer Needle */}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center transition-transform duration-150"
              style={{transform: `rotate(${relativeAngle}deg)`}}
            >
              <div className="relative flex h-full w-full flex-col items-center justify-start pt-6">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-[#C9A227] bg-black shadow-md">
                  <div className="h-1 w-full bg-[#C9A227]" />
                </div>
                <div className="h-16 w-1.5 rounded-full bg-gradient-to-b from-[#C9A227] to-black" />
              </div>
            </div>

            <div className="z-10 flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-[#C9A227] bg-black text-white">
              <span className="font-mono-num text-xs font-bold text-[#F3D56B]">
                {Math.round(heading)}°
              </span>
            </div>
          </div>

          <p
            className={`mt-4 text-sm font-bold ${
              isAligned ? 'text-[#C9A227]' : 'text-slate-700 dark:text-zinc-200'
            }`}
          >
            {isAligned
              ? 'أنت متجه الآن نحو القبلة المشرفة'
              : `در بالجهاز ${Math.round(angularDiff)}° لمحاذاة الكعبة المشرفة`}
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-3 border-t border-[#C9A227]/25 pt-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={requestCompassPermission}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-3.5 py-2 text-xs font-bold text-black hover:opacity-90"
            >
              <Compass className="h-4 w-4" />
              <span>{sensorActive ? 'البوصلة الحية مفعّلة' : 'تفعيل البوصلة الحية'}</span>
            </button>

            <button
              type="button"
              onClick={() => setHeading(Math.round(qiblaBearing))}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C9A227]/60 px-3 py-2 text-xs font-bold text-slate-700 dark:text-white"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#C9A227]" />
              <span>محاذاة للقبلة</span>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
              <span>معايرة / اختبار الاتجاه يدويًا</span>
              <span className="font-mono-num text-[#C9A227]">{Math.round(heading)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(heading)}
              onChange={(e) => setHeading(Number(e.target.value))}
              className="mt-1 w-full accent-[#C9A227]"
            />
          </div>

          {sensorError && (
            <p className="text-xs text-[#9A7415] dark:text-[#F3D56B]">{sensorError}</p>
          )}
        </div>
      </section>

      {/* Geodesic Qibla Map Card */}
      <section className="flex flex-col justify-between rounded-3xl border-2 border-[#C9A227] bg-white p-5 dark:bg-[#050505]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              خريطة مسار القبلة الجغرافي
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
              أقصر مسار جيوديسي من موقعك إلى المسجد الحرام بمكة المكرمة
            </p>
          </div>

          <div className="flex rounded-xl border border-[#C9A227]/50 p-1">
            <button
              type="button"
              onClick={() => setMapZoom('regional')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                mapZoom === 'regional'
                  ? 'bg-[#C9A227] text-black'
                  : 'text-slate-600 dark:text-zinc-300'
              }`}
            >
              نطاق إقليمي
            </button>
            <button
              type="button"
              onClick={() => setMapZoom('world')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                mapZoom === 'world'
                  ? 'bg-[#C9A227] text-black'
                  : 'text-slate-600 dark:text-zinc-300'
              }`}
            >
              خريطة العالم
            </button>
          </div>
        </div>

        <div className="my-4 overflow-hidden rounded-2xl border-2 border-[#C9A227]/60 bg-black">
          <svg
            viewBox={viewBox}
            className="h-64 w-full sm:h-80"
            role="img"
            aria-label="خريطة مسار القبلة إلى مكة المكرمة"
          >
            <rect x="0" y="0" width="720" height="360" fill="#050505" />
            {[-60, -30, 0, 30, 60].map((lat) => {
              const [, y] = projectEquirectangular(lat, 0);
              return (
                <line
                  key={`lat-${lat}`}
                  x1="0"
                  y1={y}
                  x2="720"
                  y2={y}
                  stroke="#3A2E0D"
                  strokeWidth="0.6"
                  strokeDasharray="3 3"
                />
              );
            })}
            {[-120, -60, 0, 60, 120].map((lon) => {
              const [x] = projectEquirectangular(0, lon);
              return (
                <line
                  key={`lon-${lon}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="360"
                  stroke="#3A2E0D"
                  strokeWidth="0.6"
                  strokeDasharray="3 3"
                />
              );
            })}

            {WORLD_LANDMASS_PATHS.map((d, idx) => (
              <path
                key={idx}
                d={d}
                fill="#171717"
                stroke="#C9A227"
                strokeWidth="0.6"
              />
            ))}

            <path
              d={geodesicD}
              fill="none"
              stroke="#C9A227"
              strokeWidth={mapZoom === 'world' ? '2.2' : '1.4'}
              strokeDasharray="5 4"
            />

            <g transform={`translate(${userX}, ${userY})`}>
              <circle r={mapZoom === 'world' ? 7 : 4} fill="#FFFFFF" fillOpacity="0.25" />
              <circle
                r={mapZoom === 'world' ? 3.5 : 2.2}
                fill="#FFFFFF"
                stroke="#C9A227"
                strokeWidth="0.8"
              />
            </g>

            <g transform={`translate(${kaabaX}, ${kaabaY})`}>
              <circle r={mapZoom === 'world' ? 9 : 5} fill="#C9A227" fillOpacity="0.3" />
              <rect
                x={mapZoom === 'world' ? -3.5 : -2.2}
                y={mapZoom === 'world' ? -3.5 : -2.2}
                width={mapZoom === 'world' ? 7 : 4.4}
                height={mapZoom === 'world' ? 7 : 4.4}
                fill="#000000"
                stroke="#C9A227"
                strokeWidth="1"
              />
            </g>
          </svg>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-[#C9A227]/50 p-3.5">
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              المسافة إلى مكة
            </span>
            <p className="font-mono-num mt-1 text-lg font-bold text-[#C9A227]">
              {distanceKm.toLocaleString('en-US')} كم
            </p>
          </div>
          <div className="rounded-2xl border border-[#C9A227]/50 p-3.5">
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              درجة الانحراف (السمت)
            </span>
            <p className="font-mono-num mt-1 text-lg font-bold text-[#C9A227]">
              {qiblaBearing.toFixed(1)}°
            </p>
          </div>
          <div className="rounded-2xl border border-[#C9A227]/50 p-3.5">
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
              <MapPin className="h-3.5 w-3.5 text-[#C9A227]" />
              <span>إحداثياتك الحالية</span>
            </span>
            <p className="font-mono-num mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
