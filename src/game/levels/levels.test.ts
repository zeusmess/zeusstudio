import { describe, expect, it } from 'vitest'
import { getLevel, LEVEL_COUNT, LEVELS, targetForLevel } from './levels'
import { MATCH_PRESETS, sessionConfigFor } from './modes'

const REQUIRED_TARGETS = [
  500, 1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500, 11500, 12500, 13500, 14500,
]

describe('campaign levels', () => {
  it('has exactly 15 levels', () => {
    expect(LEVEL_COUNT).toBe(15)
    expect(LEVELS).toHaveLength(15)
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
  })

  it('uses the required target for every level', () => {
    expect(LEVELS.map((l) => l.target)).toEqual(REQUIRED_TARGETS)
    REQUIRED_TARGETS.forEach((target, i) => expect(targetForLevel(i + 1)).toBe(target))
  })

  it('raises each target by exactly 1,000 points', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].target - LEVELS[i - 1].target).toBe(1000)
    }
  })

  it('uses individual (not cumulative) level targets in session configs', () => {
    for (const level of LEVELS) {
      const config = sessionConfigFor({ mode: 'campaign', levelId: level.id, seed: 1 })
      expect(config.target).toBe(level.target)
      expect(config.lives).toBeGreaterThan(0)
    }
  })

  it('gets faster from the first level to the last', () => {
    const first = getLevel(1)
    const last = getLevel(15)
    expect(last.end.fallMs[0]).toBeLessThan(first.start.fallMs[0])
    expect(last.end.mix.obstacle).toBeGreaterThan(0)
    expect(first.start.mix.obstacle).toBe(0)
    expect(first.tutorial).toBe(true)
    expect(last.finalWaveAt).toBeGreaterThan(0)
  })

  it('introduces golden cups at level 4, special cups at 6 and obstacles at 12', () => {
    expect(LEVELS.slice(0, 3).every((l) => l.start.mix.golden === 0 && l.end.mix.golden === 0)).toBe(true)
    expect(getLevel(4).start.mix.golden).toBeGreaterThan(0)
    expect(LEVELS.slice(0, 5).every((l) => l.end.mix.special === 0)).toBe(true)
    expect(getLevel(6).start.mix.special).toBeGreaterThan(0)
    expect(LEVELS.slice(0, 11).every((l) => l.end.mix.obstacle === 0)).toBe(true)
    expect(getLevel(12).start.mix.obstacle).toBeGreaterThan(0)
  })

  it('rejects unknown levels', () => {
    expect(() => getLevel(0)).toThrow(RangeError)
    expect(() => getLevel(16)).toThrow(RangeError)
  })

  it('bases online matches on campaign levels with a time limit and no lives', () => {
    for (const preset of Object.values(MATCH_PRESETS)) {
      expect(preset.target).toBe(getLevel(preset.levelId).target)
      expect(preset.timeLimitMs).toBeGreaterThan(0)
    }
    const config = sessionConfigFor({ mode: 'versus', length: 'classic', seed: 4, roomCode: 'ABCDEF' })
    expect(config.lives).toBe(Number.POSITIVE_INFINITY)
    expect(config.ramp).toBe('time')
  })
})
