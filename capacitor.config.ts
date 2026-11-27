import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alzahabi.adhan.app',
  appName: 'تسبيح - البرنامج الإسلامي الذهبي',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#C9A227',
      sound: 'adhan.mp3',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BackgroundRunner: {
      label: 'com.alzahabi.adhan.background',
      src: 'runners/background.js',
      event: 'adhanPeriodicCheck',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
