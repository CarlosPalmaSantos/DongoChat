import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.magin.dongochat',
  appName: 'DongoChat',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
  },
};

export default config;
