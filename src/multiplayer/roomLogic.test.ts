import { describe, expect, it } from 'vitest'
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode'
import {
  bothReady,
  bothWantRematch,
  canStart,
  checkJoin,
  decideResult,
  FORFEIT_AFTER_MS,
  MATCH_COUNTDOWN_MS,
  matchStartAt,
  opponentForfeits,
  outcomeFor,
  ROOM_JOIN_TTL_MS,
  timeLimitFor,
  type RoomMeta,
  type RoomSnapshot,
} from './roomLogic'

const NOW = 1_800_000_000_000

function meta(overrides: Partial<RoomMeta> = {}): RoomMeta {
  return {
    hostUid: 'host',
    guestUid: 'guest',
    status: 'waiting',
    length: 'classic',
    seed: 42,
    round: 1,
    createdAt: NOW - 60_000,
    countdownAt: null,
    ...overrides,
  }
}

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'K7M2QX',
    meta: meta(),
    players: {
      host: { name: 'Host', avatar: 'bean', readyRound: 1, connected: true },
      guest: { name: 'Guest', avatar: 'bear', readyRound: 1, connected: true },
    },
    scores: {},
    result: null,
    rematch: {},
    ...overrides,
  }
}

describe('invitation codes', () => {
  it('generates 6-character codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(6)
      expect(isValidRoomCode(code)).toBe(true)
      expect(code).not.toMatch(/[01OIL]/)
    }
  })

  it('normalises what players type', () => {
    expect(normalizeRoomCode(' k7m-2qx ')).toBe('K7M2QX')
    expect(normalizeRoomCode('k7 m2 qx')).toBe('K7M2QX')
    expect(normalizeRoomCode('ABC٢٣٤')).toBe('ABC234')
    expect(normalizeRoomCode('ＫＭ２３４５')).toBe('KM2345')
  })

  it('rejects malformed codes', () => {
    for (const bad of ['', 'ABC', 'ABCDEFG', 'ABCDE0', 'ABCDE1', 'ABCDEO', 'ABCDEI', 'ABCDEL', 'abcdef', 'ABC-DE', 'ABCDE!']) {
      expect(isValidRoomCode(bad)).toBe(false)
    }
    expect(isValidRoomCode('K7M2QX')).toBe(true)
  })
})

describe('joining a room', () => {
  it('lets a second player join an open room', () => {
    expect(checkJoin(meta({ guestUid: null }), 'newbie', NOW)).toBe('ok')
  })

  it('explains why a join is refused', () => {
    expect(checkJoin(null, 'x', NOW)).toBe('notFound')
    expect(checkJoin(meta({ status: 'closed', guestUid: null }), 'x', NOW)).toBe('notFound')
    expect(checkJoin(meta({ guestUid: null }), 'host', NOW)).toBe('ownRoom')
    expect(checkJoin(meta(), 'guest', NOW)).toBe('alreadyJoined')
    expect(checkJoin(meta(), 'third', NOW)).toBe('full')
    expect(checkJoin(meta({ guestUid: null, status: 'live' }), 'x', NOW)).toBe('started')
    expect(checkJoin(meta({ guestUid: null, createdAt: NOW - ROOM_JOIN_TTL_MS - 1 }), 'x', NOW)).toBe('expired')
  })
})

describe('match state transitions', () => {
  it('starts only when the host starts and both players are ready', () => {
    expect(bothReady(room())).toBe(true)
    expect(canStart(room(), 'host')).toBe(true)
    expect(canStart(room(), 'guest')).toBe(false)
    const notReady = room({ players: { ...room().players, guest: { name: 'G', avatar: 'bear', readyRound: 0, connected: true } } })
    expect(bothReady(notReady)).toBe(false)
    expect(canStart(notReady, 'host')).toBe(false)
    expect(canStart(room({ meta: meta({ guestUid: null }) }), 'host')).toBe(false)
    expect(canStart(room({ meta: meta({ status: 'live' }) }), 'host')).toBe(false)
  })

  it('resets readiness on a rematch round', () => {
    expect(bothReady(room({ meta: meta({ round: 2 }) }))).toBe(false)
  })

  it('needs both players to ask for a rematch', () => {
    expect(bothWantRematch(room({ rematch: { host: true } }))).toBe(false)
    expect(bothWantRematch(room({ rematch: { host: true, guest: true } }))).toBe(true)
  })

  it('derives the shared start time from the countdown', () => {
    expect(matchStartAt(meta())).toBeNull()
    expect(matchStartAt(meta({ countdownAt: NOW }))).toBe(NOW + MATCH_COUNTDOWN_MS)
  })
})

describe('winner calculation', () => {
  const live = meta({ status: 'live', countdownAt: NOW - 10_000 })

  it('gives the win to the first player to reach the target', () => {
    const snapshot = room({ meta: live, scores: { host: { score: 5600, lastCup: 50 }, guest: { score: 4000, lastCup: 48 } } })
    const result = decideResult(snapshot, NOW, { targetReachedBy: 'host' })
    expect(result).toMatchObject({ winner: 'host', reason: 'target', hostScore: 5600, guestScore: 4000 })
    expect(outcomeFor(result!, 'host')).toBe('win')
    expect(outcomeFor(result!, 'guest')).toBe('loss')
  })

  it('does not end the match before the target or the time limit', () => {
    const snapshot = room({ meta: live, scores: { host: { score: 1200, lastCup: 9 } } })
    expect(decideResult(snapshot, NOW)).toBeNull()
    expect(decideResult(snapshot, NOW, { targetReachedBy: 'host' })).toBeNull()
  })

  it('awards the higher score when time runs out', () => {
    const end = NOW - 10_000 + MATCH_COUNTDOWN_MS + timeLimitFor('classic')
    const snapshot = room({ meta: live, scores: { host: { score: 3000, lastCup: 20 }, guest: { score: 3400, lastCup: 22 } } })
    expect(decideResult(snapshot, end - 1)).toBeNull()
    expect(decideResult(snapshot, end)).toMatchObject({ winner: 'guest', reason: 'time' })
  })

  it('reports a tie when the scores are equal at the time limit', () => {
    const end = NOW + MATCH_COUNTDOWN_MS + timeLimitFor('classic')
    const snapshot = room({ meta: meta({ status: 'live', countdownAt: NOW }), scores: { host: { score: 2500, lastCup: 20 }, guest: { score: 2500, lastCup: 21 } } })
    const result = decideResult(snapshot, end)
    expect(result).toMatchObject({ winner: 'tie', reason: 'time' })
    expect(outcomeFor(result!, 'host')).toBe('tie')
    expect(outcomeFor(result!, 'guest')).toBe('tie')
  })

  it('treats leaving or a long disconnect as a forfeit', () => {
    const result = decideResult(room({ meta: live }), NOW, { forfeitBy: 'guest' })
    expect(result).toMatchObject({ winner: 'host', reason: 'forfeit' })
    expect(opponentForfeits(undefined, NOW)).toBe(true)
    expect(opponentForfeits({ name: 'G', avatar: 'bear', connected: true }, NOW)).toBe(false)
    expect(opponentForfeits({ name: 'G', avatar: 'bear', connected: false, lastSeen: NOW - 1000 }, NOW)).toBe(false)
    expect(opponentForfeits({ name: 'G', avatar: 'bear', connected: false, lastSeen: NOW - FORFEIT_AFTER_MS }, NOW)).toBe(true)
  })
})
