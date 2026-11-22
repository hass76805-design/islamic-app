export const AUDIO_CACHE_NAME = 'alzahabi-offline-audio-v1';
export const IMAGE_CACHE_NAME = 'alzahabi-offline-images-v1';

export async function isAudioCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined' || !url) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}

export async function cacheAssetInBucket(
  bucketName: string,
  url: string,
): Promise<boolean> {
  if (typeof caches === 'undefined' || !url) return false;
  try {
    const cache = await caches.open(bucketName);
    const existing = await cache.match(url);
    if (existing) return true;

    try {
      const corsRes = await fetch(url, {mode: 'cors'});
      if (corsRes.ok) {
        await cache.put(url, corsRes);
        return true;
      }
    } catch {
      // Fallback to opaque no-cors response for cross-origin CDNs without ACAO
    }

    const noCorsRes = await fetch(url, {mode: 'no-cors'});
    await cache.put(url, noCorsRes);
    return true;
  } catch {
    return false;
  }
}

export async function cacheAudioUrl(url: string): Promise<boolean> {
  return cacheAssetInBucket(AUDIO_CACHE_NAME, url);
}

export async function cacheImageUrl(url: string): Promise<boolean> {
  return cacheAssetInBucket(IMAGE_CACHE_NAME, url);
}

export async function removeCachedAudio(url: string): Promise<void> {
  if (typeof caches === 'undefined' || !url) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.delete(url);
  } catch {
    // ignore
  }
}

export async function cacheBatchUrls(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  let success = 0;
  for (let i = 0; i < urls.length; i++) {
    const ok = await cacheAudioUrl(urls[i]);
    if (ok) success++;
    onProgress?.(i + 1, urls.length);
  }
  return success;
}

export async function countCachedAudioItems(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}
