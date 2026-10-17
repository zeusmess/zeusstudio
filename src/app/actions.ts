import { randomSeed } from '../game/core/rng'
import { getProfile } from '../profile/profileStore'
import { isEndlessUnlocked, nextPlayableLevel, isCampaignComplete } from '../profile/progress'
import { getApp } from './appStore'

export function playCampaignLevel(levelId: number): boolean {
  const progress = getProfile().progress
  if (levelId > progress.unlockedLevel) return false
  return getApp().startRun({ mode: 'campaign', levelId, seed: randomSeed() })
}

export function playEndless(): boolean {
  if (!isEndlessUnlocked(getProfile().progress)) return false
  return getApp().startRun({ mode: 'endless', seed: randomSeed() })
}

/** "Play Now": continue the campaign, or Endless Mode once the campaign is done. */
export function playNow(): boolean {
  const progress = getProfile().progress
  if (isCampaignComplete(progress)) return playEndless()
  return playCampaignLevel(nextPlayableLevel(progress))
}
