import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  getAyahAudioUrl,
  getReciterById,
  RECITERS_30,
} from '../data/reciters';
import {CompactAyah, CompactSurah, ReciterId} from '../types';
import {loadOfflineJson} from '../utils/offlineAudioCache';
import {
  AyahWordToken,
  compareArabicWords,
  normalizeQuranWord,
  tokenizeArabicAyah,
} from '../utils/recitationMatcher';

interface VoiceTestViewProps {
  preferredReciter: ReciterId;
}

interface EvaluatedWordResult {
  raw: string;
  isMatch: boolean;
  spokenWord: string | null;
  hint: string | null;
}

interface EvaluatedAyahResult {
  ayah: CompactAyah;
  wordResults: EvaluatedWordResult[];
  correctCount: number;
  wrongCount: number;
  isAyahCorrect: boolean;
}

interface DetectionOutcome {
  surah: CompactSurah;
  evaluatedAyahs: EvaluatedAyahResult[];
  totalCorrectWords: number;
  totalWrongWords: number;
  correctAyahsCount: number;
  wrongAyahsCount: number;
  accuracyPercent: number;
  pageLabel: string;
}

const ENCOURAGEMENT_POOLS: Record<
  'high' | 'good' | 'mid' | 'retry',
  Array<{headline: string; message: string}>
> = {
  high: [
    {
      headline: 'ما شاء الله، تلاوة مباركة ومُتقنة!',
      message:
        'أداء ممتاز ونطق سليم لحروف القرآن — بارك الله فيك وزادك تثبيتًا ونورًا.',
    },
    {
      headline: 'أحسنت يا حافظ كتاب الله!',
      message:
        'تلاوتك جميلة ومتزنة جدًا — استمر على هذا الورد اليومي المميز.',
    },
    {
      headline: 'رائع جدًا — قراءة تثلج الصدر!',
      message:
        'أكرمك الله بالقرآن وجعلك من أهل الله وخاصته، أداء يفرح القلب.',
    },
    {
      headline: 'تثبيت رائع وإتقان واضح!',
      message:
        'ربنا يبارك في حفظك ويجعل كل حرف قرأته شفيعًا لك يوم القيامة.',
    },
    {
      headline: 'نعم القراءة ونعم الحفظ!',
      message:
        'كل كلمة نطقتها تشهد بتعبك وحرصك — واصل التقدم نحو الختمة الكاملة.',
    },
    {
      headline: 'سفرة كرام بررة بإذن الله!',
      message:
        'صوت هادئ وتلاوة منضبطة — جزاك الله خيرًا وفتح عليك فتوح العارفين.',
    },
  ],
  good: [
    {
      headline: 'ممتاز، قرّبت جدًا من الإتقان!',
      message:
        'قراءة جميلة ولا ينقصك إلا كلمات يسيرة — اضغط زر «استمع» بجانب الآية وراجع الكلمات الحمراء.',
    },
    {
      headline: 'أحسنت يا بطل — خطوة رائعة!',
      message:
        'أداؤك مبشر جدًا — اسمع الآية بصوت الشيخ وكرّر الكلمات الحمراء وستصل إلى ١٠٠٪ فورًا.',
    },
    {
      headline: 'تقدّم ممتاز — استمر على هذا النشاط!',
      message:
        'حفظك قوي وطيب — لم يتبقَّ إلا ضبط بسيط لبعض الحروف الملوّنة بالأحمر.',
    },
    {
      headline: 'بارك الله في مجهودك الطيب!',
      message:
        'أغلب تلاوتك صحيحة وموزونة — مراجعة سريعة للكلمات الحمراء تجعلها متقنة تمامًا.',
    },
    {
      headline: 'ما أجمل محاولتك — كدت تتقنها كلها!',
      message:
        'الاستمرار سر التثبيت — اضغط «استمع» عند الآية التي فيها ملاحظة وجرّب مرة أخرى.',
    },
    {
      headline: 'بشّرك الله بالخير — مستوى متقدم!',
      message:
        'قراءتك في تحسن مستمر، وكل مرة تسجل فيها يثبت القرآن في صدرك أكثر.',
    },
  ],
  mid: [
    {
      headline: 'بداية طيبة وقرّبت كثيرًا!',
      message:
        'المهم أنك تقرأ وتتعلّم — اضغط زر «استمع» بجانب كل آية وكرّرها وستتقنها بإذن الله.',
    },
    {
      headline: 'مجهود جميل ولك فيه أجران!',
      message:
        'قال ﷺ: «الذي يقرأ القرآن وهو يتتعتع فيه وهو عليه شاق له أجران» — استمع للشيخ وكمّل.',
    },
    {
      headline: 'خطوة مباركة على طريق الحفظ!',
      message:
        'اقرأ كل آية بهدوء بعد سماعها من الشيخ في الأعلى وستجد نفسك أسرع وأدق في المرة القادمة.',
    },
    {
      headline: 'أنت في الطريق الصحيح — واصل!',
      message:
        'كل قارئ متقن بدأ بالتكرار والمراجعة — اسمع الكلمات الحمراء وكررها مع الشيخ.',
    },
    {
      headline: 'ثابر ولا تتوقف — القرآن يثبت بالتكرار!',
      message:
        'تلاوتك فيها كلمات كثيرة صحيحة — ركّز الآن على الكلمات المعلّمة بالأحمر فقط.',
    },
    {
      headline: 'بارك الله في وقتك مع القرآن!',
      message:
        'مجرد جلوسك لتسميع القرآن عبادة عظيمة — استمع للتصحيح وأعد التسجيل بهمة عالية.',
    },
  ],
  retry: [
    {
      headline: 'محاولة جميلة — وأجرك عند الله عظيم!',
      message:
        'اضغط على زر «استمع» بجانب كل آية لتسمعها بصوت الشيخ، ثم أعد المحاولة بكل ثقة.',
    },
    {
      headline: 'لا تتوقف — كل تكرار يثبت الحفظ!',
      message:
        'حفظ القرآن يحب الصبر والهدوء — استمع للآية مرتين ثم اقرأها معنا.',
    },
    {
      headline: 'نور على نور — استمر ولا تستسلم!',
      message:
        'تذكر أن المتتعتع في القرآن له أجران عند الله — اسمع التصحيح وجرّب من جديد.',
    },
    {
      headline: 'بداية موفقة على طريق الإتقان!',
      message:
        'استخدم زر «استمع» بجانب الآية لتسمع مخارج الحروف الصحيحة ثم سجّل تلاوتك مرة ثانية.',
    },
    {
      headline: 'أحسنت أنك بدأت — والمواصلة أسهل!',
      message:
        'اقرأ آية واحدة أو آيتين ببطء بعد سماع الشيخ وستندهش من سرعة تحسن نتيجتك.',
    },
    {
      headline: 'جعل الله سعيك مع القرآن في ميزان حسناتك!',
      message:
        'كثرة المراجعة هي مفتاح الحفظ المتين — اسمع الآيات وكرر معنا الآن.',
    },
  ],
};

function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function formatTimerMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNormalizedTokenForms(tok: AyahWordToken): string[] {
  const forms = new Set<string>();
  if (tok.norm) forms.add(tok.norm);
  for (const v of tok.altVariants) {
    const nv = normalizeQuranWord(v);
    if (nv) forms.add(nv);
  }
  return Array.from(forms);
}

/**
 * Broad phonetic Arabic key used strictly for IDENTIFYING which Surah/Ayah a quiet or
 * mixed-up speaker was attempting, without relaxing actual error reporting afterwards.
 */
function phoneticArabicKey(word: string): string {
  return normalizeQuranWord(word)
    .replace(/[صث]/g, 'س')
    .replace(/[طضد]/g, 'ت')
    .replace(/[ذظ]/g, 'ز')
    .replace(/ق/g, 'ك')
    .replace(/[حخ]/g, 'ه')
    .replace(/ع/g, 'ا')
    .replace(/غ/g, 'خ')
    .replace(/ن/g, 'م');
}

function arabicCharSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  const dp: number[] = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev, dp[j], dp[j - 1]) + 1;
      }
      prev = temp;
    }
  }
  const dist = dp[b.length];
  return Math.max(0, 1 - dist / maxLen);
}

// Forgiving distance <= 1 or strong phonetic match for Surah/Ayah identification
function isNearArabicWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (phoneticArabicKey(a) === phoneticArabicKey(b) && Math.min(a.length, b.length) >= 2) {
    return true;
  }
  if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 3) {
    return false;
  }
  return arabicCharSimilarity(a, b) >= 0.65;
}

const BASMALAH_NORM_PREFIX = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

function getAyahEffectiveTokens(
  surahNum: number,
  ayahNum: number,
  ayahText: string,
  spokenNormSet: Set<string>,
): AyahWordToken[] {
  const tokens = tokenizeArabicAyah(ayahText);
  if (
    surahNum !== 1 &&
    surahNum !== 9 &&
    ayahNum === 1 &&
    tokens.length > 4
  ) {
    const startsWithBasmalah = BASMALAH_NORM_PREFIX.every((w, i) =>
      getNormalizedTokenForms(tokens[i]).includes(w),
    );
    const userRecitedBasmalah =
      spokenNormSet.has('بسم') && spokenNormSet.has('الرحمن');
    if (startsWithBasmalah && !userRecitedBasmalah) {
      return tokens.slice(4);
    }
  }
  return tokens;
}

function findBestAnchorCursorForAyah(
  tokens: AyahWordToken[],
  rawTokens: Array<{raw: string; norm: string; phon: string}>,
  fallbackCursor: number,
): number {
  if (rawTokens.length === 0 || tokens.length === 0) return fallbackCursor;
  const checkCount = Math.min(3, tokens.length);
  let bestPos = fallbackCursor;
  let bestWeight = 0;

  for (let start = 0; start < rawTokens.length; start++) {
    let weight = 0;
    for (let tIdx = 0; tIdx < checkCount; tIdx++) {
      const tokForms = getNormalizedTokenForms(tokens[tIdx]);
      const tokPhon = phoneticArabicKey(tokens[tIdx].norm);
      const lookaheadEnd = Math.min(rawTokens.length, start + tIdx + 3);
      for (let p = start; p < lookaheadEnd; p++) {
        if (tokForms.includes(rawTokens[p].norm)) {
          weight += 3;
          break;
        } else if (
          tokPhon === rawTokens[p].phon ||
          tokForms.some((f) => isNearArabicWord(f, rawTokens[p].norm))
        ) {
          weight += 1.5;
          break;
        }
      }
    }
    if (weight > bestWeight) {
      bestWeight = weight;
      bestPos = start;
    }
  }
  return bestWeight > 0 ? bestPos : fallbackCursor;
}

function buildOutcomeForAyahList(
  surah: CompactSurah,
  targetAyahs: CompactAyah[],
  rawTokens: Array<{raw: string; norm: string; phon: string}>,
): DetectionOutcome {
  const spokenNormSet = new Set(rawTokens.map((t) => t.norm));
  let spokenCursor = 0;
  const evaluatedAyahs: EvaluatedAyahResult[] = [];

  let totalCorrectWords = 0;
  let totalWrongWords = 0;
  let correctAyahsCount = 0;
  let wrongAyahsCount = 0;

  for (const ayah of targetAyahs) {
    const tokens = getAyahEffectiveTokens(
      surah.n,
      ayah.n,
      ayah.t,
      spokenNormSet,
    );

    // Re-anchor cursor if user recited ayahs out of order or skipped some words ("ملخبط")
    spokenCursor = findBestAnchorCursorForAyah(tokens, rawTokens, spokenCursor);

    const wordResults: EvaluatedWordResult[] = [];
    let ayahCorrect = 0;
    let ayahWrong = 0;

    for (const tok of tokens) {
      let matched = false;
      let spokenMatchedWord: string | null = null;
      let mistakeHint: string | null = null;

      const searchEnd = Math.min(rawTokens.length, spokenCursor + 6);
      for (let probe = spokenCursor; probe < searchEnd; probe++) {
        const res = compareArabicWords(
          rawTokens[probe].raw,
          tok.norm,
          tok.hamzaNorm,
          tok.altVariants,
        );
        if (res.isMatch) {
          matched = true;
          spokenMatchedWord = rawTokens[probe].raw;
          spokenCursor = probe + 1;
          break;
        }
      }

      if (!matched) {
        // Look nearby for a near-phonetic candidate the speaker actually pronounced wrong
        let bestNearIdx = -1;
        let bestNearScore = 0.35;
        const nearEnd = Math.min(rawTokens.length, spokenCursor + 3);
        for (let probe = spokenCursor; probe < nearEnd; probe++) {
          const sim = Math.max(
            arabicCharSimilarity(rawTokens[probe].norm, tok.norm),
            arabicCharSimilarity(
              rawTokens[probe].phon,
              phoneticArabicKey(tok.norm),
            ),
          );
          if (sim > bestNearScore) {
            bestNearScore = sim;
            bestNearIdx = probe;
          }
        }

        const candidateSpoken =
          bestNearIdx >= 0
            ? rawTokens[bestNearIdx]
            : rawTokens[spokenCursor];
        if (candidateSpoken) {
          const check = compareArabicWords(
            candidateSpoken.raw,
            tok.norm,
            tok.hamzaNorm,
            tok.altVariants,
          );
          mistakeHint = check.wrongLetterHint;
          spokenMatchedWord = candidateSpoken.raw;
          spokenCursor = (bestNearIdx >= 0 ? bestNearIdx : spokenCursor) + 1;
        } else {
          mistakeHint = 'سقطت هذه الكلمة أو قُرئت بصوت خافت';
          spokenMatchedWord = null;
        }
      }

      if (matched) {
        ayahCorrect += 1;
        totalCorrectWords += 1;
      } else {
        ayahWrong += 1;
        totalWrongWords += 1;
      }

      wordResults.push({
        raw: tok.raw,
        isMatch: matched,
        spokenWord: spokenMatchedWord,
        hint: mistakeHint,
      });
    }

    const isAyahCorrect = ayahWrong === 0 && ayahCorrect > 0;
    if (isAyahCorrect) {
      correctAyahsCount += 1;
    } else {
      wrongAyahsCount += 1;
    }

    evaluatedAyahs.push({
      ayah,
      wordResults,
      correctCount: ayahCorrect,
      wrongCount: ayahWrong,
      isAyahCorrect,
    });
  }

  const totalWords = totalCorrectWords + totalWrongWords;
  const accuracyPercent =
    totalWords > 0 ? Math.round((totalCorrectWords / totalWords) * 100) : 0;

  const pages = Array.from(new Set(targetAyahs.map((a) => a.p))).sort(
    (a, b) => a - b,
  );
  const pageLabel =
    pages.length === 1
      ? `صفحة ${toArabicDigits(pages[0])}`
      : `صفحات ${toArabicDigits(pages[0])} - ${toArabicDigits(pages[pages.length - 1])}`;

  return {
    surah,
    evaluatedAyahs,
    totalCorrectWords,
    totalWrongWords,
    correctAyahsCount,
    wrongAyahsCount,
    accuracyPercent,
    pageLabel,
  };
}

function detectSurahAndEvaluate(
  surahs: CompactSurah[],
  transcript: string,
): DetectionOutcome | null {
  const rawTokens = transcript
    .trim()
    .split(/\s+/)
    .map((w) => {
      const norm = normalizeQuranWord(w);
      return {raw: w, norm, phon: phoneticArabicKey(w)};
    })
    .filter((w) => w.norm.length > 0);

  if (rawTokens.length === 0 || surahs.length === 0) return null;

  const spokenNorms = rawTokens.map((t) => t.norm);
  const spokenPhons = rawTokens.map((t) => t.phon);
  const spokenNormSet = new Set(spokenNorms);
  const spokenPhonSet = new Set(spokenPhons);
  const spokenBigrams = new Set<string>();
  const spokenPhonBigrams = new Set<string>();
  for (let i = 0; i < rawTokens.length - 1; i++) {
    spokenBigrams.add(`${rawTokens[i].norm}|${rawTokens[i + 1].norm}`);
    spokenPhonBigrams.add(`${rawTokens[i].phon}|${rawTokens[i + 1].phon}`);
  }

  let bestSurah: CompactSurah = surahs[0];
  let bestScore = -1;
  let bestMatchedIndices: number[] = [];

  for (const surah of surahs) {
    const matchedRows: Array<{idx: number; score: number}> = [];

    for (let idx = 0; idx < surah.ayahs.length; idx++) {
      const ayah = surah.ayahs[idx];
      const tokens = getAyahEffectiveTokens(
        surah.n,
        ayah.n,
        ayah.t,
        spokenNormSet,
      );
      if (tokens.length === 0) continue;

      const tokenFormsList = tokens.map(getNormalizedTokenForms);
      const tokenPhons = tokens.map((t) => phoneticArabicKey(t.norm));

      let wordHits = 0;
      let nearHits = 0;
      for (let ti = 0; ti < tokenFormsList.length; ti++) {
        const forms = tokenFormsList[ti];
        const phon = tokenPhons[ti];
        if (forms.some((f) => spokenNormSet.has(f))) {
          wordHits += 1;
        } else if (
          (phon.length >= 2 && spokenPhonSet.has(phon)) ||
          forms.some((f) => spokenNorms.some((sn) => isNearArabicWord(f, sn)))
        ) {
          nearHits += 1;
        }
      }

      let bigramHits = 0;
      for (let i = 0; i < tokenFormsList.length - 1; i++) {
        let matchedPair = false;
        for (const f1 of tokenFormsList[i]) {
          for (const f2 of tokenFormsList[i + 1]) {
            if (spokenBigrams.has(`${f1}|${f2}`)) {
              matchedPair = true;
              break;
            }
          }
          if (matchedPair) break;
        }
        if (
          !matchedPair &&
          spokenPhonBigrams.has(`${tokenPhons[i]}|${tokenPhons[i + 1]}`)
        ) {
          matchedPair = true;
        }
        if (matchedPair) bigramHits += 1;
      }

      const effectiveHits = wordHits + nearHits * 0.75;
      const ratio = effectiveHits / tokens.length;
      const ayahScore =
        wordHits * 2.5 +
        nearHits * 1.4 +
        bigramHits * 6 +
        (ratio >= 0.25 ? 3 : 0);

      if (effectiveHits >= 0.9 || bigramHits >= 1 || ratio >= 0.25) {
        matchedRows.push({idx, score: ayahScore});
      }
    }

    if (matchedRows.length === 0) continue;

    // Group nearby ayahs, allowing gaps up to 4 ayahs for mixed-up ("ملخبط") recitations
    const clusters: Array<{indices: number[]; score: number}> = [];
    let currentCluster = {
      indices: [matchedRows[0].idx],
      score: matchedRows[0].score,
    };
    for (let i = 1; i < matchedRows.length; i++) {
      const prevIdx =
        currentCluster.indices[currentCluster.indices.length - 1];
      if (matchedRows[i].idx - prevIdx <= 4) {
        currentCluster.indices.push(matchedRows[i].idx);
        currentCluster.score += matchedRows[i].score;
      } else {
        clusters.push(currentCluster);
        currentCluster = {
          indices: [matchedRows[i].idx],
          score: matchedRows[i].score,
        };
      }
    }
    clusters.push(currentCluster);

    const topCluster = clusters.reduce((best, cur) =>
      cur.score > best.score ? cur : best,
    );

    if (topCluster.score > bestScore) {
      bestScore = topCluster.score;
      bestSurah = surah;
      bestMatchedIndices = topCluster.indices;
    }
  }

  if (bestMatchedIndices.length === 0) {
    return null;
  }

  // If user recited consecutive ayahs (gap <= 2), fill gentle gap of 1 skipped ayah;
  // otherwise keep the matched ayahs stacked cleanly in order
  const selectedIndices: number[] = [];
  for (let i = 0; i < bestMatchedIndices.length; i++) {
    const idx = bestMatchedIndices[i];
    if (i > 0) {
      const prev = bestMatchedIndices[i - 1];
      if (idx - prev === 2) {
        selectedIndices.push(prev + 1);
      }
    }
    selectedIndices.push(idx);
  }

  const targetAyahs = Array.from(new Set(selectedIndices))
    .slice(0, 12)
    .map((idx) => bestSurah.ayahs[idx])
    .filter(Boolean);

  return buildOutcomeForAyahList(bestSurah, targetAyahs, rawTokens);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : '');
    };
    reader.onerror = () => reject(new Error('Failed to encode audio'));
    reader.readAsDataURL(blob);
  });
}

const QUICK_SURAHS_PICKS = [1, 112, 113, 114, 108, 103, 97, 87];

export const VoiceTestView: React.FC<VoiceTestViewProps> = ({
  preferredReciter,
}) => {
  const [surahs, setSurahs] = useState<CompactSurah[] | null>(null);
  const [loadingQuran, setLoadingQuran] = useState(true);
  const [selectedReciter, setSelectedReciter] =
    useState<ReciterId>(preferredReciter);

  const [phase, setPhase] = useState<
    'ready' | 'recording' | 'analyzing' | 'result'
  >('ready');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [attemptNum, setAttemptNum] = useState(0);

  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserClip, setIsPlayingUserClip] = useState(false);
  const [playingSheikhAyahId, setPlayingSheikhAyahId] = useState<number | null>(
    null,
  );
  const [outcome, setOutcome] = useState<DetectionOutcome | null>(null);
  const [lastRecognizedText, setLastRecognizedText] = useState('');
  const [manualSurahNum, setManualSurahNum] = useState(1);

  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const sheikhAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastEncouragementIdxRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    loadOfflineJson<CompactSurah[]>('/data/quran.json')
      .then((data) => {
        if (active) {
          setSurahs(data);
          setLoadingQuran(false);
        }
      })
      .catch(() => {
        if (active) setLoadingQuran(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const teardownAudioNodes = () => {
    if (micIntervalRef.current !== null) {
      window.clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
  };

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      teardownAudioNodes();
      userAudioRef.current?.pause();
      sheikhAudioRef.current?.pause();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  const activeSheikh = useMemo(
    () => getReciterById(selectedReciter),
    [selectedReciter],
  );

  /**
   * High-sensitivity microphone capture with Web Audio preamp & adaptive gain boost
   * so quiet / whispered voices in noisy rooms are amplified cleanly without DSP suppression cutting them off.
   */
  const createHighSensitivityStream = (rawStream: MediaStream): MediaStream => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext})
          .webkitAudioContext;
      if (!AudioCtx) return rawStream;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(rawStream);

      // Remove low-frequency background rumble / fan / AC hum (< 85 Hz)
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 85;
      highPass.Q.value = 0.7;

      // Boost Arabic vocal clarity band (~1.8 kHz)
      const presenceBoost = ctx.createBiquadFilter();
      presenceBoost.type = 'peaking';
      presenceBoost.frequency.value = 1850;
      presenceBoost.Q.value = 1.1;
      presenceBoost.gain.value = 5.5;

      // Maximum-sensitivity adaptive preamp GainNode (8x baseline up to 13x for whispers)
      const preampGain = ctx.createGain();
      preampGain.gain.value = 8.0;

      // Heavy compressor so quiet words become loud and sharp peaks never clip
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -40;
      compressor.knee.value = 28;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.16;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const dataBuf = new Uint8Array(analyser.frequencyBinCount);

      const dest = ctx.createMediaStreamDestination();

      source.connect(highPass);
      highPass.connect(presenceBoost);
      presenceBoost.connect(preampGain);
      preampGain.connect(compressor);
      compressor.connect(analyser);
      compressor.connect(dest);

      micIntervalRef.current = window.setInterval(() => {
        if (!isRecordingRef.current) return;
        analyser.getByteTimeDomainData(dataBuf);
        let sumSq = 0;
        for (let i = 0; i < dataBuf.length; i++) {
          const v = (dataBuf[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / dataBuf.length);
        // Adaptively lift very quiet voices up to 13x gain
        const desiredGain = rms < 0.04 ? 13.0 : rms < 0.12 ? 9.5 : 5.5;
        preampGain.gain.setTargetAtTime(desiredGain, ctx.currentTime, 0.08);
        setMicLevel(Math.min(100, Math.round(rms * 420)));
      }, 110);

      return dest.stream;
    } catch {
      return rawStream;
    }
  };

  const startRecording = async () => {
    setMicNote(null);
    setElapsedSec(0);
    setOutcome(null);
    isRecordingRef.current = true;

    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        let rawStream: MediaStream;
        try {
          // Disable hardware noiseSuppression/echoCancellation that often silences quiet/whispered voices
          rawStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: true,
              channelCount: 1,
            },
          });
        } catch {
          rawStream = await navigator.mediaDevices.getUserMedia({audio: true});
        }

        streamRef.current = rawStream;
        const boostedStream = createHighSensitivityStream(rawStream);

        if (typeof MediaRecorder !== 'undefined') {
          audioChunksRef.current = [];
          const preferredMime = MediaRecorder.isTypeSupported?.(
            'audio/webm;codecs=opus',
          )
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported?.('audio/mp4')
              ? 'audio/mp4'
              : '';
          const recorder = preferredMime
            ? new MediaRecorder(boostedStream, {mimeType: preferredMime})
            : new MediaRecorder(boostedStream);
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              audioChunksRef.current.push(ev.data);
            }
          };
          mediaRecorderRef.current = recorder;
          recorder.start(250);
        }
      }
    } catch {
      setMicNote('يرجى السماح بصلاحية الميكروفون من المتصفح لتسجيل صوتك');
    }

    // Pure MediaRecorder capture runs 100% silently with zero system "تن" mic beep
    setPhase('recording');
  };

  const handleFinishRecording = async () => {
    isRecordingRef.current = false;

    setPhase('analyzing');

    const recordedBlob: Blob | null = await new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        const mimeType = recorder.mimeType || 'audio/webm';
        recorder.onstop = () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          teardownAudioNodes();
          if (audioChunksRef.current.length > 0) {
            resolve(new Blob(audioChunksRef.current, {type: mimeType}));
          } else {
            resolve(null);
          }
        };
        recorder.stop();
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        teardownAudioNodes();
        if (audioChunksRef.current.length > 0) {
          resolve(new Blob(audioChunksRef.current, {type: 'audio/webm'}));
        } else {
          resolve(null);
        }
      }
    });

    if (recordedBlob && recordedBlob.size > 0) {
      const url = URL.createObjectURL(recordedBlob);
      setRecordedAudioUrl(url);
    }

    let finalText = '';

    if (
      recordedBlob &&
      recordedBlob.size > 300 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      try {
        const audioBase64 = await blobToBase64(recordedBlob);
        if (audioBase64) {
          const resp = await fetch('/api/transcribe-quran', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              audioBase64,
              mimeType: recordedBlob.type || 'audio/webm',
            }),
          });
          if (resp.ok) {
            const json = (await resp.json()) as {
              ok?: boolean;
              text?: string;
            };
            if (json.ok && json.text && json.text.trim().length > 0) {
              finalText = json.text.trim();
            }
          }
        }
      } catch {
        // Proceed smoothly to manual Surah view if offline
      }
    }

    setLastRecognizedText(finalText);
    setAttemptNum((c) => c + 1);

    if (surahs && surahs.length > 0 && finalText) {
      const detected = detectSurahAndEvaluate(surahs, finalText);
      setOutcome(detected);
    } else {
      setOutcome(null);
    }
    setPhase('result');
  };

  const evaluateManualSurahChoice = (surahNum: number) => {
    if (!surahs) return;
    const surah = surahs.find((s) => s.n === surahNum);
    if (!surah) return;
    setManualSurahNum(surahNum);
    setAttemptNum((c) => c + 1);
    const endIdx = Math.min(surah.ayahs.length - 1, 6);
    const rawTokens = lastRecognizedText
      .trim()
      .split(/\s+/)
      .map((w) => {
        const norm = normalizeQuranWord(w);
        return {raw: w, norm, phon: phoneticArabicKey(w)};
      })
      .filter((w) => w.norm.length > 0);
    setOutcome(
      buildOutcomeForAyahList(surah, surah.ayahs.slice(0, endIdx + 1), rawTokens),
    );
  };

  const handleReset = () => {
    isRecordingRef.current = false;
    teardownAudioNodes();
    userAudioRef.current?.pause();
    sheikhAudioRef.current?.pause();
    setIsPlayingUserClip(false);
    setPlayingSheikhAyahId(null);
    setPhase('ready');
    setOutcome(null);
    setLastRecognizedText('');
    setElapsedSec(0);
  };

  const togglePlaySheikhAyah = (
    surahNum: number,
    ayahNum: number,
    ayahId: number,
    forcePlay = false,
  ) => {
    if (!sheikhAudioRef.current) {
      sheikhAudioRef.current = new Audio();
    }
    const audio = sheikhAudioRef.current;
    if (!forcePlay && playingSheikhAyahId === ayahId) {
      audio.pause();
      setPlayingSheikhAyahId(null);
      return;
    }
    userAudioRef.current?.pause();
    setIsPlayingUserClip(false);

    audio.pause();
    audio.currentTime = 0;
    audio.src = getAyahAudioUrl(selectedReciter, surahNum, ayahNum);
    setPlayingSheikhAyahId(ayahId);
    audio.onended = () => setPlayingSheikhAyahId(null);
    audio.onerror = () => setPlayingSheikhAyahId(null);
    audio.play().catch(() => setPlayingSheikhAyahId(null));
  };

  const toggleUserRecording = () => {
    if (!recordedAudioUrl) return;
    if (!userAudioRef.current) {
      userAudioRef.current = new Audio();
    }
    const audio = userAudioRef.current;
    if (isPlayingUserClip) {
      audio.pause();
      setIsPlayingUserClip(false);
      return;
    }
    sheikhAudioRef.current?.pause();
    setPlayingSheikhAyahId(null);
    audio.src = recordedAudioUrl;
    setIsPlayingUserClip(true);
    audio.onended = () => setIsPlayingUserClip(false);
    audio.play().catch(() => setIsPlayingUserClip(false));
  };

  const feedback = useMemo(() => {
    if (!outcome) return null;
    const tier =
      outcome.accuracyPercent >= 85
        ? 'high'
        : outcome.accuracyPercent >= 55
          ? 'good'
          : outcome.accuracyPercent >= 25
            ? 'mid'
            : 'retry';
    const pool = ENCOURAGEMENT_POOLS[tier];
    const prevIdx = lastEncouragementIdxRef.current[tier] ?? -1;
    let nextIdx = (attemptNum + outcome.totalCorrectWords) % pool.length;
    if (nextIdx === prevIdx) {
      nextIdx = (prevIdx + 1) % pool.length;
    }
    lastEncouragementIdxRef.current[tier] = nextIdx;
    const picked = pool[nextIdx];
    const tone: 'emerald' | 'gold' | 'amber' =
      tier === 'high' ? 'emerald' : tier === 'good' ? 'gold' : 'amber';
    return {...picked, tone};
  }, [outcome, attemptNum]);

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]">
            <Mic className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#FCE38A]">
              سجّل صوتك واختبر قراءتك
            </h2>
            <p className="text-[11px] text-zinc-300">
              ميكروفون فائق الحساسية حتى للصوت الهامس أو وسط الضوضاء — يعرض كل آية بالتشكيل وتصحيح أخطائها تحتها مع زر «استمع»
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[#C9A227]/45 bg-[#0A0904] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#FCE38A]">
            <UserCheck className="h-4 w-4 text-[#C9A227]" />
            <span>الشيخ للتصحيح وسماع النطق الصحيح:</span>
          </div>
          <select
            aria-label="اختيار الشيخ للتصحيح"
            value={selectedReciter}
            onChange={(e) => setSelectedReciter(e.target.value as ReciterId)}
            className="min-h-[38px] w-full rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
          >
            {RECITERS_30.map((r) => (
              <option key={r.id} value={r.id}>
                الشيخ {r.nameAr} — {r.styleAr}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loadingQuran ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-8 text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A227]" />
          <p className="mt-2 text-xs font-bold text-[#FCE38A]">
            جاري تجهيز المصحف الكامل للتعرف على تلاوتك...
          </p>
        </div>
      ) : phase === 'ready' ? (
        <section className="flex flex-col items-center rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-6 text-center text-white">
          <button
            type="button"
            onClick={() => void startRecording()}
            className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full border-4 border-[#FCE38A] bg-gradient-to-b from-[#FCE38A] via-[#C9A227] to-[#9A7415] text-black shadow-[0_0_40px_rgba(201,162,39,0.45)] active:scale-95"
          >
            <Mic className="h-12 w-12 stroke-[2.4]" />
            <span className="text-xl font-extrabold leading-tight">
              ابدأ التسجيل
            </span>
            <span className="text-[11px] font-bold text-black/80">
              اقرأ بأي نبرة صوت
            </span>
          </button>

          <p className="mt-4 text-xs leading-relaxed text-zinc-300">
            حساسية الميكروفون مضبوطة على أقصى درجة لالتقاط الصوت الواطي والهامس — اقرأ ما تحفظ ثم اضغط «إنهاء».
          </p>
        </section>
      ) : phase === 'recording' ? (
        <section className="flex flex-col items-center space-y-4 rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-5 text-center text-white">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-950/40 px-4 py-1.5 text-xs font-bold text-emerald-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            <span>جاري تسجيل صوتك بحساسية قصوى · {formatTimerMMSS(elapsedSec)}</span>
          </div>

          <div className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full border-4 border-[#FCE38A] bg-[#C9A227]/20 text-[#FCE38A]">
            <Mic className="h-12 w-12" />
          </div>

          {/* Live Sensitive Mic Level Meter */}
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#C9A227]">
              <span>حساسية الميكروفون: أقصى درجة</span>
              <span className="font-mono-num">{micLevel}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-[#C9A227]/40 bg-black">
              <div
                className="h-full bg-gradient-to-l from-[#FCE38A] via-emerald-400 to-[#C9A227] transition-all duration-100"
                style={{width: `${Math.max(8, micLevel)}%`}}
              />
            </div>
          </div>

          <div className="min-h-[68px] w-full rounded-2xl border border-[#C9A227]/45 bg-black p-3 text-right">
            <p className="text-[11px] font-bold text-[#FCE38A]">
              الميكروفون يعمل بصمت تام (بدون أي صوت تن)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              تفضل بالقراءة — الميكروفون مضبوط على أقصى حساسية حتى للصوت الهامس، وعند الانتهاء اضغط «إنهاء» لعرض الآيات والتصحيح.
            </p>
          </div>

          {micNote && <p className="text-xs text-[#FCE38A]">{micNote}</p>}

          <button
            type="button"
            onClick={() => void handleFinishRecording()}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-base font-extrabold text-black"
          >
            <Square className="h-5 w-5 fill-current" />
            <span>إنهاء</span>
          </button>
        </section>
      ) : phase === 'analyzing' ? (
        <section className="flex flex-col items-center space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#040301] p-8 text-center text-white">
          <Loader2 className="h-10 w-10 animate-spin text-[#FCE38A]" />
          <p className="text-sm font-extrabold text-[#FCE38A]">
            جاري استخراج الآيات بالتشكيل ومراجعة كل كلمة...
          </p>
          <p className="text-xs text-zinc-400">
            لحظات قليلة وتظهر كل آية وتصحيحها أدناه
          </p>
        </section>
      ) : (
        /* RESULTS SCREEN */
        <div className="space-y-4">
          {/* 1. User's Recorded Clip Player */}
          <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#0A0904] p-4 text-white">
            <h4 className="text-sm font-bold text-[#FCE38A]">
              تسجيل صوتك (استمع لقراءتك الآن)
            </h4>
            {recordedAudioUrl ? (
              <div className="space-y-2.5">
                <audio
                  controls
                  src={recordedAudioUrl}
                  className="h-10 w-full rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleUserRecording}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#C9A227] text-xs font-extrabold text-black"
                  >
                    {isPlayingUserClip ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span>
                      {isPlayingUserClip ? 'إيقاف صوتي' : 'تشغيل صوتي'}
                    </span>
                  </button>

                  <a
                    href={recordedAudioUrl}
                    download="my-quran-recitation.webm"
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A227] bg-black text-xs font-bold text-[#FCE38A]"
                  >
                    <Download className="h-4 w-4" />
                    <span>حفظ التسجيل</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-300">
                انتهى التسجيل — راجع الآيات والتصحيح أدناه.
              </p>
            )}
          </section>

          {outcome ? (
            <>
              {/* 2. Surah Header & Accuracy Summary */}
              <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-center text-white">
                <div className="flex items-center justify-center gap-2">
                  <Award className="h-6 w-6 shrink-0 text-[#FCE38A]" />
                  <div>
                    <h3 className="font-quran text-2xl font-bold text-[#FCE38A]">
                      {outcome.surah.name}
                    </h3>
                    <p className="text-xs font-bold text-[#C9A227]">
                      {outcome.evaluatedAyahs.length === 1
                        ? `الآية ${toArabicDigits(outcome.evaluatedAyahs[0].ayah.n)}`
                        : `من الآية ${toArabicDigits(outcome.evaluatedAyahs[0].ayah.n)} إلى الآية ${toArabicDigits(outcome.evaluatedAyahs[outcome.evaluatedAyahs.length - 1].ayah.n)}`}{' '}
                      ·{' '}
                      <span className="text-[#FCE38A]">
                        {outcome.pageLabel}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-2.5">
                    <span className="text-[11px] text-zinc-300">كلمات صح</span>
                    <p className="font-mono-num text-lg font-extrabold text-emerald-400">
                      {toArabicDigits(outcome.totalCorrectWords)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-2.5">
                    <span className="text-[11px] text-zinc-300">كلمات غلط</span>
                    <p className="font-mono-num text-lg font-extrabold text-rose-400">
                      {toArabicDigits(outcome.totalWrongWords)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#C9A227]/40 bg-[#141004] p-2.5">
                    <span className="text-[11px] text-zinc-300">نسبة الدقة</span>
                    <p className="font-mono-num text-lg font-extrabold text-[#FCE38A]">
                      {toArabicDigits(outcome.accuracyPercent)}٪
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. STACKED AYAHS ONE BELOW ANOTHER WITH TASHKEEL, LISTEN BUTTON PER AYAH, AND PER-AYAH MISTAKES DIRECTLY UNDERNEATH */}
              <section className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-[#C9A227]/50 bg-[#0A0904] px-3.5 py-2.5 text-xs font-extrabold text-[#FCE38A]">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-[#C9A227]" />
                    <span>الآيات التي قرأتها بالتشكيل وتصحيح كل آية:</span>
                  </div>
                  <span className="text-[11px] text-[#C9A227]">
                    {activeSheikh.shortNameAr}
                  </span>
                </div>

                <div className="space-y-3">
                  {outcome.evaluatedAyahs.map((item) => {
                    const isPlayingThisAyah =
                      playingSheikhAyahId === item.ayah.id;
                    const ayahMistakes = item.wordResults.filter(
                      (w) => !w.isMatch,
                    );

                    return (
                      <article
                        key={item.ayah.id}
                        className="overflow-hidden rounded-3xl border-2 border-[#C9A227] bg-[#050505] text-white"
                      >
                        {/* Top Bar: Ayah Badge + Listen Button right next to every ayah */}
                        <div className="flex items-center justify-between border-b border-[#C9A227]/30 bg-[#0D0A03] px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#C9A227] bg-[#141004] text-xs font-extrabold text-[#FCE38A]">
                              {toArabicDigits(item.ayah.n)}
                            </span>
                            <span className="text-xs font-extrabold text-[#FCE38A]">
                              الآية {toArabicDigits(item.ayah.n)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              togglePlaySheikhAyah(
                                outcome.surah.n,
                                item.ayah.n,
                                item.ayah.id,
                              )
                            }
                            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition active:scale-95 ${
                              isPlayingThisAyah
                                ? 'bg-[#FCE38A] text-black'
                                : 'border border-[#C9A227] bg-[#C9A227]/20 text-[#FCE38A]'
                            }`}
                          >
                            {isPlayingThisAyah ? (
                              <>
                                <Pause className="h-3.5 w-3.5" />
                                <span>إيقاف</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>استمع</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Ayah Text in Full Uthmani Tashkeel with Red Wrong Words */}
                        <div
                          dir="rtl"
                          className="font-quran bg-[#020202] px-4 py-3.5 text-right text-xl leading-[2.35]"
                        >
                          {item.wordResults.map((w, wIdx) =>
                            w.isMatch ? (
                              <span
                                key={`${item.ayah.id}-${wIdx}`}
                                className="text-emerald-100"
                              >
                                {w.raw}{' '}
                              </span>
                            ) : (
                              <span
                                key={`${item.ayah.id}-${wIdx}`}
                                className="mx-0.5 inline-block rounded-md border-b-2 border-rose-500 bg-rose-600/25 px-1 font-bold text-rose-300"
                              >
                                {w.raw}{' '}
                              </span>
                            ),
                          )}
                          <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#C9A227] bg-[#141004] text-[11px] font-extrabold text-[#FCE38A]">
                            {toArabicDigits(item.ayah.n)}
                          </span>
                        </div>

                        {/* Directly Underneath This Ayah: Exact Mistakes ("أنا قلت كذا والصح كذا") or All Correct */}
                        <div className="border-t border-[#C9A227]/25 bg-[#080603] px-4 py-3">
                          {ayahMistakes.length === 0 ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                              <span>
                                ممتاز! قرأت هذه الآية كاملة بدون أي أخطاء.
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-extrabold text-rose-300">
                                أخطائي في هذه الآية:
                              </p>
                              {ayahMistakes.map((m, mIdx) => (
                                <div
                                  key={`${item.ayah.id}-err-${mIdx}`}
                                  className="rounded-xl border border-rose-500/40 bg-[#140507] px-3 py-2 text-xs leading-relaxed"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                    {m.spokenWord ? (
                                      <>
                                        <span className="text-zinc-300">
                                          أنا قلت:
                                        </span>
                                        <span className="rounded bg-rose-600/30 px-1.5 py-0.5 font-extrabold text-rose-300 underline decoration-rose-400">
                                          «{m.spokenWord}»
                                        </span>
                                        <span className="text-[#C9A227]">
                                          ← الصح:
                                        </span>
                                        <span className="font-quran text-sm font-extrabold text-[#FCE38A]">
                                          «{m.raw}»
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-rose-300">
                                          كلمة لم تُقرأ بوضوح:
                                        </span>
                                        <span className="font-quran rounded bg-rose-600/30 px-1.5 py-0.5 text-sm font-extrabold text-rose-200">
                                          «{m.raw}»
                                        </span>
                                        <span className="text-[#C9A227]">
                                          ← الصح:
                                        </span>
                                        <span className="font-quran text-sm font-extrabold text-[#FCE38A]">
                                          «{m.raw}»
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {m.hint && (
                                    <p className="mt-0.5 text-[10px] text-zinc-400">
                                      {m.hint}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* 4. AT THE END: DIFFERENT ENCOURAGING MESSAGE EVERY TIME */}
              {feedback && (
                <section
                  className={`rounded-3xl border-2 p-4 text-center shadow-lg ${
                    feedback.tone === 'emerald'
                      ? 'border-emerald-500/70 bg-emerald-950/35 text-emerald-200'
                      : feedback.tone === 'gold'
                        ? 'border-[#C9A227] bg-[#141004] text-[#FCE38A]'
                        : 'border-amber-500/70 bg-amber-950/30 text-amber-200'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-center gap-1.5">
                    <Sparkles className="h-5 w-5" />
                    <h4 className="text-base font-extrabold">
                      {feedback.headline}
                    </h4>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed">
                    {feedback.message}
                  </p>
                </section>
              )}
            </>
          ) : (
            /* Friendly Surah Selector without any "didn't understand" wording */
            <section className="space-y-3 rounded-3xl border-2 border-[#C9A227] bg-[#050505] p-4 text-white">
              <div className="space-y-1 text-center">
                <h3 className="text-sm font-extrabold text-[#FCE38A]">
                  تم حفظ صوتك! اختر السورة التي قرأتها لعرض الآيات بالتشكيل وتصحيحها
                </h3>
                <p className="text-[11px] text-zinc-300">
                  اضغط على السورة لعرض كل آية تحت بعضها مع زر «استمع» بصوت الشيخ
                </p>
              </div>

              {surahs && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_SURAHS_PICKS.map((sNum) => {
                      const sObj = surahs.find((x) => x.n === sNum);
                      if (!sObj) return null;
                      return (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => evaluateManualSurahChoice(sNum)}
                          className="min-h-[36px] rounded-xl border border-[#C9A227]/60 bg-[#141004] px-3 text-xs font-bold text-[#FCE38A]"
                        >
                          {sObj.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <select
                      aria-label="اختر السورة للمراجعة"
                      value={manualSurahNum}
                      onChange={(e) => setManualSurahNum(Number(e.target.value))}
                      className="min-h-[40px] flex-1 rounded-xl border border-[#C9A227]/60 bg-black px-2.5 text-xs font-bold text-white outline-none"
                    >
                      {surahs.map((s) => (
                        <option key={s.n} value={s.n}>
                          {s.n}. {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => evaluateManualSurahChoice(manualSurahNum)}
                      className="min-h-[40px] rounded-xl bg-[#C9A227] px-4 text-xs font-extrabold text-black"
                    >
                      عرض الآيات
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] text-sm font-extrabold text-black"
          >
            <RotateCcw className="h-4 w-4" />
            <span>جرّب تسجيلًا جديدًا</span>
          </button>
        </div>
      )}
    </div>
  );
};
