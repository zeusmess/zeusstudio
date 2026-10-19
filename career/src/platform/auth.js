// Signing in: Google (a popup on the web, the native account picker inside the
// Android app when it was built with the Firebase plugin) or an employee
// registration backed by an anonymous Firebase account.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { isNative } from './firebase.js'

const NativeAuth = registerPlugin('FirebaseAuthentication')

export function nativeGoogleAvailable() {
  try {
    return isNative() && Capacitor.isPluginAvailable('FirebaseAuthentication')
  } catch {
    return false
  }
}

/** Google sign-in is possible on the web, and in the app only with the native plugin. */
export function googleSignInSupported() {
  return !isNative() || nativeGoogleAvailable()
}

export function watchAuth(fb, callback) {
  return fb.A.onAuthStateChanged(fb.auth, callback)
}

/** Finishes a redirect sign-in started on a browser that blocked the popup. */
export async function completeRedirect(fb) {
  if (isNative()) return null
  try {
    const result = await fb.A.getRedirectResult(fb.auth)
    return result?.user || null
  } catch (error) {
    console.warn('[auth] redirect result', error)
    return null
  }
}

async function nativeGoogleCredential(fb) {
  const result = await NativeAuth.signInWithGoogle()
  const idToken = result?.credential?.idToken
  if (!idToken) throw Object.assign(new Error('No Google token'), { code: 'auth/no-token' })
  return fb.A.GoogleAuthProvider.credential(idToken)
}

/**
 * Signs in with Google. A player who registered with their employee ID keeps
 * their progress: the Google account is linked to the same account.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signInWithGoogle(fb) {
  const { A, auth } = fb
  const current = auth.currentUser
  if (isNative()) {
    if (!nativeGoogleAvailable()) throw Object.assign(new Error('Google sign-in is not set up in this build'), { code: 'auth/native-unavailable' })
    const credential = await nativeGoogleCredential(fb)
    if (current && current.isAnonymous) {
      const linked = await A.linkWithCredential(current, credential)
      return linked.user
    }
    const signed = await A.signInWithCredential(auth, credential)
    return signed.user
  }
  const provider = new A.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    if (current && current.isAnonymous) {
      const linked = await A.linkWithPopup(current, provider)
      return linked.user
    }
    const signed = await A.signInWithPopup(auth, provider)
    return signed.user
  } catch (error) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      if (current && current.isAnonymous) await A.linkWithRedirect(current, provider)
      else await A.signInWithRedirect(auth, provider)
      return null
    }
    throw error
  }
}

export async function signInAsEmployee(fb) {
  const { A, auth } = fb
  if (auth.currentUser) return auth.currentUser
  const result = await A.signInAnonymously(auth)
  return result.user
}

export async function signOutEverywhere(fb) {
  try {
    if (nativeGoogleAvailable()) await NativeAuth.signOut()
  } catch {
    // The native session may already be gone.
  }
  await fb.A.signOut(fb.auth)
}

/** Arabic message for a Firebase auth error. */
export function authErrorMessage(error) {
  const code = error?.code || ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || /cancel/i.test(error?.message || ''))
    return 'تم إلغاء تسجيل الدخول.'
  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use')
    return 'حساب Google ده مربوط بلاعب تاني بالفعل. سجّل خروج وادخل بيه مباشرةً.'
  if (code === 'auth/network-request-failed') return 'لا يوجد اتصال بالإنترنت. حاول مرة أخرى.'
  if (code === 'auth/unauthorized-domain') return 'نطاق الموقع غير مسموح به في إعدادات Firebase (Authorized domains).'
  if (code === 'auth/native-unavailable') return 'تسجيل Google غير مفعّل في نسخة الأندرويد هذه. استخدم التسجيل بالرقم الوظيفي أو نسخة الويب.'
  if (code === 'auth/operation-not-allowed') return 'طريقة الدخول هذه غير مفعّلة في Firebase (Authentication → Sign-in method).'
  if (code === 'auth/too-many-requests') return 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.'
  return 'تعذّر تسجيل الدخول. حاول مرة أخرى.'
}
