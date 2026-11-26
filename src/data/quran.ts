import {CompactAyah, CompactSurah, KhatmaPlan} from '../types';
import {loadOfflineJson} from '../utils/offlineAudioCache';
import {
  readKhatmaFromIdb,
  readLastReadFromIdb,
  saveKhatmaToIdb,
  saveLastReadToIdb,
} from '../utils/offlineDb';

export interface SurahMeta {
  n: number;
  name: string;
  en: string;
  type: 'Meccan' | 'Medinan';
  ayahsCount: number;
  startPage: number;
  startJuz: number;
}

export interface JuzMeta {
  number: number;
  nameAr: string;
  startPage: number;
}

export const JUZ_DATA: JuzMeta[] = [
  {number: 1, nameAr: 'الجزء الأول', startPage: 1},
  {number: 2, nameAr: 'الجزء الثاني', startPage: 22},
  {number: 3, nameAr: 'الجزء الثالث', startPage: 42},
  {number: 4, nameAr: 'الجزء الرابع', startPage: 62},
  {number: 5, nameAr: 'الجزء الخامس', startPage: 82},
  {number: 6, nameAr: 'الجزء السادس', startPage: 102},
  {number: 7, nameAr: 'الجزء السابع', startPage: 121},
  {number: 8, nameAr: 'الجزء الثامن', startPage: 142},
  {number: 9, nameAr: 'الجزء التاسع', startPage: 162},
  {number: 10, nameAr: 'الجزء العاشر', startPage: 182},
  {number: 11, nameAr: 'الجزء الحادي عشر', startPage: 201},
  {number: 12, nameAr: 'الجزء الثاني عشر', startPage: 222},
  {number: 13, nameAr: 'الجزء الثالث عشر', startPage: 242},
  {number: 14, nameAr: 'الجزء الرابع عشر', startPage: 262},
  {number: 15, nameAr: 'الجزء الخامس عشر', startPage: 282},
  {number: 16, nameAr: 'الجزء السادس عشر', startPage: 302},
  {number: 17, nameAr: 'الجزء السابع عشر', startPage: 322},
  {number: 18, nameAr: 'الجزء الثامن عشر', startPage: 342},
  {number: 19, nameAr: 'الجزء التاسع عشر', startPage: 362},
  {number: 20, nameAr: 'الجزء العشرون', startPage: 382},
  {number: 21, nameAr: 'الجزء الحادي والعشرون', startPage: 402},
  {number: 22, nameAr: 'الجزء الثاني والعشرون', startPage: 422},
  {number: 23, nameAr: 'الجزء الثالث والعشرون', startPage: 442},
  {number: 24, nameAr: 'الجزء الرابع والعشرون', startPage: 462},
  {number: 25, nameAr: 'الجزء الخامس والعشرون', startPage: 482},
  {number: 26, nameAr: 'الجزء السادس والعشرون', startPage: 502},
  {number: 27, nameAr: 'الجزء السابع والعشرون', startPage: 522},
  {number: 28, nameAr: 'الجزء الثامن والعشرون', startPage: 542},
  {number: 29, nameAr: 'الجزء التاسع والعشرون', startPage: 562},
  {number: 30, nameAr: 'الجزء الثلاثون (جزء عمّ)', startPage: 582},
];

export const QURAN_SURAHS_META: SurahMeta[] = [
  {
    "n": 1,
    "name": "سُورَةُ ٱلْفَاتِحَةِ",
    "en": "Al-Faatiha",
    "type": "Meccan",
    "ayahsCount": 7,
    "startPage": 1,
    "startJuz": 1
  },
  {
    "n": 2,
    "name": "سُورَةُ البَقَرَةِ",
    "en": "Al-Baqara",
    "type": "Medinan",
    "ayahsCount": 286,
    "startPage": 2,
    "startJuz": 1
  },
  {
    "n": 3,
    "name": "سُورَةُ آلِ عِمۡرَانَ",
    "en": "Aal-i-Imraan",
    "type": "Medinan",
    "ayahsCount": 200,
    "startPage": 50,
    "startJuz": 3
  },
  {
    "n": 4,
    "name": "سُورَةُ النِّسَاءِ",
    "en": "An-Nisaa",
    "type": "Medinan",
    "ayahsCount": 176,
    "startPage": 77,
    "startJuz": 4
  },
  {
    "n": 5,
    "name": "سُورَةُ المَائـِدَةِ",
    "en": "Al-Maaida",
    "type": "Medinan",
    "ayahsCount": 120,
    "startPage": 106,
    "startJuz": 6
  },
  {
    "n": 6,
    "name": "سُورَةُ الأَنۡعَامِ",
    "en": "Al-An'aam",
    "type": "Meccan",
    "ayahsCount": 165,
    "startPage": 128,
    "startJuz": 7
  },
  {
    "n": 7,
    "name": "سُورَةُ الأَعۡرَافِ",
    "en": "Al-A'raaf",
    "type": "Meccan",
    "ayahsCount": 206,
    "startPage": 151,
    "startJuz": 8
  },
  {
    "n": 8,
    "name": "سُورَةُ الأَنفَالِ",
    "en": "Al-Anfaal",
    "type": "Medinan",
    "ayahsCount": 75,
    "startPage": 177,
    "startJuz": 9
  },
  {
    "n": 9,
    "name": "سُورَةُ التَّوۡبَةِ",
    "en": "At-Tawba",
    "type": "Medinan",
    "ayahsCount": 129,
    "startPage": 187,
    "startJuz": 10
  },
  {
    "n": 10,
    "name": "سُورَةُ يُونُسَ",
    "en": "Yunus",
    "type": "Meccan",
    "ayahsCount": 109,
    "startPage": 208,
    "startJuz": 11
  },
  {
    "n": 11,
    "name": "سُورَةُ هُودٍ",
    "en": "Hud",
    "type": "Meccan",
    "ayahsCount": 123,
    "startPage": 221,
    "startJuz": 11
  },
  {
    "n": 12,
    "name": "سُورَةُ يُوسُفَ",
    "en": "Yusuf",
    "type": "Meccan",
    "ayahsCount": 111,
    "startPage": 235,
    "startJuz": 12
  },
  {
    "n": 13,
    "name": "سُورَةُ الرَّعۡدِ",
    "en": "Ar-Ra'd",
    "type": "Medinan",
    "ayahsCount": 43,
    "startPage": 249,
    "startJuz": 13
  },
  {
    "n": 14,
    "name": "سُورَةُ إِبۡرَاهِيمَ",
    "en": "Ibrahim",
    "type": "Meccan",
    "ayahsCount": 52,
    "startPage": 255,
    "startJuz": 13
  },
  {
    "n": 15,
    "name": "سُورَةُ الحِجۡرِ",
    "en": "Al-Hijr",
    "type": "Meccan",
    "ayahsCount": 99,
    "startPage": 262,
    "startJuz": 14
  },
  {
    "n": 16,
    "name": "سُورَةُ النَّحۡلِ",
    "en": "An-Nahl",
    "type": "Meccan",
    "ayahsCount": 128,
    "startPage": 267,
    "startJuz": 14
  },
  {
    "n": 17,
    "name": "سُورَةُ الإِسۡرَاءِ",
    "en": "Al-Israa",
    "type": "Meccan",
    "ayahsCount": 111,
    "startPage": 282,
    "startJuz": 15
  },
  {
    "n": 18,
    "name": "سُورَةُ الكَهۡفِ",
    "en": "Al-Kahf",
    "type": "Meccan",
    "ayahsCount": 110,
    "startPage": 293,
    "startJuz": 15
  },
  {
    "n": 19,
    "name": "سُورَةُ مَرۡيَمَ",
    "en": "Maryam",
    "type": "Meccan",
    "ayahsCount": 98,
    "startPage": 305,
    "startJuz": 16
  },
  {
    "n": 20,
    "name": "سُورَةُ طه",
    "en": "Taa-Haa",
    "type": "Meccan",
    "ayahsCount": 135,
    "startPage": 312,
    "startJuz": 16
  },
  {
    "n": 21,
    "name": "سُورَةُ الأَنبِيَاءِ",
    "en": "Al-Anbiyaa",
    "type": "Meccan",
    "ayahsCount": 112,
    "startPage": 322,
    "startJuz": 17
  },
  {
    "n": 22,
    "name": "سُورَةُ الحَجِّ",
    "en": "Al-Hajj",
    "type": "Medinan",
    "ayahsCount": 78,
    "startPage": 332,
    "startJuz": 17
  },
  {
    "n": 23,
    "name": "سُورَةُ المُؤۡمِنُونَ",
    "en": "Al-Muminoon",
    "type": "Meccan",
    "ayahsCount": 118,
    "startPage": 342,
    "startJuz": 18
  },
  {
    "n": 24,
    "name": "سُورَةُ النُّورِ",
    "en": "An-Noor",
    "type": "Medinan",
    "ayahsCount": 64,
    "startPage": 350,
    "startJuz": 18
  },
  {
    "n": 25,
    "name": "سُورَةُ الفُرۡقَانِ",
    "en": "Al-Furqaan",
    "type": "Meccan",
    "ayahsCount": 77,
    "startPage": 359,
    "startJuz": 18
  },
  {
    "n": 26,
    "name": "سُورَةُ الشُّعَرَاءِ",
    "en": "Ash-Shu'araa",
    "type": "Meccan",
    "ayahsCount": 227,
    "startPage": 367,
    "startJuz": 19
  },
  {
    "n": 27,
    "name": "سُورَةُ النَّمۡلِ",
    "en": "An-Naml",
    "type": "Meccan",
    "ayahsCount": 93,
    "startPage": 377,
    "startJuz": 19
  },
  {
    "n": 28,
    "name": "سُورَةُ القَصَصِ",
    "en": "Al-Qasas",
    "type": "Meccan",
    "ayahsCount": 88,
    "startPage": 385,
    "startJuz": 20
  },
  {
    "n": 29,
    "name": "سُورَةُ العَنكَبُوتِ",
    "en": "Al-Ankaboot",
    "type": "Meccan",
    "ayahsCount": 69,
    "startPage": 396,
    "startJuz": 20
  },
  {
    "n": 30,
    "name": "سُورَةُ الرُّومِ",
    "en": "Ar-Room",
    "type": "Meccan",
    "ayahsCount": 60,
    "startPage": 404,
    "startJuz": 21
  },
  {
    "n": 31,
    "name": "سُورَةُ لُقۡمَانَ",
    "en": "Luqman",
    "type": "Meccan",
    "ayahsCount": 34,
    "startPage": 411,
    "startJuz": 21
  },
  {
    "n": 32,
    "name": "سُورَةُ السَّجۡدَةِ",
    "en": "As-Sajda",
    "type": "Meccan",
    "ayahsCount": 30,
    "startPage": 415,
    "startJuz": 21
  },
  {
    "n": 33,
    "name": "سُورَةُ الأَحۡزَابِ",
    "en": "Al-Ahzaab",
    "type": "Medinan",
    "ayahsCount": 73,
    "startPage": 418,
    "startJuz": 21
  },
  {
    "n": 34,
    "name": "سُورَةُ سَبَإٍ",
    "en": "Saba",
    "type": "Meccan",
    "ayahsCount": 54,
    "startPage": 428,
    "startJuz": 22
  },
  {
    "n": 35,
    "name": "سُورَةُ فَاطِرٍ",
    "en": "Faatir",
    "type": "Meccan",
    "ayahsCount": 45,
    "startPage": 434,
    "startJuz": 22
  },
  {
    "n": 36,
    "name": "سُورَةُ يسٓ",
    "en": "Yaseen",
    "type": "Meccan",
    "ayahsCount": 83,
    "startPage": 440,
    "startJuz": 22
  },
  {
    "n": 37,
    "name": "سُورَةُ الصَّافَّاتِ",
    "en": "As-Saaffaat",
    "type": "Meccan",
    "ayahsCount": 182,
    "startPage": 446,
    "startJuz": 23
  },
  {
    "n": 38,
    "name": "سُورَةُ صٓ",
    "en": "Saad",
    "type": "Meccan",
    "ayahsCount": 88,
    "startPage": 453,
    "startJuz": 23
  },
  {
    "n": 39,
    "name": "سُورَةُ الزُّمَرِ",
    "en": "Az-Zumar",
    "type": "Meccan",
    "ayahsCount": 75,
    "startPage": 458,
    "startJuz": 23
  },
  {
    "n": 40,
    "name": "سُورَةُ غَافِرٍ",
    "en": "Ghafir",
    "type": "Meccan",
    "ayahsCount": 85,
    "startPage": 467,
    "startJuz": 24
  },
  {
    "n": 41,
    "name": "سُورَةُ فُصِّلَتۡ",
    "en": "Fussilat",
    "type": "Meccan",
    "ayahsCount": 54,
    "startPage": 477,
    "startJuz": 24
  },
  {
    "n": 42,
    "name": "سُورَةُ الشُّورَىٰ",
    "en": "Ash-Shura",
    "type": "Meccan",
    "ayahsCount": 53,
    "startPage": 483,
    "startJuz": 25
  },
  {
    "n": 43,
    "name": "سُورَةُ الزُّخۡرُفِ",
    "en": "Az-Zukhruf",
    "type": "Meccan",
    "ayahsCount": 89,
    "startPage": 489,
    "startJuz": 25
  },
  {
    "n": 44,
    "name": "سُورَةُ الدُّخَانِ",
    "en": "Ad-Dukhaan",
    "type": "Meccan",
    "ayahsCount": 59,
    "startPage": 496,
    "startJuz": 25
  },
  {
    "n": 45,
    "name": "سُورَةُ الجَاثِيَةِ",
    "en": "Al-Jaathiya",
    "type": "Meccan",
    "ayahsCount": 37,
    "startPage": 499,
    "startJuz": 25
  },
  {
    "n": 46,
    "name": "سُورَةُ الأَحۡقَافِ",
    "en": "Al-Ahqaf",
    "type": "Meccan",
    "ayahsCount": 35,
    "startPage": 502,
    "startJuz": 26
  },
  {
    "n": 47,
    "name": "سُورَةُ مُحَمَّدٍ",
    "en": "Muhammad",
    "type": "Medinan",
    "ayahsCount": 38,
    "startPage": 507,
    "startJuz": 26
  },
  {
    "n": 48,
    "name": "سُورَةُ الفَتۡحِ",
    "en": "Al-Fath",
    "type": "Medinan",
    "ayahsCount": 29,
    "startPage": 511,
    "startJuz": 26
  },
  {
    "n": 49,
    "name": "سُورَةُ الحُجُرَاتِ",
    "en": "Al-Hujuraat",
    "type": "Medinan",
    "ayahsCount": 18,
    "startPage": 515,
    "startJuz": 26
  },
  {
    "n": 50,
    "name": "سُورَةُ قٓ",
    "en": "Qaaf",
    "type": "Meccan",
    "ayahsCount": 45,
    "startPage": 518,
    "startJuz": 26
  },
  {
    "n": 51,
    "name": "سُورَةُ الذَّارِيَاتِ",
    "en": "Adh-Dhaariyat",
    "type": "Meccan",
    "ayahsCount": 60,
    "startPage": 520,
    "startJuz": 26
  },
  {
    "n": 52,
    "name": "سُورَةُ الطُّورِ",
    "en": "At-Tur",
    "type": "Meccan",
    "ayahsCount": 49,
    "startPage": 523,
    "startJuz": 27
  },
  {
    "n": 53,
    "name": "سُورَةُ النَّجۡمِ",
    "en": "An-Najm",
    "type": "Meccan",
    "ayahsCount": 62,
    "startPage": 526,
    "startJuz": 27
  },
  {
    "n": 54,
    "name": "سُورَةُ القَمَرِ",
    "en": "Al-Qamar",
    "type": "Meccan",
    "ayahsCount": 55,
    "startPage": 528,
    "startJuz": 27
  },
  {
    "n": 55,
    "name": "سُورَةُ الرَّحۡمَٰن",
    "en": "Ar-Rahmaan",
    "type": "Medinan",
    "ayahsCount": 78,
    "startPage": 531,
    "startJuz": 27
  },
  {
    "n": 56,
    "name": "سُورَةُ الوَاقِعَةِ",
    "en": "Al-Waaqia",
    "type": "Meccan",
    "ayahsCount": 96,
    "startPage": 534,
    "startJuz": 27
  },
  {
    "n": 57,
    "name": "سُورَةُ الحَدِيدِ",
    "en": "Al-Hadid",
    "type": "Medinan",
    "ayahsCount": 29,
    "startPage": 537,
    "startJuz": 27
  },
  {
    "n": 58,
    "name": "سُورَةُ المُجَادلَةِ",
    "en": "Al-Mujaadila",
    "type": "Medinan",
    "ayahsCount": 22,
    "startPage": 542,
    "startJuz": 28
  },
  {
    "n": 59,
    "name": "سُورَةُ الحَشۡرِ",
    "en": "Al-Hashr",
    "type": "Medinan",
    "ayahsCount": 24,
    "startPage": 545,
    "startJuz": 28
  },
  {
    "n": 60,
    "name": "سُورَةُ المُمۡتَحنَةِ",
    "en": "Al-Mumtahana",
    "type": "Medinan",
    "ayahsCount": 13,
    "startPage": 549,
    "startJuz": 28
  },
  {
    "n": 61,
    "name": "سُورَةُ الصَّفِّ",
    "en": "As-Saff",
    "type": "Medinan",
    "ayahsCount": 14,
    "startPage": 551,
    "startJuz": 28
  },
  {
    "n": 62,
    "name": "سُورَةُ الجُمُعَةِ",
    "en": "Al-Jumu'a",
    "type": "Medinan",
    "ayahsCount": 11,
    "startPage": 553,
    "startJuz": 28
  },
  {
    "n": 63,
    "name": "سُورَةُ المُنَافِقُونَ",
    "en": "Al-Munaafiqoon",
    "type": "Medinan",
    "ayahsCount": 11,
    "startPage": 554,
    "startJuz": 28
  },
  {
    "n": 64,
    "name": "سُورَةُ التَّغَابُنِ",
    "en": "At-Taghaabun",
    "type": "Medinan",
    "ayahsCount": 18,
    "startPage": 556,
    "startJuz": 28
  },
  {
    "n": 65,
    "name": "سُورَةُ الطَّلَاقِ",
    "en": "At-Talaaq",
    "type": "Medinan",
    "ayahsCount": 12,
    "startPage": 558,
    "startJuz": 28
  },
  {
    "n": 66,
    "name": "سُورَةُ التَّحۡرِيمِ",
    "en": "At-Tahrim",
    "type": "Medinan",
    "ayahsCount": 12,
    "startPage": 560,
    "startJuz": 28
  },
  {
    "n": 67,
    "name": "سُورَةُ المُلۡكِ",
    "en": "Al-Mulk",
    "type": "Meccan",
    "ayahsCount": 30,
    "startPage": 562,
    "startJuz": 29
  },
  {
    "n": 68,
    "name": "سُورَةُ القَلَمِ",
    "en": "Al-Qalam",
    "type": "Meccan",
    "ayahsCount": 52,
    "startPage": 564,
    "startJuz": 29
  },
  {
    "n": 69,
    "name": "سُورَةُ الحَاقَّةِ",
    "en": "Al-Haaqqa",
    "type": "Meccan",
    "ayahsCount": 52,
    "startPage": 566,
    "startJuz": 29
  },
  {
    "n": 70,
    "name": "سُورَةُ المَعَارِجِ",
    "en": "Al-Ma'aarij",
    "type": "Meccan",
    "ayahsCount": 44,
    "startPage": 568,
    "startJuz": 29
  },
  {
    "n": 71,
    "name": "سُورَةُ نُوحٍ",
    "en": "Nooh",
    "type": "Meccan",
    "ayahsCount": 28,
    "startPage": 570,
    "startJuz": 29
  },
  {
    "n": 72,
    "name": "سُورَةُ الجِنِّ",
    "en": "Al-Jinn",
    "type": "Meccan",
    "ayahsCount": 28,
    "startPage": 572,
    "startJuz": 29
  },
  {
    "n": 73,
    "name": "سُورَةُ المُزَّمِّلِ",
    "en": "Al-Muzzammil",
    "type": "Meccan",
    "ayahsCount": 20,
    "startPage": 574,
    "startJuz": 29
  },
  {
    "n": 74,
    "name": "سُورَةُ المُدَّثِّرِ",
    "en": "Al-Muddaththir",
    "type": "Meccan",
    "ayahsCount": 56,
    "startPage": 575,
    "startJuz": 29
  },
  {
    "n": 75,
    "name": "سُورَةُ القِيَامَةِ",
    "en": "Al-Qiyaama",
    "type": "Meccan",
    "ayahsCount": 40,
    "startPage": 577,
    "startJuz": 29
  },
  {
    "n": 76,
    "name": "سُورَةُ الإِنسَانِ",
    "en": "Al-Insaan",
    "type": "Medinan",
    "ayahsCount": 31,
    "startPage": 578,
    "startJuz": 29
  },
  {
    "n": 77,
    "name": "سُورَةُ المُرۡسَلَاتِ",
    "en": "Al-Mursalaat",
    "type": "Meccan",
    "ayahsCount": 50,
    "startPage": 580,
    "startJuz": 29
  },
  {
    "n": 78,
    "name": "سُورَةُ النَّبَإِ",
    "en": "An-Naba",
    "type": "Meccan",
    "ayahsCount": 40,
    "startPage": 582,
    "startJuz": 30
  },
  {
    "n": 79,
    "name": "سُورَةُ النَّازِعَاتِ",
    "en": "An-Naazi'aat",
    "type": "Meccan",
    "ayahsCount": 46,
    "startPage": 583,
    "startJuz": 30
  },
  {
    "n": 80,
    "name": "سُورَةُ عَبَسَ",
    "en": "Abasa",
    "type": "Meccan",
    "ayahsCount": 42,
    "startPage": 585,
    "startJuz": 30
  },
  {
    "n": 81,
    "name": "سُورَةُ التَّكۡوِيرِ",
    "en": "At-Takwir",
    "type": "Meccan",
    "ayahsCount": 29,
    "startPage": 586,
    "startJuz": 30
  },
  {
    "n": 82,
    "name": "سُورَةُ الانفِطَارِ",
    "en": "Al-Infitaar",
    "type": "Meccan",
    "ayahsCount": 19,
    "startPage": 587,
    "startJuz": 30
  },
  {
    "n": 83,
    "name": "سُورَةُ المُطَفِّفِينَ",
    "en": "Al-Mutaffifin",
    "type": "Meccan",
    "ayahsCount": 36,
    "startPage": 587,
    "startJuz": 30
  },
  {
    "n": 84,
    "name": "سُورَةُ الانشِقَاقِ",
    "en": "Al-Inshiqaaq",
    "type": "Meccan",
    "ayahsCount": 25,
    "startPage": 589,
    "startJuz": 30
  },
  {
    "n": 85,
    "name": "سُورَةُ البُرُوجِ",
    "en": "Al-Burooj",
    "type": "Meccan",
    "ayahsCount": 22,
    "startPage": 590,
    "startJuz": 30
  },
  {
    "n": 86,
    "name": "سُورَةُ الطَّارِقِ",
    "en": "At-Taariq",
    "type": "Meccan",
    "ayahsCount": 17,
    "startPage": 591,
    "startJuz": 30
  },
  {
    "n": 87,
    "name": "سُورَةُ الأَعۡلَىٰ",
    "en": "Al-A'laa",
    "type": "Meccan",
    "ayahsCount": 19,
    "startPage": 591,
    "startJuz": 30
  },
  {
    "n": 88,
    "name": "سُورَةُ الغَاشِيَةِ",
    "en": "Al-Ghaashiya",
    "type": "Meccan",
    "ayahsCount": 26,
    "startPage": 592,
    "startJuz": 30
  },
  {
    "n": 89,
    "name": "سُورَةُ الفَجۡرِ",
    "en": "Al-Fajr",
    "type": "Meccan",
    "ayahsCount": 30,
    "startPage": 593,
    "startJuz": 30
  },
  {
    "n": 90,
    "name": "سُورَةُ البَلَدِ",
    "en": "Al-Balad",
    "type": "Meccan",
    "ayahsCount": 20,
    "startPage": 594,
    "startJuz": 30
  },
  {
    "n": 91,
    "name": "سُورَةُ الشَّمۡسِ",
    "en": "Ash-Shams",
    "type": "Meccan",
    "ayahsCount": 15,
    "startPage": 595,
    "startJuz": 30
  },
  {
    "n": 92,
    "name": "سُورَةُ اللَّيۡلِ",
    "en": "Al-Lail",
    "type": "Meccan",
    "ayahsCount": 21,
    "startPage": 595,
    "startJuz": 30
  },
  {
    "n": 93,
    "name": "سُورَةُ الضُّحَىٰ",
    "en": "Ad-Dhuhaa",
    "type": "Meccan",
    "ayahsCount": 11,
    "startPage": 596,
    "startJuz": 30
  },
  {
    "n": 94,
    "name": "سُورَةُ الشَّرۡحِ",
    "en": "Ash-Sharh",
    "type": "Meccan",
    "ayahsCount": 8,
    "startPage": 596,
    "startJuz": 30
  },
  {
    "n": 95,
    "name": "سُورَةُ التِّينِ",
    "en": "At-Tin",
    "type": "Meccan",
    "ayahsCount": 8,
    "startPage": 597,
    "startJuz": 30
  },
  {
    "n": 96,
    "name": "سُورَةُ العَلَقِ",
    "en": "Al-Alaq",
    "type": "Meccan",
    "ayahsCount": 19,
    "startPage": 597,
    "startJuz": 30
  },
  {
    "n": 97,
    "name": "سُورَةُ القَدۡرِ",
    "en": "Al-Qadr",
    "type": "Meccan",
    "ayahsCount": 5,
    "startPage": 598,
    "startJuz": 30
  },
  {
    "n": 98,
    "name": "سُورَةُ البَيِّنَةِ",
    "en": "Al-Bayyina",
    "type": "Medinan",
    "ayahsCount": 8,
    "startPage": 598,
    "startJuz": 30
  },
  {
    "n": 99,
    "name": "سُورَةُ الزَّلۡزَلَةِ",
    "en": "Az-Zalzala",
    "type": "Medinan",
    "ayahsCount": 8,
    "startPage": 599,
    "startJuz": 30
  },
  {
    "n": 100,
    "name": "سُورَةُ العَادِيَاتِ",
    "en": "Al-Aadiyaat",
    "type": "Meccan",
    "ayahsCount": 11,
    "startPage": 599,
    "startJuz": 30
  },
  {
    "n": 101,
    "name": "سُورَةُ القَارِعَةِ",
    "en": "Al-Qaari'a",
    "type": "Meccan",
    "ayahsCount": 11,
    "startPage": 600,
    "startJuz": 30
  },
  {
    "n": 102,
    "name": "سُورَةُ التَّكَاثُرِ",
    "en": "At-Takaathur",
    "type": "Meccan",
    "ayahsCount": 8,
    "startPage": 600,
    "startJuz": 30
  },
  {
    "n": 103,
    "name": "سُورَةُ العَصۡرِ",
    "en": "Al-Asr",
    "type": "Meccan",
    "ayahsCount": 3,
    "startPage": 601,
    "startJuz": 30
  },
  {
    "n": 104,
    "name": "سُورَةُ الهُمَزَةِ",
    "en": "Al-Humaza",
    "type": "Meccan",
    "ayahsCount": 9,
    "startPage": 601,
    "startJuz": 30
  },
  {
    "n": 105,
    "name": "سُورَةُ الفِيلِ",
    "en": "Al-Fil",
    "type": "Meccan",
    "ayahsCount": 5,
    "startPage": 601,
    "startJuz": 30
  },
  {
    "n": 106,
    "name": "سُورَةُ قُرَيۡشٍ",
    "en": "Quraish",
    "type": "Meccan",
    "ayahsCount": 4,
    "startPage": 602,
    "startJuz": 30
  },
  {
    "n": 107,
    "name": "سُورَةُ المَاعُونِ",
    "en": "Al-Maa'un",
    "type": "Meccan",
    "ayahsCount": 7,
    "startPage": 602,
    "startJuz": 30
  },
  {
    "n": 108,
    "name": "سُورَةُ الكَوۡثَرِ",
    "en": "Al-Kawthar",
    "type": "Meccan",
    "ayahsCount": 3,
    "startPage": 602,
    "startJuz": 30
  },
  {
    "n": 109,
    "name": "سُورَةُ الكَافِرُونَ",
    "en": "Al-Kaafiroon",
    "type": "Meccan",
    "ayahsCount": 6,
    "startPage": 603,
    "startJuz": 30
  },
  {
    "n": 110,
    "name": "سُورَةُ النَّصۡرِ",
    "en": "An-Nasr",
    "type": "Medinan",
    "ayahsCount": 3,
    "startPage": 603,
    "startJuz": 30
  },
  {
    "n": 111,
    "name": "سُورَةُ المَسَدِ",
    "en": "Al-Masad",
    "type": "Meccan",
    "ayahsCount": 5,
    "startPage": 603,
    "startJuz": 30
  },
  {
    "n": 112,
    "name": "سُورَةُ الإِخۡلَاصِ",
    "en": "Al-Ikhlaas",
    "type": "Meccan",
    "ayahsCount": 4,
    "startPage": 604,
    "startJuz": 30
  },
  {
    "n": 113,
    "name": "سُورَةُ الفَلَقِ",
    "en": "Al-Falaq",
    "type": "Meccan",
    "ayahsCount": 5,
    "startPage": 604,
    "startJuz": 30
  },
  {
    "n": 114,
    "name": "سُورَةُ النَّاسِ",
    "en": "An-Naas",
    "type": "Meccan",
    "ayahsCount": 6,
    "startPage": 604,
    "startJuz": 30
  }
];

export function normalizeArabicQuran(text: string): string {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

export async function loadFullQuranOffline(): Promise<CompactSurah[]> {
  return loadOfflineJson<CompactSurah[]>('/data/quran.json');
}

export function searchQuranOffline(
  surahs: CompactSurah[],
  query: string,
  maxResults = 60,
): Array<{surah: CompactSurah; ayah: CompactAyah}> {
  const q = normalizeArabicQuran(query);
  if (q.length < 2) return [];
  const results: Array<{surah: CompactSurah; ayah: CompactAyah}> = [];
  for (const s of surahs) {
    for (const a of s.ayahs) {
      if (normalizeArabicQuran(a.t).includes(q)) {
        results.push({surah: s, ayah: a});
        if (results.length >= maxResults) return results;
      }
    }
  }
  return results;
}

export async function saveLastReadOffline(pos: {
  surahNumber: number;
  ayahNumber: number;
  page: number;
  updatedAt: number;
}): Promise<boolean> {
  return saveLastReadToIdb(pos);
}

export async function loadLastReadOffline() {
  return readLastReadFromIdb();
}

export async function saveKhatmaOffline(khatma: KhatmaPlan): Promise<boolean> {
  return saveKhatmaToIdb(khatma);
}

export async function loadKhatmaOffline(): Promise<KhatmaPlan | null> {
  return readKhatmaFromIdb();
}
