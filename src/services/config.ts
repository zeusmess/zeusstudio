/**
 * Runtime configuration read from Vite environment variables.
 * Only public, client-safe values live here (Firebase web config is public by
 * design; access is enforced by database.rules.json, not by hiding the keys).
 */

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}

export interface FirebaseStatus {
  configured: boolean
  useEmulators: boolean
  missing: string[]
  config: FirebaseWebConfig | null
  emulatorHost: string
}

type Env = Record<string, string | boolean | undefined>

const REQUIRED_KEYS = [
  ['VITE_FIREBASE_API_KEY', 'apiKey'],
  ['VITE_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['VITE_FIREBASE_DATABASE_URL', 'databaseURL'],
  ['VITE_FIREBASE_PROJECT_ID', 'projectId'],
  ['VITE_FIREBASE_APP_ID', 'appId'],
] as const

function text(env: Env, key: string): string {
  const value = env[key]
  return typeof value === 'string' ? value.trim() : ''
}

/** Pure so it can be unit-tested with any env object. */
export function resolveFirebaseStatus(env: Env): FirebaseStatus {
  const useEmulators = text(env, 'VITE_USE_FIREBASE_EMULATORS') === 'true'
  const emulatorHost = text(env, 'VITE_FIREBASE_EMULATOR_HOST') || '127.0.0.1'
  const projectId = text(env, 'VITE_FIREBASE_PROJECT_ID')

  if (useEmulators) {
    // The emulator suite accepts any "demo-" project without real credentials.
    const id = projectId || 'demo-cup-catcher'
    return {
      configured: true,
      useEmulators: true,
      missing: [],
      emulatorHost,
      config: {
        apiKey: text(env, 'VITE_FIREBASE_API_KEY') || 'demo-api-key',
        authDomain: text(env, 'VITE_FIREBASE_AUTH_DOMAIN') || `${id}.firebaseapp.com`,
        databaseURL:
          text(env, 'VITE_FIREBASE_DATABASE_URL') || `http://${emulatorHost}:9000/?ns=${id}-default-rtdb`,
        projectId: id,
        appId: text(env, 'VITE_FIREBASE_APP_ID') || '1:000000000000:web:demo',
      },
    }
  }

  const missing = REQUIRED_KEYS.filter(([envKey]) => !text(env, envKey)).map(([envKey]) => envKey)
  if (missing.length > 0) {
    return { configured: false, useEmulators: false, missing, config: null, emulatorHost }
  }

  const config: FirebaseWebConfig = {
    apiKey: text(env, 'VITE_FIREBASE_API_KEY'),
    authDomain: text(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
    databaseURL: text(env, 'VITE_FIREBASE_DATABASE_URL'),
    projectId,
    appId: text(env, 'VITE_FIREBASE_APP_ID'),
  }
  const storageBucket = text(env, 'VITE_FIREBASE_STORAGE_BUCKET')
  const messagingSenderId = text(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID')
  if (storageBucket) config.storageBucket = storageBucket
  if (messagingSenderId) config.messagingSenderId = messagingSenderId
  return { configured: true, useEmulators: false, missing: [], config, emulatorHost }
}

export const firebaseStatus: FirebaseStatus = resolveFirebaseStatus(import.meta.env as Env)

export const appVersion = '1.0.0'
