import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Database } from 'firebase/database'
import { firebaseStatus } from '../services/config'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Database
}

export class FirebaseNotConfiguredError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Firebase is not configured (missing: ${missing.join(', ') || 'config'})`)
    this.name = 'FirebaseNotConfiguredError'
    this.missing = missing
  }
}

let services: Promise<FirebaseServices> | null = null

export function isFirebaseConfigured(): boolean {
  return firebaseStatus.configured
}

/**
 * Loads and initialises Firebase on first use. The SDK is code-split, so
 * players who never sign in or play online never download it.
 */
export function getFirebase(): Promise<FirebaseServices> {
  const config = firebaseStatus.config
  if (!firebaseStatus.configured || !config) {
    return Promise.reject(new FirebaseNotConfiguredError(firebaseStatus.missing))
  }
  services ??= (async () => {
    const [{ initializeApp }, authModule, databaseModule] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/database'),
    ])
    const app = initializeApp(config)
    const auth = authModule.getAuth(app)
    const db = databaseModule.getDatabase(app)
    if (firebaseStatus.useEmulators) {
      const host = firebaseStatus.emulatorHost
      authModule.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
      databaseModule.connectDatabaseEmulator(db, host, 9000)
    }
    return { app, auth, db }
  })()
  services.catch(() => {
    services = null
  })
  return services
}
