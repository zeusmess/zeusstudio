import type { AppScreen } from '../types'

/**
 * Every allowed move between application states. Anything not listed here is
 * rejected, so e.g. a level can never jump to LEVEL_COMPLETE from the menu.
 */
export const TRANSITIONS: Readonly<Record<AppScreen, readonly AppScreen[]>> = {
  INITIALIZING: ['MENU', 'LOGIN'],
  LOGIN: ['MENU', 'PROFILE'],
  MENU: ['LOGIN', 'PROFILE', 'SETTINGS', 'ACHIEVEMENTS', 'LEVEL_SELECT', 'LEADERBOARD', 'LOBBY', 'COUNTDOWN'],
  PROFILE: ['MENU', 'LOGIN', 'ACHIEVEMENTS'],
  SETTINGS: ['MENU'],
  ACHIEVEMENTS: ['MENU', 'PROFILE'],
  LEVEL_SELECT: ['MENU', 'COUNTDOWN'],
  LEADERBOARD: ['MENU', 'COUNTDOWN'],
  LOBBY: ['MENU', 'COUNTDOWN'],
  COUNTDOWN: ['PLAYING', 'MENU', 'LOBBY', 'MATCH_RESULTS'],
  PLAYING: ['PAUSED', 'LEVEL_COMPLETE', 'GAME_OVER', 'MATCH_RESULTS', 'MENU'],
  PAUSED: ['PLAYING', 'COUNTDOWN', 'MENU', 'LEVEL_SELECT'],
  LEVEL_COMPLETE: ['COUNTDOWN', 'MENU', 'LEVEL_SELECT'],
  GAME_OVER: ['COUNTDOWN', 'MENU', 'LEVEL_SELECT', 'LEADERBOARD'],
  MATCH_RESULTS: ['LOBBY', 'COUNTDOWN', 'MENU'],
}

/** States in which the game canvas is on screen. */
export const GAME_STATES: ReadonlySet<AppScreen> = new Set([
  'COUNTDOWN',
  'PLAYING',
  'PAUSED',
  'LEVEL_COMPLETE',
  'GAME_OVER',
  'MATCH_RESULTS',
])

export function canTransition(from: AppScreen, to: AppScreen): boolean {
  return TRANSITIONS[from].includes(to)
}

export class InvalidTransitionError extends Error {
  readonly from: AppScreen
  readonly to: AppScreen

  constructor(from: AppScreen, to: AppScreen) {
    super(`Invalid state transition ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

export function assertTransition(from: AppScreen, to: AppScreen): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}
