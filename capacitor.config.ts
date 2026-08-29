import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neoalpharesearch.etfcampus',
  appName: 'ETF Campus',
  webDir: 'public',
  server: {
    url: 'https://etf-campus.pages.dev',
    cleartext: true,
  },
  appendUserAgent: 'ETFCampusApp',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
