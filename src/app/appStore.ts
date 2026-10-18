import { create } from 'zustand'
import type { SessionResult } from '../game/core/types'
import type { PlayRequest } from '../game/levels/modes'
import type { CampaignSummary, EndlessSummary } from '../profile/profileStore'
import type { EndlessRank } from '../services/leaderboard'
import type { AppScreen } from '../types'
import { canTransition } from './stateMachine'

/** What the result screens show after a run ends. */
export type RunOutcome =
  | { kind: 'campaign'; result: SessionResult; summary: CampaignSummary }
  | { kind: 'endless'; result: SessionResult; summary: EndlessSummary; rank: EndlessRank | null; rankPending: boolean }

interface AppState {
  screen: AppScreen
  previous: AppScreen | null
  /** The current (or last) game being played. */
  play: PlayRequest | null
  outcome: RunOutcome | null
  /** Increments each time a run starts, so the game view knows to reset. */
  runId: number
  introSeen: boolean
  /** Moves to another state if the state machine allows it; returns whether it did. */
  go: (to: AppScreen) => boolean
  /** Starts (or restarts) a run: stores the request and enters COUNTDOWN. */
  startRun: (request: PlayRequest) => boolean
  setOutcome: (outcome: RunOutcome | null) => void
  markIntroSeen: () => void
}

export const useApp = create<AppState>()((set, get) => ({
  screen: 'INITIALIZING',
  previous: null,
  play: null,
  outcome: null,
  runId: 0,
  introSeen: false,

  go: (to) => {
    const from = get().screen
    if (from === to) return true
    if (!canTransition(from, to)) {
      if (import.meta.env.DEV) console.warn(`[state] blocked ${from} → ${to}`)
      return false
    }
    set({ screen: to, previous: from })
    return true
  },

  startRun: (request) => {
    const from = get().screen
    if (!canTransition(from, 'COUNTDOWN')) return false
    set((state) => ({ play: request, outcome: null, runId: state.runId + 1, screen: 'COUNTDOWN', previous: from }))
    return true
  },

  setOutcome: (outcome) => set({ outcome }),
  markIntroSeen: () => set({ introSeen: true }),
}))

export function getApp() {
  return useApp.getState()
}
