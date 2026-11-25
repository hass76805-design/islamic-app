import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Pause,
  Play,
  Radio,
  Search,
  Video,
  Volume2,
} from 'lucide-react';
import {
  ADHAN_VOICES_30,
  FAMOUS_SURAHS_30,
  getReciterById,
  getSurahAudioUrl,
  IQAMAH_AUDIO,
  RECITERS_30,
} from '../data/reciters';
import {AdhanVoice, ReciterId} from '../types';
import {resolveOfflinePlayableUrl} from '../utils/offlineAudioCache';
import {AdhanLiveModal} from './AdhanLiveModal';

interface AudioLibraryViewProps {
  preferredReciter: ReciterId;
  onChangePreferredReciter: (id: ReciterId) => void;
  preferredAdhan: string;
  onChangePreferredAdhan: (id: string) => void;
}

export const AudioLibraryView: React.FC<AudioLibraryViewProps> = ({
  preferredReciter,
  onChangePreferredReciter,
  preferredAdhan,
  onChangePreferredAdhan,
}) => {
  const [subTab, setSubTab] = useState<'surahs' | 'adhan'>('surahs');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingTitle, setPlayingTitle] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [videoPreviewVoice, setVideoPreviewVoice] = useState<{
    voice: AdhanVoice;
    mode: 'adhan' | 'iqamah';
  } | null>(null);

  const [adhanSearch, setAdhanSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reciterInfo = getReciterById(preferredReciter);

  const filteredAdhanVoices = useMemo(() => {
    const q = adhanSearch.trim();
    if (!q) return ADHAN_VOICES_30;
    return ADHAN_VOICES_30.filter(
      (a) =>
        a.nameAr.includes(q) ||
        a.muezzinAr.includes(q) ||
        a.locationAr.includes(q),
    );
  }, [adhanSearch]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = (url: string, title: string, fallbackUrl?: string) => {
    setAudioError(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    if (playingUrl === url && isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    setPlayingUrl(url);
    setPlayingTitle(title);
    setIsPlaying(true);

    let usedFallback = false;
    const setOfflineOrErr = () => {
      setIsPlaying(false);
      setAudioError(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'يرجى الاتصال بالإنترنت لتشغيل هذا المقطع (أو قم بتحميله للعمل بدون نت)'
          : 'تعذر تشغيل هذا المقطع حاليًا',
      );
    };

    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      if (!usedFallback && fallbackUrl && !url.startsWith('/audio/')) {
        usedFallback = true;
        void resolveOfflinePlayableUrl(fallbackUrl).then((fbPlayable) => {
          audio.src = fbPlayable;
          audio.load();
          audio.play().catch(setOfflineOrErr);
        });
        return;
      }
      setOfflineOrErr();
    };

    void resolveOfflinePlayableUrl(url).then((playableUrl) => {
      audio.src = playableUrl;
      audio.play().catch(() => {
        if (!usedFallback && fallbackUrl && !url.startsWith('/audio/')) {
          usedFallback = true;
          void resolveOfflinePlayableUrl(fallbackUrl).then((fbPlayable) => {
            audio.src = fbPlayable;
            audio.load();
            audio.play().catch(setOfflineOrErr);
          });
        } else {
          setOfflineOrErr();
        }
      });
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-[#C9A227] bg-white p-6 dark:bg-[#050505]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            مكتبة التلاوات والأذان
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
            30 سورة مشهورة بـ 30 قارئًا · 30 مؤذنًا للأذان محفوظة للعمل بدون نت
          </p>
        </div>

        <div className="flex rounded-xl border border-[#C9A227]/50 p-1">
          <button
            type="button"
            onClick={() => setSubTab('surahs')}
            className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              subTab === 'surahs'
                ? 'bg-[#C9A227] text-black'
                : 'text-slate-700 dark:text-white'
            }`}
          >
            30 سورة مشهورة
          </button>
          <button
            type="button"
            onClick={() => setSubTab('adhan')}
            className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              subTab === 'adhan'
                ? 'bg-[#C9A227] text-black'
                : 'text-slate-700 dark:text-white'
            }`}
          >
            مكتبة الأذان (30 مؤذنًا)
          </button>
        </div>
      </div>

      {/* Now Playing */}
      {playingUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#C9A227] bg-[#FFFDF6] px-4 py-3 text-slate-900 dark:bg-[#0D0A02] dark:text-white">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-[#C9A227]" />
            <div>
              <p className="text-sm font-bold text-[#9A7415] dark:text-[#F3D56B]">
                {playingTitle}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-300">
                {isPlaying ? 'جاري التشغيل الآن' : 'متوقف مؤقتًا'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => togglePlay(playingUrl, playingTitle)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-bold text-black"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isPlaying ? 'إيقاف' : 'متابعة'}</span>
          </button>
        </div>
      )}

      {audioError && (
        <div className="rounded-2xl border border-[#C9A227]/60 bg-[#141004] px-4 py-3 text-xs font-semibold text-[#FCE38A]">
          {audioError}
        </div>
      )}

      {subTab === 'surahs' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#C9A227] bg-white p-4 dark:bg-[#050505]">
            <div className="flex w-full flex-wrap items-center gap-2">
              <label
                htmlFor="lib-reciter"
                className="text-xs font-bold text-[#9A7415] dark:text-[#C9A227]"
              >
                القارئ:
              </label>
              <select
                id="lib-reciter"
                value={preferredReciter}
                onChange={(e) => onChangePreferredReciter(e.target.value as ReciterId)}
                className="min-h-[40px] flex-1 rounded-xl border border-[#C9A227]/60 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none dark:bg-[#0B0B0B] dark:text-white"
              >
                {RECITERS_30.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameAr} ({r.styleAr})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {FAMOUS_SURAHS_30.map((surah) => {
              const url = getSurahAudioUrl(preferredReciter, surah.number);
              const isCurrent = playingUrl === url && isPlaying;

              return (
                <div
                  key={surah.number}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 transition-colors ${
                    surah.highlight
                      ? 'border-[#C9A227] bg-[#C9A227]/10 dark:bg-[#141004]'
                      : 'border-[#C9A227]/65 bg-white dark:bg-[#050505]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-xs font-bold text-[#C9A227]">
                        {String(surah.number).padStart(2, '0')}
                      </span>
                      <h3 className="font-quran truncate text-xl font-bold text-slate-900 dark:text-white">
                        {surah.nameAr}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      {surah.revelationAr} · {surah.ayahsCount} آية · {reciterInfo.shortNameAr}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      togglePlay(url, `${surah.nameAr} — ${reciterInfo.shortNameAr}`)
                    }
                    aria-label={isCurrent ? 'إيقاف' : 'تشغيل'}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isCurrent
                        ? 'bg-[#C9A227] text-black'
                        : 'border border-[#C9A227] text-[#C9A227] hover:bg-[#C9A227] hover:text-black'
                    }`}
                  >
                    {isCurrent ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl bg-[#000000] p-3 text-white sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#C9A227] bg-[#060606] p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-[#C9A227]" />
              <span className="text-sm font-bold text-[#F3D56B]">
                30 مؤذنًا مختارًا من الحرمين والعالم الإسلامي
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                }
                setVideoPreviewVoice({voice: IQAMAH_AUDIO, mode: 'iqamah'});
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#FCE38A] bg-[#141004] px-3.5 py-2 text-xs font-extrabold text-[#FCE38A] hover:bg-[#C9A227] hover:text-black"
            >
              <Video className="h-4 w-4 text-[#C9A227]" />
              <span>معاينة الإقامة</span>
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              type="text"
              value={adhanSearch}
              onChange={(e) => setAdhanSearch(e.target.value)}
              placeholder="ابحث باسم المؤذن أو البلد..."
              className="min-h-[40px] w-full rounded-xl border border-[#C9A227]/60 bg-[#080703] py-2 pr-9 pl-3 text-xs text-white outline-none focus:border-[#C9A227]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredAdhanVoices.map((adhan) => {
              const isCurrent = playingUrl === adhan.url && isPlaying;
              const isPreferred = preferredAdhan === adhan.id;

              return (
                <div
                  key={adhan.id}
                  className={`flex flex-col justify-between gap-4 rounded-2xl border-2 p-4 ${
                    isPreferred
                      ? 'border-[#C9A227] bg-[#141004]'
                      : 'border-[#C9A227]/65 bg-[#080703]'
                  }`}
                >
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {adhan.nameAr}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400">
                      {adhan.muezzinAr} · {adhan.locationAr}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[#C9A227]/25 pt-3">
                    <button
                      type="button"
                      onClick={() => onChangePreferredAdhan(adhan.id)}
                      className={`min-h-[36px] rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        isPreferred
                          ? 'border-[#C9A227] bg-[#C9A227] text-black'
                          : 'border-[#C9A227]/55 bg-black text-white'
                      }`}
                    >
                      {isPreferred ? 'الصوت المفضل' : 'تعيين كمفضل'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.pause();
                            setIsPlaying(false);
                          }
                          setVideoPreviewVoice({voice: adhan, mode: 'adhan'});
                        }}
                        className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#C9A227] bg-black px-2.5 text-xs font-bold text-[#F3D56B] hover:bg-[#C9A227] hover:text-black"
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>معاينة فيديو</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePlay(adhan.url, adhan.nameAr, adhan.fallbackUrl)}
                        aria-label={isCurrent ? 'إيقاف الأذان' : 'تشغيل الأذان'}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isCurrent
                            ? 'bg-[#C9A227] text-black'
                            : 'border border-[#C9A227] bg-black text-[#C9A227] hover:bg-[#C9A227] hover:text-black'
                        }`}
                      >
                        {isCurrent ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {videoPreviewVoice && (
        <AdhanLiveModal
          prayerNameAr={
            videoPreviewVoice.mode === 'iqamah'
              ? 'الصلاة'
              : videoPreviewVoice.voice.id === 'adhan-fajr'
              ? 'صلاة الفجر'
              : 'الصلاة'
          }
          voice={videoPreviewVoice.voice}
          cityAr="مكة المكرمة"
          countryAr="المملكة العربية السعودية"
          now={new Date()}
          mode={videoPreviewVoice.mode}
          isPreview
          onClose={() => setVideoPreviewVoice(null)}
        />
      )}
    </div>
  );
};
