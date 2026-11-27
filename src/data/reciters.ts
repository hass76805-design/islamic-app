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

// 30 verified working high-quality Adhan voices (every URL tested HTTP 200/206 audio/mpeg or bundled offline)
export const ADHAN_VOICES_30: AdhanVoice[] = [
  {
    id: 'adhan-alafasy',
    nameAr: 'أذان الشيخ مشاري العفاسي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت (يعمل بدون نت)',
    url: '/audio/adhan-alafasy.mp3',
    fallbackUrl: '/adhan-sounds/mishary-alafasy.mp3',
  },
  {
    id: 'adhan-abdulbasit',
    nameAr: 'أذان الشيخ عبد الباسط عبد الصمد',
    muezzinAr: 'الشيخ عبد الباسط عبد الصمد',
    locationAr: 'مصر',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Abdulbasit_Abdusamad_1_-_Egypt_(%D8%B9%D8%A8%D8%AF_%D8%A7%D9%84%D8%A8%D8%A7%D8%B3%D8%B7_%D8%B9%D8%A8%D8%AF_%D8%A7%D9%84%D8%B5%D9%85%D8%AF_-_%D9%85%D8%B5%D8%B1).mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-minshawi',
    nameAr: 'أذان الشيخ محمد صديق المنشاوي',
    muezzinAr: 'الشيخ محمد صديق المنشاوي',
    locationAr: 'مصر',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Mohamed_Siddiq_El-Minshawi_-_Egypt_1_(%D9%85%D8%AD%D9%85%D8%AF_%D8%B5%D8%AF%D9%8A%D9%82_%D8%A7%D9%84%D9%85%D9%86%D8%B4%D8%A7%D9%88%D9%8A_-_%D9%85%D8%B5%D8%B1).mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-husary',
    nameAr: 'أذان الشيخ محمود خليل الحصري',
    muezzinAr: 'الشيخ محمود خليل الحصري',
    locationAr: 'القاهرة',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Mahmoud_Khalil_Al_Hussary_-_Cairo_(%D9%85%D8%AD%D9%85%D9%88%D8%AF_%D8%AE%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D8%AD%D8%B5%D8%B1%D9%8A_-_%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9).mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-ghamdi',
    nameAr: 'أذان الحرمين — الشيخ سعد الغامدي',
    muezzinAr: 'الشيخ سعد الغامدي',
    locationAr: 'السعودية',
    url: 'https://cdn.aladhan.com/audio/adhans/a7.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-ajamy',
    nameAr: 'أذان الشيخ أحمد بن علي العجمي',
    muezzinAr: 'الشيخ أحمد بن علي العجمي',
    locationAr: 'السعودية',
    url: 'https://cdn.aladhan.com/audio/adhans/a9.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-makkah',
    nameAr: 'أذان المسجد الحرام — علي أحمد ملا',
    muezzinAr: 'الشيخ علي أحمد ملا',
    locationAr: 'مكة المكرمة (يعمل بدون نت)',
    url: '/audio/adhan-makkah.mp3',
    fallbackUrl: '/adhan-sounds/makkah.mp3',
  },
  {
    id: 'adhan-farooq',
    nameAr: 'أذان الشيخ فاروق حضراوي',
    muezzinAr: 'الشيخ فاروق بن عبد الرحمن حضراوي',
    locationAr: 'المسجد الحرام',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Faruq_Abdul_Rahman_Hadrawe_-_Al_Haram_Al_Maki_(%D9%81%D8%A7%D8%B1%D9%88%D9%82_%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D8%B1%D8%AD%D9%85%D9%86_%D8%AD%D8%B6%D8%B1%D8%A7%D9%88%D9%8A_-_%D8%A7%D9%84%D8%AD%D8%B1%D9%85_%D8%A7%D9%84%D9%85%D9%83%D9%8A).mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-qatami',
    nameAr: 'أذان الشيخ ناصر القطامي',
    muezzinAr: 'الشيخ ناصر القطامي',
    locationAr: 'الرياض',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Nasser_Al_Qatami_-_HQ_(%D9%86%D8%A7%D8%B5%D8%B1_%D8%A7%D9%84%D9%82%D8%B7%D8%A7%D9%85%D9%8A).mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-dosari',
    nameAr: 'أذان الشيخ ياسر الدوسري',
    muezzinAr: 'الشيخ ياسر الدوسري',
    locationAr: 'مكة المكرمة',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Yasser_Al-Dosari_-_Saudi_Arabia_(%D9%8A%D8%A7%D8%B3%D8%B1_%D8%A7%D9%84%D8%AF%D9%88%D8%B3%D8%B1%D9%8A_-_%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9_%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9_%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9).mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-islam-sobhi',
    nameAr: 'أذان القارئ إسلام صبحي',
    muezzinAr: 'الشيخ إسلام صبحي',
    locationAr: 'مصر',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/islam-sobhi-01.mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-muaiqly',
    nameAr: 'أذان الحرم المكي — ماهر المعيقلي',
    muezzinAr: 'الشيخ ماهر المعيقلي',
    locationAr: 'المسجد الحرام',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/makkah-haram-01.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-sudais',
    nameAr: 'أذان الحرم المكي — عبد الرحمن السديس',
    muezzinAr: 'الشيخ عبد الرحمن السديس',
    locationAr: 'المسجد الحرام',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/makkah-haram-02.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-shuraim',
    nameAr: 'أذان الحرم المكي — سعود الشريم',
    muezzinAr: 'الشيخ سعود الشريم',
    locationAr: 'المسجد الحرام',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/makkah-haram-03.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-alijaber',
    nameAr: 'أذان الشيخ علي جابر',
    muezzinAr: 'الشيخ علي عبد الله جابر',
    locationAr: 'المسجد الحرام',
    url: 'https://archive.org/download/azan-iqamah/%D8%A3%D8%B0%D8%A7%D9%86%20%D8%A7%D9%84%D9%81%D8%AC%D8%B1%20%D8%B9%D8%A7%D9%851402%D9%87%D9%80.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-luhaidan',
    nameAr: 'أذان الشيخ محمد اللحيدان',
    muezzinAr: 'الشيخ محمد اللحيدان — جامع الراجحي',
    locationAr: 'الرياض',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Adhan_Masjid_Al_Rajehe_Saudi_Arabia_1_(%D8%A3%D8%B0%D8%A7%D9%86_%D9%85%D8%B3%D8%AC%D8%AF_%D8%A7%D9%84%D8%B1%D8%A7%D8%AC%D8%AD%D9%8A_%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9).mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-hatem-farid',
    nameAr: 'أذان الشيخ حاتم فريد الواعر',
    muezzinAr: 'الشيخ حاتم فريد الواعر',
    locationAr: 'مصر',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Adhan_Fajr_Cairo_Egypt_(%D8%A3%D8%B0%D8%A7%D9%86_%D8%A7%D9%84%D9%81%D8%AC%D8%B1_%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9_%D9%85%D8%B5%D8%B1).mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-moataz-hamdi',
    nameAr: 'أذان الشيخ معتز الحمدي',
    muezzinAr: 'الشيخ معتز الحمدي — المقام المصري',
    locationAr: 'القاهرة',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/egypt-traditional-01.mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-qazabri',
    nameAr: 'أذان الشيخ عمر القزابري',
    muezzinAr: 'الشيخ عمر القزابري',
    locationAr: 'المغرب',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Omar_Al_Kazabri_(%D8%B9%D9%85%D8%B1_%D8%A7%D9%84%D9%82%D8%B2%D8%A7%D8%A8%D8%B1%D9%8A).mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-matroud',
    nameAr: 'أذان الشيخ عبد الله المطرود',
    muezzinAr: 'الشيخ عبد الله المطرود',
    locationAr: 'المدينة المنورة',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/madinah-01.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-majed-zamil',
    nameAr: 'أذان الشيخ ماجد الزامل',
    muezzinAr: 'الشيخ ماجد الزامل',
    locationAr: 'الرياض',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Majid_Al_Zamel_(%D9%85%D8%A7%D8%AC%D8%AF_%D8%A7%D9%84%D8%B2%D8%A7%D9%85%D9%84).mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-hamad-deghreri',
    nameAr: 'أذان الشيخ حمد الدغريري',
    muezzinAr: 'الشيخ حمد الدغريري',
    locationAr: 'السعودية',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Hamad_Al_Daghriri_-_HQ_(%D8%AD%D9%85%D8%AF_%D8%A7%D9%84%D8%AF%D8%BA%D8%B1%D9%8A%D8%B1%D9%8A).mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-ayman-ramadan',
    nameAr: 'أذان الشيخ أيمن رمضان',
    muezzinAr: 'الشيخ أيمن رمضان — المسجد النبوي',
    locationAr: 'المدينة المنورة (يعمل بدون نت)',
    url: '/audio/adhan-madinah.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-hassan-saleh',
    nameAr: 'أذان الشيخ حسن صالح',
    muezzinAr: 'الشيخ حسن صالح بعلول',
    locationAr: 'مصر',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Hassan_Salah_Baalul_(%D8%AD%D8%B3%D9%86_%D8%B5%D8%A7%D9%84%D8%AD_%D8%A8%D8%B9%D9%84%D9%88%D9%84).mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
  {
    id: 'adhan-ayyub',
    nameAr: 'أذان الشيخ محمد أيوب',
    muezzinAr: 'الشيخ محمد أيوب',
    locationAr: 'المدينة المنورة',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Adhan_Al_Haram_Al_Madani_-_Al_Madinah_1_(%D8%A3%D8%B0%D8%A7%D9%86_%D8%A7%D9%84%D8%AD%D8%B1%D9%85_%D8%A7%D9%84%D9%85%D8%AF%D9%86%D9%8A_-_%D8%A7%D9%84%D9%85%D8%AF%D9%8A%D9%86%D8%A9_%D8%A7%D9%84%D9%85%D9%86%D9%88%D8%B1%D8%A9).mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
  {
    id: 'adhan-aziz-alili',
    nameAr: 'أذان الشيخ عزيز العليلي',
    muezzinAr: 'الشيخ عزيز العليلي — المسجد الأقصى',
    locationAr: 'القدس الشريف',
    url: 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/Adhan_Al_Aqsa_-_Jerusalem_(%D8%A3%D8%B0%D8%A7%D9%86_%D8%A7%D9%84%D9%85%D8%B3%D8%AC%D8%AF_%D8%A7%D9%84%D8%A3%D9%82%D8%B5%D9%89_-_%D8%A7%D9%84%D9%82%D8%AF%D8%B3).mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-rachid-bilal',
    nameAr: 'أذان الشيخ رشيد بلال',
    muezzinAr: 'الشيخ رشيد بلال',
    locationAr: 'المغرب العربي',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/cheb-ali-north-africa-01.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'adhan-idris-abkar',
    nameAr: 'أذان الشيخ إدريس أبكر',
    muezzinAr: 'الشيخ إدريس أبكر',
    locationAr: 'الرياض',
    url: 'https://raw.githubusercontent.com/mohsalvi/adhan-audio/main/general/ahmad-al-nafees-01.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-khalid-aljalil',
    nameAr: 'أذان الشيخ خالد الجليل',
    muezzinAr: 'الشيخ خالد الجليل',
    locationAr: 'الرياض (يعمل بدون نت)',
    url: '/adhan-sounds/khalid-aljalil.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'adhan-ahmed-naina',
    nameAr: 'أذان الشيخ أحمد نعينع',
    muezzinAr: 'الشيخ أحمد نعينع',
    locationAr: 'مصر (يعمل بدون نت)',
    url: '/adhan-sounds/ahmed-naina.mp3',
    fallbackUrl: '/adhan-sounds/egyptian.mp3',
  },
];

export const ADHAN_VOICES_9: AdhanVoice[] = ADHAN_VOICES_30.slice(0, 9);
export const ADHAN_VOICES_3: AdhanVoice[] = ADHAN_VOICES_30.slice(0, 3);

export const MUEZZIN_POPUP_VOICES_5: AdhanVoice[] = [
  {
    id: 'muezzin-makkah',
    nameAr: 'الحرم المكي — علي أحمد ملا',
    muezzinAr: 'أذان الحرم المكي الشريف',
    locationAr: 'مكة المكرمة (أوفلاين)',
    url: '/adhan-sounds/makkah.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'muezzin-alafasy',
    nameAr: 'الشيخ مشاري راشد العفاسي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الكويت (أوفلاين)',
    url: '/adhan-sounds/mishary-alafasy.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'muezzin-jalil',
    nameAr: 'الشيخ خالد الجليل',
    muezzinAr: 'الشيخ خالد الجليل',
    locationAr: 'الرياض (أوفلاين)',
    url: '/adhan-sounds/khalid-aljalil.mp3',
    fallbackUrl: '/audio/adhan-alafasy.mp3',
  },
  {
    id: 'muezzin-naina',
    nameAr: 'الشيخ أحمد نعينع',
    muezzinAr: 'الشيخ أحمد نعينع',
    locationAr: 'مصر (أوفلاين)',
    url: '/adhan-sounds/ahmed-naina.mp3',
    fallbackUrl: '/audio/adhan-makkah.mp3',
  },
  {
    id: 'muezzin-egyptian',
    nameAr: 'الأذان المصري الأصيل',
    muezzinAr: 'الأذان المصري الأصيل',
    locationAr: 'القاهرة (أوفلاين)',
    url: '/adhan-sounds/egyptian.mp3',
    fallbackUrl: '/audio/adhan-madinah.mp3',
  },
];

const LEGACY_ADHAN_ID_ALIASES: Record<string, string> = {
  'adhan-madinah': 'adhan-ayyub',
  'adhan-aqsa': 'adhan-aziz-alili',
  'adhan-egypt': 'adhan-moataz-hamdi',
  'adhan-fajr': 'adhan-ayman-ramadan',
  'adhan-istanbul': 'adhan-farooq',
  'adhan-sham': 'adhan-alijaber',
  'adhan-haramain': 'adhan-makkah',
  'adhan-refaat': 'adhan-abdulbasit',
  'adhan-naqshabandi': 'adhan-minshawi',
  'adhan-bukhari': 'adhan-ayyub',
  'adhan-reis': 'adhan-farooq',
  'adhan-shaker': 'adhan-makkah',
  'adhan-khoja': 'adhan-makkah',
  'adhan-afifi': 'adhan-matroud',
  'adhan-imran': 'adhan-ayman-ramadan',
  'adhan-quba': 'adhan-ayyub',
  'adhan-azhar': 'adhan-husary',
  'adhan-amr': 'adhan-ahmed-naina',
  'adhan-zayed': 'adhan-dosari',
  'adhan-maghreb': 'adhan-qazabri',
  'adhan-ramadan-fajr': 'adhan-alafasy',
};

export function resolveAdhanVoiceById(id?: string | null): AdhanVoice {
  if (!id || id === 'unselected') {
    return MUEZZIN_POPUP_VOICES_5[0];
  }
  const normalized = LEGACY_ADHAN_ID_ALIASES[id] || id;
  return (
    MUEZZIN_POPUP_VOICES_5.find((v) => v.id === normalized) ||
    ADHAN_VOICES_30.find((v) => v.id === normalized) ||
    MUEZZIN_POPUP_VOICES_5[0]
  );
}

// الإقامة الحقيقية فقط ("قد قامت الصلاة") — 4 شيوخ معتمدين (بدون أذان أو دعاء)
export const IQAMAH_VOICES_10: AdhanVoice[] = [
  {
    id: 'iqamah-alafasy',
    nameAr: 'إقامة الشيخ مشاري راشد العفاسي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'الإقامة الحقيقية (أوفلاين)',
    descAr: 'صوت الإقامة الشرعية فقط — قد قامت الصلاة (بدون أذان أو دعاء)',
    url: '/audio/iqamah-makkah.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
  {
    id: 'iqamah-ghamdi',
    nameAr: 'إقامة الشيخ سعد الغامدي',
    muezzinAr: 'الشيخ سعد الغامدي',
    locationAr: 'الإقامة الحقيقية',
    descAr: 'صوت الإقامة الشرعية فقط بصوت خاشع ومتقن',
    url: 'https://archive.org/download/iqamah_athan/iqamah.mp3',
    fallbackUrl: '/audio/iqamah-madinah.mp3',
  },
  {
    id: 'iqamah-abdulbasit',
    nameAr: 'إقامة الشيخ عبد الباسط عبد الصمد',
    muezzinAr: 'الشيخ عبد الباسط عبد الصمد',
    locationAr: 'الإقامة الحقيقية',
    descAr: 'صوت الإقامة الشرعية فقط بنبرة خاشعة واضحة',
    url: 'https://archive.org/download/iqamah_20140523/iqamah.mp3',
    fallbackUrl: '/audio/iqamah-haram.mp3',
  },
  {
    id: 'iqamah-qatami',
    nameAr: 'إقامة الشيخ ناصر القطامي',
    muezzinAr: 'الشيخ ناصر القطامي',
    locationAr: 'الإقامة الحقيقية',
    descAr: 'صوت الإقامة الشرعية فقط — قد قامت الصلاة',
    url: 'https://archive.org/download/azan-iqamah/%D8%A7%D9%82%D8%A7%D9%85%D8%A9.mp3',
    fallbackUrl: '/audio/iqamah-makkah.mp3',
  },
];

export const IQAMAH_VOICES_3: AdhanVoice[] = IQAMAH_VOICES_10;

const LEGACY_IQAMAH_ALIASES: Record<string, string> = {
  'iqamah-makkah': 'iqamah-alafasy',
  'iqamah-madinah': 'iqamah-ghamdi',
  'iqamah-haram': 'iqamah-abdulbasit',
};

export function resolveIqamahVoiceById(id?: string | null): AdhanVoice {
  if (!id) return IQAMAH_VOICES_10[0];
  const normalized = LEGACY_IQAMAH_ALIASES[id] || id;
  return (
    IQAMAH_VOICES_10.find((v) => v.id === normalized) || IQAMAH_VOICES_10[0]
  );
}

// تنبيه قبل الصلاة بصوت شيوخ حقيقي — العفاسي، الغامدي، عبد الباسط، وإلا صلاتي (بدون رنات أو نغمات)
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
    id: 'pre-sheikh-alafasy',
    nameAr: 'الشيخ مشاري راشد العفاسي (اقتربت صلاة...)',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'صوت شيخ حقيقي (أوفلاين)',
    descAr: 'نداء واضح: اقتربت صلاة الفجر / الظهر / العصر / المغرب / العشاء قبل الموعد',
    url: '/audio/pre-adhan/alafasy-general.mp3',
    fallbackUrl: '/audio/pre-adhan/alafasy-general.mp3',
  },
  {
    id: 'pre-sheikh-ghamdi',
    nameAr: 'الشيخ سعد الغامدي (اقتربت صلاة...)',
    muezzinAr: 'الشيخ سعد الغامدي',
    locationAr: 'صوت شيخ حقيقي (أوفلاين)',
    descAr: 'نداء خاشع وهادئ قبل موعد كل صلاة',
    url: '/audio/pre-adhan/ghamdi-general.mp3',
    fallbackUrl: '/audio/pre-adhan/ghamdi-general.mp3',
  },
  {
    id: 'pre-sheikh-abdulbasit',
    nameAr: 'الشيخ عبد الباسط عبد الصمد (اقتربت صلاة...)',
    muezzinAr: 'الشيخ عبد الباسط عبد الصمد',
    locationAr: 'صوت شيخ حقيقي (أوفلاين)',
    descAr: 'نداء وقور بنبرة مصرية أصيلة قبل موعد كل صلاة',
    url: '/audio/pre-adhan/abdulbasit-general.mp3',
    fallbackUrl: '/audio/pre-adhan/abdulbasit-general.mp3',
  },
  {
    id: 'pre-sheikh-illa-salati',
    nameAr: 'إلا صلاتي ما أخليها — الشيخ مشاري العفاسي',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationAr: 'صوت شيخ حقيقي (أوفلاين)',
    descAr: 'أنشودة التذكير الشهيرة: إلا صلاتي ما أخليها هي حياتي ودنيتي فيها',
    url: '/audio/pre-adhan/illa-salati.mp3',
    fallbackUrl: '/audio/pre-adhan-illa-salati.mp3',
  },
];

export const PRE_ADHAN_VOICES_3 = PRE_ADHAN_VOICES_10;

const LEGACY_PRE_ADHAN_ALIASES: Record<string, string> = {
  'pre-chime': 'pre-sheikh-alafasy',
  'pre-beep-soft': 'pre-sheikh-ghamdi',
  'pre-beep-double': 'pre-sheikh-abdulbasit',
  'pre-illa-salati': 'pre-sheikh-illa-salati',
};

export function resolvePreAdhanVoiceById(id?: string | null) {
  if (!id) return PRE_ADHAN_VOICES_10[0];
  const normalized = LEGACY_PRE_ADHAN_ALIASES[id] || id;
  return (
    PRE_ADHAN_VOICES_10.find((p) => p.id === normalized) || PRE_ADHAN_VOICES_10[0]
  );
}

export function getPreAdhanAudioUrl(
  voiceId?: string | null,
  prayerKey?: string,
): string {
  const norm = resolvePreAdhanVoiceById(voiceId).id;
  if (norm === 'pre-sheikh-illa-salati') {
    return '/audio/pre-adhan/illa-salati.mp3';
  }
  const pKey = prayerKey && ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(prayerKey)
    ? prayerKey
    : 'general';
  if (norm === 'pre-sheikh-ghamdi') {
    return `/audio/pre-adhan/ghamdi-${pKey}.mp3`;
  }
  if (norm === 'pre-sheikh-abdulbasit') {
    return `/audio/pre-adhan/abdulbasit-${pKey}.mp3`;
  }
  return `/audio/pre-adhan/alafasy-${pKey}.mp3`;
}

// التواشيح وتكبيرات العيد محفوظة هنا للمعاينة المكتبية فقط ولا تُستخدم في شاشة التنبيهات
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
    id: 'dua-abdulbasit',
    nameAr: 'صلاة ودعاء بعد الأذان — الشيخ عبد الباسط عبد الصمد',
    muezzinAr: 'الشيخ عبد الباسط عبد الصمد',
    locationAr: 'مصر',
    descAr: 'دعاء وصلوات خاشعة بصوت الشيخ عبد الباسط عبد الصمد',
    url: '/audio/salawat-3.mp3',
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
    nameAr: 'الدعاء النبوي المأثور — حصن المسلم',
    muezzinAr: 'حصن المسلم',
    locationAr: 'الأذكار المأثورة',
    descAr: 'اللهم رب هذه الدعوة التامة مع الآيات والذكر',
    url: '/audio/post-adhan-dua.mp3',
    fallbackUrl: '/audio/post-adhan-dua.mp3',
  },
];

export function resolvePostAdhanDuaVoiceById(id?: string | null): AdhanVoice {
  if (!id) return POST_ADHAN_DUA_VOICES_10[0];
  if (id === 'dua-muaiqly') return POST_ADHAN_DUA_VOICES_10[3];
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
  formulaId: string;
  titleAr: string;
  textAr: string;
  reciterAr: string;
  virtueAr: string;
  url: string;
}

// 3 أصوات فقط لصفحة صلِّ على النبي ﷺ: مشاري العفاسي، سعد الغامدي، وعبد الباسط عبد الصمد
export const SALAWAT_AUDIO_TRACKS: SalawatAudioTrack[] = [
  {
    id: 'salawat-afasy',
    formulaId: 'short',
    titleAr: '1. اللهم صلِّ على محمد ﷺ',
    textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    reciterAr: 'بصوت الشيخ مشاري راشد العفاسي',
    virtueAr: 'من صلى عليَّ صلاة واحدة صلى الله عليه بها عشرًا (صحيح مسلم)',
    url: '/audio/salawat-1.mp3',
  },
  {
    id: 'salawat-ghamdi',
    formulaId: 'ibrahimiyyah',
    titleAr: '2. الصلاة الإبراهيمية الكاملة',
    textAr:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    reciterAr: 'بصوت الشيخ سعد الغامدي',
    virtueAr: 'أفضل صيغة علّمها النبي ﷺ لأصحابه رضي الله عنهم (متفق عليه)',
    url: '/audio/salawat-2.mp3',
  },
  {
    id: 'salawat-abdulbasit',
    formulaId: 'kafiyah',
    titleAr: '3. اللهم صلِّ وسلم على محمد ﷺ',
    textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ',
    reciterAr: 'بصوت الشيخ عبد الباسط عبد الصمد',
    virtueAr: 'قيل لأبي بن كعب: إذن تُكفى همَّك ويُغفر لك ذنبُك (الترمذي)',
    url: '/audio/salawat-3.mp3',
  },
];

export function resolveSalawatTrackById(id?: string | null): SalawatAudioTrack {
  if (!id) return SALAWAT_AUDIO_TRACKS[0];
  if (id === 'salawat-muaiqly') return SALAWAT_AUDIO_TRACKS[2];
  return (
    SALAWAT_AUDIO_TRACKS.find((t) => t.id === id) || SALAWAT_AUDIO_TRACKS[0]
  );
}

export const ADHAN_TONE_DESCRIPTIONS: Record<string, {maqamAr: string; paceFactor: number}> = {
  'adhan-makkah': {maqamAr: 'النغمة: المقام المكي الجَهوري (الحجاز)', paceFactor: 1.0},
  'adhan-alafasy': {maqamAr: 'النغمة: نبرة العفاسي الندية (الراست)', paceFactor: 1.0},
  'adhan-abdulbasit': {maqamAr: 'النغمة: الأذان المصري الخاشع — عبد الباسط', paceFactor: 0.96},
  'adhan-minshawi': {maqamAr: 'النغمة: تلاوة الأذان الخاشعة — المنشاوي', paceFactor: 0.96},
  'adhan-husary': {maqamAr: 'النغمة: الأذان المتقن — الحصري', paceFactor: 0.96},
  'adhan-ghamdi': {maqamAr: 'النغمة: نبرة الحرمين — سعد الغامدي', paceFactor: 0.98},
  'adhan-ajamy': {maqamAr: 'النغمة: أداء أحمد بن علي العجمي', paceFactor: 1.0},
  'iqamah-alafasy': {maqamAr: 'إقامة الشيخ مشاري راشد العفاسي — الإقامة فقط', paceFactor: 1.0},
  'iqamah-ghamdi': {maqamAr: 'إقامة الشيخ سعد الغامدي — الإقامة فقط', paceFactor: 1.0},
  'iqamah-abdulbasit': {maqamAr: 'إقامة الشيخ عبد الباسط عبد الصمد — الإقامة فقط', paceFactor: 1.0},
  'iqamah-qatami': {maqamAr: 'إقامة الشيخ ناصر القطامي — الإقامة فقط', paceFactor: 1.0},
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
