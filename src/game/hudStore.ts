import { create } from 'zustand'
import type { GameMode } from '../types'
import type { LevelTheme } from './core/types'

export type BannerKind =
  | 'finalWave'
  | 'wave'
  | 'goldenRush'
  | 'streak'
  | 'refill'
  | 'milestone'
  | 'goldenIntro'
  | 'specialIntro'
  | 'obstacleIntro'
  | 'targetReached'

export interface Banner {
  id: number
  kind: BannerKind
  value?: number
}

export interface OpponentHud {
  name: string
  avatar: string
  score: number
  connected: boolean
}

export interface HudState {
  active: boolean
  /** The app run (runId) this HUD and the controller's session were prepared for. */
  run: number
  mode: GameMode
  levelId: number
  theme: LevelTheme
  score: number
  target: number
  lives: number
  maxLives: number
  multiplier: number
  streak: number
  wave: number
  /** Remaining time for online matches (ms); null otherwise. */
  timeLeftMs: number | null
  banner: Banner | null
  /** Level-1 tutorial hint currently shown. */
  tutorial: 'move' | 'catch' | 'goal' | null
  /** Bumps on each life lost, so the HUD can animate. */
  hitPulse: number
  opponent: OpponentHud | null
  set: (patch: Partial<Omit<HudState, 'set' | 'showBanner'>>) => void
  showBanner: (kind: BannerKind, value?: number) => void
}

let bannerId = 0

export const useHud = create<HudState>()((set) => ({
  active: false,
  run: -1,
  mode: 'campaign',
  levelId: 1,
  theme: 'morning',
  score: 0,
  target: 0,
  lives: 5,
  maxLives: 5,
  multiplier: 1,
  streak: 0,
  wave: 1,
  timeLeftMs: null,
  banner: null,
  tutorial: null,
  hitPulse: 0,
  opponent: null,
  set: (patch) => set(patch),
  showBanner: (kind, value) => set({ banner: { id: ++bannerId, kind, value } }),
}))
