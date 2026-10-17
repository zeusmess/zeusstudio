import { getProfile, loadOrCreateGuest, loadStoredRecord, useProfile } from '../profile/profileStore'
import { createProgress, mergeProgress } from '../profile/progress'
import type { ProfileRecord } from '../profile/types'
import { NAME_MAX, validateDisplayName } from '../profile/validation'
import type { AuthUser } from './authStore'

/** Turns a Google display name into a valid in-game name, if possible. */
export function suggestName(raw: string | null): string | null {
  if (!raw) return null
  const cleaned = [...raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{Nd} _.-]/gu, '').replace(/\s+/gu, ' ').trim()]
    .slice(0, NAME_MAX)
    .join('')
    .trim()
  const result = validateDisplayName(cleaned)
  return result.ok ? result.value : null
}

/**
 * Makes the signed-in Google account the active profile. When the player was
 * a guest on this device, their guest progress is merged into the account
 * (guest-to-account linking) so nothing earned as a guest is lost.
 */
export function activateAccount(user: AuthUser): 'same' | 'linked' | 'welcome' {
  const current = getProfile()
  if (current.profile.kind === 'google' && current.profile.id === user.uid) return 'same'

  const now = Date.now()
  const cached = loadStoredRecord(user.uid)
  const base: ProfileRecord = cached ?? {
    version: 1,
    profile: {
      ...current.profile,
      id: user.uid,
      kind: 'google',
      displayName: current.profile.identityChosen
        ? current.profile.displayName
        : (suggestName(user.displayName) ?? current.profile.displayName),
      createdAt: now,
      updatedAt: now,
    },
    progress: createProgress(now),
  }

  const linking = current.profile.kind === 'guest'
  const record: ProfileRecord = {
    ...base,
    profile: { ...base.profile, id: user.uid, kind: 'google', identityChosen: true },
    progress: linking ? mergeProgress(base.progress, current.progress) : base.progress,
  }
  useProfile.getState().replaceRecord(record)
  return linking && current.progress.gamesPlayed > 0 ? 'linked' : 'welcome'
}

/** Back to this device's guest profile (after signing out). */
export function activateGuest(): void {
  if (getProfile().profile.kind === 'guest') return
  useProfile.getState().replaceRecord(loadOrCreateGuest())
}
