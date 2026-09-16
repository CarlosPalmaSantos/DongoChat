import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.magin.dongochat',
  appName: 'DongoChat',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorUpdater: {
      autoUpdate: false, // you're calling download/set manually
    },
    StatusBar: {
      overlaysWebView: true,
    },
  },
};

export default config;
