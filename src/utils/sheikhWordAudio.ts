import {getAyahAudioUrl} from '../data/reciters';
import {ReciterId} from '../types';
import {AUDIO_CACHE_NAME} from './offlineAudioCache';
import {readAudioBlobFromIdb} from './offlineDb';

/**
 * Computes phonological speech weight for an Arabic Quranic token so we can map
 * exact word index within an ayah recitation to its acoustic time slice.
 */
function getArabicTokenWeight(token: string): number {
  const letters = token.replace(/[\s\u06D6-\u06ED]/g, '');
  let weight = 0;
  for (const ch of letters) {
    if ('اويى'.includes(ch) || ch === '\u0670' || ch === '\u0653') {
      weight += 1.85;
    } else if (ch === '\u0651') {
      weight += 0.65;
    } else if (/[\u064B-\u065F]/.test(ch)) {
      weight += 0.2;
    } else if (/[\u0621-\u064A]/.test(ch)) {
      weight += 1.0;
    }
  }
  return Math.max(1.8, weight);
}

function computeWordTimeRatios(
  tokens: string[],
  targetWordIdx: number,
): {startRatio: number; endRatio: number} {
  if (tokens.length <= 1 || targetWordIdx < 0 || targetWordIdx >= tokens.length) {
    return {startRatio: 0, endRatio: 1};
  }
  const weights = tokens.map(getArabicTokenWeight);
  const total = weights.reduce((acc, w) => acc + w, 0);
  if (total <= 0) return {startRatio: 0, endRatio: 1};

  let before = 0;
  for (let i = 0; i < targetWordIdx; i++) {
    before += weights[i];
  }
  const current = weights[targetWordIdx];
  const padBefore = Math.min(0.035, 0.08 / tokens.length);
  const padAfter = Math.min(0.05, 0.1 / tokens.length);

  return {
    startRatio: Math.max(0, before / total - padBefore),
    endRatio: Math.min(1, (before + current) / total + padAfter),
  };
}

/**
 * Finds local energy valleys around expected start/end so the Sheikh snippet starts
 * cleanly before the word and stops right after the word without cutting syllables.
 */
function findWordSliceBoundsInBuffer(
  buffer: AudioBuffer,
  startRatio: number,
  endRatio: number,
): {startSec: number; endSec: number} {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const totalSec = buffer.duration;
  const frameLen = Math.max(1, Math.floor(sr * 0.015)); // 15ms frames
  const frameCount = Math.floor(data.length / frameLen);
  if (frameCount < 8) {
    return {startSec: 0, endSec: totalSec};
  }

  const energies = new Float32Array(frameCount);
  let peak = 0;
  for (let f = 0; f < frameCount; f++) {
    let sum = 0;
    const base = f * frameLen;
    for (let i = 0; i < frameLen; i++) {
      const v = data[base + i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / frameLen);
    energies[f] = rms;
    if (rms > peak) peak = rms;
  }

  const silenceThreshold = Math.max(0.004, peak * 0.045);
  let firstSpeechFrame = 0;
  while (
    firstSpeechFrame < frameCount - 1 &&
    energies[firstSpeechFrame] < silenceThreshold
  ) {
    firstSpeechFrame++;
  }
  let lastSpeechFrame = frameCount - 1;
  while (
    lastSpeechFrame > firstSpeechFrame &&
    energies[lastSpeechFrame] < silenceThreshold
  ) {
    lastSpeechFrame--;
  }

  const speechStartSec = Math.max(0, (firstSpeechFrame * frameLen) / sr - 0.04);
  const speechEndSec = Math.min(
    totalSec,
    ((lastSpeechFrame + 1) * frameLen) / sr + 0.05,
  );
  const activeSpan = Math.max(0.4, speechEndSec - speechStartSec);

  let rawStartSec = speechStartSec + startRatio * activeSpan;
  let rawEndSec = speechStartSec + endRatio * activeSpan;

  // Snap to quietest local frame within +/- 0.16s window
  const snapSearchFrames = Math.ceil(0.16 / 0.015);
  const snapToValley = (targetSec: number): number => {
    const center = Math.round((targetSec * sr) / frameLen);
    const from = Math.max(firstSpeechFrame, center - snapSearchFrames);
    const to = Math.min(lastSpeechFrame, center + snapSearchFrames);
    let bestFrame = center;
    let bestEnergy = Number.POSITIVE_INFINITY;
    for (let f = from; f <= to; f++) {
      if (energies[f] < bestEnergy) {
        bestEnergy = energies[f];
        bestFrame = f;
      }
    }
    return (bestFrame * frameLen) / sr;
  };

  if (startRatio > 0.02) {
    rawStartSec = Math.max(speechStartSec, snapToValley(rawStartSec) - 0.03);
  } else {
    rawStartSec = speechStartSec;
  }

  if (endRatio < 0.98) {
    rawEndSec = Math.min(speechEndSec, snapToValley(rawEndSec) + 0.06);
  } else {
    rawEndSec = speechEndSec;
  }

  if (rawEndSec - rawStartSec < 0.55) {
    rawEndSec = Math.min(totalSec, rawStartSec + 0.65);
  }

  return {
    startSec: Math.max(0, rawStartSec),
    endSec: Math.min(totalSec, rawEndSec),
  };
}

let activeWordCtx: AudioContext | null = null;
let activeWordSource: AudioBufferSourceNode | null = null;
let activeWordAudioEl: HTMLAudioElement | null = null;
let activeWordStopTimer: number | null = null;
let activeBlobUrl: string | null = null;

export function stopSheikhWordPlayback(): void {
  if (activeWordStopTimer !== null) {
    window.clearTimeout(activeWordStopTimer);
    activeWordStopTimer = null;
  }
  if (activeWordSource) {
    try {
      activeWordSource.stop();
    } catch {
      // ignore
    }
    activeWordSource = null;
  }
  if (activeWordCtx) {
    activeWordCtx.close().catch(() => {});
    activeWordCtx = null;
  }
  if (activeWordAudioEl) {
    activeWordAudioEl.pause();
    activeWordAudioEl.currentTime = 0;
  }
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }
}

async function loadDecodableAudioBytes(url: string): Promise<ArrayBuffer | null> {
  // 1. Check IndexedDB audio blobs (works 100% offline)
  try {
    const idbBlob = await readAudioBlobFromIdb(url);
    if (idbBlob && idbBlob.size > 0) {
      return await idbBlob.arrayBuffer();
    }
  } catch {
    // continue
  }

  // 2. Check CacheStorage (non-opaque cached responses)
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const cachedRes = (await cache.match(url)) || (await caches.match(url));
      if (cachedRes && cachedRes.type !== 'opaque' && cachedRes.ok) {
        return await cachedRes.arrayBuffer();
      }
    } catch {
      // continue
    }
  }

  // 3. Try CORS fetch online
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch(url, {mode: 'cors'});
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // ignore CORS fetch failure
    }
  }

  return null;
}

/**
 * Pronounces ONLY the specific target word from the real Sheikh's ayah recitation MP3
 * (never plays the entire surah or whole ayah, and works offline via IndexedDB/CacheStorage).
 */
export async function playSheikhSingleWord(opts: {
  reciterId: ReciterId;
  surahNumber: number;
  ayahNumber: number;
  ayahTokens: string[];
  targetWordIdx: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}): Promise<void> {
  stopSheikhWordPlayback();

  const {
    reciterId,
    surahNumber,
    ayahNumber,
    ayahTokens,
    targetWordIdx,
    onStart,
    onEnd,
    onError,
  } = opts;

  const url = getAyahAudioUrl(reciterId, surahNumber, ayahNumber);
  const {startRatio, endRatio} = computeWordTimeRatios(
    ayahTokens,
    targetWordIdx,
  );

  onStart?.();

  // Attempt precision Web Audio buffer word slicing first
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext})
          .webkitAudioContext
      : undefined;

  if (AudioCtx) {
    const bytes = await loadDecodableAudioBytes(url);
    if (bytes) {
      try {
        const ctx = new AudioCtx();
        activeWordCtx = ctx;
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        const {startSec, endSec} = findWordSliceBoundsInBuffer(
          decoded,
          startRatio,
          endRatio,
        );
        const playDuration = Math.max(0.45, endSec - startSec);
        const rate = 0.92;

        const gainNode = ctx.createGain();
        const now = ctx.currentTime;
        const realDur = playDuration / rate;
        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.linearRampToValueAtTime(1.0, now + 0.02);
        gainNode.gain.setValueAtTime(1.0, Math.max(now + 0.03, now + realDur - 0.04));
        gainNode.gain.linearRampToValueAtTime(0.001, now + realDur);

        const src = ctx.createBufferSource();
        src.buffer = decoded;
        src.playbackRate.value = rate;
        src.connect(gainNode);
        gainNode.connect(ctx.destination);
        activeWordSource = src;

        src.onended = () => {
          activeWordSource = null;
          ctx.close().catch(() => {});
          if (activeWordCtx === ctx) activeWordCtx = null;
          onEnd?.();
        };

        src.start(0, startSec, playDuration);
        return;
      } catch {
        activeWordCtx?.close().catch(() => {});
        activeWordCtx = null;
      }
    }
  }

  // Fallback to <audio> element (also checks IndexedDB blob URL first for offline safety)
  try {
    let playSrc = url;
    const idbBlob = await readAudioBlobFromIdb(url);
    if (idbBlob && idbBlob.size > 0) {
      activeBlobUrl = URL.createObjectURL(idbBlob);
      playSrc = activeBlobUrl;
    }

    if (!activeWordAudioEl) {
      activeWordAudioEl = new Audio();
    }
    const audio = activeWordAudioEl;
    audio.src = playSrc;
    audio.playbackRate = 0.9;

    const cleanup = () => {
      if (activeWordStopTimer !== null) {
        window.clearTimeout(activeWordStopTimer);
        activeWordStopTimer = null;
      }
      audio.onloadedmetadata = null;
      audio.onended = null;
      audio.onerror = null;
    };

    audio.onloadedmetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (dur > 0.6 && ayahTokens.length > 1) {
        const usableStart = Math.min(0.25, dur * 0.08);
        const usableEnd = Math.max(usableStart + 0.4, dur - Math.min(0.3, dur * 0.08));
        const span = usableEnd - usableStart;
        const startSec = usableStart + startRatio * span;
        const sliceDur = Math.max(0.6, (endRatio - startRatio) * span + 0.15);
        try {
          audio.currentTime = startSec;
        } catch {
          // ignore seek errors on streaming responses
        }
        activeWordStopTimer = window.setTimeout(() => {
          audio.pause();
          cleanup();
          onEnd?.();
        }, (sliceDur / 0.9) * 1000);
      }
    };

    audio.onended = () => {
      cleanup();
      onEnd?.();
    };
    audio.onerror = () => {
      cleanup();
      onError?.();
    };

    await audio.play();
  } catch {
    stopSheikhWordPlayback();
    onError?.();
  }
}
