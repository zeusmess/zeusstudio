import type { SessionResult } from '../game/core/types'

/** A finished run, for tests: level 1 cleared with five catches unless overridden. */
export function sessionResult(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    mode: 'campaign',
    levelId: 1,
    score: 500,
    target: 500,
    durationMs: 30_000,
    caught: 5,
    missed: 0,
    goldenCaught: 0,
    specialCaught: 0,
    obstaclesHit: 0,
    bestStreak: 5,
    bestMultiplier: 1,
    livesLost: 0,
    livesLeft: 5,
    wave: 1,
    outcome: 'complete',
    ...overrides,
  }
}
