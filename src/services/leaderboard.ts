import { ensureOnlineUser } from '../auth/authService'
import { getFirebase, isFirebaseConfigured } from '../auth/firebase'
import type { SessionResult } from '../game/core/types'
import { getProfile } from '../profile/profileStore'
import type { AvatarId } from '../types'
import { readJson, writeJson } from './storage'

export interface LeaderboardEntry {
  uid: string
  name: string
  avatar: AvatarId
  score: number
  wave: number
  at: number
}

const LOCAL_KEY = 'scc:v1:leaderboard:endless'
const LOCAL_LIMIT = 10
export const GLOBAL_LIMIT = 20

export function localEntries(): LeaderboardEntry[] {
  const entries = readJson<LeaderboardEntry[]>(LOCAL_KEY)
  return Array.isArray(entries)
    ? entries.filter((e) => typeof e?.score === 'number' && typeof e?.name === 'string').slice(0, LOCAL_LIMIT)
    : []
}

/** Adds a run to this device's top ten; returns its rank there (1-based) or null. */
export function recordLocal(entry: LeaderboardEntry): number | null {
  const entries = [...localEntries(), entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, LOCAL_LIMIT)
  writeJson(LOCAL_KEY, entries)
  const index = entries.indexOf(entry)
  return index >= 0 ? index + 1 : null
}

/**
 * Records the time an endless run starts on the server. The database rules
 * use it to reject leaderboard scores that could not have been earned in
 * the time that has passed.
 */
export async function markEndlessRunStart(): Promise<void> {
  if (!isFirebaseConfigured()) return
  try {
    const uid = await ensureOnlineUser()
    const { db } = await getFirebase()
    const { ref, set, serverTimestamp } = await import('firebase/database')
    await set(ref(db, `runs/${uid}`), { startedAt: serverTimestamp() })
  } catch {
    // Offline or not allowed: the run still counts locally.
  }
}

/** Saves an endless result locally and, when online play is configured, globally. Returns the rank. */
export async function submitEndlessScore(result: SessionResult): Promise<number | null> {
  const { profile } = getProfile()
  const entry: LeaderboardEntry = {
    uid: profile.id,
    name: profile.displayName,
    avatar: profile.avatarId,
    score: result.score,
    wave: result.wave,
    at: Date.now(),
  }
  const localRank = recordLocal(entry)
  if (!isFirebaseConfigured() || result.score <= 0) return localRank
  try {
    const uid = await ensureOnlineUser()
    const { db } = await getFirebase()
    const { ref, runTransaction, query, orderByChild, startAt, get, serverTimestamp } = await import('firebase/database')
    const entryRef = ref(db, `leaderboard/endless/${uid}`)
    await runTransaction(entryRef, (current: { score?: number } | null) => {
      if (current && typeof current.score === 'number' && current.score >= result.score) return undefined
      return { name: profile.displayName, avatar: profile.avatarId, score: result.score, wave: result.wave, at: serverTimestamp() }
    })
    const better = await get(query(ref(db, 'leaderboard/endless'), orderByChild('score'), startAt(result.score + 1)))
    return better.size + 1
  } catch {
    return localRank
  }
}

export async function fetchGlobalTop(limit = GLOBAL_LIMIT): Promise<LeaderboardEntry[]> {
  const { db } = await getFirebase()
  const { ref, query, orderByChild, limitToLast, get } = await import('firebase/database')
  const snapshot = await get(query(ref(db, 'leaderboard/endless'), orderByChild('score'), limitToLast(limit)))
  const entries: LeaderboardEntry[] = []
  snapshot.forEach((child) => {
    const value = child.val() as Partial<LeaderboardEntry>
    if (typeof value.score === 'number' && typeof value.name === 'string') {
      entries.push({
        uid: child.key ?? '',
        name: value.name,
        avatar: (value.avatar as AvatarId) ?? 'hot-cup',
        score: value.score,
        wave: typeof value.wave === 'number' ? value.wave : 1,
        at: typeof value.at === 'number' ? value.at : 0,
      })
    }
  })
  return entries.sort((a, b) => b.score - a.score)
}
