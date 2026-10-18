import type { MatchLength } from '../../types'
import type { DifficultyProfile, LevelConfig, SessionConfig } from '../core/types'
import type { WaveOptions } from '../systems/spawner'
import { lerpProfile } from '../systems/difficulty'
import { catchToleranceFor, getLevel, LEVELS } from './levels'

/* ---------------------------------- Endless --------------------------------- */

const ENDLESS_CAP: DifficultyProfile = {
  ...LEVELS[14].end,
  fallMs: [1850, 2100],
  gapMs: [1500, 1900],
  clusterGapMs: [240, 320],
  mix: { golden: 0.08, special: 0.04, obstacle: 0.1 },
  burstChance: 0.25,
  reachSpeed: 820,
}

export const ENDLESS_LEVEL: LevelConfig = {
  id: 0,
  target: 0,
  lives: 5,
  theme: 'endless',
  catchHalfWidth: catchToleranceFor(10),
  start: LEVELS[3].start,
  end: ENDLESS_CAP,
}

/** Waves 1–12 climb from level-4 pace to the level-15 finale; later waves keep tightening to a cap. */
export function endlessProfile(wave: number): DifficultyProfile {
  if (wave <= 12) return lerpProfile(LEVELS[3].start, LEVELS[14].end, (wave - 1) / 11)
  return lerpProfile(LEVELS[14].end, ENDLESS_CAP, Math.min(1, (wave - 12) / 18))
}

export const ENDLESS_WAVES: WaveOptions = {
  cupsPerWave: (wave) => 10 + Math.min(12, wave),
  breakMs: 2600,
  bonusEvery: 5,
}

/** Score milestones celebrated during an endless run. */
export const ENDLESS_MILESTONES = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000] as const

/* ---------------------------------- Versus ---------------------------------- */

export interface MatchPreset {
  levelId: number
  target: number
  timeLimitMs: number
}

/** Online matches replay a campaign level's difficulty on a shared seed and clock. */
export const MATCH_PRESETS: Record<MatchLength, MatchPreset> = {
  quick: { levelId: 3, target: getLevel(3).target, timeLimitMs: 90_000 },
  classic: { levelId: 6, target: getLevel(6).target, timeLimitMs: 150_000 },
  marathon: { levelId: 10, target: getLevel(10).target, timeLimitMs: 210_000 },
}

/* ---------------------------------- Factory --------------------------------- */

export type PlayRequest =
  | { mode: 'campaign'; levelId: number; seed: number }
  | { mode: 'endless'; seed: number }
  | { mode: 'versus'; length: MatchLength; seed: number; roomCode: string; round: number }

export function sessionConfigFor(request: PlayRequest): SessionConfig {
  switch (request.mode) {
    case 'campaign': {
      const level = getLevel(request.levelId)
      return {
        mode: 'campaign',
        level,
        lives: level.lives,
        target: level.target,
        timeLimitMs: 0,
        leadInMs: level.tutorial ? 1600 : 900,
        ramp: 'score',
      }
    }
    case 'endless':
      return {
        mode: 'endless',
        level: ENDLESS_LEVEL,
        lives: ENDLESS_LEVEL.lives,
        target: 0,
        timeLimitMs: 0,
        leadInMs: 900,
        ramp: 'wave',
      }
    case 'versus': {
      const preset = MATCH_PRESETS[request.length]
      return {
        mode: 'versus',
        level: { ...getLevel(preset.levelId), theme: 'versus' },
        lives: Number.POSITIVE_INFINITY,
        target: preset.target,
        timeLimitMs: preset.timeLimitMs,
        leadInMs: 900,
        ramp: 'time',
      }
    }
  }
}
