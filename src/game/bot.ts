import { CATCH_HALF_WIDTH, OBSTACLE_HIT_HALF_WIDTH } from './core/constants'
import type { GameSession } from './core/GameSession'
import { Rng } from './core/rng'
import type { ActiveCup } from './core/types'
import { arrivalTime, arrivalX } from './systems/motion'

/**
 * A simulated player. It only ever moves the basket like a finger would —
 * it has no way to score other than catching cups — so it is used for the
 * balance simulation (scripts/simulate-balance.ts) and end-to-end tests.
 */
export interface BotSkill {
  /** Time after a cup appears before the bot reacts to it (ms). */
  reactionMs: number
  /** Standard deviation of where the bot aims (units). */
  aimError: number
  /** Chance of misjudging a cup completely. */
  lapse: number
  /** Extra misjudge chance for cups that speed up mid-fall. */
  burstLapse: number
  /** How fast the bot's "finger" moves (units/s). */
  handSpeed: number
  /** Chance of not noticing an obstacle. */
  obstacleMistake: number
  /** Hesitation before chasing a new cup after the previous one (ms). */
  switchMs: number
  /** How unsure the bot is about where a swaying or drifting cup will land (0..1). */
  trajectoryDoubt: number
}

export const BOT_SKILLS = {
  casual: {
    reactionMs: 340,
    aimError: 24,
    lapse: 0.03,
    burstLapse: 0.22,
    handSpeed: 900,
    obstacleMistake: 0.12,
    switchMs: 200,
    trajectoryDoubt: 0.9,
  },
  normal: {
    reactionMs: 260,
    aimError: 16,
    lapse: 0.014,
    burstLapse: 0.12,
    handSpeed: 1250,
    obstacleMistake: 0.06,
    switchMs: 130,
    trajectoryDoubt: 0.6,
  },
  skilled: {
    reactionMs: 200,
    aimError: 9,
    lapse: 0.005,
    burstLapse: 0.05,
    handSpeed: 1800,
    obstacleMistake: 0.02,
    switchMs: 80,
    trajectoryDoubt: 0.3,
  },
  perfect: {
    reactionMs: 0,
    aimError: 0,
    lapse: 0,
    burstLapse: 0,
    handSpeed: 2800,
    obstacleMistake: 0,
    switchMs: 0,
    trajectoryDoubt: 0,
  },
} satisfies Record<string, BotSkill>

export type BotSkillName = keyof typeof BOT_SKILLS

interface Judgement {
  offset: number
  /** Fixed per-cup misreading of a moving cup's landing spot (fades near arrival). */
  doubt: number
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-9)
  const v = rng.next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export class Bot {
  private readonly rng: Rng
  private readonly judgements = new Map<number, Judgement>()
  private readonly ignoredObstacles = new Map<number, boolean>()
  private hand: number | null = null
  private targetId: number | null = null
  private hesitateUntil = 0
  private readonly skill: BotSkill

  constructor(skill: BotSkill, seed = 1) {
    this.skill = skill
    this.rng = new Rng((seed ^ 0x5bd1e995) >>> 0)
  }

  private judge(cup: ActiveCup): Judgement {
    let judgement = this.judgements.get(cup.spec.id)
    if (!judgement) {
      const lapseChance = this.skill.lapse + (cup.spec.burst ? this.skill.burstLapse : 0)
      const offset = this.rng.chance(lapseChance)
        ? this.rng.sign() * this.rng.range(CATCH_HALF_WIDTH + 20, CATCH_HALF_WIDTH + 90)
        : gaussian(this.rng) * this.skill.aimError
      const wander = (cup.spec.sway?.amp ?? 0) + Math.abs(cup.spec.x0 - cup.spec.x1) * 0.5
      judgement = { offset, doubt: gaussian(this.rng) * wander * this.skill.trajectoryDoubt }
      this.judgements.set(cup.spec.id, judgement)
    }
    return judgement
  }

  private ignores(obstacle: ActiveCup): boolean {
    let ignored = this.ignoredObstacles.get(obstacle.spec.id)
    if (ignored === undefined) {
      ignored = this.rng.chance(this.skill.obstacleMistake)
      this.ignoredObstacles.set(obstacle.spec.id, ignored)
    }
    return ignored
  }

  /** Call once per frame with the frame's duration, before advancing the session. */
  update(session: GameSession, frameMs: number): void {
    const now = session.time
    const noticed = session.cups.filter(
      (cup) => cup.state === 'falling' && now - cup.spec.spawnAt >= this.skill.reactionMs,
    )
    const wanted = noticed
      .filter((cup) => cup.spec.kind !== 'obstacle')
      .sort((a, b) => arrivalTime(a.spec) - arrivalTime(b.spec))

    let goal: number | null = null
    let goalId: number | null = null
    for (const cup of wanted) {
      const judgement = this.judge(cup)
      const secondsLeft = (arrivalTime(cup.spec) - now) / 1000
      // A moving cup's landing spot becomes clear only as it gets close.
      const certainty = Math.min(1, Math.max(0, (secondsLeft - 0.35) / 1.1))
      const x = arrivalX(cup.spec) + judgement.offset + judgement.doubt * certainty
      const distance = Math.abs(x - session.basket.x) - CATCH_HALF_WIDTH * 0.6
      // Give up on a cup that cannot be reached and go for the next one.
      if (distance > secondsLeft * this.skill.handSpeed + 30 && wanted.length > 1) continue
      goal = x
      goalId = cup.spec.id
      break
    }

    if (goalId !== this.targetId) {
      this.targetId = goalId
      this.hesitateUntil = now + this.skill.switchMs
    }
    if (now < this.hesitateUntil) goal = null

    if (goal !== null) {
      for (const obstacle of noticed) {
        if (obstacle.spec.kind !== 'obstacle' || this.ignores(obstacle)) continue
        const msLeft = arrivalTime(obstacle.spec) - now
        if (msLeft > 520 || msLeft < -40) continue
        const ox = arrivalX(obstacle.spec)
        if (Math.abs(goal - ox) < OBSTACLE_HIT_HALF_WIDTH + 24) {
          goal = ox + (goal >= ox ? 1 : -1) * (OBSTACLE_HIT_HALF_WIDTH + 30)
        }
      }
    }

    const hand = this.hand ?? session.basket.x
    const target = goal ?? hand
    const maxStep = (this.skill.handSpeed * frameMs) / 1000
    this.hand = hand + Math.max(-maxStep, Math.min(maxStep, target - hand))
    session.setPointer(this.hand)
  }
}
