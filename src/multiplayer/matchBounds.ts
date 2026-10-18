import { MAX_MULTIPLIER, POINTS, STREAK } from '../game/core/constants'
import { getLevel } from '../game/levels/levels'
import { MATCH_PRESETS } from '../game/levels/modes'
import type { CupKind, MatchLength } from '../types'

/**
 * Limits the server applies to scores it did not see being earned
 * (database.rules.json). They sit well above perfect play — matchBounds.test.ts
 * replays a flawless player against them — so honest players never hit them,
 * while a modified client cannot post arbitrary numbers.
 */

/** Online match: score ≤ elapsed × rate + headroom (perfect play stays under 0.3/ms). */
export const MATCH_SCORE_PER_MS = 0.35
export const MATCH_SCORE_HEADROOM = 800
/** Cup ids are handed out in falling order; a cup cannot be caught before it could have fallen. */
export const CUP_IDS_PER_MS = 0.002
export const CUP_ID_HEADROOM = 6
/** Endless leaderboard: score ≤ time since the run started × rate + headroom. */
export const ENDLESS_SCORE_PER_MS = 0.3
export const ENDLESS_SCORE_HEADROOM = 2000
/** Allowance for the gap between a device's synced clock and the server's. */
export const CLOCK_SKEW_MS = 1500
/** Catches made just before the time limit may still be arriving this much later. */
export const LATE_WRITE_MS = 6000

/** The most a single catch can be worth in a match of this length. */
export function maxPointsPerCatch(length: MatchLength): number {
  const level = getLevel(MATCH_PRESETS[length].levelId)
  const mixes = [level.start.mix, level.end.mix]
  const best: CupKind = mixes.some((m) => m.special > 0) ? 'special' : mixes.some((m) => m.golden > 0) ? 'golden' : 'normal'
  return POINTS[best] * MAX_MULTIPLIER + STREAK.maxBonus
}

export function maxMatchScoreAt(elapsedMs: number): number {
  return elapsedMs * MATCH_SCORE_PER_MS + MATCH_SCORE_HEADROOM
}

export function maxCupIdAt(elapsedMs: number): number {
  return elapsedMs * CUP_IDS_PER_MS + CUP_ID_HEADROOM
}

export function maxEndlessScoreAt(elapsedMs: number): number {
  return elapsedMs * ENDLESS_SCORE_PER_MS + ENDLESS_SCORE_HEADROOM
}
