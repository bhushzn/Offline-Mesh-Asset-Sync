import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fieldlink.tacticalmesh',
  appName: 'FIELDLINK',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for nearby tactical mesh nodes...',
        cancel: 'Cancel',
        availableDevices: 'Nearby Tactical Nodes',
        noDeviceFound: 'No tactical nodes detected',
      },
    },
  },
};

export default config;
