import type { User } from 'firebase/auth'
import { toast } from '../components/toastStore'
import { currentI18n } from '../locales/i18n'
import { getProfile } from '../profile/profileStore'
import { flushSync, startSync, stopSync } from '../profile/sync'
import { activateAccount, activateGuest } from './account'
import { mapAuthError, useAuth, type AuthUser } from './authStore'
import { firebaseStatus } from '../services/config'
import { getFirebase, isFirebaseConfigured } from './firebase'

let initialised = false

function toAuthUser(user: User): AuthUser {
  // An upgraded anonymous account keeps its Google name in providerData.
  const googleName = user.providerData.find((p) => p.providerId === 'google.com')?.displayName ?? null
  return { uid: user.uid, displayName: user.displayName ?? googleName, isAnonymous: user.isAnonymous }
}

function handleUser(user: User | null): void {
  const store = useAuth.getState()
  if (!user) {
    store.set({ status: 'signed-out', user: null })
    stopSync()
    activateGuest()
    return
  }
  const authUser = toAuthUser(user)
  store.set({ status: 'signed-in', user: authUser, error: null })
  if (user.isAnonymous) {
    stopSync()
    activateGuest()
    return
  }
  const result = activateAccount(authUser)
  const { t } = currentI18n()
  if (result === 'linked') toast({ tone: 'success', title: t('login.linked') })
  else if (result === 'welcome') {
    toast({ tone: 'success', title: t('login.welcomeBack', { name: getProfile().profile.displayName }) })
  }
  void startSync(user.uid).catch(() => useAuth.getState().set({ sync: 'error' }))
}

/** Starts listening to Firebase Auth. Safe to call when Firebase is not configured. */
export async function initAuth(): Promise<void> {
  if (initialised) return
  initialised = true
  if (!isFirebaseConfigured()) {
    useAuth.getState().set({ status: 'unconfigured' })
    return
  }
  try {
    const { auth } = await getFirebase()
    const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth')
    getRedirectResult(auth).catch((error) => useAuth.getState().set({ error: mapAuthError(error) }))
    onAuthStateChanged(auth, handleUser)
  } catch {
    // Firebase could not load (offline). The game keeps working as a guest.
    useAuth.getState().set({ status: 'signed-out' })
  }
}

/**
 * Real Google sign-in through Firebase (popup, with a redirect fallback when
 * popups are blocked). A guest who signed in anonymously for online play is
 * upgraded in place, keeping the same account.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const store = useAuth.getState()
  if (!isFirebaseConfigured()) {
    store.set({ status: 'unconfigured' })
    return false
  }
  const previousStatus = store.status
  store.set({ status: 'signing-in', error: null })
  try {
    const { auth } = await getFirebase()
    const { GoogleAuthProvider, linkWithPopup, signInWithCredential, signInWithPopup, signInWithRedirect } =
      await import('firebase/auth')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      if (auth.currentUser?.isAnonymous) {
        try {
          const credential = await linkWithPopup(auth.currentUser, provider)
          await credential.user.reload()
          handleUser(auth.currentUser)
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') throw error
          const credential = GoogleAuthProvider.credentialFromError(error as never)
          if (!credential) throw error
          await signInWithCredential(auth, credential)
        }
      } else {
        await signInWithPopup(auth, provider)
      }
      return true
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment') {
        await signInWithRedirect(auth, provider)
        return false
      }
      throw error
    }
  } catch (error) {
    useAuth.getState().set({
      status: previousStatus === 'signing-in' ? 'signed-out' : previousStatus,
      error: mapAuthError(error),
    })
    return false
  }
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured()) return
  await flushSync().catch(() => undefined)
  const { auth } = await getFirebase()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  toast({ tone: 'info', title: currentI18n().t('login.signedOut') })
}

export class OnlineUnavailableError extends Error {
  readonly reason: 'unconfigured' | 'auth'

  constructor(reason: 'unconfigured' | 'auth', cause?: unknown) {
    super(`Online play unavailable: ${reason}`, { cause })
    this.name = 'OnlineUnavailableError'
    this.reason = reason
  }
}

/** The uid used for online play: the Google account, or an anonymous guest session. */
export async function ensureOnlineUser(): Promise<string> {
  if (!isFirebaseConfigured()) throw new OnlineUnavailableError('unconfigured')
  try {
    const { auth } = await getFirebase()
    // Wait for a saved sign-in to be restored, so a Google player is never replaced by an anonymous one.
    await auth.authStateReady()
    if (auth.currentUser) return auth.currentUser.uid
    const { signInAnonymously } = await import('firebase/auth')
    const credential = await signInAnonymously(auth)
    return credential.user.uid
  } catch (error) {
    throw new OnlineUnavailableError('auth', error)
  }
}

/**
 * End-to-end tests only: signs in to the Firebase Auth emulator as a made-up
 * Google account (the emulator accepts unsigned test credentials), following
 * the same path as a real sign-in once Google has answered. It refuses to run
 * against a real Firebase project and is only exposed in development builds.
 */
export async function signInWithEmulatorGoogleAccount(email: string, name: string): Promise<void> {
  if (!firebaseStatus.useEmulators) throw new Error('Only available with the Firebase emulators')
  const { auth } = await getFirebase()
  const { GoogleAuthProvider, linkWithCredential, signInWithCredential } = await import('firebase/auth')
  const credential = GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, name, email_verified: true }))
  if (auth.currentUser?.isAnonymous) {
    try {
      await linkWithCredential(auth.currentUser, credential)
      await auth.currentUser.reload()
      handleUser(auth.currentUser)
      return
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/credential-already-in-use') throw error
    }
  }
  await signInWithCredential(auth, credential)
}
