import { describe, expect, it } from 'vitest'
import { Bot, BOT_SKILLS, type BotSkillName } from '../bot'
import { sessionConfigFor, type PlayRequest } from '../levels/modes'
import { reachesRim } from '../systems/collision'
import { FIELD_WIDTH } from './constants'
import { GameSession } from './GameSession'
import type { GameEvent } from './types'

const FRAME = 1000 / 60

function session(request: PlayRequest): GameSession {
  return new GameSession(sessionConfigFor(request), request.seed)
}

function campaign(levelId: number, seed = 42): GameSession {
  return session({ mode: 'campaign', levelId, seed })
}

function play(game: GameSession, skill: BotSkillName | null, maxMs = 15 * 60_000): GameEvent[] {
  const bot = skill ? new Bot(BOT_SKILLS[skill], 7) : null
  const events: GameEvent[] = []
  game.start()
  while (game.running && game.time < maxMs) {
    bot?.update(game, FRAME)
    game.advance(FRAME)
    events.push(...game.drainEvents())
  }
  return events
}

function runUntil(game: GameSession, predicate: (e: GameEvent) => boolean, maxMs = 60_000): GameEvent[] {
  const events: GameEvent[] = []
  game.start()
  while (game.running && game.time < maxMs) {
    game.advance(FRAME)
    const batch = game.drainEvents()
    events.push(...batch)
    if (batch.some(predicate)) break
  }
  return events
}

describe('GameSession', () => {
  it('starts with a clean state', () => {
    const game = campaign(3)
    expect(game.status).toBe('ready')
    expect(game.score).toBe(0)
    expect(game.lives).toBe(5)
    expect(game.cups).toHaveLength(0)
    expect(game.basket.x).toBe(FIELD_WIDTH / 2)
  })

  it('does nothing until started', () => {
    const game = campaign(1)
    game.advance(10_000)
    expect(game.time).toBe(0)
    expect(game.drainEvents()).toEqual([])
  })

  it('awards points for a catch and starts a streak', () => {
    // Level 1's first tutorial cup falls straight into the centred basket.
    const game = campaign(1)
    const events = runUntil(game, (e) => e.type === 'catch')
    const caught = events.find((e) => e.type === 'catch')
    expect(caught).toMatchObject({ type: 'catch', kind: 'normal', points: { total: 100 } })
    expect(game.score).toBe(100)
    expect(game.streak).toBe(1)
    expect(game.lives).toBe(5)
  })

  it('takes a life, awards nothing and resets the streak on a miss', () => {
    const game = campaign(1)
    game.setPointer(0) // park the basket at the far left; the first cup lands in the centre
    const events = runUntil(game, (e) => e.type === 'miss')
    const miss = events.find((e) => e.type === 'miss')
    expect(miss).toMatchObject({ type: 'miss', lives: 4 })
    expect(game.score).toBe(0)
    expect(game.missed).toBe(1)
    expect(game.lives).toBe(4)
    expect(game.streak).toBe(0)
    expect(events.some((e) => e.type === 'catch')).toBe(false)
  })

  it('scores every cup at most once and the score equals the sum of catches', () => {
    const game = campaign(8, 1234)
    const events = play(game, 'normal')
    const catches = events.filter((e): e is Extract<GameEvent, { type: 'catch' }> => e.type === 'catch')
    const ids = catches.map((c) => c.cupId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(catches.reduce((sum, c) => sum + c.points.total, 0)).toBe(game.score)
    expect(game.caught).toBe(catches.length)
    const spawned = events.filter((e) => e.type === 'spawn').length
    const resolved = events.filter((e) => ['catch', 'miss', 'obstacleHit', 'dodge'].includes(e.type)).length
    expect(resolved + game.cups.length).toBe(spawned)
  })

  it('detects the rim crossing on exactly one step', () => {
    const progressSteps = [0.9, 0.97, 0.999, 1.0, 1.02, 1.1, 1.3]
    const crossings = progressSteps.slice(1).filter((p, i) => reachesRim(progressSteps[i], p))
    expect(crossings).toHaveLength(1)
  })

  it('triggers level completion exactly once', () => {
    const game = campaign(1)
    const events = play(game, 'perfect')
    expect(events.filter((e) => e.type === 'complete')).toHaveLength(1)
    expect(game.status).toBe('complete')
    expect(game.score).toBeGreaterThanOrEqual(500)

    const scoreAtEnd = game.score
    game.advance(5_000)
    game.start()
    game.advance(5_000)
    expect(game.drainEvents()).toEqual([])
    expect(game.score).toBe(scoreAtEnd)
  })

  it('ends the game exactly once when the lives run out', () => {
    const game = campaign(15)
    game.setPointer(0)
    const events = play(game, null)
    expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'complete')).toHaveLength(0)
    expect(game.status).toBe('over')
    expect(game.lives).toBe(0)
  })

  it('restarting creates an independent session with fresh temporary state', () => {
    const first = campaign(4, 99)
    play(first, 'normal', 30_000)
    expect(first.score).toBeGreaterThan(0)

    const restarted = campaign(4, 99)
    expect(restarted.score).toBe(0)
    expect(restarted.lives).toBe(restarted.maxLives)
    expect(restarted.streak).toBe(0)
    expect(restarted.combo).toBe(0)
    expect(restarted.time).toBe(0)
    expect(restarted.cups).toHaveLength(0)
    expect(first.config).not.toBe(restarted.config)
  })

  it('is deterministic for a seed (both online players see the same cups)', () => {
    const spawnsFor = (seed: number) => {
      const game = session({ mode: 'versus', length: 'classic', seed, roomCode: 'ABCDEF' })
      game.start()
      game.advance(45_000, 45_000)
      return game
        .drainEvents()
        .filter((e): e is Extract<GameEvent, { type: 'spawn' }> => e.type === 'spawn')
        .map((e) => [e.cup.id, e.cup.kind, Math.round(e.cup.spawnAt), Math.round(e.cup.x1)])
    }
    expect(spawnsFor(777)).toEqual(spawnsFor(777))
    expect(spawnsFor(777)).not.toEqual(spawnsFor(778))
  })

  it.each(Array.from({ length: 15 }, (_, i) => i + 1))('level %i is fair: a perfect player never misses', (levelId) => {
    for (const seed of [11, 222]) {
      const game = campaign(levelId, seed)
      play(game, 'perfect')
      expect(game.status).toBe('complete')
      expect(game.missed).toBe(0)
      expect(game.obstaclesHit).toBe(0)
    }
  })

  it('announces the level-15 final wave once', () => {
    const events = play(campaign(15, 5), 'perfect')
    expect(events.filter((e) => e.type === 'finalWave')).toHaveLength(1)
  })

  it('runs endless waves with milestones and no completion', () => {
    const game = session({ mode: 'endless', seed: 3 })
    const events = play(game, 'normal', 6 * 60_000)
    expect(events.some((e) => e.type === 'wave' && e.wave === 2)).toBe(true)
    expect(events.some((e) => e.type === 'milestone' && e.score === 5000)).toBe(true)
    expect(events.some((e) => e.type === 'complete')).toBe(false)
  })

  it('ends an online match at the time limit without using lives', () => {
    const game = session({ mode: 'versus', length: 'quick', seed: 8, roomCode: 'ABCDEF' })
    game.setPointer(0)
    const events = play(game, null)
    expect(game.lives).toBe(Number.POSITIVE_INFINITY)
    expect(events.filter((e) => e.type === 'timeUp')).toHaveLength(1)
    expect(game.status).toBe('timeup')
    expect(game.time).toBeGreaterThanOrEqual(game.config.timeLimitMs)
  })

  it('catches up to a shared clock in online matches', () => {
    const game = session({ mode: 'versus', length: 'classic', seed: 9, roomCode: 'ABCDEF' })
    game.start()
    game.advanceTo(3_000)
    expect(game.time).toBeGreaterThanOrEqual(2_990)
    expect(game.time).toBeLessThanOrEqual(3_000)
  })
})
