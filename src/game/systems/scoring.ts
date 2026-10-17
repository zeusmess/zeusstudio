import type { CupKind } from '../../types'
import { COMBO_TIERS, COMBO_WINDOW_MS, POINTS, STREAK } from '../core/constants'
import type { CatchBreakdown } from '../core/types'

export function basePoints(kind: CupKind): number {
  return POINTS[kind]
}

/** Multiplier earned by `combo` quick catches in a row (including this one). */
export function multiplierFor(combo: number): number {
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.minCombo) return tier.multiplier
  }
  return 1
}

/** Bonus paid when the streak (after this catch) lands on a milestone. */
export function streakBonusFor(streak: number): number {
  if (streak <= 0 || streak % STREAK.every !== 0) return 0
  return Math.min(STREAK.perCatch * streak, STREAK.maxBonus)
}

/** The combo count after a catch at `now`, given the previous catch time. */
export function nextCombo(previousCombo: number, lastCatchAt: number, now: number): number {
  return now - lastCatchAt <= COMBO_WINDOW_MS && previousCombo > 0 ? previousCombo + 1 : 1
}

export function scoreCatch(kind: CupKind, combo: number, streak: number): CatchBreakdown {
  const base = basePoints(kind)
  const multiplier = multiplierFor(combo)
  const streakBonus = streakBonusFor(streak)
  return { base, multiplier, streakBonus, total: Math.round(base * multiplier) + streakBonus }
}
