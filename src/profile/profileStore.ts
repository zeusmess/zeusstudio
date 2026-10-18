import { create } from 'zustand'
import { getSettings } from '../app/settings'
import type { SessionResult } from '../game/core/types'
import { readJson, safeStorage, writeJson } from '../services/storage'
import type { AchievementId, AvatarId, BasketSkinId, Language, MatchRecord } from '../types'
import { achievementsFromMatch, achievementsFromResult } from './achievements'
import { isAvatarAvailable, isBasketAvailable } from './cosmetics'
import {
  addPlayStats,
  applyCampaignResult,
  applyEndlessResult,
  applyMatchResult,
  createProgress,
  unlockAchievements,
  type CampaignOutcome,
} from './progress'
import { sanitizeRecord } from './sanitize'
import type { PlayerProfile, ProfileRecord } from './types'
import { validateDisplayName, type NameValidation } from './validation'

const ACTIVE_KEY = 'scc:v1:activeProfile'
const GUEST_KEY = 'scc:v1:guestProfile'
export const recordKey = (id: string) => `scc:v1:profile:${id}`

function randomId(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function defaultGuestName(language: Language): string {
  const bytes = new Uint8Array(2)
  globalThis.crypto.getRandomValues(bytes)
  const n = 100 + (((bytes[0] << 8) | bytes[1]) % 900)
  return language === 'ar' ? `باريستا ${n}` : `Barista ${n}`
}

export function createGuestRecord(language: Language, now = Date.now()): ProfileRecord {
  return {
    version: 1,
    profile: {
      id: `guest-${randomId()}`,
      kind: 'guest',
      displayName: defaultGuestName(language),
      avatarId: 'hot-cup',
      basketSkin: 'classic',
      identityChosen: false,
      createdAt: now,
      updatedAt: now,
    },
    progress: createProgress(now),
  }
}

function fallbackProfile(id: string): PlayerProfile {
  const fresh = createGuestRecord(getSettings().language).profile
  return { ...fresh, id }
}

export function loadStoredRecord(id: string): ProfileRecord | null {
  const raw = readJson<unknown>(recordKey(id))
  return raw ? sanitizeRecord(raw, fallbackProfile(id)) : null
}

/** The device's guest profile — created on first launch, kept across sign-in/out. */
export function loadOrCreateGuest(): ProfileRecord {
  const guestId = safeStorage.getItem(GUEST_KEY)
  const existing = guestId ? loadStoredRecord(guestId) : null
  return existing ?? createGuestRecord(getSettings().language)
}

function loadInitialRecord(): ProfileRecord {
  const activeId = safeStorage.getItem(ACTIVE_KEY)
  return (activeId && loadStoredRecord(activeId)) || loadOrCreateGuest()
}

export function persistRecord(record: ProfileRecord): void {
  writeJson(recordKey(record.profile.id), record)
  safeStorage.setItem(ACTIVE_KEY, record.profile.id)
  if (record.profile.kind === 'guest') safeStorage.setItem(GUEST_KEY, record.profile.id)
}

type AchievementListener = (ids: AchievementId[]) => void
const achievementListeners = new Set<AchievementListener>()

/** Notified whenever achievements unlock (the toast layer listens). */
export function onAchievementsUnlocked(listener: AchievementListener): () => void {
  achievementListeners.add(listener)
  return () => achievementListeners.delete(listener)
}

export interface CampaignSummary extends CampaignOutcome {
  achievements: AchievementId[]
}

export interface EndlessSummary {
  newBest: boolean
  previousBest: number
  achievements: AchievementId[]
}

interface ProfileState {
  record: ProfileRecord
  setDisplayName: (raw: string) => NameValidation
  setAvatar: (avatar: AvatarId) => boolean
  setBasket: (skin: BasketSkinId) => boolean
  /** The player picked guest play on the opening screen. */
  chooseGuest: () => void
  unlock: (ids: readonly AchievementId[]) => AchievementId[]
  recordCampaign: (result: SessionResult) => CampaignSummary
  recordEndless: (result: SessionResult) => EndlessSummary
  /** Records an online match once (by id); `play` adds the cups caught in it to the totals. */
  recordMatch: (record: MatchRecord, play?: SessionResult | null) => AchievementId[]
  /** Counts cups from a run the player quit or restarted. */
  recordAbandoned: (result: SessionResult) => void
  resetProgress: () => void
  /** Replace the active record (sync merge, account switch). */
  replaceRecord: (record: ProfileRecord) => void
}

export const useProfile = create<ProfileState>()((set, get) => {
  const commitProgress = (progress: ProfileRecord['progress']) =>
    set((state) => ({ record: { ...state.record, progress } }))

  const notify = (ids: AchievementId[]) => {
    if (ids.length > 0) achievementListeners.forEach((listener) => listener(ids))
  }

  const updateProfile = (patch: Partial<PlayerProfile>) =>
    set((state) => ({
      record: { ...state.record, profile: { ...state.record.profile, ...patch, updatedAt: Date.now() } },
    }))

  return {
    record: loadInitialRecord(),

    setDisplayName: (raw) => {
      const validation = validateDisplayName(raw)
      if (validation.ok) updateProfile({ displayName: validation.value, identityChosen: true })
      return validation
    },

    setAvatar: (avatar) => {
      if (!isAvatarAvailable(avatar, get().record.progress.unlockedCosmetics)) return false
      updateProfile({ avatarId: avatar })
      return true
    },

    setBasket: (skin) => {
      if (!isBasketAvailable(skin, get().record.progress.unlockedCosmetics)) return false
      updateProfile({ basketSkin: skin })
      return true
    },

    chooseGuest: () => updateProfile({ identityChosen: true }),

    unlock: (ids) => {
      const { progress, unlocked } = unlockAchievements(get().record.progress, ids)
      if (unlocked.length > 0) {
        commitProgress(progress)
        notify(unlocked)
      }
      return unlocked
    },

    recordCampaign: (result) => {
      const outcome = applyCampaignResult(get().record.progress, result)
      const { progress, unlocked } = unlockAchievements(outcome.progress, achievementsFromResult(result, outcome.progress))
      commitProgress(progress)
      notify(unlocked)
      return { ...outcome, progress, achievements: unlocked }
    },

    recordEndless: (result) => {
      const outcome = applyEndlessResult(get().record.progress, result)
      const { progress, unlocked } = unlockAchievements(outcome.progress, achievementsFromResult(result, outcome.progress))
      commitProgress(progress)
      notify(unlocked)
      return { newBest: outcome.newBest, previousBest: outcome.previousBest, achievements: unlocked }
    },

    recordMatch: (match, play) => {
      const before = get().record.progress
      if (before.matchHistory.some((m) => m.id === match.id)) return []
      const withStats = play ? addPlayStats(before, play) : before
      const withMatch = applyMatchResult(withStats, match)
      const earned = [
        ...achievementsFromMatch(match.outcome),
        ...(play ? achievementsFromResult(play, withMatch) : []),
      ]
      const { progress, unlocked } = unlockAchievements(withMatch, earned)
      commitProgress(progress)
      notify(unlocked)
      return unlocked
    },

    recordAbandoned: (result) => {
      if (result.caught === 0 && result.durationMs < 3000) return
      const withStats = addPlayStats(get().record.progress, result)
      const { progress, unlocked } = unlockAchievements(
        withStats,
        achievementsFromResult({ ...result, outcome: 'gameOver' }, withStats),
      )
      commitProgress(progress)
      notify(unlocked)
    },

    resetProgress: () => {
      commitProgress(createProgress())
      const { profile } = get().record
      updateProfile({
        avatarId: isAvatarAvailable(profile.avatarId, []) ? profile.avatarId : 'hot-cup',
        basketSkin: 'classic',
      })
    },

    replaceRecord: (record) => set({ record }),
  }
})

useProfile.subscribe((state) => persistRecord(state.record))
persistRecord(useProfile.getState().record)

export function getProfile(): ProfileRecord {
  return useProfile.getState().record
}
