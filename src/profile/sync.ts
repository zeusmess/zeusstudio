import { useAuth } from '../auth/authStore'
import { getFirebase } from '../auth/firebase'
import { mergeProgress } from './progress'
import { getProfile, useProfile } from './profileStore'
import { sanitizeRecord } from './sanitize'
import type { ProfileRecord } from './types'

const SYNC_DELAY_MS = 1200

interface RemoteUser {
  profile: Pick<ProfileRecord['profile'], 'displayName' | 'avatarId' | 'basketSkin' | 'createdAt' | 'updatedAt'>
  progress: ProfileRecord['progress']
}

function toRemote(record: ProfileRecord): RemoteUser {
  const { displayName, avatarId, basketSkin, createdAt, updatedAt } = record.profile
  return { profile: { displayName, avatarId, basketSkin, createdAt, updatedAt }, progress: record.progress }
}

/** Arrays may come back from the database as objects; the sanitizer expects arrays. */
function normalizeArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeArrays)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeArrays(v)] as const)
    const listKeys = ['completedLevels', 'unlockedCosmetics', 'matchHistory']
    return Object.fromEntries(
      entries.map(([k, v]) => [k, listKeys.includes(k) && v && typeof v === 'object' && !Array.isArray(v) ? Object.values(v) : v]),
    )
  }
  return value
}

/** Combines the cloud copy with this device's copy; newer profile fields win, progress is merged. */
export function mergeRecords(remoteRaw: unknown, local: ProfileRecord): ProfileRecord {
  if (!remoteRaw) return local
  const remote = sanitizeRecord(
    { profile: { ...local.profile, ...(remoteRaw as RemoteUser).profile }, progress: (remoteRaw as RemoteUser).progress },
    local.profile,
  )
  const newerProfile = remote.profile.updatedAt > local.profile.updatedAt ? remote.profile : local.profile
  return {
    version: 1,
    profile: { ...newerProfile, id: local.profile.id, kind: local.profile.kind, identityChosen: true },
    progress: mergeProgress(local.progress, remote.progress),
  }
}

let active: { uid: string; stop: () => void; flush: () => Promise<void> } | null = null

/** Keeps the signed-in player's profile and progress synced with the cloud. */
export async function startSync(uid: string): Promise<void> {
  if (active?.uid === uid) return
  stopSync()
  const { db } = await getFirebase()
  const { ref, runTransaction } = await import('firebase/database')
  const userRef = ref(db, `users/${uid}`)
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastPushed = ''
  let running: Promise<void> = Promise.resolve()

  const push = () => {
    running = running.then(async () => {
      const local = getProfile()
      if (local.profile.id !== uid) return
      useAuth.getState().set({ sync: 'syncing' })
      try {
        const result = await runTransaction(
          userRef,
          (remote: unknown) => {
            // An error thrown in here would be swallowed by the SDK and stall the sync; abort instead.
            try {
              return toRemote(mergeRecords(normalizeArrays(remote), getProfile()))
            } catch {
              return undefined
            }
          },
          { applyLocally: false },
        )
        const merged = mergeRecords(normalizeArrays(result.snapshot.val()), getProfile())
        lastPushed = JSON.stringify(merged)
        if (getProfile().profile.id === uid && JSON.stringify(getProfile()) !== lastPushed) {
          useProfile.getState().replaceRecord(merged)
        }
        useAuth.getState().set({ sync: 'synced' })
      } catch {
        // Offline or refused: the local copy is safe and the next change retries.
        useAuth.getState().set({ sync: 'error' })
      }
    })
    return running
  }

  const unsubscribe = useProfile.subscribe((state) => {
    if (state.record.profile.id !== uid || JSON.stringify(state.record) === lastPushed) return
    clearTimeout(timer)
    timer = setTimeout(push, SYNC_DELAY_MS)
  })
  const onOnline = () => void push()
  globalThis.addEventListener?.('online', onOnline)

  active = {
    uid,
    stop: () => {
      clearTimeout(timer)
      unsubscribe()
      globalThis.removeEventListener?.('online', onOnline)
    },
    flush: () => {
      clearTimeout(timer)
      return push()
    },
  }
  await push()
}

export function stopSync(): void {
  active?.stop()
  active = null
  useAuth.getState().set({ sync: 'idle' })
}

/** Pushes pending changes now (before signing out). */
export async function flushSync(): Promise<void> {
  await active?.flush()
}
