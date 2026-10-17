import { create } from 'zustand'
import { firebaseStatus } from '../services/config'

export type AuthStatus = 'unconfigured' | 'initializing' | 'signed-out' | 'signing-in' | 'signed-in'

export type AuthErrorCode =
  | 'popupClosed'
  | 'popupBlocked'
  | 'network'
  | 'unauthorizedDomain'
  | 'operationNotAllowed'
  | 'generic'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

export interface AuthUser {
  uid: string
  displayName: string | null
  isAnonymous: boolean
}

interface AuthState {
  status: AuthStatus
  /** The Firebase user — a Google account, or an anonymous guest used for online play. */
  user: AuthUser | null
  error: AuthErrorCode | null
  sync: SyncState
  set: (patch: Partial<Omit<AuthState, 'set'>>) => void
}

export const useAuth = create<AuthState>()((set) => ({
  status: firebaseStatus.configured ? 'initializing' : 'unconfigured',
  user: null,
  error: null,
  sync: 'idle',
  set: (patch) => set(patch),
}))

/** True when a real Google account is signed in (not an anonymous guest). */
export function isGoogleSignedIn(state = useAuth.getState()): boolean {
  return state.status === 'signed-in' && state.user !== null && !state.user.isAnonymous
}

/** Maps Firebase error codes to messages the player can act on. */
export function mapAuthError(error: unknown): AuthErrorCode {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'popupClosed'
    case 'auth/popup-blocked':
      return 'popupBlocked'
    case 'auth/network-request-failed':
    case 'auth/timeout':
      return 'network'
    case 'auth/unauthorized-domain':
      return 'unauthorizedDomain'
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'operationNotAllowed'
    default:
      return 'generic'
  }
}
