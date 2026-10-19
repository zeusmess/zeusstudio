// Loads the Firebase SDK only when the game is configured for online play, so
// offline builds stay small and never touch the network.
import { Capacitor } from '@capacitor/core'
import { EMULATOR_PORTS, emulatorHost, firebaseConfig, isOnlineConfigured, useEmulators } from './config.js'

let loading = null

export function isNative() {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * @returns {Promise<null | { app, auth, db, A: typeof import('firebase/auth'), D: typeof import('firebase/database') }>}
 */
export function loadFirebase() {
  if (!isOnlineConfigured) return Promise.resolve(null)
  if (!loading) {
    loading = (async () => {
      const [{ initializeApp }, A, D] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/database'),
      ])
      const app = initializeApp(firebaseConfig)
      const auth = isNative()
        ? A.initializeAuth(app, { persistence: A.indexedDBLocalPersistence })
        : A.initializeAuth(app, {
            persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence],
            popupRedirectResolver: A.browserPopupRedirectResolver,
          })
      const db = D.getDatabase(app)
      if (useEmulators) {
        A.connectAuthEmulator(auth, `http://${emulatorHost}:${EMULATOR_PORTS.auth}`, { disableWarnings: true })
        D.connectDatabaseEmulator(db, emulatorHost, EMULATOR_PORTS.database)
      }
      const loaded = { app, auth, db, A, D }
      // The end-to-end tests drive sign-in through the emulator from the page.
      if (useEmulators) window.__sbcFirebase = loaded
      return loaded
    })().catch((error) => {
      console.error('[firebase] failed to load', error)
      loading = null
      return null
    })
  }
  return loading
}
