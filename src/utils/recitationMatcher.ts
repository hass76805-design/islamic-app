export interface AyahWordToken {
  raw: string;
  norm: string;
  hamzaNorm: string;
  altVariants: string[];
}

const UTHMANI_TAJWEED_MARKS =
  /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640\uFEFF]/g;

// Keep Hamza (أ إ آ ء ؤ ئ) intact; convert Hamzat Wasl (ٱ) to ا; handle dagger alif (\u0670)
export function stripTashkeelKeepHamza(text: string): string {
  return text
    .replace(UTHMANI_TAJWEED_MARKS, '')
    .replace(/\u0670/g, 'ا')
    .replace(/ٱ/g, 'ا')
    .replace(/[^\u0621-\u064A]/g, '')
    .trim();
}

export function normalizeQuranWord(text: string): string {
  return stripTashkeelKeepHamza(text)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

/**
 * Generates standard Arabic orthographic equivalents for Uthmani Mushaf script
 * while preserving EVERY Hamza (أ إ آ ء ؤ ئ) and EVERY Madd/Tajweed consonant strictly.
 */
function buildUthmaniHamzaVariants(rawWord: string): string[] {
  const cleaned = rawWord.replace(UTHMANI_TAJWEED_MARKS, '').replace(/ٱ/g, 'ا');
  const variants = new Set<string>();

  const toPureLetters = (s: string) =>
    s.replace(/[^\u0621-\u064A]/g, '').trim();

  // 1) With dagger-alif realized as 'ا' (e.g. مَٰلِكِ -> مالك, ٱلْكِتَٰبُ -> الكتاب)
  const vDaggerAsAlif = toPureLetters(cleaned.replace(/\u0670/g, 'ا'));
  if (vDaggerAsAlif) variants.add(vDaggerAsAlif);

  // 2) With dagger-alif omitted as in modern Arabic (e.g. ٱلرَّحْمَٰنِ -> الرحمن, ذَٰلِكَ -> ذلك, هَٰذَا -> هذا, أُو۟لَٰٓئِكَ -> أولئك)
  const vDaggerOmitted = toPureLetters(cleaned.replace(/\u0670/g, ''));
  if (vDaggerOmitted) variants.add(vDaggerOmitted);

  // 3) Uthmani Waw+Dagger-Alif -> Alif (e.g. ٱلصَّلَوٰةَ -> الصلاة, ٱلزَّكَوٰةَ -> الزكاة, ٱلْحَيَوٰةَ -> الحياة)
  const vWawAlif = toPureLetters(
    cleaned.replace(/و\u0670/g, 'ا').replace(/\u0670/g, ''),
  );
  if (vWawAlif) variants.add(vWawAlif);

  // 4) Uthmani Ya-Maqsurah + Dagger-Alif -> ا or ى (e.g. عَلَىٰ -> على, مُوسَىٰ -> موسى)
  const vYaDagger = toPureLetters(
    cleaned.replace(/ى\u0670/g, 'ى').replace(/\u0670/g, ''),
  );
  if (vYaDagger) variants.add(vYaDagger);

  // 5) Uthmani Separate Hamza+Alif (ءا) -> آ (e.g. بِٱلْءَاخِرَةِ -> بالآخرة, ءَامَنَ -> آمن)
  for (const existing of Array.from(variants)) {
    if (existing.includes('ءا')) {
      variants.add(existing.replace(/ءا/g, 'آ'));
    }
    if (existing.endsWith('ة')) {
      variants.add(existing.slice(0, -1) + 'ه');
    }
    if (existing.includes('ى')) {
      variants.add(existing.replace(/ى/g, 'ي'));
    }
  }

  // 6) Special Uthmani Muqatta'at (الم، المص، المر، كهيعص، يس، طه، حم، ق، ص، ن)
  const pure = toPureLetters(cleaned.replace(/\u0670/g, ''));
  if (pure === 'الم') {
    variants.add('ألم');
    variants.add('الم');
  } else if (pure === 'المر') {
    variants.add('ألمر');
  } else if (pure === 'المص') {
    variants.add('ألمص');
  }

  return Array.from(variants);
}

export function tokenizeArabicAyah(ayahText: string): AyahWordToken[] {
  return ayahText
    .split(/\s+/)
    .map((raw) => {
      const altVariants = buildUthmaniHamzaVariants(raw);
      return {
        raw,
        norm: normalizeQuranWord(raw),
        hamzaNorm: altVariants[0] || stripTashkeelKeepHamza(raw),
        altVariants,
      };
    })
    .filter((w) => w.norm.length > 0);
}

const HAMZA_SET = new Set(['أ', 'إ', 'آ', 'ء', 'ؤ', 'ئ']);
const TAFKHEEM_PAIRS = new Set([
  'س:ص',
  'ص:س',
  'ت:ط',
  'ط:ت',
  'د:ض',
  'ض:د',
  'ذ:ظ',
  'ظ:ذ',
]);
const INTERDENTAL_PAIRS = new Set([
  'ث:س',
  'س:ث',
  'ذ:ز',
  'ز:ذ',
  'ظ:ز',
  'ز:ظ',
]);
const MAKHARIJ_PAIRS = new Set([
  'ح:ه',
  'ه:ح',
  'ق:ك',
  'ك:ق',
  'ع:ا',
  'ا:ع',
  'ع:أ',
  'أ:ع',
  'غ:خ',
  'خ:غ',
]);

function classifyTajweedMismatch(sc: string, ec: string): string {
  const pair = `${sc}:${ec}`;
  if (HAMZA_SET.has(ec) || HAMZA_SET.has(sc)) {
    return `خطأ في الهمزة: نُطِق «${sc || 'بدون همزة'}» والصحيح «${ec}»`;
  }
  if (TAFKHEEM_PAIRS.has(pair)) {
    return `خطأ تجويد (التفخيم والترقيق): نُطِق «${sc}» والصحيح «${ec}»`;
  }
  if (INTERDENTAL_PAIRS.has(pair)) {
    return `خطأ تجويد (الحروف اللثوية): نُطِق «${sc}» والصحيح «${ec}»`;
  }
  if (MAKHARIJ_PAIRS.has(pair)) {
    return `خطأ تجويد (مخرج الحرف): نُطِق «${sc}» والصحيح «${ec}»`;
  }
  if (
    (ec === 'ا' || ec === 'و' || ec === 'ي') &&
    (sc === '—' || sc === '')
  ) {
    return `خطأ في المد (نقص حرف المد «${ec}»)`;
  }
  return `خطأ في الحرف أو التجويد: نُطِق «${sc}» والصحيح «${ec}»`;
}

export function compareArabicWords(
  spokenRaw: string,
  expectedNorm: string,
  expectedHamzaNorm?: string,
  expectedAltVariants?: string[],
): {
  isMatch: boolean;
  wrongLetterHint: string | null;
} {
  const spokenHamza = stripTashkeelKeepHamza(spokenRaw);
  const spokenNorm = normalizeQuranWord(spokenRaw);
  if (!spokenNorm) return {isMatch: false, wrongLetterHint: null};

  // Strict Hamza + Uthmani standard-orthography match
  const candidates =
    expectedAltVariants && expectedAltVariants.length > 0
      ? expectedAltVariants
      : expectedHamzaNorm
      ? [expectedHamzaNorm]
      : [];

  if (candidates.length > 0) {
    if (candidates.includes(spokenHamza)) {
      return {isMatch: true, wrongLetterHint: null};
    }
    // Check if consonants match ignoring hamza -> flag specific Hamza error!
    for (const cand of candidates) {
      const candLoose = cand
        .replace(/[أإآ]/g, 'ا')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه');
      if (spokenNorm === candLoose) {
        const maxH = Math.max(spokenHamza.length, cand.length);
        for (let i = 0; i < maxH; i++) {
          const sc = spokenHamza[i] || '';
          const ec = cand[i] || '';
          if (sc !== ec && (HAMZA_SET.has(ec) || HAMZA_SET.has(sc))) {
            return {
              isMatch: false,
              wrongLetterHint: `خطأ في الهمزة: نُطِق «${sc || 'بدون همزة'}» والصحيح «${ec}»`,
            };
          }
        }
      }
    }
  } else if (spokenNorm === expectedNorm) {
    return {isMatch: true, wrongLetterHint: null};
  }

  // Classify exact Tajweed / Madd / Makharij / Letter mistake against best candidate
  const compareTarget = candidates[0] || expectedHamzaNorm || expectedNorm;
  const compareSpoken =
    candidates.length > 0 || expectedHamzaNorm ? spokenHamza : spokenNorm;

  const maxLen = Math.max(compareSpoken.length, compareTarget.length);
  for (let i = 0; i < maxLen; i++) {
    const sc = compareSpoken[i] || '—';
    const ec = compareTarget[i] || '—';
    if (sc !== ec) {
      return {
        isMatch: false,
        wrongLetterHint: classifyTajweedMismatch(sc, ec),
      };
    }
  }

  return {
    isMatch: false,
    wrongLetterHint: `نطقت «${spokenRaw}»`,
  };
}
