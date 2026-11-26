import {AdhanVoice, FamousSurahItem, ReciterId, ReciterInfo} from '../types';

export const RECITERS_30: ReciterInfo[] = [
  {
    id: 'minshawi',
    nameAr: 'محمد صديق المنشاوي',
    shortNameAr: 'المنشاوي',
    styleAr: 'مرتل خاشع',
    everyayahFolder: 'Minshawy_Murattal_128kbps',
    mp3quranBase: 'https://server10.mp3quran.net/minsh',
  },
  {
    id: 'abdulbasit',
    nameAr: 'عبد الباسط عبد الصمد',
    shortNameAr: 'عبد الباسط',
    styleAr: 'مرتل متقن',
    everyayahFolder: 'Abdul_Basit_Murattal_192kbps',
    mp3quranBase: 'https://server7.mp3quran.net/basit',
  },
  {
    id: 'alafasy',
    nameAr: 'مشاري راشد العفاسي',
    shortNameAr: 'العفاسي',
    styleAr: 'حفص عن عاصم',
    everyayahFolder: 'Alafasy_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/afs',
  },
  {
    id: 'sudais',
    nameAr: 'عبد الرحمن السديس',
    shortNameAr: 'السديس',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Abdurrahmaan_As-Sudais_192kbps',
    mp3quranBase: 'https://server11.mp3quran.net/sds',
  },
  {
    id: 'dosari',
    nameAr: 'ياسر الدوسري',
    shortNameAr: 'ياسر الدوسري',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Yasser_Ad-Dussary_128kbps',
    mp3quranBase: 'https://server11.mp3quran.net/yasser',
  },
  {
    id: 'muaiqly',
    nameAr: 'ماهر المعيقلي',
    shortNameAr: 'ماهر المعيقلي',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'MaherAlMuaiqly128kbps',
    mp3quranBase: 'https://server12.mp3quran.net/maher',
  },
  {
    id: 'husary',
    nameAr: 'محمود خليل الحصري',
    shortNameAr: 'الحصري',
    styleAr: 'مرتل تعليمي',
    everyayahFolder: 'Husary_128kbps',
    mp3quranBase: 'https://server13.mp3quran.net/husr',
  },
  {
    id: 'ghamdi',
    nameAr: 'سعد الغامدي',
    shortNameAr: 'سعد الغامدي',
    styleAr: 'مرتل هادئ',
    everyayahFolder: 'Ghamadi_40kbps',
    mp3quranBase: 'https://server7.mp3quran.net/s_gmd',
  },
  {
    id: 'ajamy',
    nameAr: 'أحمد بن علي العجمي',
    shortNameAr: 'أحمد العجمي',
    styleAr: 'مرتل ندي',
    everyayahFolder: 'ahmed_ibn_ali_al_ajamy_128kbps',
    mp3quranBase: 'https://server10.mp3quran.net/ajm',
  },
  {
    id: 'shuraim',
    nameAr: 'سعود الشريم',
    shortNameAr: 'سعود الشريم',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Saood_ash-Shuraym_128kbps',
    mp3quranBase: 'https://server7.mp3quran.net/shur',
  },
  {
    id: 'banna',
    nameAr: 'محمود علي البنا',
    shortNameAr: 'البنا',
    styleAr: 'مرتل مصري أصيل',
    everyayahFolder: 'mahmoud_ali_al_banna_32kbps',
    mp3quranBase: 'https://server8.mp3quran.net/bna',
  },
  {
    id: 'hudhaify',
    nameAr: 'علي بن عبد الرحمن الحذيفي',
    shortNameAr: 'الحذيفي',
    styleAr: 'إمام المسجد النبوي',
    everyayahFolder: 'Hudhaify_128kbps',
    mp3quranBase: 'https://server9.mp3quran.net/hthfi',
  },
  {
    id: 'tablawi',
    nameAr: 'محمد محمود الطبلاوي',
    shortNameAr: 'الطبلاوي',
    styleAr: 'تلاوة مصرية عريقة',
    everyayahFolder: 'Mohammad_al_Tablaway_128kbps',
    mp3quranBase: 'https://server12.mp3quran.net/tblawi',
  },
  {
    id: 'jibreel',
    nameAr: 'محمد جبريل',
    shortNameAr: 'محمد جبريل',
    styleAr: 'خاشع مؤثر',
    everyayahFolder: 'Muhammad_Jibreel_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/jbrl',
  },
  {
    id: 'ayyub',
    nameAr: 'محمد أيوب',
    shortNameAr: 'محمد أيوب',
    styleAr: 'إمام المسجد النبوي سابقًا',
    everyayahFolder: 'Muhammad_Ayyoub_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/ayyub',
  },
  {
    id: 'basfar',
    nameAr: 'عبد الله بن علي بصفر',
    shortNameAr: 'عبد الله بصفر',
    styleAr: 'مرتل رصين',
    everyayahFolder: 'Abdullah_Basfar_192kbps',
    mp3quranBase: 'https://server6.mp3quran.net/bsfr',
  },
  {
    id: 'juhany',
    nameAr: 'عبد الله عواد الجهني',
    shortNameAr: 'الجهني',
    styleAr: 'إمام الحرم المكي',
    everyayahFolder: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps',
    mp3quranBase: 'https://server13.mp3quran.net/jhn',
  },
  {
    id: 'shatri',
    nameAr: 'أبو بكر الشاطري',
    shortNameAr: 'الشاطري',
    styleAr: 'تلاوة حجازية خاشعة',
    everyayahFolder: 'Abu_Bakr_Ash-Shaatree_128kbps',
    mp3quranBase: 'https://server11.mp3quran.net/shatri',
  },
  {
    id: 'qatami',
    nameAr: 'ناصر القطامي',
    shortNameAr: 'ناصر القطامي',
    styleAr: 'صوت ندي مؤثر',
    everyayahFolder: 'Nasser_Alqatami_128kbps',
    mp3quranBase: 'https://server6.mp3quran.net/qtm',
  },
  {
    id: 'rifai',
    nameAr: 'هاني الرفاعي',
    shortNameAr: 'هاني الرفاعي',
    styleAr: 'بكاء وخشوع',
    everyayahFolder: 'Hani_Rifai_192kbps',
    mp3quranBase: 'https://server8.mp3quran.net/hani',
  },
  {
    id: 'akhdar',
    nameAr: 'إبراهيم الأخضر',
    shortNameAr: 'إبراهيم الأخضر',
    styleAr: 'شيخ قراء المسجد النبوي',
    everyayahFolder: 'Ibrahim_Akhdar_32kbps',
    mp3quranBase: 'https://server6.mp3quran.net/akdr',
  },
  {
    id: 'matroud',
    nameAr: 'عبد الله المطرود',
    shortNameAr: 'المطرود',
    styleAr: 'تلاوة خاشعة',
    everyayahFolder: 'Abdullah_Matroud_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/mtrod',
  },
  {
    id: 'abbad',
    nameAr: 'فارس عباد',
    shortNameAr: 'فارس عباد',
    styleAr: 'مرتل شجي',
    everyayahFolder: 'Fares_Abbad_64kbps',
    mp3quranBase: 'https://server8.mp3quran.net/frs_a',
  },
  {
    id: 'bukhatir',
    nameAr: 'صلاح بو خاطر',
    shortNameAr: 'صلاح بو خاطر',
    styleAr: 'أداء هادئ عذب',
    everyayahFolder: 'Salaah_AbdulRahman_Bukhatir_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/bu_khtr',
  },
  {
    id: 'budair',
    nameAr: 'صلاح البدير',
    shortNameAr: 'صلاح البدير',
    styleAr: 'إمام المسجد النبوي',
    everyayahFolder: 'Salah_Al_Budair_128kbps',
    mp3quranBase: 'https://server6.mp3quran.net/s_bud',
  },
  {
    id: 'qasim',
    nameAr: 'عبد المحسن القاسم',
    shortNameAr: 'القاسم',
    styleAr: 'إمام المسجد النبوي',
    everyayahFolder: 'Muhsin_Al_Qasim_192kbps',
    mp3quranBase: 'https://server8.mp3quran.net/qasm',
  },
  {
    id: 'thubayti',
    nameAr: 'عبد الباري الثبيتي',
    shortNameAr: 'الثبيتي',
    styleAr: 'إمام المسجد النبوي سابقًا',
    everyayahFolder: 'AbdulBari_Al-Thubaity_128kbps',
    mp3quranBase: 'https://server6.mp3quran.net/thubti',
  },
  {
    id: 'alijaber',
    nameAr: 'علي جابر',
    shortNameAr: 'علي جابر',
    styleAr: 'إمام الحرم المكي سابقًا',
    everyayahFolder: 'Ali_Jaber_64kbps',
    mp3quranBase: 'https://server11.mp3quran.net/a_jbr',
  },
  {
    id: 'qahtani',
    nameAr: 'خالد القحطاني',
    shortNameAr: 'خالد القحطاني',
    styleAr: 'تلاوة مؤثرة',
    everyayahFolder: 'Khaalid_Al-Qahtaanee_192kbps',
    mp3quranBase: 'https://server10.mp3quran.net/qht',
  },
  {
    id: 'suwaid',
    nameAr: 'أيمن رشدي سويد',
    shortNameAr: 'أيمن سويد',
    styleAr: 'مصحف معلم متقن',
    everyayahFolder: 'Ayman_Sowaid_64kbps',
    mp3quranBase: 'https://server8.mp3quran.net/ayman',
  },
];

export const RECITERS_10: ReciterInfo[] = RECITERS_30.slice(0, 10);

export function getReciterById(id: ReciterId): ReciterInfo {
  return RECITERS_30.find((r) => r.id === id) || RECITERS_30[2];
}

function pad3(num: number): string {
  return String(num).padStart(3, '0');
}

export function getAyahAudioUrl(
  reciterId: ReciterId,
  surahNumber: number,
  ayahInSurah: number,
): string {
  const reciter = getReciterById(reciterId);
  return `https://everyayah.com/data/${reciter.everyayahFolder}/${pad3(surahNumber)}${pad3(ayahInSurah)}.mp3`;
}

export function getSurahAudioUrl(reciterId: ReciterId, surahNumber: number): string {
  const reciter = getReciterById(reciterId);
  return `${reciter.mp3quranBase}/${pad3(surahNumber)}.mp3`;
}

export const ADHAN_VOICES_30: AdhanVoice[] = [
  {
    id: 'adhan-makkah',
    nameAr: 'أذان المسجد الحرام (بدون نت)',
    muezzinAr: 'الشيخ علي أحمد ملا',
    locationAr: 'مكة المكرمة',
    url: '/audio/adhan-makkah.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-madinah',
    nameAr: 'أذان المسجد النبوي (بدون نت)',
    muezzinAr: 'أذان المدينة المنورة',
    locationAr: 'المدينة المنورة',
    url: '/audio/adhan-madinah.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-alafasy',
    nameAr: 'أذان مشاري العفاسي (بدون نت)',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت',
    url: '/audio/adhan-alafasy.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-aqsa',
    nameAr: 'أذان المسجد الأقصى',
    muezzinAr: 'مؤذن المسجد الأقصى المبارك',
    locationAr: 'القدس الشريف',
    url: 'https://www.islamcan.com/audio/adhan/azan3.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-egypt',
    nameAr: 'الأذان المصري الكلاسيكي',
    muezzinAr: 'الأذان المقامي العريق',
    locationAr: 'القاهرة',
    url: 'https://www.islamcan.com/audio/adhan/azan5.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-fajr',
    nameAr: 'أذان الفجر الخاشع',
    muezzinAr: 'الصلاة خير من النوم',
    locationAr: 'الحرمين الشريفين',
    url: 'https://www.islamcan.com/audio/adhan/azan6.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-istanbul',
    nameAr: 'أذان إسطنبول العثماني',
    muezzinAr: 'مؤذن جامع السلطان أحمد',
    locationAr: 'إسطنبول',
    url: 'https://www.islamcan.com/audio/adhan/azan7.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-sham',
    nameAr: 'أذان بلاد الشام',
    muezzinAr: 'مؤذن المسجد الأموي',
    locationAr: 'دمشق',
    url: 'https://www.islamcan.com/audio/adhan/azan8.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-haramain',
    nameAr: 'أذان الحرمين الندي',
    muezzinAr: 'الأذان الحجازي الروحاني',
    locationAr: 'الحرم المكي',
    url: 'https://www.islamcan.com/audio/adhan/azan9.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-abdulbasit',
    nameAr: 'أذان الشيخ عبد الباسط عبد الصمد',
    muezzinAr: 'الشيخ عبد الباسط عبد الصمد',
    locationAr: 'مصر',
    url: 'https://www.islamcan.com/audio/adhan/azan1.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-refaat',
    nameAr: 'أذان الشيخ محمد رفعت',
    muezzinAr: 'الشيخ محمد رفعت',
    locationAr: 'القاهرة',
    url: 'https://www.islamcan.com/audio/adhan/azan2.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-naqshabandi',
    nameAr: 'أذان الشيخ سيد النقشبندي',
    muezzinAr: 'الشيخ سيد النقشبندي',
    locationAr: 'مصر',
    url: 'https://www.islamcan.com/audio/adhan/azan4.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-minshawi',
    nameAr: 'أذان الشيخ محمد صديق المنشاوي',
    muezzinAr: 'الشيخ محمد صديق المنشاوي',
    locationAr: 'مصر',
    url: 'https://www.islamcan.com/audio/adhan/azan10.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-husary',
    nameAr: 'أذان الشيخ محمود خليل الحصري',
    muezzinAr: 'الشيخ محمود خليل الحصري',
    locationAr: 'مصر',
    url: 'https://www.islamcan.com/audio/adhan/azan11.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-qatami',
    nameAr: 'أذان الشيخ ناصر القطامي',
    muezzinAr: 'الشيخ ناصر القطامي',
    locationAr: 'الرياض',
    url: 'https://www.islamcan.com/audio/adhan/azan12.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-dosari',
    nameAr: 'أذان الشيخ ياسر الدوسري',
    muezzinAr: 'الشيخ ياسر الدوسري',
    locationAr: 'مكة المكرمة',
    url: 'https://www.islamcan.com/audio/adhan/azan13.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-bukhari',
    nameAr: 'أذان الشيخ عصام بخاري',
    muezzinAr: 'الشيخ عصام بن حسين بخاري',
    locationAr: 'المدينة المنورة',
    url: 'https://www.islamcan.com/audio/adhan/azan14.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-farooq',
    nameAr: 'أذان الشيخ فاروق حضراوي',
    muezzinAr: 'الشيخ فاروق بن عبد الرحمن حضراوي',
    locationAr: 'المسجد الحرام',
    url: 'https://www.islamcan.com/audio/adhan/azan15.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-reis',
    nameAr: 'أذان الشيخ نايف فيده',
    muezzinAr: 'الشيخ نايف بن صالح فيده',
    locationAr: 'المسجد الحرام',
    url: 'https://www.islamcan.com/audio/adhan/azan16.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-shaker',
    nameAr: 'أذان الشيخ ماجد العباس',
    muezzinAr: 'الشيخ ماجد بن إبراهيم العباس',
    locationAr: 'المسجد الحرام',
    url: 'https://www.islamcan.com/audio/adhan/azan17.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-khoja',
    nameAr: 'أذان الشيخ أحمد خوجة',
    muezzinAr: 'الشيخ أحمد بن يونس خوجة',
    locationAr: 'المسجد الحرام',
    url: 'https://www.islamcan.com/audio/adhan/azan18.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-afifi',
    nameAr: 'أذان الشيخ محمد حكيم',
    muezzinAr: 'الشيخ محمد بن ماجد حكيم',
    locationAr: 'المسجد النبوي',
    url: 'https://www.islamcan.com/audio/adhan/azan19.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-imran',
    nameAr: 'أذان الشيخ عبد المجيد السريحي',
    muezzinAr: 'الشيخ عبد المجيد السريحي',
    locationAr: 'المسجد النبوي',
    url: 'https://www.islamcan.com/audio/adhan/azan20.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-quba',
    nameAr: 'أذان مسجد قباء المبارك',
    muezzinAr: 'مؤذن مسجد قباء',
    locationAr: 'المدينة المنورة',
    url: 'https://www.islamcan.com/audio/adhan/azan21.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-azhar',
    nameAr: 'أذان الجامع الأزهر الشريف',
    muezzinAr: 'مؤذن الجامع الأزهر',
    locationAr: 'القاهرة',
    url: 'https://www.islamcan.com/audio/adhan/azan22.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-amr',
    nameAr: 'أذان مسجد عمرو بن العاص',
    muezzinAr: 'مؤذن مسجد عمرو بن العاص',
    locationAr: 'القاهرة',
    url: 'https://www.islamcan.com/audio/adhan/azan23.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-zayed',
    nameAr: 'أذان جامع الشيخ زايد الكبير',
    muezzinAr: 'مؤذن جامع الشيخ زايد',
    locationAr: 'أبوظبي',
    url: 'https://www.islamcan.com/audio/adhan/azan24.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-maghreb',
    nameAr: 'أذان المغرب المغربي الأصيل',
    muezzinAr: 'مؤذن مسجد الحسن الثاني',
    locationAr: 'الدار البيضاء',
    url: 'https://www.islamcan.com/audio/adhan/azan25.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-ghamdi',
    nameAr: 'أذان الشيخ سعد الغامدي',
    muezzinAr: 'الشيخ سعد الغامدي',
    locationAr: 'الدمام',
    url: 'https://www.islamcan.com/audio/adhan/azan26.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-ramadan-fajr',
    nameAr: 'أذان الفجر الرمضاني الهادئ',
    muezzinAr: 'أذان الفجر الخاشع',
    locationAr: 'الحرم المكي',
    url: '/audio/adhan-madinah.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
];

export const ADHAN_VOICES_9: AdhanVoice[] = ADHAN_VOICES_30.slice(0, 9);
export const ADHAN_VOICES_3: AdhanVoice[] = ADHAN_VOICES_30.slice(0, 3);

export const MUEZZIN_POPUP_VOICES_5: AdhanVoice[] = [
  {
    id: 'muezzin-makkah',
    nameAr: 'الحرم المكي',
    muezzinAr: 'أذان الحرم المكي الشريف',
    locationAr: 'مكة المكرمة',
    url: '/adhan-sounds/makkah.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'muezzin-naina',
    nameAr: 'أحمد نعينع',
    muezzinAr: 'الشيخ أحمد نعينع',
    locationAr: 'مصر',
    url: '/adhan-sounds/ahmed-naina.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'muezzin-jalil',
    nameAr: 'خالد الجليل',
    muezzinAr: 'الشيخ خالد الجليل',
    locationAr: 'الرياض',
    url: '/adhan-sounds/khalid-aljalil.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'muezzin-alafasy',
    nameAr: 'مشاري راشد',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت',
    url: '/adhan-sounds/mishary-alafasy.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'muezzin-egyptian',
    nameAr: 'الأذان المصري',
    muezzinAr: 'الأذان المصري الأصيل',
    locationAr: 'القاهرة',
    url: '/adhan-sounds/egyptian.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
];

export function resolveAdhanVoiceById(id?: string | null): AdhanVoice {
  if (!id || id === 'unselected') {
    return MUEZZIN_POPUP_VOICES_5[0];
  }
  return (
    MUEZZIN_POPUP_VOICES_5.find((v) => v.id === id) ||
    ADHAN_VOICES_30.find((v) => v.id === id) ||
    MUEZZIN_POPUP_VOICES_5[0]
  );
}

export const IQAMAH_VOICES_10: AdhanVoice[] = [
  {
    id: 'iqamah-makkah',
    nameAr: 'إقامة المسجد الحرام — الشيخ علي أحمد ملا',
    muezzinAr: 'الشيخ علي أحمد ملا',
    locationAr: 'مكة المكرمة',
    url: '/audio/iqamah-makkah.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-madinah',
    nameAr: 'إقامة المسجد النبوي — الشيخ عصام بخاري',
    muezzinAr: 'الشيخ عصام بن حسين بخاري',
    locationAr: 'المدينة المنورة',
    url: '/audio/iqamah-madinah.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-haram',
    nameAr: 'الإقامة الخاشعة — الشيخ فاروق حضراوي',
    muezzinAr: 'الشيخ فاروق حضراوي',
    locationAr: 'المسجد الحرام',
    url: '/audio/iqamah-haram.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-alafasy',
    nameAr: 'نداء وإقامة الشيخ مشاري راشد العفاسي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت',
    url: '/adhan-sounds/mishary-alafasy.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-jalil',
    nameAr: 'نداء وإقامة الشيخ خالد الجليل',
    muezzinAr: 'الشيخ خالد الجليل',
    locationAr: 'الرياض',
    url: '/adhan-sounds/khalid-aljalil.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-naina',
    nameAr: 'نداء وإقامة الشيخ أحمد نعينع',
    muezzinAr: 'الشيخ أحمد نعينع',
    locationAr: 'مصر',
    url: '/adhan-sounds/ahmed-naina.mp3',
    fallbackUrl: '/audio/iqamah-madinah.mp3',
  },
  {
    id: 'iqamah-makkah-fayd',
    nameAr: 'إقامة الحرم المكي — الشيخ نايف فيده',
    muezzinAr: 'الشيخ نايف بن صالح فيده',
    locationAr: 'مكة المكرمة',
    url: '/adhan-sounds/makkah.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-egypt',
    nameAr: 'الإقامة المصرية الأصيلة — الجامع الأزهر',
    muezzinAr: 'مؤذن الجامع الأزهر',
    locationAr: 'القاهرة',
    url: '/adhan-sounds/egyptian.mp3',
    fallbackUrl: '/audio/iqamah-madinah.mp3',
  },
  {
    id: 'iqamah-quba',
    nameAr: 'إقامة مسجد قباء — الشيخ عبد المجيد السريحي',
    muezzinAr: 'الشيخ عبد المجيد السريحي',
    locationAr: 'المدينة المنورة',
    url: '/audio/adhan-madinah.mp3',
    fallbackUrl: '/audio/iqamah-madinah.mp3',
  },
  {
    id: 'iqamah-jaber',
    nameAr: 'إقامة الحرم المكي الهادئة — الشيخ ماجد العباس',
    muezzinAr: 'الشيخ ماجد بن إبراهيم العباس',
    locationAr: 'المسجد الحرام',
    url: '/audio/azan.mp3',
    fallbackUrl: '/audio/iqamah-haram.mp3',
  },
];

export const IQAMAH_VOICES_3: AdhanVoice[] = IQAMAH_VOICES_10;

export function resolveIqamahVoiceById(id?: string | null): AdhanVoice {
  if (!id) return IQAMAH_VOICES_10[0];
  return (
    IQAMAH_VOICES_10.find((v) => v.id === id) || IQAMAH_VOICES_10[0]
  );
}

export const PRE_ADHAN_VOICES_10: Array<{
  id: string;
  nameAr: string;
  muezzinAr: string;
  locationAr: string;
  descAr: string;
  url: string;
  fallbackUrl: string;
}> = [
  {
    id: 'pre-takbeer',
    nameAr: 'تكبير الحرم المكي — الشيخ علي أحمد ملا',
    muezzinAr: 'الشيخ علي أحمد ملا',
    locationAr: 'مكة المكرمة',
    descAr: 'صوت «الله أكبر» بصوت مؤذن المسجد الحرام للتنبيه قبل الصلاة',
    url: '/audio/pre-takbeer.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-istighfar',
    nameAr: 'ذكر واستغفار قبل الصلاة — حصن المسلم',
    muezzinAr: 'الذكر المأثور',
    locationAr: 'حصن المسلم',
    descAr: 'تنبيه صوتي بالذكر والاستغفار استعدادًا للصلاة',
    url: '/audio/pre-istighfar.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-alafasy',
    nameAr: 'الشيخ مشاري راشد العفاسي — صلاة على النبي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت',
    descAr: 'تنبيه خاشع بصوت الشيخ مشاري العفاسي قبل دخول الوقت',
    url: '/audio/salawat-1.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-ghamdi',
    nameAr: 'الشيخ سعد الغامدي — الصلاة الإبراهيمية',
    muezzinAr: 'الشيخ سعد الغامدي',
    locationAr: 'الدمام',
    descAr: 'تنبيه ندي هادئ بصوت الشيخ سعد الغامدي',
    url: '/audio/salawat-2.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-muaiqly',
    nameAr: 'الشيخ ماهر المعيقلي — خشوع الحرم',
    muezzinAr: 'الشيخ ماهر المعيقلي',
    locationAr: 'المسجد الحرام',
    descAr: 'تنبيه روحاني بصوت إمام المسجد الحرام الشيخ ماهر المعيقلي',
    url: '/audio/salawat-3.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-dukhin',
    nameAr: 'الشيخ هيثم الدخين — نبرة هادئة',
    muezzinAr: 'الشيخ هيثم الدخين',
    locationAr: 'السعودية',
    descAr: 'تنبيه هادئ وعذب لتذكيرك بالاستعداد للصلاة والوضوء',
    url: '/audio/salawat-4.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-naqshabandi-1',
    nameAr: 'الشيخ سيد النقشبندي — مولاي إني ببابك',
    muezzinAr: 'الشيخ سيد النقشبندي',
    locationAr: 'القاهرة',
    descAr: 'ابتهال خاشع للشيخ سيد النقشبندي قبل الأذان',
    url: '/audio/tawasih-naqshabandi-1.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-naqshabandi-2',
    nameAr: 'الشيخ سيد النقشبندي — أغيب وذو اللطائف',
    muezzinAr: 'الشيخ سيد النقشبندي',
    locationAr: 'القاهرة',
    descAr: 'مناجاة روحانية مؤثرة للشيخ سيد النقشبندي قبل الصلاة',
    url: '/audio/tawasih-naqshabandi-2.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-naina',
    nameAr: 'الشيخ أحمد نعينع — نداء الصلاة',
    muezzinAr: 'الشيخ أحمد نعينع',
    locationAr: 'مصر',
    descAr: 'نداء مصري وقور بصوت القارئ والمبتهل الشيخ أحمد نعينع',
    url: '/adhan-sounds/ahmed-naina.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
  {
    id: 'pre-jalil',
    nameAr: 'الشيخ خالد الجليل — تنبيه الاقتراب',
    muezzinAr: 'الشيخ خالد الجليل',
    locationAr: 'الرياض',
    descAr: 'صوت الشيخ خالد الجليل لتنبيهك باقتراب موعد الصلاة',
    url: '/adhan-sounds/khalid-aljalil.mp3',
    fallbackUrl: '/audio/pre-takbeer.mp3',
  },
];

export const PRE_ADHAN_VOICES_3 = PRE_ADHAN_VOICES_10;

export function resolvePreAdhanVoiceById(id?: string | null) {
  if (id === 'pre-chime') {
    return {
      id: 'pre-chime',
      nameAr: 'نغمة المسجد الهادئة',
      muezzinAr: 'تنبيه هادئ',
      locationAr: 'المسجد',
      descAr: 'جرس ذهبي هادئ ولطيف للتنبيه قبل الأذان',
      url: '/audio/pre-chime.mp3',
      fallbackUrl: '/audio/pre-takbeer.mp3',
    };
  }
  return (
    PRE_ADHAN_VOICES_10.find((p) => p.id === id) || PRE_ADHAN_VOICES_10[0]
  );
}

// تواشيح وابتهالات الشيخ سيد النقشبندي الأصلية فقط (تعمل بدون نت)
export const TAWASIH_NAQSHABANDI: Array<{
  id: string;
  titleAr: string;
  reciterAr: string;
  url: string;
}> = [
  {
    id: 'tawasih-naqshabandi-1',
    titleAr: 'ابتهال مولاي إني ببابك قد بسطت يدي',
    reciterAr: 'الشيخ سيد النقشبندي',
    url: '/audio/tawasih-naqshabandi-1.mp3',
  },
  {
    id: 'tawasih-naqshabandi-2',
    titleAr: 'ابتهال أغيب وذو اللطائف لا يغيب',
    reciterAr: 'الشيخ سيد النقشبندي',
    url: '/audio/tawasih-naqshabandi-2.mp3',
  },
  {
    id: 'tawasih-naqshabandi-3',
    titleAr: 'ابتهال يا رب إن عظمت ذنوبي كثرة',
    reciterAr: 'الشيخ سيد النقشبندي',
    url: '/audio/tawasih-naqshabandi-3.mp3',
  },
];

export const TAWASIH_VOICES_3 = TAWASIH_NAQSHABANDI;

export const EID_TAKBEERAT_VOICES_3: Array<{
  id: string;
  titleAr: string;
  reciterAr: string;
  url: string;
}> = [
  {
    id: 'eid-makkah-1',
    titleAr: 'تكبيرات المسجد الحرام',
    reciterAr: 'الشيخ علي أحمد ملا',
    url: '/audio/eid-makkah-1.mp3',
  },
  {
    id: 'eid-makkah-2',
    titleAr: 'تكبيرات الحرم المكي المباركة',
    reciterAr: 'مؤذنو المسجد الحرام',
    url: '/audio/eid-makkah-2.mp3',
  },
  {
    id: 'eid-jamaa',
    titleAr: 'تكبيرات العيد الجماعية',
    reciterAr: 'تكبيرات عيد الفطر والأضحى',
    url: '/audio/eid-jamaa.mp3',
  },
];

export const FRIDAY_KAHF_VOICES_3: Array<{
  id: string;
  titleAr: string;
  reciterAr: string;
  url: string;
}> = [
  {
    id: 'kahf-alafasy',
    titleAr: 'سورة الكهف ليوم الجمعة',
    reciterAr: 'الشيخ مشاري راشد العفاسي',
    url: '/audio/kahf-alafasy.mp3',
  },
  {
    id: 'kahf-abdulbasit',
    titleAr: 'سورة الكهف — تلاوة مجودة',
    reciterAr: 'الشيخ عبد الباسط عبد الصمد',
    url: '/audio/kahf-abdulbasit.mp3',
  },
  {
    id: 'kahf-muaiqly',
    titleAr: 'سورة الكهف — تلاوة الحرم',
    reciterAr: 'الشيخ ماهر المعيقلي',
    url: '/audio/kahf-muaiqly.mp3',
  },
];

export const POST_ADHAN_DUA = {
  titleAr: 'الدعاء المأثور بعد الأذان',
  textAr:
    'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ، إِنَّكَ لَا تُخْلِفُ الْمِيعَادَ.',
  sourceAr: 'صحيح البخاري — ويُسَنُّ قبلها الصلاة على النبي ﷺ ثم الدعاء، فإن الدعاء بين الأذان والإقامة لا يُرد.',
  audioUrl: '/audio/post-adhan-dua.mp3',
};

export const POST_ADHAN_DUA_VOICES_10: AdhanVoice[] = [
  {
    id: 'dua-makkah',
    nameAr: 'دعاء ما بعد الأذان — الشيخ علي ملا (الحرم المكي)',
    muezzinAr: 'الشيخ علي أحمد ملا',
    locationAr: 'مكة المكرمة',
    descAr: 'اللهم رب هذه الدعوة التامة والصلاة القائمة',
    url: '/audio/post-adhan-dua.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-alafasy',
    nameAr: 'دعاء وصلاة بعد الأذان — الشيخ مشاري العفاسي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت',
    descAr: 'الصلاة على النبي ﷺ والدعاء بعد الأذان بصوت العفاسي',
    url: '/audio/salawat-1.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-ghamdi',
    nameAr: 'دعاء الإبراهيمية بعد الأذان — الشيخ سعد الغامدي',
    muezzinAr: 'الشيخ سعد الغامدي',
    locationAr: 'الدمام',
    descAr: 'الصلاة الإبراهيمية والدعاء المأثور بصوت الشيخ سعد الغامدي',
    url: '/audio/salawat-2.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-muaiqly',
    nameAr: 'دعاء الحرم بعد الأذان — الشيخ ماهر المعيقلي',
    muezzinAr: 'الشيخ ماهر المعيقلي',
    locationAr: 'المسجد الحرام',
    descAr: 'دعاء وصلوات خاشعة بصوت إمام المسجد الحرام',
    url: '/audio/salawat-3.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-dukhin',
    nameAr: 'دعاء هادئ بعد الأذان — الشيخ هيثم الدخين',
    muezzinAr: 'الشيخ هيثم الدخين',
    locationAr: 'السعودية',
    descAr: 'صوت ندي خاشع للصلاة على النبي والدعاء',
    url: '/audio/salawat-4.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-naqshabandi-1',
    nameAr: 'دعاء مولاي إني ببابك — الشيخ سيد النقشبندي',
    muezzinAr: 'الشيخ سيد النقشبندي',
    locationAr: 'القاهرة',
    descAr: 'ابتهال ودعاء خاشع بعد الأذان بصوت النقشبندي',
    url: '/audio/tawasih-naqshabandi-1.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-naqshabandi-2',
    nameAr: 'دعاء أغيب وذو اللطائف — الشيخ سيد النقشبندي',
    muezzinAr: 'الشيخ سيد النقشبندي',
    locationAr: 'القاهرة',
    descAr: 'مناجاة ودعاء بعد الأذان للشيخ سيد النقشبندي',
    url: '/audio/tawasih-naqshabandi-2.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-naqshabandi-3',
    nameAr: 'دعاء يا رب إن عظمت ذنوبي — الشيخ سيد النقشبندي',
    muezzinAr: 'الشيخ سيد النقشبندي',
    locationAr: 'القاهرة',
    descAr: 'دعاء التوسل والمغفرة بعد الأذان بصوت النقشبندي',
    url: '/audio/tawasih-naqshabandi-3.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-istighfar',
    nameAr: 'أذكار واستغفار بعد الأذان — حصن المسلم',
    muezzinAr: 'حصن المسلم',
    locationAr: 'الأذكار المأثورة',
    descAr: 'أذكار وأدعية بعد الأذان بين الأذان والإقامة',
    url: '/audio/pre-istighfar.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
  {
    id: 'dua-hisn',
    nameAr: 'الدعاء النبوي المأثور — الشيخ عبد الباسط / حصن المسلم',
    muezzinAr: 'الشيخ عبد الباسط / حصن المسلم',
    locationAr: 'مصر',
    descAr: 'اللهم رب هذه الدعوة التامة مع الآيات والذكر',
    url: 'https://www.hisnmuslim.com/audio/ar/24.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
];

export function resolvePostAdhanDuaVoiceById(id?: string | null): AdhanVoice {
  if (!id) return POST_ADHAN_DUA_VOICES_10[0];
  return (
    POST_ADHAN_DUA_VOICES_10.find((v) => v.id === id) ||
    POST_ADHAN_DUA_VOICES_10[0]
  );
}

export const EID_TAKBEERAT_AUDIO = EID_TAKBEERAT_VOICES_3[0];
export const FAJR_TAWASIH_AUDIO = TAWASIH_NAQSHABANDI[0];

export const POST_PRAYER_AZKAR_AUDIO_URLS = [
  'https://www.hisnmuslim.com/audio/ar/66.mp3',
  'https://www.hisnmuslim.com/audio/ar/67.mp3',
  'https://www.hisnmuslim.com/audio/ar/68.mp3',
  'https://www.hisnmuslim.com/audio/ar/69.mp3',
  'https://www.hisnmuslim.com/audio/ar/71.mp3',
];

export const IQAMAH_AUDIO: AdhanVoice = IQAMAH_VOICES_10[0];

export interface SalawatAudioTrack {
  id: string;
  formulaId: 'short' | 'ibrahimiyyah' | 'kafiyah' | 'friday';
  titleAr: string;
  textAr: string;
  reciterAr: string;
  virtueAr: string;
  url: string;
}

export const SALAWAT_AUDIO_TRACKS: SalawatAudioTrack[] = [
  {
    id: 'salawat-afasy',
    formulaId: 'short',
    titleAr: 'الصلاة المختصرة المباركة',
    textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    reciterAr: 'بصوت الشيخ مشاري راشد العفاسي',
    virtueAr: 'من صلى عليَّ صلاة واحدة صلى الله عليه بها عشرًا (صحيح مسلم)',
    url: '/audio/salawat-1.mp3',
  },
  {
    id: 'salawat-ghamdi',
    formulaId: 'ibrahimiyyah',
    titleAr: 'الصلاة الإبراهيمية الكاملة',
    textAr:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    reciterAr: 'بصوت الشيخ سعد الغامدي',
    virtueAr: 'أفضل صيغة علّمها النبي ﷺ لأصحابه رضي الله عنهم (متفق عليه)',
    url: '/audio/salawat-2.mp3',
  },
  {
    id: 'salawat-muaiqly',
    formulaId: 'kafiyah',
    titleAr: 'الصلاة على النبي ﷺ بخشوع الحرم',
    textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ',
    reciterAr: 'بصوت الشيخ ماهر المعيقلي',
    virtueAr: 'قيل لأبي بن كعب: إذن تُكفى همَّك ويُغفر لك ذنبُك (الترمذي)',
    url: '/audio/salawat-3.mp3',
  },
  {
    id: 'salawat-dukhin',
    formulaId: 'friday',
    titleAr: 'صلِّ على النبي ﷺ بنبرة هادئة خاشعة',
    textAr: 'صَلَّى اللَّهُ عَلَى مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ',
    reciterAr: 'بصوت الشيخ هيثم الدخين',
    virtueAr: 'فأكثروا عليَّ من الصلاة فيه، فإن صلاتكم معروضة عليَّ (أبو داود)',
    url: '/audio/salawat-4.mp3',
  },
];

export function resolveSalawatTrackById(id?: string | null): SalawatAudioTrack {
  if (!id) return SALAWAT_AUDIO_TRACKS[0];
  return (
    SALAWAT_AUDIO_TRACKS.find((t) => t.id === id) || SALAWAT_AUDIO_TRACKS[0]
  );
}

export const ADHAN_TONE_DESCRIPTIONS: Record<string, {maqamAr: string; paceFactor: number}> = {
  'adhan-makkah': {maqamAr: 'النغمة: المقام المكي الجَهوري (الحجاز)', paceFactor: 1.0},
  'adhan-madinah': {maqamAr: 'النغمة: المقام المدني الرصين (البيات)', paceFactor: 0.98},
  'adhan-alafasy': {maqamAr: 'النغمة: نبرة العفاسي الندية (الراست)', paceFactor: 1.0},
  'adhan-aqsa': {maqamAr: 'النغمة: مقام الأقصى الخاشع', paceFactor: 1.02},
  'adhan-egypt': {maqamAr: 'النغمة: المقام المصري التراثي (الصبا)', paceFactor: 0.95},
  'adhan-fajr': {maqamAr: 'النغمة: مقام الفجر الروحاني (الصبا والسيكاه)', paceFactor: 0.94},
  'adhan-istanbul': {maqamAr: 'النغمة: المقام العثماني الهادئ', paceFactor: 0.97},
  'adhan-sham': {maqamAr: 'النغمة: المقام الشامي العريق', paceFactor: 1.0},
  'adhan-haramain': {maqamAr: 'النغمة: أداء الحرمين الندي', paceFactor: 1.0},
  'iqamah-makkah': {maqamAr: 'نغمة الإقامة المكية المتقنة (بدون نت)', paceFactor: 1.0},
  'iqamah-madinah': {maqamAr: 'نغمة الإقامة المدنية الهادئة (بدون نت)', paceFactor: 1.0},
  'iqamah-haram': {maqamAr: 'نغمة الإقامة الخاشعة (بدون نت)', paceFactor: 1.0},
  'muezzin-makkah': {maqamAr: 'النغمة: أذان الحرم المكي الشريف (بدون نت)', paceFactor: 1.0},
  'muezzin-naina': {maqamAr: 'النغمة: الشيخ أحمد نعينع (بدون نت)', paceFactor: 0.98},
  'muezzin-jalil': {maqamAr: 'النغمة: الشيخ خالد الجليل (بدون نت)', paceFactor: 1.0},
  'muezzin-alafasy': {maqamAr: 'النغمة: الشيخ مشاري راشد العفاسي (بدون نت)', paceFactor: 1.0},
  'muezzin-egyptian': {maqamAr: 'النغمة: الأذان المصري الأصيل (بدون نت)', paceFactor: 0.96},
};

export const FAMOUS_SURAHS_30: FamousSurahItem[] = [
  {number: 1, nameAr: 'سورة الفاتحة', ayahsCount: 7, revelationAr: 'مكية', highlight: true},
  {number: 18, nameAr: 'سورة الكهف', ayahsCount: 110, revelationAr: 'مكية', highlight: true},
  {number: 36, nameAr: 'سورة يس', ayahsCount: 83, revelationAr: 'مكية', highlight: true},
  {number: 67, nameAr: 'سورة الملك', ayahsCount: 30, revelationAr: 'مكية', highlight: true},
  {number: 56, nameAr: 'سورة الواقعة', ayahsCount: 96, revelationAr: 'مكية', highlight: true},
  {number: 55, nameAr: 'سورة الرحمن', ayahsCount: 78, revelationAr: 'مدنية', highlight: true},
  {number: 2, nameAr: 'سورة البقرة', ayahsCount: 286, revelationAr: 'مدنية'},
  {number: 3, nameAr: 'سورة آل عمران', ayahsCount: 200, revelationAr: 'مدنية'},
  {number: 12, nameAr: 'سورة يوسف', ayahsCount: 111, revelationAr: 'مكية'},
  {number: 19, nameAr: 'سورة مريم', ayahsCount: 98, revelationAr: 'مكية'},
  {number: 20, nameAr: 'سورة طه', ayahsCount: 135, revelationAr: 'مكية'},
  {number: 24, nameAr: 'سورة النور', ayahsCount: 64, revelationAr: 'مدنية'},
  {number: 25, nameAr: 'سورة الفرقان', ayahsCount: 77, revelationAr: 'مكية'},
  {number: 31, nameAr: 'سورة لقمان', ayahsCount: 34, revelationAr: 'مكية'},
  {number: 32, nameAr: 'سورة السجدة', ayahsCount: 30, revelationAr: 'مكية'},
  {number: 37, nameAr: 'سورة الصافات', ayahsCount: 182, revelationAr: 'مكية'},
  {number: 48, nameAr: 'سورة الفتح', ayahsCount: 29, revelationAr: 'مدنية'},
  {number: 50, nameAr: 'سورة ق', ayahsCount: 45, revelationAr: 'مكية'},
  {number: 59, nameAr: 'سورة الحشر', ayahsCount: 24, revelationAr: 'مدنية'},
  {number: 73, nameAr: 'سورة المزمل', ayahsCount: 20, revelationAr: 'مكية'},
  {number: 76, nameAr: 'سورة الإنسان', ayahsCount: 31, revelationAr: 'مدنية'},
  {number: 78, nameAr: 'سورة النبأ', ayahsCount: 40, revelationAr: 'مكية'},
  {number: 87, nameAr: 'سورة الأعلى', ayahsCount: 19, revelationAr: 'مكية'},
  {number: 88, nameAr: 'سورة الغاشية', ayahsCount: 26, revelationAr: 'مكية'},
  {number: 93, nameAr: 'سورة الضحى', ayahsCount: 11, revelationAr: 'مكية'},
  {number: 94, nameAr: 'سورة الشرح', ayahsCount: 8, revelationAr: 'مكية'},
  {number: 97, nameAr: 'سورة القدر', ayahsCount: 5, revelationAr: 'مكية'},
  {number: 99, nameAr: 'سورة الزلزلة', ayahsCount: 8, revelationAr: 'مدنية'},
  {number: 112, nameAr: 'سورة الإخلاص', ayahsCount: 4, revelationAr: 'مكية'},
  {number: 113, nameAr: 'سورة الفلق', ayahsCount: 5, revelationAr: 'مكية'},
];
