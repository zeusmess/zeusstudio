import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app wraps the same web build (dist/) in a native shell.
 *
 *   npm run android:sync     # build the game and copy it into android/
 *   npm run android:apk      # …then build a debug APK (needs the Android SDK)
 *
 * GitHub Actions builds the APK on every push (.github/workflows/android.yml).
 */
const config: CapacitorConfig = {
  appId: 'com.youssefayman.cupcatcher',
  appName: 'Cup Catcher',
  webDir: 'dist',
  backgroundColor: '#0b2b22',
  android: {
    backgroundColor: '#0b2b22',
  },
}

export default config
