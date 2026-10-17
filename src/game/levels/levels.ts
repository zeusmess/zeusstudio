import { CATCH_HALF_WIDTH } from '../core/constants'
import type { DifficultyProfile, LevelConfig, LevelTheme } from '../core/types'

export const LEVEL_COUNT = 15
export const FIRST_TARGET = 500
export const TARGET_STEP = 1000

/** Level n needs 500 + 1,000 × (n − 1) points: 500, 1,500 … 14,500. */
export function targetForLevel(levelId: number): number {
  return FIRST_TARGET + TARGET_STEP * (levelId - 1)
}

const BASE: DifficultyProfile = {
  fallMs: [5200, 5600],
  gapMs: [2600, 3000],
  clusterGapMs: [460, 600],
  patterns: { single: 1 },
  mix: { golden: 0, special: 0, obstacle: 0 },
  swayChance: 0,
  swayAmp: [28, 56],
  swayFreq: [0.32, 0.55],
  driftChance: 0,
  driftMax: 110,
  burstChance: 0,
  reachSpeed: 340,
}

function profile(overrides: Partial<DifficultyProfile>): DifficultyProfile {
  return {
    ...BASE,
    ...overrides,
    mix: { ...BASE.mix, ...overrides.mix },
  }
}

interface LevelSpec {
  theme: LevelTheme
  lives?: number
  tutorial?: boolean
  finalWaveAt?: number
  start: Partial<DifficultyProfile>
  end: Partial<DifficultyProfile>
}

/**
 * Difficulty plan (see README "Level design"):
 *  1     slow, predictable, tutorial
 *  2–3   faster, varied positions, small clusters
 *  4–5   more cups at once, golden cups, faster falls
 *  6–8   mixed cup types, richer patterns, sway & drift
 *  9–11  denser spawns, advanced combinations, tighter accuracy
 *  12–14 faster cups, speed bursts, fair obstacles
 *  15    finale with a dramatic final wave
 */
const SPECS: LevelSpec[] = [
  {
    theme: 'morning',
    tutorial: true,
    start: { fallMs: [5600, 6000], gapMs: [4710, 5450], reachSpeed: 320 },
    end: { fallMs: [5000, 5400], gapMs: [4090, 4830], reachSpeed: 360 },
  },
  {
    theme: 'morning',
    start: {
      fallMs: [4800, 5200],
      gapMs: [4220, 4840],
      clusterGapMs: [520, 660],
      patterns: { single: 0.72, pair: 0.28 },
      reachSpeed: 380,
    },
    end: {
      fallMs: [4300, 4700],
      gapMs: [3590, 4220],
      clusterGapMs: [480, 620],
      patterns: { single: 0.55, pair: 0.3, stack: 0.15 },
      reachSpeed: 420,
    },
  },
  {
    theme: 'noon',
    start: {
      fallMs: [4400, 4800],
      gapMs: [4090, 4740],
      clusterGapMs: [480, 620],
      patterns: { single: 0.5, pair: 0.3, stack: 0.2 },
      reachSpeed: 420,
    },
    end: {
      fallMs: [3900, 4300],
      gapMs: [3520, 4170],
      clusterGapMs: [440, 580],
      patterns: { single: 0.4, pair: 0.3, stack: 0.15, line: 0.15 },
      reachSpeed: 460,
    },
  },
  {
    theme: 'noon',
    start: {
      fallMs: [4000, 4400],
      gapMs: [4160, 4860],
      clusterGapMs: [440, 580],
      patterns: { single: 0.35, pair: 0.35, stack: 0.15, line: 0.15 },
      mix: { golden: 0.05, special: 0, obstacle: 0 },
      reachSpeed: 460,
    },
    end: {
      fallMs: [3550, 3950],
      gapMs: [3630, 4240],
      clusterGapMs: [420, 540],
      patterns: { single: 0.3, pair: 0.35, line: 0.2, stack: 0.15 },
      mix: { golden: 0.07, special: 0, obstacle: 0 },
      reachSpeed: 500,
    },
  },
  {
    theme: 'afternoon',
    start: {
      fallMs: [3700, 4100],
      gapMs: [4440, 5230],
      clusterGapMs: [420, 540],
      patterns: { single: 0.3, pair: 0.3, line: 0.2, stack: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0, obstacle: 0 },
      reachSpeed: 500,
    },
    end: {
      fallMs: [3300, 3700],
      gapMs: [3840, 4530],
      clusterGapMs: [400, 520],
      patterns: { single: 0.25, pair: 0.3, line: 0.2, zigzag: 0.1, 'golden-run': 0.15 },
      mix: { golden: 0.08, special: 0, obstacle: 0 },
      reachSpeed: 540,
    },
  },
  {
    theme: 'afternoon',
    start: {
      fallMs: [3500, 3900],
      gapMs: [4600, 5450],
      clusterGapMs: [400, 520],
      patterns: { single: 0.25, pair: 0.25, line: 0.2, zigzag: 0.15, 'golden-run': 0.1, stack: 0.05 },
      mix: { golden: 0.06, special: 0.015, obstacle: 0 },
      swayChance: 0.08,
      reachSpeed: 540,
    },
    end: {
      fallMs: [3150, 3500],
      gapMs: [3950, 4700],
      clusterGapMs: [380, 500],
      patterns: { single: 0.2, pair: 0.25, line: 0.2, zigzag: 0.2, 'golden-run': 0.15 },
      mix: { golden: 0.07, special: 0.02, obstacle: 0 },
      swayChance: 0.14,
      reachSpeed: 570,
    },
  },
  {
    theme: 'afternoon',
    start: {
      fallMs: [3350, 3700],
      gapMs: [3950, 4720],
      clusterGapMs: [380, 500],
      patterns: { single: 0.2, pair: 0.25, line: 0.2, zigzag: 0.2, 'golden-run': 0.1, stack: 0.05 },
      mix: { golden: 0.06, special: 0.02, obstacle: 0 },
      swayChance: 0.12,
      driftChance: 0.06,
      reachSpeed: 570,
    },
    end: {
      fallMs: [3000, 3350],
      gapMs: [3380, 4050],
      clusterGapMs: [360, 480],
      patterns: { single: 0.2, pair: 0.2, line: 0.2, zigzag: 0.25, 'golden-run': 0.15 },
      mix: { golden: 0.07, special: 0.025, obstacle: 0 },
      swayChance: 0.2,
      driftChance: 0.1,
      reachSpeed: 600,
    },
  },
  {
    theme: 'evening',
    start: {
      fallMs: [3200, 3550],
      gapMs: [3650, 4410],
      clusterGapMs: [360, 480],
      patterns: { single: 0.2, pair: 0.2, line: 0.2, zigzag: 0.2, edges: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.02, obstacle: 0 },
      swayChance: 0.18,
      driftChance: 0.1,
      reachSpeed: 600,
    },
    end: {
      fallMs: [2900, 3200],
      gapMs: [3180, 3740],
      clusterGapMs: [340, 460],
      patterns: { single: 0.15, pair: 0.2, line: 0.2, zigzag: 0.25, edges: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.025, obstacle: 0 },
      swayChance: 0.25,
      driftChance: 0.15,
      reachSpeed: 630,
    },
  },
  {
    theme: 'evening',
    start: {
      fallMs: [3050, 3400],
      gapMs: [3580, 4270],
      clusterGapMs: [340, 460],
      patterns: { single: 0.15, pair: 0.2, line: 0.2, zigzag: 0.2, edges: 0.1, rain: 0.05, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.025, obstacle: 0 },
      swayChance: 0.22,
      driftChance: 0.12,
      reachSpeed: 630,
    },
    end: {
      fallMs: [2800, 3100],
      gapMs: [3080, 3680],
      clusterGapMs: [320, 440],
      patterns: { single: 0.1, pair: 0.2, line: 0.2, zigzag: 0.25, edges: 0.1, rain: 0.05, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.03, obstacle: 0 },
      swayChance: 0.28,
      driftChance: 0.16,
      reachSpeed: 660,
    },
  },
  {
    theme: 'evening',
    start: {
      fallMs: [2950, 3300],
      gapMs: [3670, 4410],
      clusterGapMs: [330, 450],
      patterns: { single: 0.15, pair: 0.2, line: 0.2, zigzag: 0.2, edges: 0.1, rain: 0.05, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.025, obstacle: 0 },
      swayChance: 0.25,
      driftChance: 0.14,
      reachSpeed: 650,
    },
    end: {
      fallMs: [2700, 3000],
      gapMs: [3120, 3770],
      clusterGapMs: [310, 420],
      patterns: { single: 0.1, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.1, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.03, obstacle: 0 },
      swayChance: 0.3,
      driftChance: 0.18,
      reachSpeed: 680,
    },
  },
  {
    theme: 'night',
    start: {
      fallMs: [2850, 3200],
      gapMs: [3330, 4060],
      clusterGapMs: [320, 440],
      patterns: { single: 0.1, pair: 0.2, line: 0.2, zigzag: 0.2, edges: 0.1, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.03, obstacle: 0 },
      swayChance: 0.28,
      driftChance: 0.16,
      reachSpeed: 670,
    },
    end: {
      fallMs: [2600, 2900],
      gapMs: [2910, 3540],
      clusterGapMs: [300, 410],
      patterns: { single: 0.1, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.1, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.035, obstacle: 0 },
      swayChance: 0.32,
      driftChance: 0.2,
      reachSpeed: 700,
    },
  },
  {
    theme: 'night',
    start: {
      fallMs: [2750, 3100],
      gapMs: [3120, 3830],
      clusterGapMs: [310, 430],
      patterns: { single: 0.1, pair: 0.2, line: 0.2, zigzag: 0.2, edges: 0.1, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.03, obstacle: 0.03 },
      swayChance: 0.28,
      driftChance: 0.16,
      burstChance: 0.08,
      reachSpeed: 680,
    },
    end: {
      fallMs: [2500, 2800],
      gapMs: [2720, 3320],
      clusterGapMs: [300, 400],
      patterns: { single: 0.1, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.1, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.035, obstacle: 0.05 },
      swayChance: 0.32,
      driftChance: 0.2,
      burstChance: 0.12,
      reachSpeed: 710,
    },
  },
  {
    theme: 'night',
    start: {
      fallMs: [2650, 3000],
      gapMs: [2750, 3380],
      clusterGapMs: [300, 420],
      patterns: { single: 0.1, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.1, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.03, obstacle: 0.04 },
      swayChance: 0.3,
      driftChance: 0.18,
      burstChance: 0.1,
      reachSpeed: 690,
    },
    end: {
      fallMs: [2400, 2700],
      gapMs: [2380, 2930],
      clusterGapMs: [290, 390],
      patterns: { single: 0.05, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.15, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.035, obstacle: 0.06 },
      swayChance: 0.34,
      driftChance: 0.22,
      burstChance: 0.15,
      reachSpeed: 720,
    },
  },
  {
    theme: 'night',
    start: {
      fallMs: [2550, 2900],
      gapMs: [2890, 3590],
      clusterGapMs: [290, 410],
      patterns: { single: 0.05, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.15, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.06, special: 0.03, obstacle: 0.05 },
      swayChance: 0.32,
      driftChance: 0.2,
      burstChance: 0.12,
      reachSpeed: 700,
    },
    end: {
      fallMs: [2300, 2600],
      gapMs: [2490, 3090],
      clusterGapMs: [280, 380],
      patterns: { single: 0.05, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.15, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.035, obstacle: 0.07 },
      swayChance: 0.36,
      driftChance: 0.24,
      burstChance: 0.18,
      reachSpeed: 730,
    },
  },
  {
    theme: 'finale',
    finalWaveAt: 0.75,
    start: {
      fallMs: [2450, 2800],
      gapMs: [3310, 4130],
      clusterGapMs: [280, 400],
      patterns: { single: 0.05, pair: 0.15, line: 0.2, zigzag: 0.25, edges: 0.15, rain: 0.1, 'golden-run': 0.1 },
      mix: { golden: 0.07, special: 0.035, obstacle: 0.05 },
      swayChance: 0.34,
      driftChance: 0.22,
      burstChance: 0.14,
      reachSpeed: 710,
    },
    end: {
      fallMs: [2250, 2550],
      gapMs: [2840, 3540],
      clusterGapMs: [270, 370],
      patterns: { single: 0.05, pair: 0.1, line: 0.2, zigzag: 0.25, edges: 0.15, rain: 0.15, 'golden-run': 0.1 },
      mix: { golden: 0.08, special: 0.04, obstacle: 0.06 },
      swayChance: 0.36,
      driftChance: 0.24,
      burstChance: 0.18,
      reachSpeed: 740,
    },
  },
]

/** Catch tolerance per level band: generous early, tighter from level 9 and 12. */
export function catchToleranceFor(levelId: number): number {
  if (levelId >= 12) return CATCH_HALF_WIDTH - 6
  if (levelId >= 9) return CATCH_HALF_WIDTH - 3
  return CATCH_HALF_WIDTH
}

export const LEVELS: readonly LevelConfig[] = SPECS.map((spec, index) => ({
  id: index + 1,
  target: targetForLevel(index + 1),
  lives: spec.lives ?? 5,
  theme: spec.theme,
  catchHalfWidth: catchToleranceFor(index + 1),
  tutorial: spec.tutorial,
  finalWaveAt: spec.finalWaveAt,
  start: profile(spec.start),
  end: profile(spec.end),
}))

export function getLevel(levelId: number): LevelConfig {
  const level = LEVELS[levelId - 1]
  if (!level) throw new RangeError(`Unknown level ${levelId}`)
  return level
}

/** Level 15's closing wave: a dense, golden-rich storm of cups. */
export const FINAL_WAVE_PROFILE: DifficultyProfile = profile({
  fallMs: [2250, 2500],
  gapMs: [1050, 1300],
  clusterGapMs: [250, 330],
  patterns: { rain: 0.35, 'golden-run': 0.2, zigzag: 0.2, line: 0.15, edges: 0.1 },
  mix: { golden: 0.14, special: 0.04, obstacle: 0.04 },
  swayChance: 0.3,
  driftChance: 0.2,
  burstChance: 0.12,
  reachSpeed: 760,
})
