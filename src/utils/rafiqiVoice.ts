import {RAFIQI_WORDS_30, RafiqiWordEntry} from '../data/rafiqiData';
import {readAudioBlobFromIdb, saveAudioBlobToIdb} from './offlineDb';

const ttsObjectUrlCache = new Map<string, string>();
const inflightTtsRequests = new Map<string, Promise<string | null>>();

export const STARTUP_DUA_TEXT =
  'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ، اللَّهُمَّ افْتَحْ لَنَا أَبْوَابَ رَحْمَتِكَ، وَبَارِكْ لَنَا فِي يَوْمِنَا هَذَا، وَاجْعَلِ الْقُرْآنَ الْعَظِيمَ رَبِيعَ قُلُوبِنَا وَنُورَ صُدُورِنَا وَجَلَاءَ أَحْزَانِنَا.';

function getTtsCacheKey(text: string): string {
  return `rafiqi-sheikh-tts-v1:${text.trim()}`;
}

function base64ToWavBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], {type: mimeType});
}

/**
 * Resolves a playable ObjectURL containing a real human Sheikh voice (WAV)
 * from IndexedDB (offline-first) or generates and persists it via /api/rafiqi-tts.
 */
export async function resolveSheikhHumanVoiceUrl(
  text: string,
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cacheKey = getTtsCacheKey(trimmed);

  if (ttsObjectUrlCache.has(cacheKey)) {
    return ttsObjectUrlCache.get(cacheKey)!;
  }

  const inflight = inflightTtsRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const task = (async (): Promise<string | null> => {
    try {
      const existingBlob = await readAudioBlobFromIdb(cacheKey);
      if (existingBlob && existingBlob.size > 0) {
        const objUrl = URL.createObjectURL(existingBlob);
        ttsObjectUrlCache.set(cacheKey, objUrl);
        return objUrl;
      }
    } catch {
      // ignore IndexedDB read error
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return null;
    }

    try {
      const res = await fetch('/api/rafiqi-tts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: trimmed}),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        ok?: boolean;
        audioBase64?: string;
        mimeType?: string;
      };
      if (!data?.ok || !data.audioBase64) return null;

      const blob = base64ToWavBlob(
        data.audioBase64,
        data.mimeType || 'audio/wav',
      );
      if (blob.size === 0) return null;

      void saveAudioBlobToIdb(cacheKey, blob);
      const objUrl = URL.createObjectURL(blob);
      ttsObjectUrlCache.set(cacheKey, objUrl);
      return objUrl;
    } catch {
      return null;
    }
  })();

  inflightTtsRequests.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inflightTtsRequests.delete(cacheKey);
  }
}

/**
 * Requests a warm, compassionate real Sheikh response tailored to what the user shared,
 * while falling back cleanly to the curated entry reply when offline.
 */
export async function generatePersonalizedSheikhReply(
  userSpeech: string,
  matchedEntry: RafiqiWordEntry,
): Promise<string> {
  const fallback = matchedEntry.replyAr;
  const trimmed = userSpeech.trim();
  if (
    !trimmed ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    const res = await fetch('/api/rafiqi-sheikh-reply', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: controller.signal,
      body: JSON.stringify({
        userMessage: trimmed,
        matchedWordAr: matchedEntry.wordAr,
        matchedSurahNameAr: matchedEntry.surahNameAr,
        matchedAyahNumber: matchedEntry.ayahNumber,
        matchedAyahTextAr: matchedEntry.ayahTextAr,
        fallbackReplyAr: fallback,
      }),
    });
    window.clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = (await res.json()) as {ok?: boolean; replyText?: string};
    const reply = data?.replyText?.trim();
    return reply && reply.length > 8 ? reply : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Pre-downloads and stores all 30 Sheikh replies in IndexedDB when the user
 * downloads the Rafiqi section for offline playback.
 */
export async function prewarmRafiqiSheikhVoicesOffline(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const entry of RAFIQI_WORDS_30) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
    const cacheKey = getTtsCacheKey(entry.replyAr);
    try {
      const existing = await readAudioBlobFromIdb(cacheKey);
      if (existing && existing.size > 0) continue;
    } catch {
      // continue
    }
    await resolveSheikhHumanVoiceUrl(entry.replyAr);
  }
}

/**
 * Pre-warms the startup opening Dua human voice into IndexedDB so subsequent launches
 * play it instantaneously even completely offline.
 */
export async function prewarmStartupDuaVoiceOffline(): Promise<string | null> {
  return resolveSheikhHumanVoiceUrl(STARTUP_DUA_TEXT);
}
