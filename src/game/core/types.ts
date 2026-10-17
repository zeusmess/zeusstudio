import type { CupKind, GameMode } from '../../types'

export type PatternId =
  | 'single'
  | 'pair'
  | 'stack'
  | 'line'
  | 'zigzag'
  | 'edges'
  | 'rain'
  | 'golden-run'

/** Parameters at one end of a level's difficulty ramp. */
export interface DifficultyProfile {
  /** Time a cup takes from appearing to reaching the basket rim (ms). */
  fallMs: [number, number]
  /** Gap between pattern groups, arrival to arrival (ms). */
  gapMs: [number, number]
  /** Gap between cups inside a multi-cup pattern (ms). */
  clusterGapMs: [number, number]
  patterns: Partial<Record<PatternId, number>>
  /** Per-cup chance of each special kind; the rest are normal cups. */
  mix: { golden: number; special: number; obstacle: number }
  swayChance: number
  swayAmp: [number, number]
  swayFreq: [number, number]
  driftChance: number
  driftMax: number
  burstChance: number
  /** Basket speed (units/s) the spawner assumes when keeping cups reachable. */
  reachSpeed: number
}

export type LevelTheme = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'finale' | 'endless' | 'versus'

export interface LevelConfig {
  id: number
  target: number
  lives: number
  theme: LevelTheme
  /** Horizontal tolerance for a catch; tightens on later levels ("higher accuracy"). */
  catchHalfWidth: number
  tutorial?: boolean
  /** Level 15: dramatic final wave once this share of the target is reached. */
  finalWaveAt?: number
  start: DifficultyProfile
  end: DifficultyProfile
}

export interface SessionConfig {
  mode: GameMode
  level: LevelConfig
  /** Lives at start; `Infinity` disables lives (online matches). */
  lives: number
  /** 0 = no target (endless). */
  target: number
  /** 0 = no time limit. */
  timeLimitMs: number
  /** Delay before the first cup appears (ms). */
  leadInMs: number
  /** How the difficulty ramp advances: by score progress, time, or endless waves. */
  ramp: 'score' | 'time' | 'wave'
}

/** Burst: the cup dawdles, then speeds up — arrival time stays the same. */
export interface BurstSpec {
  /** Share of the fall time spent before the burst. */
  at: number
  /** Share of the distance covered before the burst. */
  distanceAt: number
}

export interface SwaySpec {
  amp: number
  freq: number
  phase: number
}

export interface CupSpec {
  /** Sequential, deterministic index — each cup can score at most once. */
  id: number
  kind: CupKind
  /** Visual variant index (normal cups have several drinks). */
  variant: number
  spawnAt: number
  fallMs: number
  x0: number
  x1: number
  sway: SwaySpec | null
  burst: BurstSpec | null
  /** Endless wave the cup belongs to (0 elsewhere). */
  wave: number
}

export type CupState = 'falling' | 'passed'

export interface ActiveCup {
  spec: CupSpec
  state: CupState
  x: number
  y: number
  prevX: number
  prevY: number
  /** Progress along the fall (0 at spawn, 1 at the rim). */
  progress: number
}

export interface BasketState {
  x: number
  prevX: number
  vx: number
}

export interface CatchBreakdown {
  base: number
  multiplier: number
  streakBonus: number
  total: number
}

export type GameEvent =
  | { type: 'spawn'; cup: CupSpec }
  | {
      type: 'catch'
      cupId: number
      kind: CupKind
      variant: number
      x: number
      y: number
      points: CatchBreakdown
      streak: number
      combo: number
      lifeRefilled: boolean
      lives: number
    }
  | { type: 'miss'; cupId: number; kind: CupKind; variant: number; x: number; lives: number }
  | { type: 'obstacleHit'; cupId: number; x: number; lives: number }
  | { type: 'dodge'; cupId: number; x: number }
  | { type: 'multiplier'; multiplier: number; combo: number }
  | { type: 'streak'; streak: number; bonus: number }
  | { type: 'wave'; wave: number; bonus: boolean }
  | { type: 'finalWave' }
  | { type: 'milestone'; score: number }
  | { type: 'complete'; result: SessionResult }
  | { type: 'gameOver'; result: SessionResult }
  | { type: 'timeUp'; result: SessionResult }

export interface SessionResult {
  mode: GameMode
  levelId: number
  score: number
  target: number
  durationMs: number
  caught: number
  missed: number
  goldenCaught: number
  specialCaught: number
  obstaclesHit: number
  bestStreak: number
  bestMultiplier: number
  livesLost: number
  livesLeft: number
  wave: number
  outcome: 'complete' | 'gameOver' | 'timeUp'
}

export interface InputState {
  /** -1 left, 1 right, 0 none — keyboard and on-screen buttons. */
  axis: -1 | 0 | 1
  /** Target x from touch / mouse; null when not pointing. */
  pointerX: number | null
}
