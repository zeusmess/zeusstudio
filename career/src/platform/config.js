// Public Firebase web settings come from VITE_FIREBASE_* at build time (repository
// variables in CI, .env.local on a computer). They are not secrets: access is
// enforced by database.rules.json. Without them the game runs offline.

const env = import.meta.env || {}

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

export const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true'
export const emulatorHost = env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1'
export const EMULATOR_PORTS = { auth: 9199, database: 9100 }

const emulatorProject = env.VITE_FIREBASE_PROJECT_ID || 'demo-starbucks-career'

export const firebaseConfig = useEmulators
  ? {
      apiKey: 'demo-api-key',
      authDomain: `${emulatorProject}.firebaseapp.com`,
      databaseURL: `http://${emulatorHost}:${EMULATOR_PORTS.database}?ns=${emulatorProject}-default-rtdb`,
      projectId: emulatorProject,
      appId: 'demo-app-id',
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY || '',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
      databaseURL: env.VITE_FIREBASE_DATABASE_URL || '',
      projectId: env.VITE_FIREBASE_PROJECT_ID || '',
      appId: env.VITE_FIREBASE_APP_ID || '',
      ...(env.VITE_FIREBASE_STORAGE_BUCKET ? { storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET } : {}),
      ...(env.VITE_FIREBASE_MESSAGING_SENDER_ID ? { messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID } : {}),
    }

export const isOnlineConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId && firebaseConfig.appId,
)

/** Where players get the game; the admin can override both from the config screen. */
export const DEFAULT_LINKS = {
  web: env.VITE_CAREER_WEB_URL || '',
  apk: env.VITE_CAREER_APK_URL || '',
}

/** "1.2.10" > "1.2.9" */
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}
