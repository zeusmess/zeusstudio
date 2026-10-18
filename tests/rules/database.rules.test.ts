/**
 * Runs database.rules.json in the Firebase Realtime Database emulator.
 *
 *   npm run test:rules        # starts the emulators, runs this file, stops them
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { MATCH_PRESETS } from '../../src/game/levels/modes.ts'
import { maxPointsPerCatch } from '../../src/multiplayer/matchBounds.ts'
import { FORFEIT_AFTER_MS, MATCH_COUNTDOWN_MS, ROOM_JOIN_TTL_MS } from '../../src/multiplayer/roomLogic.ts'
import type { MatchLength } from '../../src/types/index.ts'

const NOW = { '.sv': 'timestamp' }
const CODE = 'K7M2QX'
const ROOM = `rooms/${CODE}`
const [dbHost, dbPort] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000').split(':')

let env: RulesTestEnvironment

const as = (uid: string) => env.authenticatedContext(uid).database()
const anonymous = () => env.unauthenticatedContext().database()
const seed = (path: string, value: unknown) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(path).set(value)
  })

const player = (name: string, extra: Record<string, unknown> = {}) => ({ name, avatar: 'hot-cup', connected: true, ...extra })

interface RoomSeed {
  status?: 'waiting' | 'live' | 'closed'
  guest?: boolean
  round?: number
  length?: MatchLength
  /** For a live round: milliseconds since its first cup was due. */
  elapsedMs?: number
  createdAgoMs?: number
  ready?: boolean
}

async function seedRoom(options: RoomSeed = {}): Promise<void> {
  const { status = 'waiting', guest = true, round = 1, length = 'classic', ready = true } = options
  const now = Date.now()
  const meta: Record<string, unknown> = {
    hostUid: 'host',
    status,
    length,
    seed: 12345,
    round,
    createdAt: now - (options.createdAgoMs ?? 60_000),
  }
  if (guest) meta.guestUid = 'guest'
  if (options.elapsedMs !== undefined) meta.countdownAt = now - MATCH_COUNTDOWN_MS - options.elapsedMs
  const players: Record<string, unknown> = { host: player('Host', ready ? { readyRound: round } : {}) }
  if (guest) players.guest = player('Guest', ready ? { readyRound: round } : {})
  await seed(ROOM, { meta, players })
}

/** One reported catch: the cup's points and the new total, written together. */
function catchUpdate(uid: string, cup: number, points: number, score: number, round = 1) {
  return {
    [`scores/${round}/${uid}`]: { score, lastCup: cup },
    [`caught/${round}/${uid}/${cup}`]: points,
  }
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cup-catcher-rules',
    database: {
      host: dbHost,
      port: Number(dbPort),
      rules: readFileSync(resolve(import.meta.dirname, '../../database.rules.json'), 'utf8'),
    },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearDatabase()
})

describe('player profiles', () => {
  const profile = { displayName: 'Youssef', avatarId: 'hot-cup', basketSkin: 'classic', createdAt: 1, updatedAt: 2 }

  it('lets players read and write only their own profile', async () => {
    await assertSucceeds(as('alice').ref('users/alice').set({ profile, progress: { unlockedLevel: 3 } }))
    await assertSucceeds(as('alice').ref('users/alice').get())
    await assertFails(as('bob').ref('users/alice').get())
    await assertFails(as('bob').ref('users/alice/profile').set(profile))
    await assertFails(anonymous().ref('users/alice').get())
  })

  it('rejects malformed profiles', async () => {
    await assertFails(as('alice').ref('users/alice/profile').set({ ...profile, isAdmin: true }))
    await assertFails(as('alice').ref('users/alice/profile').set({ ...profile, displayName: 'x' }))
    await assertFails(as('alice').ref('users/alice/progress').set({ unlockedLevel: 99 }))
    await assertFails(as('alice').ref('users/alice/wallet').set(100))
  })
})

describe('creating a room', () => {
  const meta = { hostUid: 'host', status: 'waiting', length: 'classic', seed: 99, round: 1, createdAt: NOW }

  it('lets a signed-in player open a room they host', async () => {
    await assertSucceeds(
      as('host').ref(ROOM).update({ meta, 'players/host': player('Host', { lastSeen: NOW }) }),
    )
    await assertSucceeds(as('stranger').ref(`${ROOM}/meta`).get())
  })

  it('refuses rooms opened for someone else, bad codes, or bad settings', async () => {
    await assertFails(as('host').ref(`${ROOM}/meta`).set({ ...meta, hostUid: 'someone-else' }))
    await assertFails(as('host').ref('rooms/ABC0OI/meta').set(meta))
    await assertFails(as('host').ref(`${ROOM}/meta`).set({ ...meta, length: 'forever' }))
    await assertFails(as('host').ref(`${ROOM}/meta`).set({ ...meta, round: 4 }))
    await assertFails(as('host').ref(`${ROOM}/meta`).set({ ...meta, status: 'live' }))
    await assertFails(as('host').ref(`${ROOM}/meta`).set({ ...meta, guestUid: 'guest' }))
    await assertFails(as('host').ref(`${ROOM}/meta`).set({ ...meta, createdAt: Date.now() - 3_600_000 }))
    await assertFails(anonymous().ref(`${ROOM}/meta`).set(meta))
  })

  it('never overwrites an existing room (code collision)', async () => {
    await seedRoom()
    await assertFails(as('intruder').ref(`${ROOM}/meta`).set({ ...meta, hostUid: 'intruder' }))
    await assertFails(as('host').ref(`${ROOM}/meta`).set(meta))
  })
})

describe('joining a room', () => {
  const join = (uid: string) =>
    as(uid).ref(ROOM).update({ 'meta/guestUid': uid, [`players/${uid}`]: player('Guest', { lastSeen: NOW }) })

  it('lets one other player take the open seat', async () => {
    await seedRoom({ guest: false })
    await assertSucceeds(join('guest'))
    await assertSucceeds(as('guest').ref(`${ROOM}/players`).get())
  })

  it('refuses a full, started, closed or expired room, and the host joining their own room', async () => {
    await seedRoom()
    await assertFails(join('third'))

    await seedRoom({ guest: false, status: 'live', elapsedMs: 1000 })
    await assertFails(join('late'))

    await seedRoom({ guest: false, status: 'closed' })
    await assertFails(join('late'))

    await seedRoom({ guest: false, createdAgoMs: ROOM_JOIN_TTL_MS + 60_000 })
    await assertFails(join('late'))

    await seedRoom({ guest: false })
    await assertFails(join('host'))
  })

  it('does not let a player put someone else in the seat', async () => {
    await seedRoom({ guest: false })
    await assertFails(as('guest').ref(`${ROOM}/meta/guestUid`).set('someone-else'))
    await assertFails(as('host').ref(`${ROOM}/meta/guestUid`).set('guest'))
  })

  it('keeps room details private to its two players', async () => {
    await seedRoom()
    await assertFails(as('stranger').ref(`${ROOM}/players`).get())
    await assertFails(as('stranger').ref(`${ROOM}/players/stranger`).set(player('Stranger')))
    await assertFails(as('guest').ref(`${ROOM}/players/host`).update({ connected: false }))
  })
})

describe('readiness and starting', () => {
  it('lets players mark themselves ready for the current round only', async () => {
    await seedRoom({ ready: false })
    await assertSucceeds(as('guest').ref(`${ROOM}/players/guest/readyRound`).set(1))
    await assertFails(as('guest').ref(`${ROOM}/players/guest/readyRound`).set(2))
  })

  it('lets only the host start, only when both are ready, on the server clock', async () => {
    const start = { status: 'live', countdownAt: NOW }
    await seedRoom({ ready: false })
    await assertFails(as('host').ref(`${ROOM}/meta`).update(start))

    await seedRoom()
    await assertFails(as('guest').ref(`${ROOM}/meta`).update(start))
    await assertFails(as('host').ref(`${ROOM}/meta`).update({ status: 'live', countdownAt: Date.now() + 60_000 }))
    await assertSucceeds(as('host').ref(`${ROOM}/meta`).update(start))
  })

  it('needs a second player before starting', async () => {
    await seedRoom({ guest: false })
    await assertFails(as('host').ref(`${ROOM}/meta`).update({ status: 'live', countdownAt: NOW }))
  })

  it('does not let the host move the start time of a running match', async () => {
    await seedRoom({ status: 'live', elapsedMs: 20_000 })
    await assertFails(as('host').ref(`${ROOM}/meta/countdownAt`).set(NOW))
    await assertFails(as('host').ref(`${ROOM}/meta/countdownAt`).remove())
  })
})

describe('reporting catches', () => {
  it('accepts a new cup whose points are added to the score', async () => {
    await seedRoom({ status: 'live', elapsedMs: 10_000 })
    await assertSucceeds(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 100)))
    await assertSucceeds(as('host').ref(ROOM).update(catchUpdate('host', 4, 150, 250)))
    await assertSucceeds(as('guest').ref(`${ROOM}/scores/1/host`).get())
  })

  it('never counts the same cup twice', async () => {
    await seedRoom({ status: 'live', elapsedMs: 10_000 })
    await assertSucceeds(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 100)))
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 200)))
    await assertFails(as('host').ref(`${ROOM}/caught/1/host/3`).set(500))
  })

  it('rejects scores that do not add up', async () => {
    await seedRoom({ status: 'live', elapsedMs: 10_000 })
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 5000)))
    await assertFails(as('host').ref(`${ROOM}/scores/1/host`).set({ score: 100, lastCup: 3 }))
    await assertFails(as('host').ref(`${ROOM}/caught/1/host/3`).set(100))
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, -100, -100)))
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 10.5, 10.5)))
  })

  it('caps the points of a single catch for the match length', async () => {
    await seedRoom({ status: 'live', elapsedMs: 30_000, length: 'quick' })
    const cap = maxPointsPerCatch('quick')
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 5, cap + 1, cap + 1)))
    await assertSucceeds(as('host').ref(ROOM).update(catchUpdate('host', 5, cap, cap)))
  })

  it('rejects cups that could not have fallen yet and scores beyond the elapsed time', async () => {
    await seedRoom({ status: 'live', elapsedMs: 5_000 })
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 400, 100, 100)))
    await seed(`${ROOM}/scores/1/host`, { score: 2000, lastCup: 6 })
    await seed(`${ROOM}/caught/1/host/6`, 100)
    // Five seconds in, no one can have more than 5000 × 0.35 + 800 = 2550 points.
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 7, 1000, 3000)))
    await assertSucceeds(as('host').ref(ROOM).update(catchUpdate('host', 7, 500, 2500)))
  })

  it('only lets players report their own catches, during their own live round', async () => {
    await seedRoom({ status: 'live', elapsedMs: 10_000 })
    await assertFails(as('guest').ref(ROOM).update(catchUpdate('host', 3, 100, 100)))
    await assertFails(as('stranger').ref(ROOM).update(catchUpdate('stranger', 3, 100, 100)))
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 100, 2)))
  })

  it('accepts nothing before the first cup is due or after the match', async () => {
    await seedRoom({ status: 'live', elapsedMs: -3_000 })
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 0, 100, 100)))

    await seedRoom({ status: 'waiting', elapsedMs: 10_000 })
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 100)))

    await seedRoom({ status: 'live', elapsedMs: MATCH_PRESETS.classic.timeLimitMs + 30_000 })
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 100)))

    await seedRoom({ status: 'live', elapsedMs: 10_000 })
    await seed(`${ROOM}/results/1`, { winner: 'guest', reason: 'forfeit', decidedAt: Date.now() })
    await assertFails(as('host').ref(ROOM).update(catchUpdate('host', 3, 100, 100)))
  })
})

describe('deciding a match', () => {
  const target = MATCH_PRESETS.classic.target
  const limit = MATCH_PRESETS.classic.timeLimitMs

  async function seedScores(host: number | null, guest: number | null) {
    if (host !== null) await seed(`${ROOM}/scores/1/host`, { score: host, lastCup: 40 })
    if (guest !== null) await seed(`${ROOM}/scores/1/guest`, { score: guest, lastCup: 41 })
  }

  it('gives the win to the first player whose stored score reaches the target', async () => {
    await seedRoom({ status: 'live', elapsedMs: 90_000 })
    await seedScores(target - 100, 3000)
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'target', decidedAt: NOW }))
    // The crossing catch and the result land together.
    await assertSucceeds(
      as('host')
        .ref(ROOM)
        .update({
          ...catchUpdate('host', 42, 250, target + 150),
          'results/1': { winner: 'host', reason: 'target', decidedAt: NOW },
        }),
    )
    await assertFails(as('guest').ref(`${ROOM}/results/1`).set({ winner: 'guest', reason: 'forfeit', decidedAt: NOW }))
  })

  it('does not let a player claim a target win for a score they do not have', async () => {
    await seedRoom({ status: 'live', elapsedMs: 90_000 })
    await seedScores(target, 1000)
    await assertFails(as('guest').ref(`${ROOM}/results/1`).set({ winner: 'guest', reason: 'target', decidedAt: NOW }))
  })

  it('decides by the higher stored score when time runs out', async () => {
    await seedRoom({ status: 'live', elapsedMs: limit - 10_000 })
    await seedScores(3000, 3400)
    await assertFails(as('guest').ref(`${ROOM}/results/1`).set({ winner: 'guest', reason: 'time', decidedAt: NOW }))

    await seedRoom({ status: 'live', elapsedMs: limit + 500 })
    await seedScores(3000, 3400)
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'time', decidedAt: NOW }))
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'tie', reason: 'time', decidedAt: NOW }))
    await assertSucceeds(as('host').ref(`${ROOM}/results/1`).set({ winner: 'guest', reason: 'time', decidedAt: NOW }))
  })

  it('calls equal scores a tie, counting a player who never scored as zero', async () => {
    await seedRoom({ status: 'live', elapsedMs: limit + 500 })
    await seedScores(2500, 2500)
    await assertSucceeds(as('guest').ref(`${ROOM}/results/1`).set({ winner: 'tie', reason: 'time', decidedAt: NOW }))

    await seedRoom({ status: 'live', elapsedMs: limit + 500 })
    await seedScores(null, null)
    await assertSucceeds(as('host').ref(`${ROOM}/results/1`).set({ winner: 'tie', reason: 'time', decidedAt: NOW }))
  })

  it('lets a player forfeit, and claims a forfeit only against an opponent who is really gone', async () => {
    await seedRoom({ status: 'live', elapsedMs: 30_000 })
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'forfeit', decidedAt: NOW }))
    await assertSucceeds(as('guest').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'forfeit', decidedAt: NOW }))

    await seedRoom({ status: 'live', elapsedMs: 30_000 })
    await seed(`${ROOM}/players/guest`, player('Guest', { connected: false, lastSeen: Date.now() - 2000 }))
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'forfeit', decidedAt: NOW }))
    await seed(`${ROOM}/players/guest`, player('Guest', { connected: false, lastSeen: Date.now() - FORFEIT_AFTER_MS - 1000 }))
    await assertSucceeds(as('host').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'forfeit', decidedAt: NOW }))
  })

  it('refuses results from outsiders, for other rounds, or with made-up winners', async () => {
    await seedRoom({ status: 'live', elapsedMs: limit + 500 })
    await seedScores(100, 0)
    await assertFails(as('stranger').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'time', decidedAt: NOW }))
    await assertFails(as('host').ref(`${ROOM}/results/2`).set({ winner: 'host', reason: 'time', decidedAt: NOW }))
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'stranger', reason: 'forfeit', decidedAt: NOW }))
    await assertFails(as('host').ref(`${ROOM}/results/1`).set({ winner: 'host', reason: 'time', decidedAt: 1 }))
  })
})

describe('rematch and leaving', () => {
  async function seedFinished() {
    await seedRoom({ status: 'live', elapsedMs: 200_000 })
    await seed(`${ROOM}/results/1`, { winner: 'host', reason: 'time', decidedAt: Date.now() })
  }
  const nextRound = { round: 2, seed: 777, status: 'waiting', countdownAt: null }

  it('starts a new round only when both players ask for a rematch', async () => {
    await seedRoom({ status: 'live', elapsedMs: 30_000 })
    await assertFails(as('host').ref(`${ROOM}/rematch/1/host`).set(true))

    await seedFinished()
    await assertSucceeds(as('host').ref(`${ROOM}/rematch/1/host`).set(true))
    await assertFails(as('host').ref(`${ROOM}/rematch/1/guest`).set(true))
    await assertFails(as('host').ref(`${ROOM}/meta`).update(nextRound))
    await assertSucceeds(as('guest').ref(`${ROOM}/rematch/1/guest`).set(true))
    await assertFails(as('guest').ref(`${ROOM}/meta`).update(nextRound))
    await assertFails(as('host').ref(`${ROOM}/meta`).update({ ...nextRound, round: 3 }))
    await assertSucceeds(as('host').ref(`${ROOM}/meta`).update(nextRound))
    await assertSucceeds(as('guest').ref(`${ROOM}/players/guest/readyRound`).set(2))
  })

  it('lets the guest leave a waiting room, but not walk out of a live round without a result', async () => {
    await seedRoom()
    await assertSucceeds(as('guest').ref(ROOM).update({ 'meta/guestUid': null, 'players/guest': null }))

    await seedRoom({ status: 'live', elapsedMs: 30_000 })
    await assertFails(as('guest').ref(`${ROOM}/meta/guestUid`).remove())

    await seedFinished()
    await assertSucceeds(as('guest').ref(ROOM).update({ 'meta/guestUid': null, 'players/guest': null }))
  })

  it('lets the host close or remove the room only between rounds', async () => {
    await seedRoom({ status: 'live', elapsedMs: 30_000 })
    await assertFails(as('host').ref(`${ROOM}/meta/status`).set('closed'))
    await assertFails(as('host').ref(ROOM).remove())
    await assertFails(as('guest').ref(`${ROOM}/meta/status`).set('closed'))

    await seedRoom()
    await assertSucceeds(as('host').ref(`${ROOM}/meta/status`).set('closed'))
    await assertFails(as('host').ref(`${ROOM}/meta/status`).set('waiting'))
    await assertSucceeds(as('host').ref(ROOM).remove())
  })

  it('lets anyone clear out a long-abandoned room', async () => {
    await seedRoom({ createdAgoMs: 3 * 60 * 60 * 1000 })
    await assertSucceeds(as('cleaner').ref(ROOM).remove())
    await seedRoom()
    await assertFails(as('cleaner').ref(ROOM).remove())
  })
})

describe('endless leaderboard', () => {
  const entry = (score: number) => ({ name: 'Youssef', avatar: 'hot-cup', score, wave: 4, at: NOW })

  it('accepts a score the run could have earned, readable by everyone', async () => {
    await seed('runs/alice', { startedAt: Date.now() - 120_000 })
    await assertSucceeds(as('alice').ref('leaderboard/endless/alice').set(entry(12_000)))
    await assertSucceeds(anonymous().ref('leaderboard/endless').get())
  })

  it('rejects impossible, unstarted, lower or foreign scores', async () => {
    await assertFails(as('alice').ref('leaderboard/endless/alice').set(entry(500)))
    await seed('runs/alice', { startedAt: Date.now() - 60_000 })
    await assertFails(as('alice').ref('leaderboard/endless/alice').set(entry(900_000)))
    await assertFails(as('alice').ref('leaderboard/endless/alice').set(entry(1000.5)))
    await assertFails(as('bob').ref('leaderboard/endless/alice').set(entry(500)))
    await assertSucceeds(as('alice').ref('leaderboard/endless/alice').set(entry(8000)))
    await assertFails(as('alice').ref('leaderboard/endless/alice').set(entry(7000)))
  })

  it('records a run start only at the server time', async () => {
    await assertSucceeds(as('alice').ref('runs/alice').set({ startedAt: NOW }))
    await assertFails(as('alice').ref('runs/alice').set({ startedAt: Date.now() - 3_600_000 }))
    await assertFails(as('bob').ref('runs/alice').set({ startedAt: NOW }))
  })
})
