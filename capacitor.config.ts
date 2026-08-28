import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neoalpharesearch.etfcampus',
  appName: 'ETF Campus',
  webDir: 'public',
  server: {
    url: 'https://etf-campus.pages.dev',
    cleartext: true,
  },
  appendUserAgent: 'ETFCampusApp',
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;