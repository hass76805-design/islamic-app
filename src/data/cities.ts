import {UserLocation} from '../types';

export const PRESET_CITIES: UserLocation[] = [
  {latitude: 21.4225, longitude: 39.8262, city: 'مكة المكرمة', country: 'السعودية', isGps: false},
  {latitude: 24.4672, longitude: 39.6111, city: 'المدينة المنورة', country: 'السعودية', isGps: false},
  {latitude: 24.7136, longitude: 46.6753, city: 'الرياض', country: 'السعودية', isGps: false},
  {latitude: 21.5433, longitude: 39.1728, city: 'جدة', country: 'السعودية', isGps: false},
  {latitude: 26.4207, longitude: 50.0888, city: 'الدمام', country: 'السعودية', isGps: false},
  {latitude: 18.2164, longitude: 42.5053, city: 'أبها', country: 'السعودية', isGps: false},
  {latitude: 28.3835, longitude: 36.5662, city: 'تبوك', country: 'السعودية', isGps: false},
  {latitude: 30.0444, longitude: 31.2357, city: 'القاهرة', country: 'مصر', isGps: false},
  {latitude: 29.0661, longitude: 31.0994, city: 'بني سويف', country: 'مصر', isGps: false},
  {latitude: 30.0131, longitude: 31.2089, city: 'الجيزة', country: 'مصر', isGps: false},
  {latitude: 31.2001, longitude: 29.9187, city: 'الإسكندرية', country: 'مصر', isGps: false},
  {latitude: 31.0409, longitude: 31.3785, city: 'المنصورة', country: 'مصر', isGps: false},
  {latitude: 30.7865, longitude: 31.0004, city: 'طنطا', country: 'مصر', isGps: false},
  {latitude: 30.5852, longitude: 31.502, city: 'الزقازيق', country: 'مصر', isGps: false},
  {latitude: 31.2653, longitude: 32.3019, city: 'بورسعيد', country: 'مصر', isGps: false},
  {latitude: 29.9668, longitude: 32.5498, city: 'السويس', country: 'مصر', isGps: false},
  {latitude: 27.1809, longitude: 31.1837, city: 'أسيوط', country: 'مصر', isGps: false},
  {latitude: 25.6872, longitude: 32.6396, city: 'الأقصر', country: 'مصر', isGps: false},
  {latitude: 24.0889, longitude: 32.8998, city: 'أسوان', country: 'مصر', isGps: false},
  {latitude: 25.2048, longitude: 55.2708, city: 'دبي', country: 'الإمارات', isGps: false},
  {latitude: 24.4539, longitude: 54.3773, city: 'أبوظبي', country: 'الإمارات', isGps: false},
  {latitude: 25.3463, longitude: 55.4209, city: 'الشارقة', country: 'الإمارات', isGps: false},
  {latitude: 25.2854, longitude: 51.531, city: 'الدوحة', country: 'قطر', isGps: false},
  {latitude: 29.3759, longitude: 47.9774, city: 'الكويت', country: 'الكويت', isGps: false},
  {latitude: 26.2285, longitude: 50.586, city: 'المنامة', country: 'البحرين', isGps: false},
  {latitude: 23.588, longitude: 58.3829, city: 'مسقط', country: 'عُمان', isGps: false},
  {latitude: 31.9454, longitude: 35.9284, city: 'عمّان', country: 'الأردن', isGps: false},
  {latitude: 31.7683, longitude: 35.2137, city: 'القدس', country: 'فلسطين', isGps: false},
  {latitude: 31.5017, longitude: 34.4668, city: 'غزة', country: 'فلسطين', isGps: false},
  {latitude: 33.8938, longitude: 35.5018, city: 'بيروت', country: 'لبنان', isGps: false},
  {latitude: 33.5138, longitude: 36.2765, city: 'دمشق', country: 'سوريا', isGps: false},
  {latitude: 33.3152, longitude: 44.3661, city: 'بغداد', country: 'العراق', isGps: false},
  {latitude: 15.3694, longitude: 44.191, city: 'صنعاء', country: 'اليمن', isGps: false},
  {latitude: 15.5007, longitude: 32.5599, city: 'الخرطوم', country: 'السودان', isGps: false},
  {latitude: 32.8872, longitude: 13.1913, city: 'طرابلس', country: 'ليبيا', isGps: false},
  {latitude: 33.9716, longitude: -6.8498, city: 'الرباط', country: 'المغرب', isGps: false},
  {latitude: 33.5731, longitude: -7.5898, city: 'الدار البيضاء', country: 'المغرب', isGps: false},
  {latitude: 36.7538, longitude: 3.0588, city: 'الجزائر', country: 'الجزائر', isGps: false},
  {latitude: 36.8065, longitude: 10.1815, city: 'تونس', country: 'تونس', isGps: false},
  {latitude: 41.0082, longitude: 28.9784, city: 'إسطنبول', country: 'تركيا', isGps: false},
  {latitude: 3.139, longitude: 101.6869, city: 'كوالالمبور', country: 'ماليزيا', isGps: false},
  {latitude: -6.2088, longitude: 106.8456, city: 'جاكرتا', country: 'إندونيسيا', isGps: false},
  {latitude: 51.5074, longitude: -0.1278, city: 'لندن', country: 'بريطانيا', isGps: false},
  {latitude: 48.8566, longitude: 2.3522, city: 'باريس', country: 'فرنسا', isGps: false},
  {latitude: 40.7128, longitude: -74.006, city: 'نيويورك', country: 'أمريكا', isGps: false},
];

export function findNearestCity(lat: number, lng: number): {city: string; country: string} {
  let best = PRESET_CITIES[0];
  let minDist = Infinity;
  for (const c of PRESET_CITIES) {
    const d = Math.hypot(c.latitude - lat, c.longitude - lng);
    if (d < minDist) {
      minDist = d;
      best = c;
    }
  }
  if (minDist < 1.5) {
    return {city: best.city, country: best.country};
  }
  return {
    city: `موقعي (${lat.toFixed(2)}°، ${lng.toFixed(2)}°)`,
    country: 'تحديد GPS',
  };
}
