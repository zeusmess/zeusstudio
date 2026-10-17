import { FINAL_WAVE_PROFILE } from '../levels/levels'
import { ENDLESS_MILESTONES, ENDLESS_WAVES, endlessProfile } from '../levels/modes'
import { stepBasket } from '../systems/basket'
import { landsInBasket, reachesRim } from '../systems/collision'
import { lerpProfile } from '../systems/difficulty'
import { progressAt, xAt, yAt } from '../systems/motion'
import { nextCombo, scoreCatch } from '../systems/scoring'
import { Spawner } from '../systems/spawner'
import {
  CATCH_Y,
  COMBO_WINDOW_MS,
  FIELD_WIDTH,
  GROUND_Y,
  LIFE_REFILL_STREAK,
  MAX_FRAME_MS,
  SIM_STEP_MS,
} from './constants'
import { Rng } from './rng'
import type {
  ActiveCup,
  BasketState,
  CupSpec,
  DifficultyProfile,
  GameEvent,
  InputState,
  SessionConfig,
  SessionResult,
} from './types'

export type SessionStatus = 'ready' | 'running' | 'complete' | 'over' | 'timeup'

export interface SessionOptions {
  /** How many visual variants normal cups cycle through. */
  normalVariants?: number
}

/**
 * One play-through of a level, an endless run or an online match.
 * Pure TypeScript — no rendering — so it is deterministic and unit-testable.
 * Restarting a level means creating a new session: no state leaks between runs.
 */
export class GameSession {
  readonly config: SessionConfig
  readonly seed: number
  status: SessionStatus = 'ready'
  /** Simulation time since the session started (ms). */
  time = 0
  score = 0
  lives: number
  readonly maxLives: number
  streak = 0
  bestStreak = 0
  combo = 0
  multiplier = 1
  bestMultiplier = 1
  caught = 0
  missed = 0
  goldenCaught = 0
  specialCaught = 0
  obstaclesHit = 0
  livesLost = 0
  wave = 1
  finalWaveActive = false

  readonly basket: BasketState = { x: FIELD_WIDTH / 2, prevX: FIELD_WIDTH / 2, vx: 0 }
  readonly cups: ActiveCup[] = []
  readonly input: InputState = { axis: 0, pointerX: null }

  private accumulator = 0
  private lastCatchAt = Number.NEGATIVE_INFINITY
  private events: GameEvent[] = []
  private readonly spawner: Spawner
  /** Every cup id that has already scored — a cup can never score twice. */
  private readonly scoredCupIds = new Set<number>()
  private milestoneIndex = 0
  private ended = false
  private profileKey = ''
  private profileCache: DifficultyProfile | null = null

  constructor(config: SessionConfig, seed: number, options: SessionOptions = {}) {
    this.config = config
    this.seed = seed
    this.lives = config.lives
    this.maxLives = config.lives
    this.spawner = new Spawner(new Rng(seed), () => this.currentProfile(), {
      leadInMs: config.leadInMs,
      catchHalfWidth: config.level.catchHalfWidth,
      normalVariants: options.normalVariants ?? 8,
      tutorial: config.level.tutorial,
      waves: config.mode === 'endless' ? ENDLESS_WAVES : undefined,
    })
  }

  /* --------------------------------- control -------------------------------- */

  start(): void {
    if (this.status === 'ready') this.status = 'running'
  }

  get running(): boolean {
    return this.status === 'running'
  }

  /** True once the session has emitted its single end event. */
  get hasEnded(): boolean {
    return this.ended
  }

  /** 0..1 progress towards the target (0 when there is none). */
  get progress(): number {
    return this.config.target > 0 ? Math.min(1, this.score / this.config.target) : 0
  }

  /** Interpolation factor between the last two simulation steps, for smooth rendering. */
  get alpha(): number {
    return this.accumulator / SIM_STEP_MS
  }

  setAxis(axis: -1 | 0 | 1): void {
    this.input.axis = axis
    if (axis !== 0) this.input.pointerX = null
  }

  setPointer(x: number | null): void {
    this.input.pointerX = x
    if (x !== null) this.input.axis = 0
  }

  /** Advances by real elapsed time; long hitches are capped (single player). */
  advance(elapsedMs: number, maxFrameMs: number = MAX_FRAME_MS): void {
    if (this.status !== 'running') return
    this.accumulator += Math.min(Math.max(elapsedMs, 0), maxFrameMs)
    while (this.accumulator >= SIM_STEP_MS && this.status === 'running') {
      this.accumulator -= SIM_STEP_MS
      this.step()
    }
  }

  /** Catches up to a shared clock (online matches keep both players in sync). */
  advanceTo(targetTimeMs: number, maxCatchUpMs = 8000): void {
    const behind = targetTimeMs - (this.time + this.accumulator)
    if (behind > 0) this.advance(behind, maxCatchUpMs)
  }

  drainEvents(): GameEvent[] {
    const drained = this.events
    this.events = []
    return drained
  }

  /* ---------------------------------- step ---------------------------------- */

  private step(): void {
    this.time += SIM_STEP_MS
    stepBasket(this.basket, this.input, SIM_STEP_MS / 1000)
    this.maybeStartFinalWave()
    this.spawner.fill(this.time)
    for (const spec of this.spawner.popDue(this.time)) this.spawn(spec)
    this.moveCups()
    this.expireCombo()
    this.checkEnd()
  }

  private currentProfile(): DifficultyProfile {
    const { level, ramp, target, timeLimitMs } = this.config
    let key: string
    if (this.finalWaveActive) key = 'final'
    else if (ramp === 'wave') key = `wave:${this.spawner ? this.spawner.wave : 1}`
    else {
      const t = ramp === 'score' ? (target > 0 ? this.score / target : 0) : timeLimitMs > 0 ? this.time / timeLimitMs : 0
      key = `ramp:${Math.round(Math.min(1, Math.max(0, t)) * 100)}`
    }
    if (key === this.profileKey && this.profileCache) return this.profileCache

    let profile: DifficultyProfile
    if (key === 'final') profile = FINAL_WAVE_PROFILE
    else if (key.startsWith('wave:')) profile = endlessProfile(Number(key.slice(5)))
    else profile = lerpProfile(level.start, level.end, Number(key.slice(5)) / 100)
    this.profileKey = key
    this.profileCache = profile
    return profile
  }

  private spawn(spec: CupSpec): void {
    if (spec.wave > this.wave) {
      this.wave = spec.wave
      this.events.push({ type: 'wave', wave: spec.wave, bonus: spec.wave % ENDLESS_WAVES.bonusEvery === 0 })
    }
    const since = this.time - spec.spawnAt
    const progress = progressAt(spec, since)
    const x = xAt(spec, since)
    const y = yAt(progress)
    this.cups.push({ spec, state: 'falling', x, y, prevX: x, prevY: y, progress })
    this.events.push({ type: 'spawn', cup: spec })
  }

  private moveCups(): void {
    for (let i = 0; i < this.cups.length; i++) {
      const cup = this.cups[i]
      const since = this.time - cup.spec.spawnAt
      const previousProgress = cup.progress
      cup.prevX = cup.x
      cup.prevY = cup.y
      cup.progress = progressAt(cup.spec, since)
      cup.x = xAt(cup.spec, since)
      cup.y = yAt(cup.progress)

      if (cup.state === 'falling' && reachesRim(previousProgress, cup.progress)) {
        if (landsInBasket(cup.spec.kind, cup.x, this.basket.x, this.config.level.catchHalfWidth)) {
          this.cups.splice(i, 1)
          i--
          if (cup.spec.kind === 'obstacle') this.hitObstacle(cup)
          else this.catchCup(cup)
          continue
        }
        cup.state = 'passed'
      }

      if (cup.state === 'passed' && cup.y >= GROUND_Y) {
        this.cups.splice(i, 1)
        i--
        if (cup.spec.kind === 'obstacle') this.events.push({ type: 'dodge', cupId: cup.spec.id, x: cup.x })
        else this.missCup(cup)
      }
    }
  }

  private catchCup(cup: ActiveCup): void {
    if (this.scoredCupIds.has(cup.spec.id)) return
    this.scoredCupIds.add(cup.spec.id)

    this.combo = nextCombo(this.combo, this.lastCatchAt, this.time)
    this.lastCatchAt = this.time
    this.streak += 1
    this.bestStreak = Math.max(this.bestStreak, this.streak)

    const points = scoreCatch(cup.spec.kind, this.combo, this.streak)
    this.score += points.total
    this.caught += 1
    if (cup.spec.kind === 'golden') this.goldenCaught += 1
    if (cup.spec.kind === 'special') this.specialCaught += 1

    const previousMultiplier = this.multiplier
    this.multiplier = points.multiplier
    this.bestMultiplier = Math.max(this.bestMultiplier, points.multiplier)

    let lifeRefilled = false
    if (this.streak % LIFE_REFILL_STREAK === 0 && Number.isFinite(this.maxLives) && this.lives < this.maxLives) {
      this.lives += 1
      lifeRefilled = true
    }

    this.events.push({
      type: 'catch',
      cupId: cup.spec.id,
      kind: cup.spec.kind,
      variant: cup.spec.variant,
      x: cup.x,
      y: CATCH_Y,
      points,
      streak: this.streak,
      combo: this.combo,
      lifeRefilled,
      lives: this.lives,
    })
    if (points.multiplier !== previousMultiplier) {
      this.events.push({ type: 'multiplier', multiplier: points.multiplier, combo: this.combo })
    }
    if (points.streakBonus > 0) this.events.push({ type: 'streak', streak: this.streak, bonus: points.streakBonus })
    this.checkMilestones()
  }

  private missCup(cup: ActiveCup): void {
    this.missed += 1
    this.breakStreak()
    this.loseLife()
    this.events.push({
      type: 'miss',
      cupId: cup.spec.id,
      kind: cup.spec.kind,
      variant: cup.spec.variant,
      x: cup.x,
      lives: this.lives,
    })
  }

  private hitObstacle(cup: ActiveCup): void {
    this.obstaclesHit += 1
    this.breakStreak()
    this.loseLife()
    this.events.push({ type: 'obstacleHit', cupId: cup.spec.id, x: cup.x, lives: this.lives })
  }

  private breakStreak(): void {
    this.streak = 0
    this.combo = 0
    this.lastCatchAt = Number.NEGATIVE_INFINITY
    if (this.multiplier !== 1) {
      this.multiplier = 1
      this.events.push({ type: 'multiplier', multiplier: 1, combo: 0 })
    }
  }

  private loseLife(): void {
    if (!Number.isFinite(this.lives)) return
    this.lives = Math.max(0, this.lives - 1)
    this.livesLost += 1
  }

  private expireCombo(): void {
    if (this.combo > 0 && this.time - this.lastCatchAt > COMBO_WINDOW_MS) {
      this.combo = 0
      if (this.multiplier !== 1) {
        this.multiplier = 1
        this.events.push({ type: 'multiplier', multiplier: 1, combo: 0 })
      }
    }
  }

  private maybeStartFinalWave(): void {
    const at = this.config.level.finalWaveAt
    if (!at || this.finalWaveActive || this.config.target <= 0) return
    if (this.score >= this.config.target * at) {
      this.finalWaveActive = true
      this.spawner.delay(1400)
      this.events.push({ type: 'finalWave' })
    }
  }

  private checkMilestones(): void {
    if (this.config.mode !== 'endless') return
    while (this.milestoneIndex < ENDLESS_MILESTONES.length && this.score >= ENDLESS_MILESTONES[this.milestoneIndex]) {
      this.events.push({ type: 'milestone', score: ENDLESS_MILESTONES[this.milestoneIndex] })
      this.milestoneIndex += 1
    }
  }

  private checkEnd(): void {
    if (this.ended) return
    const { target, timeLimitMs } = this.config
    if (target > 0 && this.score >= target) this.finish('complete')
    else if (this.lives <= 0) this.finish('gameOver')
    else if (timeLimitMs > 0 && this.time >= timeLimitMs) this.finish('timeUp')
  }

  private finish(outcome: SessionResult['outcome']): void {
    this.ended = true
    this.status = outcome === 'complete' ? 'complete' : outcome === 'gameOver' ? 'over' : 'timeup'
    const result = this.result(outcome)
    if (outcome === 'complete') this.events.push({ type: 'complete', result })
    else if (outcome === 'gameOver') this.events.push({ type: 'gameOver', result })
    else this.events.push({ type: 'timeUp', result })
  }

  result(outcome: SessionResult['outcome']): SessionResult {
    return {
      mode: this.config.mode,
      levelId: this.config.level.id,
      score: this.score,
      target: this.config.target,
      durationMs: Math.round(this.time),
      caught: this.caught,
      missed: this.missed,
      goldenCaught: this.goldenCaught,
      specialCaught: this.specialCaught,
      obstaclesHit: this.obstaclesHit,
      bestStreak: this.bestStreak,
      bestMultiplier: this.bestMultiplier,
      livesLost: this.livesLost,
      livesLeft: Number.isFinite(this.lives) ? this.lives : 0,
      wave: this.wave,
      outcome,
    }
  }
}
