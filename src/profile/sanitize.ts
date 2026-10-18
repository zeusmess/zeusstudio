import { AVATAR_IDS } from '../game/art/badges'
import { LEVEL_COUNT } from '../game/levels/levels'
import type { AchievementId, AvatarId, BasketSkinId, MatchRecord } from '../types'
import { ACHIEVEMENTS } from './achievements'
import { BASKET_ORDER } from './cosmetics'
import { createProgress, MATCH_HISTORY_LIMIT } from './progress'
import type { PlayerProfile, ProfileRecord, Progress } from './types'
import { validateDisplayName } from './validation'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : fallback
const ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENTS.map((a) => a.id))

function sanitizeMatch(raw: unknown): MatchRecord | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  const outcome = raw.outcome === 'win' || raw.outcome === 'loss' || raw.outcome === 'tie' ? raw.outcome : null
  const reason = raw.reason === 'target' || raw.reason === 'time' || raw.reason === 'forfeit' ? raw.reason : null
  const length = raw.length === 'quick' || raw.length === 'classic' || raw.length === 'marathon' ? raw.length : null
  if (!outcome || !reason || !length) return null
  const name = typeof raw.opponentName === 'string' ? validateDisplayName(raw.opponentName) : null
  return {
    id: raw.id.slice(0, 64),
    at: num(raw.at),
    opponentName: name?.ok ? name.value : '—',
    opponentAvatar: AVATAR_IDS.includes(raw.opponentAvatar as AvatarId) ? (raw.opponentAvatar as AvatarId) : 'hot-cup',
    myScore: num(raw.myScore),
    opponentScore: num(raw.opponentScore),
    outcome,
    reason,
    length,
  }
}

/** Rebuilds a valid Progress from untrusted data (storage, network); never throws. */
export function sanitizeProgress(raw: unknown): Progress {
  const base = createProgress(0)
  if (!isObject(raw)) return base
  const completed = Array.isArray(raw.completedLevels)
    ? [...new Set(raw.completedLevels.filter((l): l is number => Number.isInteger(l) && l >= 1 && l <= LEVEL_COUNT))]
    : []
  const bestScores: Record<string, number> = {}
  if (isObject(raw.bestScores)) {
    for (const [key, value] of Object.entries(raw.bestScores)) {
      const level = Number(key)
      if (Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT) bestScores[String(level)] = num(value)
    }
  }
  const achievements: Progress['achievements'] = {}
  if (isObject(raw.achievements)) {
    for (const [id, at] of Object.entries(raw.achievements)) {
      if (ACHIEVEMENT_IDS.has(id)) achievements[id as AchievementId] = num(at)
    }
  }
  const endless = isObject(raw.endlessBest)
    ? { score: num(raw.endlessBest.score), wave: num(raw.endlessBest.wave, 1), at: num(raw.endlessBest.at) }
    : null
  const stats = isObject(raw.matchStats) ? raw.matchStats : {}
  return {
    // Levels open strictly in order, so the next playable level follows from the cleared ones.
    unlockedLevel: Math.max(1, ...completed.map((l) => Math.min(LEVEL_COUNT, l + 1))),
    completedLevels: completed.sort((a, b) => a - b),
    bestScores,
    totalCupsCaught: num(raw.totalCupsCaught),
    totalGoldenCaught: num(raw.totalGoldenCaught),
    totalSpecialCaught: num(raw.totalSpecialCaught),
    gamesPlayed: num(raw.gamesPlayed),
    endlessBest: endless && endless.score > 0 ? endless : null,
    achievements,
    unlockedCosmetics: Array.isArray(raw.unlockedCosmetics)
      ? [...new Set(raw.unlockedCosmetics.filter((c): c is string => typeof c === 'string' && /^(avatar|basket):[a-z-]+$/.test(c)))]
      : [],
    matchHistory: Array.isArray(raw.matchHistory)
      ? raw.matchHistory.map(sanitizeMatch).filter((m): m is MatchRecord => m !== null).slice(0, MATCH_HISTORY_LIMIT)
      : [],
    matchStats: {
      played: num(stats.played),
      wins: num(stats.wins),
      losses: num(stats.losses),
      ties: num(stats.ties),
    },
    campaignCompletedAt: raw.campaignCompletedAt === null ? null : num(raw.campaignCompletedAt) || null,
    updatedAt: num(raw.updatedAt),
  }
}

export function sanitizeProfile(raw: unknown, fallback: PlayerProfile): PlayerProfile {
  if (!isObject(raw)) return fallback
  const name = typeof raw.displayName === 'string' ? validateDisplayName(raw.displayName) : null
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 128) : fallback.id,
    kind: raw.kind === 'google' ? 'google' : 'guest',
    displayName: name?.ok ? name.value : fallback.displayName,
    avatarId: AVATAR_IDS.includes(raw.avatarId as AvatarId) ? (raw.avatarId as AvatarId) : fallback.avatarId,
    basketSkin: BASKET_ORDER.includes(raw.basketSkin as BasketSkinId) ? (raw.basketSkin as BasketSkinId) : 'classic',
    identityChosen: raw.identityChosen === true,
    createdAt: num(raw.createdAt, fallback.createdAt),
    updatedAt: num(raw.updatedAt, fallback.updatedAt),
  }
}

export function sanitizeRecord(raw: unknown, fallback: PlayerProfile): ProfileRecord {
  const value = isObject(raw) ? raw : {}
  return {
    version: 1,
    profile: sanitizeProfile(value.profile, fallback),
    progress: sanitizeProgress(value.progress),
  }
}
