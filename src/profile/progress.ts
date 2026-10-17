import type { SessionResult } from '../game/core/types'
import { LEVEL_COUNT } from '../game/levels/levels'
import type { AchievementId, MatchRecord } from '../types'
import { rewardKeys } from './cosmetics'
import type { Progress } from './types'

export const MATCH_HISTORY_LIMIT = 10

export function createProgress(now = Date.now()): Progress {
  return {
    unlockedLevel: 1,
    completedLevels: [],
    bestScores: {},
    totalCupsCaught: 0,
    totalGoldenCaught: 0,
    totalSpecialCaught: 0,
    gamesPlayed: 0,
    endlessBest: null,
    achievements: {},
    unlockedCosmetics: [],
    matchHistory: [],
    matchStats: { played: 0, wins: 0, losses: 0, ties: 0 },
    campaignCompletedAt: null,
    updatedAt: now,
  }
}

export function isCampaignComplete(progress: Progress): boolean {
  return progress.completedLevels.length >= LEVEL_COUNT
}

export function isEndlessUnlocked(progress: Progress): boolean {
  return isCampaignComplete(progress)
}

/** The level "Play Now" starts: the first uncompleted level, or the last one. */
export function nextPlayableLevel(progress: Progress): number {
  for (let id = 1; id <= Math.min(progress.unlockedLevel, LEVEL_COUNT); id++) {
    if (!progress.completedLevels.includes(id)) return id
  }
  return Math.min(progress.unlockedLevel, LEVEL_COUNT)
}

export function bestScore(progress: Progress): number {
  return Math.max(0, ...Object.values(progress.bestScores))
}

export function campaignTotal(progress: Progress): number {
  return Object.entries(progress.bestScores)
    .filter(([level]) => progress.completedLevels.includes(Number(level)))
    .reduce((sum, [, score]) => sum + score, 0)
}

interface PlayStats {
  caught: number
  goldenCaught: number
  specialCaught: number
}

/** Counts cups from any play-through, including ones the player abandoned. */
export function addPlayStats(progress: Progress, stats: PlayStats, now = Date.now()): Progress {
  return {
    ...progress,
    totalCupsCaught: progress.totalCupsCaught + Math.max(0, stats.caught),
    totalGoldenCaught: progress.totalGoldenCaught + Math.max(0, stats.goldenCaught),
    totalSpecialCaught: progress.totalSpecialCaught + Math.max(0, stats.specialCaught),
    gamesPlayed: progress.gamesPlayed + 1,
    updatedAt: now,
  }
}

export interface CampaignOutcome {
  progress: Progress
  previousBest: number
  newBest: boolean
  firstClear: boolean
  /** A level that became available because of this result. */
  newlyUnlockedLevel: number | null
  campaignJustCompleted: boolean
}

export function applyCampaignResult(progress: Progress, result: SessionResult, now = Date.now()): CampaignOutcome {
  const key = String(result.levelId)
  const previousBest = progress.bestScores[key] ?? 0
  const newBest = result.score > previousBest
  const cleared = result.outcome === 'complete'
  const firstClear = cleared && !progress.completedLevels.includes(result.levelId)

  const completedLevels = firstClear
    ? [...progress.completedLevels, result.levelId].sort((a, b) => a - b)
    : progress.completedLevels
  const unlockedLevel = cleared
    ? Math.max(progress.unlockedLevel, Math.min(LEVEL_COUNT, result.levelId + 1))
    : progress.unlockedLevel
  const campaignJustCompleted =
    cleared && completedLevels.length >= LEVEL_COUNT && progress.campaignCompletedAt === null

  const next: Progress = {
    ...addPlayStats(progress, result, now),
    bestScores: newBest ? { ...progress.bestScores, [key]: result.score } : progress.bestScores,
    completedLevels,
    unlockedLevel,
    campaignCompletedAt: campaignJustCompleted ? now : progress.campaignCompletedAt,
  }
  return {
    progress: next,
    previousBest,
    newBest,
    firstClear,
    newlyUnlockedLevel: unlockedLevel > progress.unlockedLevel ? unlockedLevel : null,
    campaignJustCompleted,
  }
}

export function applyEndlessResult(
  progress: Progress,
  result: SessionResult,
  now = Date.now(),
): { progress: Progress; newBest: boolean; previousBest: number } {
  const previousBest = progress.endlessBest?.score ?? 0
  const newBest = result.score > previousBest
  return {
    progress: {
      ...addPlayStats(progress, result, now),
      endlessBest: newBest ? { score: result.score, wave: result.wave, at: now } : progress.endlessBest,
    },
    newBest,
    previousBest,
  }
}

export function applyMatchResult(progress: Progress, record: MatchRecord, now = Date.now()): Progress {
  if (progress.matchHistory.some((m) => m.id === record.id)) return progress
  const stats = { ...progress.matchStats, played: progress.matchStats.played + 1 }
  if (record.outcome === 'win') stats.wins += 1
  else if (record.outcome === 'loss') stats.losses += 1
  else stats.ties += 1
  return {
    ...progress,
    matchHistory: [record, ...progress.matchHistory].slice(0, MATCH_HISTORY_LIMIT),
    matchStats: stats,
    updatedAt: now,
  }
}

/** Marks achievements as unlocked (with their rewards); returns the ones that are new. */
export function unlockAchievements(
  progress: Progress,
  ids: readonly AchievementId[],
  now = Date.now(),
): { progress: Progress; unlocked: AchievementId[] } {
  const unlocked = [...new Set(ids)].filter((id) => progress.achievements[id] === undefined)
  if (unlocked.length === 0) return { progress, unlocked }
  const achievements = { ...progress.achievements }
  const cosmetics = new Set(progress.unlockedCosmetics)
  for (const id of unlocked) {
    achievements[id] = now
    for (const key of rewardKeys(id)) cosmetics.add(key)
  }
  return {
    progress: { ...progress, achievements, unlockedCosmetics: [...cosmetics], updatedAt: now },
    unlocked,
  }
}

const maxRecord = (a: Record<string, number>, b: Record<string, number>) => {
  const merged: Record<string, number> = { ...a }
  for (const [key, value] of Object.entries(b)) merged[key] = Math.max(merged[key] ?? 0, value)
  return merged
}

/**
 * Combines progress from two places (this device and the cloud). Every rule is
 * order-independent and idempotent — union, maximum, earliest unlock time — so
 * syncing the same data twice never double-counts.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const achievements: Progress['achievements'] = { ...a.achievements }
  for (const [id, at] of Object.entries(b.achievements) as Array<[AchievementId, number]>) {
    const existing = achievements[id]
    achievements[id] = existing === undefined ? at : Math.min(existing, at)
  }
  const history = new Map<string, MatchRecord>()
  for (const record of [...a.matchHistory, ...b.matchHistory]) history.set(record.id, record)
  const endless =
    !a.endlessBest || (b.endlessBest && b.endlessBest.score > a.endlessBest.score) ? b.endlessBest : a.endlessBest
  const completedAt = [a.campaignCompletedAt, b.campaignCompletedAt].filter((v): v is number => v !== null)

  return {
    unlockedLevel: Math.max(a.unlockedLevel, b.unlockedLevel),
    completedLevels: [...new Set([...a.completedLevels, ...b.completedLevels])].sort((x, y) => x - y),
    bestScores: maxRecord(a.bestScores, b.bestScores),
    totalCupsCaught: Math.max(a.totalCupsCaught, b.totalCupsCaught),
    totalGoldenCaught: Math.max(a.totalGoldenCaught, b.totalGoldenCaught),
    totalSpecialCaught: Math.max(a.totalSpecialCaught, b.totalSpecialCaught),
    gamesPlayed: Math.max(a.gamesPlayed, b.gamesPlayed),
    endlessBest: endless ?? null,
    achievements,
    unlockedCosmetics: [...new Set([...a.unlockedCosmetics, ...b.unlockedCosmetics])].sort(),
    matchHistory: [...history.values()].sort((x, y) => y.at - x.at).slice(0, MATCH_HISTORY_LIMIT),
    matchStats: {
      played: Math.max(a.matchStats.played, b.matchStats.played),
      wins: Math.max(a.matchStats.wins, b.matchStats.wins),
      losses: Math.max(a.matchStats.losses, b.matchStats.losses),
      ties: Math.max(a.matchStats.ties, b.matchStats.ties),
    },
    campaignCompletedAt: completedAt.length ? Math.min(...completedAt) : null,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  }
}
