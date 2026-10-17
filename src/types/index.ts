export type Language = 'en' | 'ar'

export type GameMode = 'campaign' | 'endless' | 'versus'

export type CupKind = 'normal' | 'golden' | 'special' | 'obstacle'

/** Top-level application states (see src/app/stateMachine.ts). */
export type AppScreen =
  | 'INITIALIZING'
  | 'LOGIN'
  | 'MENU'
  | 'PROFILE'
  | 'SETTINGS'
  | 'ACHIEVEMENTS'
  | 'LEVEL_SELECT'
  | 'LEADERBOARD'
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER'
  | 'MATCH_RESULTS'

export type MotionPreference = 'system' | 'reduced' | 'full'

export type AvatarId =
  | 'hot-cup'
  | 'iced-coffee'
  | 'frappe'
  | 'matcha'
  | 'pink-drink'
  | 'bean'
  | 'croissant'
  | 'cake-pop'
  | 'star'
  | 'crescent'
  | 'crown'
  | 'bear'

export type BasketSkinId = 'classic' | 'siren' | 'cream' | 'golden' | 'midnight' | 'rival'

export type AchievementId =
  | 'first_catch'
  | 'perfect_start'
  | 'golden_catch'
  | 'special_delivery'
  | 'combo_master'
  | 'steady_hands'
  | 'cup_collector'
  | 'rising_barista'
  | 'campaign_champion'
  | 'endless_explorer'
  | 'friendly_rivalry'
  | 'head_barista'

export type MatchLength = 'quick' | 'classic' | 'marathon'

export type MatchOutcome = 'win' | 'loss' | 'tie'

export type MatchEndReason = 'target' | 'time' | 'forfeit'

export interface MatchRecord {
  id: string
  at: number
  opponentName: string
  opponentAvatar: AvatarId
  myScore: number
  opponentScore: number
  outcome: MatchOutcome
  reason: MatchEndReason
  length: MatchLength
}
