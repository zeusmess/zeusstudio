import type { AppScreen } from '../types'
import { useApp } from './appStore'
import { assertTransition, canTransition, InvalidTransitionError, TRANSITIONS } from './stateMachine'

const REQUIRED: AppScreen[] = [
  'INITIALIZING',
  'LOGIN',
  'MENU',
  'PROFILE',
  'LOBBY',
  'COUNTDOWN',
  'PLAYING',
  'PAUSED',
  'LEVEL_COMPLETE',
  'GAME_OVER',
  'MATCH_RESULTS',
]

describe('application states', () => {
  it('has every required state, and only moves to known states', () => {
    const states = Object.keys(TRANSITIONS) as AppScreen[]
    expect(states).toEqual(expect.arrayContaining(REQUIRED))
    for (const targets of Object.values(TRANSITIONS)) for (const to of targets) expect(states).toContain(to)
  })

  it('allows the normal journeys', () => {
    const journeys: AppScreen[][] = [
      ['INITIALIZING', 'MENU', 'COUNTDOWN', 'PLAYING', 'PAUSED', 'PLAYING', 'LEVEL_COMPLETE', 'COUNTDOWN'],
      ['MENU', 'LEVEL_SELECT', 'COUNTDOWN', 'PLAYING', 'GAME_OVER', 'MENU'],
      ['MENU', 'LOBBY', 'COUNTDOWN', 'PLAYING', 'MATCH_RESULTS', 'COUNTDOWN', 'PLAYING', 'MATCH_RESULTS', 'MENU'],
      ['MENU', 'LOGIN', 'PROFILE', 'MENU'],
    ]
    for (const journey of journeys) {
      for (let i = 1; i < journey.length; i++) expect([journey[i - 1], journey[i], canTransition(journey[i - 1], journey[i])]).toEqual([journey[i - 1], journey[i], true])
    }
  })

  it('refuses moves that would skip the game', () => {
    expect(canTransition('MENU', 'LEVEL_COMPLETE')).toBe(false)
    expect(canTransition('MENU', 'PLAYING')).toBe(false)
    expect(canTransition('LOBBY', 'PLAYING')).toBe(false)
    expect(canTransition('PAUSED', 'LEVEL_COMPLETE')).toBe(false)
    expect(canTransition('GAME_OVER', 'LEVEL_COMPLETE')).toBe(false)
    expect(canTransition('LEVEL_COMPLETE', 'GAME_OVER')).toBe(false)
    expect(() => assertTransition('MENU', 'LEVEL_COMPLETE')).toThrow(InvalidTransitionError)
  })
})

describe('app store', () => {
  beforeEach(() => useApp.setState({ screen: 'MENU', previous: null, outcome: null, play: null, runId: 0 }))

  it('ignores an invalid move and stays where it is', () => {
    expect(useApp.getState().go('LEVEL_COMPLETE')).toBe(false)
    expect(useApp.getState().screen).toBe('MENU')
  })

  it('starts every run fresh: new run id, no leftover result', () => {
    useApp.setState({ screen: 'GAME_OVER', outcome: { kind: 'campaign' } as never, runId: 4 })
    expect(useApp.getState().startRun({ mode: 'campaign', levelId: 2, seed: 7 })).toBe(true)
    const state = useApp.getState()
    expect(state.screen).toBe('COUNTDOWN')
    expect(state.outcome).toBeNull()
    expect(state.runId).toBe(5)
    expect(state.play).toEqual({ mode: 'campaign', levelId: 2, seed: 7 })
  })

  it('cannot start a run from a screen that does not lead to one', () => {
    useApp.setState({ screen: 'SETTINGS' })
    expect(useApp.getState().startRun({ mode: 'endless', seed: 1 })).toBe(false)
    expect(useApp.getState().screen).toBe('SETTINGS')
  })
})
