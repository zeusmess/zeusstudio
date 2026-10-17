import type { AchievementId, AvatarId, BasketSkinId } from '../types'

export const FREE_AVATARS: readonly AvatarId[] = [
  'hot-cup',
  'iced-coffee',
  'frappe',
  'matcha',
  'pink-drink',
  'bean',
  'croissant',
  'bear',
]

export const AVATAR_ORDER: readonly AvatarId[] = [...FREE_AVATARS, 'star', 'cake-pop', 'crescent', 'crown']

export const BASKET_ORDER: readonly BasketSkinId[] = ['classic', 'siren', 'cream', 'rival', 'midnight', 'golden']

/** Cosmetic rewards granted by achievements (ids are avatar or basket ids). */
export const ACHIEVEMENT_REWARDS: Partial<Record<AchievementId, { avatars?: AvatarId[]; baskets?: BasketSkinId[] }>> = {
  golden_catch: { avatars: ['star'] },
  cup_collector: { avatars: ['cake-pop'] },
  perfect_start: { baskets: ['cream'] },
  rising_barista: { baskets: ['siren'] },
  friendly_rivalry: { baskets: ['rival'] },
  endless_explorer: { baskets: ['midnight'], avatars: ['crescent'] },
  campaign_champion: { baskets: ['golden'], avatars: ['crown'] },
}

export function avatarUnlockedBy(avatar: AvatarId): AchievementId | null {
  for (const [id, reward] of Object.entries(ACHIEVEMENT_REWARDS)) {
    if (reward?.avatars?.includes(avatar)) return id as AchievementId
  }
  return null
}

export function basketUnlockedBy(skin: BasketSkinId): AchievementId | null {
  for (const [id, reward] of Object.entries(ACHIEVEMENT_REWARDS)) {
    if (reward?.baskets?.includes(skin)) return id as AchievementId
  }
  return null
}

export function isAvatarAvailable(avatar: AvatarId, unlocked: readonly string[]): boolean {
  return FREE_AVATARS.includes(avatar) || unlocked.includes(`avatar:${avatar}`)
}

export function isBasketAvailable(skin: BasketSkinId, unlocked: readonly string[]): boolean {
  return skin === 'classic' || unlocked.includes(`basket:${skin}`)
}

export function rewardKeys(achievement: AchievementId): string[] {
  const reward = ACHIEVEMENT_REWARDS[achievement]
  if (!reward) return []
  return [
    ...(reward.avatars ?? []).map((a) => `avatar:${a}`),
    ...(reward.baskets ?? []).map((b) => `basket:${b}`),
  ]
}
