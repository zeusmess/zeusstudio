import type { GameEvent, SessionResult } from '../game/core/types'
import type { AchievementId } from '../types'
import type { Progress } from './types'

export interface AchievementDefinition {
  id: AchievementId
  icon: 'cup' | 'star' | 'sparkle' | 'combo' | 'streak' | 'trophy' | 'crown' | 'infinity' | 'users'
  /** For progress bars: current value and goal. */
  goal?: (progress: Progress) => { value: number; target: number }
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'first_catch', icon: 'cup' },
  { id: 'perfect_start', icon: 'sparkle' },
  { id: 'golden_catch', icon: 'star' },
  { id: 'special_delivery', icon: 'sparkle' },
  { id: 'combo_master', icon: 'combo' },
  { id: 'steady_hands', icon: 'streak' },
  {
    id: 'cup_collector',
    icon: 'cup',
    goal: (p) => ({ value: Math.min(p.totalCupsCaught, CUP_COLLECTOR_GOAL), target: CUP_COLLECTOR_GOAL }),
  },
  { id: 'rising_barista', icon: 'trophy' },
  {
    id: 'campaign_champion',
    icon: 'crown',
    goal: (p) => ({ value: p.completedLevels.length, target: 15 }),
  },
  {
    id: 'endless_explorer',
    icon: 'infinity',
    goal: (p) => ({ value: Math.min(p.endlessBest?.wave ?? 0, ENDLESS_EXPLORER_WAVE), target: ENDLESS_EXPLORER_WAVE }),
  },
  { id: 'friendly_rivalry', icon: 'users' },
  { id: 'head_barista', icon: 'trophy' },
]

export const CUP_COLLECTOR_GOAL = 500
export const STEADY_HANDS_STREAK = 25
export const ENDLESS_EXPLORER_WAVE = 10

/** Achievements earned by something that just happened in play. */
export function achievementsFromEvent(event: GameEvent): AchievementId[] {
  switch (event.type) {
    case 'catch': {
      const earned: AchievementId[] = ['first_catch']
      if (event.kind === 'golden') earned.push('golden_catch')
      if (event.kind === 'special') earned.push('special_delivery')
      if (event.streak >= STEADY_HANDS_STREAK) earned.push('steady_hands')
      if (event.points.multiplier >= 3) earned.push('combo_master')
      return earned
    }
    case 'wave':
      return event.wave >= ENDLESS_EXPLORER_WAVE ? ['endless_explorer'] : []
    default:
      return []
  }
}

/** Achievements earned by a finished game, checked against the updated progress. */
export function achievementsFromResult(result: SessionResult, progress: Progress): AchievementId[] {
  const earned: AchievementId[] = []
  if (result.mode === 'campaign' && result.outcome === 'complete') {
    if (result.livesLost === 0) earned.push('perfect_start')
    if (result.levelId === 5) earned.push('rising_barista')
  }
  if (progress.completedLevels.includes(5)) earned.push('rising_barista')
  if (progress.completedLevels.length >= 15) earned.push('campaign_champion')
  if (progress.totalCupsCaught >= CUP_COLLECTOR_GOAL) earned.push('cup_collector')
  if ((progress.endlessBest?.wave ?? 0) >= ENDLESS_EXPLORER_WAVE) earned.push('endless_explorer')
  return [...new Set(earned)]
}

export function achievementsFromMatch(outcome: 'win' | 'loss' | 'tie'): AchievementId[] {
  return outcome === 'win' ? ['friendly_rivalry', 'head_barista'] : ['friendly_rivalry']
}
