import { sessionResult } from '../test/fixtures'
import type { MatchRecord } from '../types'
import { applyCampaignResult, applyMatchResult, createProgress, mergeProgress, unlockAchievements } from './progress'
import { sanitizeProgress } from './sanitize'

const NOW = 1_800_000_000_000

const match = (id: string, outcome: MatchRecord['outcome'] = 'win'): MatchRecord => ({
  id,
  at: NOW,
  opponentName: 'Rival',
  opponentAvatar: 'hot-cup',
  myScore: 5600,
  opponentScore: 4100,
  outcome,
  reason: 'target',
  length: 'classic',
})

describe('campaign progress', () => {
  it('unlocks the next level only when a level is cleared', () => {
    const start = createProgress(NOW)
    const failed = applyCampaignResult(start, sessionResult({ outcome: 'gameOver', score: 300 }), NOW)
    expect(failed.progress.unlockedLevel).toBe(1)
    expect(failed.progress.completedLevels).toEqual([])

    const cleared = applyCampaignResult(start, sessionResult(), NOW)
    expect(cleared.progress.unlockedLevel).toBe(2)
    expect(cleared.progress.completedLevels).toEqual([1])
    expect(cleared.firstClear).toBe(true)
    expect(cleared.newlyUnlockedLevel).toBe(2)
  })

  it('keeps the best score per level and counts a replay once', () => {
    let progress = applyCampaignResult(createProgress(NOW), sessionResult({ score: 650 }), NOW).progress
    const replay = applyCampaignResult(progress, sessionResult({ score: 520 }), NOW)
    progress = replay.progress
    expect(progress.bestScores['1']).toBe(650)
    expect(progress.completedLevels).toEqual([1])
    expect(replay.firstClear).toBe(false)
    expect(replay.newBest).toBe(false)
    expect(progress.gamesPlayed).toBe(2)
    expect(progress.totalCupsCaught).toBe(10)
  })

  it('completes the campaign once, at level 15', () => {
    let progress = createProgress(NOW)
    for (let level = 1; level <= 14; level++) {
      progress = applyCampaignResult(progress, sessionResult({ levelId: level, score: 500 + 1000 * (level - 1) }), NOW).progress
    }
    expect(progress.campaignCompletedAt).toBeNull()
    const finale = applyCampaignResult(progress, sessionResult({ levelId: 15, score: 14_600 }), NOW)
    expect(finale.campaignJustCompleted).toBe(true)
    expect(finale.progress.unlockedLevel).toBe(15)
    const again = applyCampaignResult(finale.progress, sessionResult({ levelId: 15, score: 14_700 }), NOW + 1)
    expect(again.campaignJustCompleted).toBe(false)
    expect(again.progress.campaignCompletedAt).toBe(NOW)
  })
})

describe('saving results more than once', () => {
  it('records an online match a single time', () => {
    const once = applyMatchResult(createProgress(NOW), match('K7M2QX-1'), NOW)
    const twice = applyMatchResult(once, match('K7M2QX-1'), NOW)
    expect(twice).toBe(once)
    expect(twice.matchStats).toEqual({ played: 1, wins: 1, losses: 0, ties: 0 })
  })

  it('unlocks an achievement (and its reward) once', () => {
    const first = unlockAchievements(createProgress(NOW), ['golden_catch'], NOW)
    expect(first.unlocked).toEqual(['golden_catch'])
    expect(first.progress.unlockedCosmetics).toContain('avatar:star')
    const second = unlockAchievements(first.progress, ['golden_catch'], NOW + 5)
    expect(second.unlocked).toEqual([])
    expect(second.progress.achievements.golden_catch).toBe(NOW)
  })
})

describe('merging two copies of the same player (sync, sign-in)', () => {
  const device = (() => {
    let p = applyCampaignResult(createProgress(NOW), sessionResult({ score: 700 }), NOW).progress
    p = applyMatchResult(p, match('A-1'), NOW)
    return unlockAchievements(p, ['first_catch'], NOW + 10).progress
  })()
  const cloud = (() => {
    let p = createProgress(NOW)
    for (const level of [1, 2, 3]) p = applyCampaignResult(p, sessionResult({ levelId: level, score: 400 + 1000 * (level - 1) }), NOW).progress
    p = applyMatchResult(p, match('B-1', 'loss'), NOW)
    return unlockAchievements(p, ['first_catch', 'rising_barista'], NOW).progress
  })()

  it('keeps the best of both', () => {
    const merged = mergeProgress(device, cloud)
    expect(merged.completedLevels).toEqual([1, 2, 3])
    expect(merged.unlockedLevel).toBe(4)
    expect(merged.bestScores['1']).toBe(700)
    expect(merged.matchHistory.map((m) => m.id).sort()).toEqual(['A-1', 'B-1'])
    expect(merged.achievements.first_catch).toBe(NOW)
    expect(merged.achievements.rising_barista).toBe(NOW)
  })

  it('gives the same answer whichever copy comes first, and merging again changes nothing', () => {
    const ab = mergeProgress(device, cloud)
    const ba = mergeProgress(cloud, device)
    expect({ ...ab, matchHistory: [] }).toEqual({ ...ba, matchHistory: [] })
    expect(mergeProgress(ab, ab)).toEqual(ab)
    expect(mergeProgress(ab, cloud)).toEqual(ab)
  })
})

describe('reading progress back from the cloud', () => {
  it('keeps best scores the database returns as an array', () => {
    const progress = sanitizeProgress({ unlockedLevel: 3, completedLevels: [1, 2], bestScores: [null, 640, 1720] })
    expect(progress.bestScores).toEqual({ '1': 640, '2': 1720 })
    // What the SDK really returns for {"1": 640}: an array with a hole at 0.
    const sparse: number[] = []
    sparse[1] = 640
    expect(sanitizeProgress({ completedLevels: [1], bestScores: sparse }).bestScores).toEqual({ '1': 640 })
    expect(sanitizeProgress({ bestScores: { '3': 2600 } }).bestScores).toEqual({ '3': 2600 })
  })
})
