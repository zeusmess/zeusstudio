import type { AchievementId, AvatarId, BasketSkinId, MatchRecord } from '../types'

export type ProfileKind = 'guest' | 'google'

export interface PlayerProfile {
  id: string
  kind: ProfileKind
  displayName: string
  avatarId: AvatarId
  basketSkin: BasketSkinId
  /** The player chose to continue as a guest or signed in (hides the identity prompts). */
  identityChosen: boolean
  createdAt: number
  updatedAt: number
}

export interface EndlessBest {
  score: number
  wave: number
  at: number
}

export interface Progress {
  /** Highest campaign level the player may start (1–15). */
  unlockedLevel: number
  completedLevels: number[]
  /** Best score per level id (string keys so the record maps 1:1 to the database). */
  bestScores: Record<string, number>
  totalCupsCaught: number
  totalGoldenCaught: number
  totalSpecialCaught: number
  gamesPlayed: number
  endlessBest: EndlessBest | null
  achievements: Partial<Record<AchievementId, number>>
  /** Cosmetics (avatar and basket ids) unlocked through achievements. */
  unlockedCosmetics: string[]
  matchHistory: MatchRecord[]
  matchStats: { played: number; wins: number; losses: number; ties: number }
  campaignCompletedAt: number | null
  updatedAt: number
}

export interface ProfileRecord {
  version: 1
  profile: PlayerProfile
  progress: Progress
}
