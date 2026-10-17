import type { CupKind } from '../../types'
import { CATCH_HALF_WIDTH, CUP, FIELD_WIDTH, OBSTACLE_HIT_HALF_WIDTH } from '../core/constants'
import type { Rng } from '../core/rng'
import type { CupSpec, DifficultyProfile, PatternId } from '../core/types'
import { swayPhaseForArrival } from './motion'

/** Groups are generated slightly before their first cup appears. */
const LOOKAHEAD_MS = 120
/** Reaction time the fairness check allows between two arrivals (s). */
const REACTION_SLACK_S = 0.14
/** An obstacle never lands this close (time) to a cup the player needs (ms). */
const OBSTACLE_TIME_WINDOW = 750
const OBSTACLE_CLEARANCE = CATCH_HALF_WIDTH + OBSTACLE_HIT_HALF_WIDTH * 0.5 + 10
/** Extra share of the group gap added per cup beyond the first. */
const REST_PER_EXTRA_CUP = 0.3
const MIN_X = CUP.wallMargin
const MAX_X = FIELD_WIDTH - CUP.wallMargin

/** Fixed opening positions for the level-1 tutorial: centre, then right, then left. */
const TUTORIAL_PATH = [FIELD_WIDTH / 2, FIELD_WIDTH / 2 + 120, FIELD_WIDTH / 2 - 120, FIELD_WIDTH / 2 + 60]

export interface WaveOptions {
  cupsPerWave: (wave: number) => number
  breakMs: number
  /** Every n-th wave is a golden bonus wave. */
  bonusEvery: number
}

export interface SpawnerOptions {
  leadInMs: number
  /** The level's catch tolerance; keeps the fairness checks in step with it. */
  catchHalfWidth: number
  /** Number of visual variants for normal cups. */
  normalVariants: number
  tutorial?: boolean
  waves?: WaveOptions
}

interface PlannedCup {
  offset: number
  x: number
  kind?: CupKind
}

interface Arrival {
  t: number
  x: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export class Spawner {
  private queue: CupSpec[] = []
  private nextId = 0
  /** Arrival time (ms) of the next group's first cup. */
  private cursor: number
  private lastGood: Arrival = { t: Number.NEGATIVE_INFINITY, x: FIELD_WIDTH / 2 }
  private recentGood: Arrival[] = []
  private recentObstacles: Arrival[] = []
  private tutorialStep = 0
  private cupsInWave = 0
  private readonly rng: Rng
  private readonly profileAt: () => DifficultyProfile
  private readonly options: SpawnerOptions
  wave = 1

  constructor(rng: Rng, profileAt: () => DifficultyProfile, options: SpawnerOptions) {
    this.rng = rng
    this.profileAt = profileAt
    this.options = options
    this.cursor = options.leadInMs + profileAt().fallMs[1]
  }

  /** Pushes the next group back, e.g. to give the level-15 final wave a breath. */
  delay(ms: number): void {
    this.cursor += ms
  }

  get generatedCount(): number {
    return this.nextId
  }

  /** Generates groups until nothing new could appear before `now` + lookahead. */
  fill(now: number): void {
    for (let guard = 0; guard < 64; guard++) {
      const profile = this.profileAt()
      if (this.cursor - profile.fallMs[1] > now + LOOKAHEAD_MS) return
      this.generateGroup(profile)
    }
  }

  /** Removes and returns the cups whose spawn time has come, in order. */
  popDue(now: number): CupSpec[] {
    const due: CupSpec[] = []
    while (this.queue.length > 0 && this.queue[0].spawnAt <= now) {
      due.push(this.queue.shift() as CupSpec)
    }
    return due
  }

  private generateGroup(profile: DifficultyProfile): void {
    const waves = this.options.waves
    if (waves && this.cupsInWave >= waves.cupsPerWave(this.wave)) {
      this.wave += 1
      this.cupsInWave = 0
      this.cursor += waves.breakMs
    }
    const bonusWave = waves !== undefined && this.wave % waves.bonusEvery === 0

    const pattern: PatternId = this.options.tutorial
      ? 'single'
      : bonusWave
        ? 'rain'
        : this.rng.weighted(profile.patterns)
    const fall = this.rng.range(profile.fallMs[0], profile.fallMs[1])
    const planned = this.plan(pattern, profile)

    let lastArrival = this.cursor
    for (const item of planned) {
      const arrival = this.cursor + item.offset
      const kind: CupKind = item.kind ?? (bonusWave ? 'golden' : this.rollKind(profile))
      const cupFall = pattern === 'rain' ? fall * this.rng.range(0.92, 1.08) : fall
      this.insert(this.buildCup(kind, arrival, cupFall, item.x, profile))
      lastArrival = Math.max(lastArrival, arrival)
    }
    this.cupsInWave += planned.length
    // Bigger patterns earn a longer breather before the next one.
    const rest = 1 + REST_PER_EXTRA_CUP * (planned.length - 1)
    this.cursor = lastArrival + this.rng.range(profile.gapMs[0], profile.gapMs[1]) * rest
  }

  private plan(pattern: PatternId, profile: DifficultyProfile): PlannedCup[] {
    const rng = this.rng
    const gap = () => rng.range(profile.clusterGapMs[0], profile.clusterGapMs[1])
    const anyX = (margin = 0) => rng.range(MIN_X + margin, MAX_X - margin)

    switch (pattern) {
      case 'single': {
        if (this.options.tutorial && this.tutorialStep < TUTORIAL_PATH.length) {
          return [{ offset: 0, x: TUTORIAL_PATH[this.tutorialStep++] }]
        }
        return [{ offset: 0, x: anyX() }]
      }
      case 'pair': {
        if (rng.chance(0.5)) {
          // Two cups side by side: one well-placed basket catches both.
          const centre = anyX(60)
          const half = rng.range(28, 48)
          return [
            { offset: 0, x: centre - half },
            { offset: rng.range(0, 90), x: centre + half },
          ]
        }
        const first = anyX()
        return [
          { offset: 0, x: first },
          { offset: gap(), x: first + rng.sign() * rng.range(140, 300) },
        ]
      }
      case 'stack': {
        const x = anyX(20)
        const g = gap()
        return [0, 0.7, 1.4].map((k) => ({ offset: g * k, x: x + rng.range(-12, 12) }))
      }
      case 'line':
      case 'golden-run': {
        const count = pattern === 'line' ? rng.int(3, 5) : rng.int(3, 4)
        const dir = rng.sign()
        const start = dir > 0 ? rng.range(MIN_X, MIN_X + 120) : rng.range(MAX_X - 120, MAX_X)
        const step = rng.range(70, 115)
        const g = gap()
        return Array.from({ length: count }, (_, k) => ({
          offset: g * k,
          x: start + dir * step * k,
          kind: pattern === 'golden-run' && k === count - 1 ? ('golden' as const) : undefined,
        }))
      }
      case 'zigzag': {
        const count = rng.int(4, 6)
        const centre = rng.range(190, FIELD_WIDTH - 190)
        const amp = rng.range(70, 135)
        const startSide = rng.sign()
        const g = gap()
        return Array.from({ length: count }, (_, k) => ({
          offset: g * k,
          x: centre + startSide * (k % 2 === 0 ? amp : -amp),
        }))
      }
      case 'edges': {
        const leftFirst = rng.chance(0.5)
        const left = rng.range(MIN_X, MIN_X + 60)
        const right = rng.range(MAX_X - 60, MAX_X)
        const second = gap() * 1.6
        return [
          { offset: 0, x: leftFirst ? left : right },
          { offset: second, x: leftFirst ? right : left },
        ]
      }
      case 'rain': {
        const count = rng.int(6, 9)
        let offset = 0
        return Array.from({ length: count }, () => {
          const item = { offset, x: anyX() }
          offset += gap() * rng.range(0.5, 0.9)
          return item
        })
      }
    }
  }

  private rollKind(profile: DifficultyProfile): CupKind {
    const roll = this.rng.next()
    const { obstacle, special, golden } = profile.mix
    if (roll < obstacle) return 'obstacle'
    if (roll < obstacle + special) return 'special'
    if (roll < obstacle + special + golden) return 'golden'
    return 'normal'
  }

  private buildCup(kind: CupKind, arrival: number, fallMs: number, desiredX: number, profile: DifficultyProfile): CupSpec {
    const rng = this.rng
    const id = this.nextId++
    const variant = kind === 'normal' ? rng.int(0, Math.max(0, this.options.normalVariants - 1)) : 0

    let sway: CupSpec['sway'] = null
    if (!this.options.tutorial && rng.chance(profile.swayChance)) {
      const freq = rng.range(profile.swayFreq[0], profile.swayFreq[1])
      sway = { amp: rng.range(profile.swayAmp[0], profile.swayAmp[1]), freq, phase: swayPhaseForArrival(freq, fallMs) }
    }
    const drift = !this.options.tutorial && rng.chance(profile.driftChance) ? rng.sign() * rng.range(0.45, 1) * profile.driftMax : 0
    const burst =
      kind !== 'obstacle' && rng.chance(profile.burstChance)
        ? { at: rng.range(0.42, 0.58), distanceAt: rng.range(0.2, 0.32) }
        : null

    let x: number
    if (kind === 'obstacle') {
      x = this.placeObstacle(arrival, sway?.amp ?? 0)
      this.recentObstacles = [...this.recentObstacles.slice(-5), { t: arrival, x }]
    } else {
      let range = this.reachableRange(arrival, profile.reachSpeed, sway?.amp ?? 0)
      if (!range && sway) {
        sway = null
        range = this.reachableRange(arrival, profile.reachSpeed, 0)
      }
      const [lo, hi] = range ?? [MIN_X, MAX_X]
      x = this.avoidObstacles(clamp(desiredX, lo, hi), arrival, lo, hi)
      this.lastGood = { t: arrival, x }
      this.recentGood = [...this.recentGood.slice(-7), { t: arrival, x }]
    }

    const amp = sway?.amp ?? 0
    const x0 = drift !== 0 ? clamp(x + drift, MIN_X + amp, MAX_X - amp) : x
    return { id, kind, variant, spawnAt: arrival - fallMs, fallMs, x0, x1: x, sway, burst, wave: this.wave }
  }

  /** Where a needed cup may land so a basket moving at `speed` can get there in time. */
  private reachableRange(arrival: number, speed: number, swayAmp: number): [number, number] | null {
    const wallLo = MIN_X + swayAmp
    const wallHi = MAX_X - swayAmp
    if (!Number.isFinite(this.lastGood.t)) return [wallLo, wallHi]
    const dt = (arrival - this.lastGood.t) / 1000
    const maxDx = Math.max(0, dt - REACTION_SLACK_S) * speed + this.options.catchHalfWidth * 0.85
    const lo = Math.max(wallLo, this.lastGood.x - maxDx)
    const hi = Math.min(wallHi, this.lastGood.x + maxDx)
    return lo <= hi ? [lo, hi] : null
  }

  private conflicts(list: Arrival[], arrival: number, x: number): boolean {
    return list.some((a) => Math.abs(a.t - arrival) < OBSTACLE_TIME_WINDOW && Math.abs(a.x - x) < OBSTACLE_CLEARANCE)
  }

  private avoidObstacles(x: number, arrival: number, lo: number, hi: number): number {
    if (!this.conflicts(this.recentObstacles, arrival, x)) return x
    for (let i = 0; i < 12; i++) {
      const candidate = this.rng.range(lo, hi)
      if (!this.conflicts(this.recentObstacles, arrival, candidate)) return candidate
    }
    return x
  }

  private placeObstacle(arrival: number, swayAmp: number): number {
    const lo = MIN_X + swayAmp
    const hi = MAX_X - swayAmp
    let best = this.rng.range(lo, hi)
    let bestDistance = -1
    for (let i = 0; i < 12; i++) {
      const candidate = this.rng.range(lo, hi)
      if (!this.conflicts(this.recentGood, arrival, candidate)) return candidate
      const nearest = Math.min(...this.recentGood.map((g) => Math.abs(g.x - candidate)))
      if (nearest > bestDistance) {
        bestDistance = nearest
        best = candidate
      }
    }
    return best
  }

  private insert(spec: CupSpec): void {
    let lo = 0
    let hi = this.queue.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.queue[mid].spawnAt <= spec.spawnAt) lo = mid + 1
      else hi = mid
    }
    this.queue.splice(lo, 0, spec)
  }
}
