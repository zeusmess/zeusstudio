import { describe, expect, it } from 'vitest'
import { COMBO_WINDOW_MS, MAX_POINTS_PER_CATCH } from '../core/constants'
import { basePoints, multiplierFor, nextCombo, scoreCatch, streakBonusFor } from './scoring'

describe('scoring', () => {
  it('awards 100 / 250 / 500 base points and nothing for obstacles', () => {
    expect(basePoints('normal')).toBe(100)
    expect(basePoints('golden')).toBe(250)
    expect(basePoints('special')).toBe(500)
    expect(basePoints('obstacle')).toBe(0)
  })

  it('scores an isolated catch at face value', () => {
    expect(scoreCatch('normal', 1, 1)).toEqual({ base: 100, multiplier: 1, streakBonus: 0, total: 100 })
    expect(scoreCatch('golden', 1, 2).total).toBe(250)
    expect(scoreCatch('special', 1, 3).total).toBe(500)
  })

  it('raises the multiplier with fast consecutive catches', () => {
    expect([1, 2].map(multiplierFor)).toEqual([1, 1])
    expect(multiplierFor(3)).toBe(1.5)
    expect(multiplierFor(5)).toBe(2)
    expect(multiplierFor(8)).toBe(2.5)
    expect(multiplierFor(12)).toBe(3)
    expect(multiplierFor(40)).toBe(3)
    expect(scoreCatch('normal', 5, 1).total).toBe(200)
    expect(scoreCatch('golden', 3, 1).total).toBe(375)
  })

  it('continues a combo only inside the combo window', () => {
    expect(nextCombo(0, Number.NEGATIVE_INFINITY, 1000)).toBe(1)
    expect(nextCombo(2, 1000, 1000 + COMBO_WINDOW_MS)).toBe(3)
    expect(nextCombo(2, 1000, 1001 + COMBO_WINDOW_MS)).toBe(1)
  })

  it('pays streak bonuses every 10 consecutive catches, capped', () => {
    expect(streakBonusFor(9)).toBe(0)
    expect(streakBonusFor(10)).toBe(100)
    expect(streakBonusFor(11)).toBe(0)
    expect(streakBonusFor(20)).toBe(200)
    expect(streakBonusFor(30)).toBe(300)
    expect(streakBonusFor(90)).toBe(300)
    expect(scoreCatch('normal', 1, 10).total).toBe(200)
  })

  it('never exceeds the per-catch ceiling the server rules enforce', () => {
    expect(scoreCatch('special', 99, 30).total).toBe(MAX_POINTS_PER_CATCH)
  })
})
