// Offline Muezzin & Prayer Times Engine (100% Offline, IndexedDB + Local Cities)
// Supports Beni Suef, Cairo, GPS reverse city lookup, Egyptian General Authority & 5 offline Adhan voices.

(function initAlZahabiAdhanEngine(globalScope) {
  const MUEZZIN_DB_NAME = 'alzahabi-offline-json-db';
  const MUEZZIN_DB_VER = 4;

  const OFFLINE_ADHAN_VOICES = [
    {
      id: 'muezzin-makkah',
      nameAr: 'الحرم المكي',
      muezzinAr: 'أذان الحرم المكي الشريف',
      url: '/adhan-sounds/makkah.mp3',
    },
    {
      id: 'muezzin-naina',
      nameAr: 'أحمد نعينع',
      muezzinAr: 'الشيخ أحمد نعينع',
      url: '/adhan-sounds/ahmed-naina.mp3',
    },
    {
      id: 'muezzin-jalil',
      nameAr: 'خالد الجليل',
      muezzinAr: 'الشيخ خالد الجليل',
      url: '/adhan-sounds/khalid-aljalil.mp3',
    },
    {
      id: 'muezzin-alafasy',
      nameAr: 'مشاري راشد',
      muezzinAr: 'الشيخ مشاري راشد العفاسي',
      url: '/adhan-sounds/mishary-alafasy.mp3',
    },
    {
      id: 'muezzin-egyptian',
      nameAr: 'الأذان المصري',
      muezzinAr: 'الأذان المصري الأصيل',
      url: '/adhan-sounds/egyptian.mp3',
    },
  ];

  const EGYPT_CITIES_PRESET = [
    {city: 'بني سويف', country: 'مصر', latitude: 29.0661, longitude: 31.0994},
    {city: 'القاهرة', country: 'مصر', latitude: 30.0444, longitude: 31.2357},
    {city: 'الجيزة', country: 'مصر', latitude: 30.0131, longitude: 31.2089},
    {city: 'الإسكندرية', country: 'مصر', latitude: 31.2001, longitude: 29.9187},
    {city: 'مكة المكرمة', country: 'السعودية', latitude: 21.4225, longitude: 39.8262},
    {city: 'المدينة المنورة', country: 'السعودية', latitude: 24.4672, longitude: 39.6111},
  ];

  function openMuezzinIdb() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(MUEZZIN_DB_NAME, MUEZZIN_DB_VER);
        req.onupgradeneeded = () => {
          const db = req.result;
          ['json_cache', 'audio_blobs', 'offline_meta', 'app_state'].forEach((store) => {
            if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
          });
          if (!db.objectStoreNames.contains('voice_history')) {
            db.createObjectStore('voice_history', {keyPath: 'id'});
          }
          if (!db.objectStoreNames.contains('downloads')) {
            db.createObjectStore('downloads', {keyPath: 'id'});
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function saveMuezzinConfigOffline(config) {
    const db = await openMuezzinIdb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('app_state', 'readwrite');
        tx.objectStore('app_state').put({...config, updatedAt: Date.now()}, 'muezzin_engine_config_v1');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function scheduleSnooze5Minutes(payload) {
    const snoozeMs = Date.now() + 5 * 60 * 1000;
    const item = {
      tag: `snooze-${Date.now()}`,
      title: `تذكير مؤجل — ${payload && payload.prayerNameAr ? payload.prayerNameAr : 'الصلاة'}`,
      body: 'انتهت مدة التأجيل (5 دقائق) — حان وقت الصلاة',
      prayerNameAr: (payload && payload.prayerNameAr) || 'الصلاة',
      voiceId: (payload && payload.voiceId) || 'muezzin-makkah',
      audioUrl: (payload && payload.audioUrl) || '/adhan-sounds/makkah.mp3',
      timestamp: snoozeMs,
      type: 'adhan',
    };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'MUEZZIN_SNOOZE_5MIN',
          alert: item,
        });
      }
    } catch {
      // ignore if SW controller not yet ready
    }
    return item;
  }

  async function warmOfflineAdhanSounds() {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open('adhan-sounds-v1');
      await Promise.allSettled(
        OFFLINE_ADHAN_VOICES.map(async (v) => {
          const existing = await cache.match(v.url);
          if (!existing) {
            const res = await fetch(v.url);
            if (res && res.ok) await cache.put(v.url, res);
          }
        }),
      );
    } catch {
      // ignore when completely offline before initial warm
    }
  }

  globalScope.AlZahabiAdhan = {
    voices: OFFLINE_ADHAN_VOICES,
    cities: EGYPT_CITIES_PRESET,
    saveMuezzinConfigOffline,
    scheduleSnooze5Minutes,
    warmOfflineAdhanSounds,
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      void warmOfflineAdhanSounds();
    });
  }
})(typeof self !== 'undefined' ? self : window);
