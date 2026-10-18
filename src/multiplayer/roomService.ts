import type { Database, DataSnapshot } from 'firebase/database'
import { ensureOnlineUser, OnlineUnavailableError } from '../auth/authService'
import { FirebaseNotConfiguredError, getFirebase } from '../auth/firebase'
import { AVATAR_IDS } from '../game/art/badges'
import { randomSeed } from '../game/core/rng'
import type { AvatarId, MatchLength } from '../types'
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode'
import {
  checkJoin,
  decideResult,
  type MatchResultRecord,
  type RoomMeta,
  type RoomPlayer,
  type RoomScore,
  type RoomSnapshot,
  type RoomStatus,
  type StoredResult,
} from './roomLogic'

/**
 * Online rooms on the Firebase Realtime Database. Every write here is checked
 * again by database.rules.json, which is the real referee: this module only
 * decides what to ask for and turns refusals into messages players understand.
 */

type DatabaseApi = typeof import('firebase/database')

export type RoomErrorCode =
  | 'invalidCode'
  | 'notFound'
  | 'expired'
  | 'full'
  | 'started'
  | 'network'
  | 'permission'
  | 'auth'
  | 'unconfigured'
  | 'generic'

export class RoomError extends Error {
  readonly code: RoomErrorCode

  constructor(code: RoomErrorCode, cause?: unknown) {
    super(`Room error: ${code}`, { cause })
    this.name = 'RoomError'
    this.code = code
  }
}

export interface Me {
  name: string
  avatar: AvatarId
}

export interface RoomEntry {
  code: string
  uid: string
  role: 'host' | 'guest'
}

const CONNECT_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 12_000
const CODE_ATTEMPTS = 6

interface Connection {
  db: Database
  api: DatabaseApi
}

let connection: Promise<Connection> | null = null
let serverOffset = 0
let connected = false
const connectionListeners = new Set<(connected: boolean) => void>()

function connect(): Promise<Connection> {
  connection ??= (async () => {
    const [{ db }, api] = await Promise.all([getFirebase(), import('firebase/database')])
    api.onValue(api.ref(db, '.info/serverTimeOffset'), (snapshot) => {
      serverOffset = Number(snapshot.val()) || 0
    })
    api.onValue(api.ref(db, '.info/connected'), (snapshot) => {
      connected = snapshot.val() === true
      connectionListeners.forEach((listener) => listener(connected))
    })
    return { db, api }
  })()
  connection.catch(() => {
    connection = null
  })
  return connection
}

/** The server's clock, as estimated from this device's offset to it. */
export function serverNow(): number {
  return Date.now() + serverOffset
}

export function isConnected(): boolean {
  return connected
}

export function onConnectionChange(listener: (connected: boolean) => void): () => void {
  connectionListeners.add(listener)
  return () => connectionListeners.delete(listener)
}

/** Writes made while offline would be queued and land later; refuse to start them instead. */
function waitForConnection(timeoutMs = CONNECT_TIMEOUT_MS): Promise<void> {
  if (connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off()
      reject(new RoomError('network'))
    }, timeoutMs)
    const off = onConnectionChange((now) => {
      if (!now) return
      clearTimeout(timer)
      off()
      resolve()
    })
  })
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new RoomError('network')), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isPermissionDenied(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  return code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(message ?? '')
}

export function toRoomError(error: unknown): RoomError {
  if (error instanceof RoomError) return error
  if (error instanceof OnlineUnavailableError) {
    return new RoomError(error.reason === 'unconfigured' ? 'unconfigured' : 'auth', error)
  }
  if (error instanceof FirebaseNotConfiguredError) return new RoomError('unconfigured', error)
  if (isPermissionDenied(error)) return new RoomError('permission', error)
  if (/offline|network|disconnect|timeout/i.test(String((error as Error | null)?.message ?? ''))) {
    return new RoomError('network', error)
  }
  return new RoomError('generic', error)
}

/* ---------------------------- reading room data ---------------------------- */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const LENGTHS: readonly MatchLength[] = ['quick', 'classic', 'marathon']
const STATUSES: readonly RoomStatus[] = ['waiting', 'live', 'closed']

/** Room data comes from the network: anything malformed is treated as missing. */
export function parseMeta(raw: unknown): RoomMeta | null {
  if (!isObject(raw)) return null
  const { hostUid, guestUid, status, length, seed, round, createdAt, countdownAt } = raw
  if (typeof hostUid !== 'string' || !STATUSES.includes(status as RoomStatus) || !LENGTHS.includes(length as MatchLength)) {
    return null
  }
  if (typeof seed !== 'number' || typeof round !== 'number' || typeof createdAt !== 'number') return null
  return {
    hostUid,
    guestUid: typeof guestUid === 'string' ? guestUid : null,
    status: status as RoomStatus,
    length: length as MatchLength,
    seed,
    round,
    createdAt,
    countdownAt: typeof countdownAt === 'number' ? countdownAt : null,
  }
}

function parsePlayers(raw: unknown): Record<string, RoomPlayer> {
  const players: Record<string, RoomPlayer> = {}
  if (!isObject(raw)) return players
  for (const [uid, value] of Object.entries(raw)) {
    if (!isObject(value) || typeof value.name !== 'string') continue
    players[uid] = {
      name: value.name.slice(0, 60),
      avatar: AVATAR_IDS.includes(value.avatar as AvatarId) ? (value.avatar as AvatarId) : 'hot-cup',
      readyRound: typeof value.readyRound === 'number' ? value.readyRound : undefined,
      connected: value.connected === true,
      lastSeen: typeof value.lastSeen === 'number' ? value.lastSeen : undefined,
    }
  }
  return players
}

function parseScores(raw: unknown): Record<string, RoomScore> {
  const scores: Record<string, RoomScore> = {}
  if (!isObject(raw)) return scores
  for (const [uid, value] of Object.entries(raw)) {
    if (isObject(value) && typeof value.score === 'number' && typeof value.lastCup === 'number') {
      scores[uid] = { score: value.score, lastCup: value.lastCup }
    }
  }
  return scores
}

function parseResult(raw: unknown): StoredResult | null {
  if (!isObject(raw) || typeof raw.winner !== 'string' || typeof raw.decidedAt !== 'number') return null
  if (raw.reason !== 'target' && raw.reason !== 'time' && raw.reason !== 'forfeit') return null
  return { winner: raw.winner, reason: raw.reason, decidedAt: raw.decidedAt }
}

function parseFlags(raw: unknown): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  if (!isObject(raw)) return flags
  for (const [uid, value] of Object.entries(raw)) if (value === true) flags[uid] = true
  return flags
}

/** A stored result with the final scores (score nodes cannot change once a result exists). */
function withScores(result: StoredResult | null, meta: RoomMeta, scores: Record<string, RoomScore>): MatchResultRecord | null {
  if (!result) return null
  return {
    ...result,
    hostScore: scores[meta.hostUid]?.score ?? 0,
    guestScore: meta.guestUid ? (scores[meta.guestUid]?.score ?? 0) : 0,
  }
}

/* --------------------------------- actions -------------------------------- */

function playerNode(me: Me, api: DatabaseApi) {
  return { name: me.name, avatar: me.avatar, connected: true, lastSeen: api.serverTimestamp() }
}

async function session(): Promise<Connection & { uid: string }> {
  const uid = await ensureOnlineUser()
  const conn = await connect()
  await waitForConnection()
  return { ...conn, uid }
}

/** Opens a room with a fresh invitation code; the creator is its host. */
export async function createRoom(length: MatchLength, me: Me): Promise<RoomEntry> {
  try {
    const { db, api, uid } = await session()
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode()
      try {
        await withTimeout(
          api.update(api.ref(db, `rooms/${code}`), {
            meta: { hostUid: uid, status: 'waiting', length, seed: randomSeed(), round: 1, createdAt: api.serverTimestamp() },
            [`players/${uid}`]: playerNode(me, api),
          }),
        )
        return { code, uid, role: 'host' }
      } catch (error) {
        // The rules refuse to overwrite an existing room: that code is taken, so draw another.
        if (!isPermissionDenied(error)) throw error
      }
    }
    throw new RoomError('generic')
  } catch (error) {
    throw toRoomError(error)
  }
}

/**
 * Joins a friend's room. Entering the code of a room you are already in
 * (your own, or after a refresh) takes you back to it instead of failing.
 */
export async function joinRoom(input: string, me: Me): Promise<RoomEntry> {
  const code = normalizeRoomCode(input)
  if (!isValidRoomCode(code)) throw new RoomError('invalidCode')
  try {
    const { db, api, uid } = await session()
    const roomRef = api.ref(db, `rooms/${code}`)
    for (let attempt = 0; attempt < 2; attempt++) {
      const meta = parseMeta((await withTimeout(api.get(api.child(roomRef, 'meta')))).val())
      const check = checkJoin(meta, uid, serverNow())
      if (check === 'ownRoom' || check === 'alreadyJoined') {
        await withTimeout(api.update(roomRef, { [`players/${uid}`]: playerNode(me, api) }))
        return { code, uid, role: check === 'ownRoom' ? 'host' : 'guest' }
      }
      if (check !== 'ok') throw new RoomError(check)
      try {
        await withTimeout(api.update(roomRef, { 'meta/guestUid': uid, [`players/${uid}`]: playerNode(me, api) }))
        return { code, uid, role: 'guest' }
      } catch (error) {
        // Someone may have taken the seat a moment earlier: look again to explain why.
        if (!isPermissionDenied(error)) throw error
      }
    }
    throw new RoomError('permission')
  } catch (error) {
    throw toRoomError(error)
  }
}

/** Streams a room the player belongs to; `onChange(null)` means it is gone. */
export function watchRoom(
  code: string,
  onChange: (room: RoomSnapshot | null) => void,
  onError: (error: RoomError) => void,
): () => void {
  let stopped = false
  const offs: Array<() => void> = []
  let roundOffs: Array<() => void> = []
  let meta: RoomMeta | null = null
  let watchedRound = 0
  let players: Record<string, RoomPlayer> = {}
  let scores: Record<string, RoomScore> = {}
  let result: StoredResult | null = null
  let rematch: Record<string, boolean> = {}
  let playersWatched = false
  let emitQueued = false

  // One server update can touch several nodes (a catch and the result it wins);
  // their callbacks run back to back, so emit once after all of them.
  const emit = () => {
    if (emitQueued) return
    emitQueued = true
    queueMicrotask(() => {
      emitQueued = false
      if (stopped || !meta) return
      onChange({ code, meta, players, scores, result: withScores(result, meta, scores), rematch })
    })
  }

  void connect()
    .then(({ db, api }) => {
      if (stopped) return
      const roomRef = api.ref(db, `rooms/${code}`)
      const listen = (path: string, apply: (snapshot: DataSnapshot) => void, list: Array<() => void>) => {
        list.push(
          api.onValue(
            api.child(roomRef, path),
            (snapshot) => {
              apply(snapshot)
              emit()
            },
            (error) => !stopped && onError(toRoomError(error)),
          ),
        )
      }

      const watchRound = (round: number) => {
        roundOffs.forEach((off) => off())
        roundOffs = []
        watchedRound = round
        scores = {}
        result = null
        rematch = {}
        listen(`scores/${round}`, (s) => (scores = parseScores(s.val())), roundOffs)
        listen(`results/${round}`, (s) => (result = parseResult(s.val())), roundOffs)
        listen(`rematch/${round}`, (s) => (rematch = parseFlags(s.val())), roundOffs)
      }

      offs.push(
        api.onValue(
          api.child(roomRef, 'meta'),
          (snapshot) => {
            meta = parseMeta(snapshot.val())
            if (!meta) {
              if (!stopped) onChange(null)
              return
            }
            if (!playersWatched) {
              playersWatched = true
              listen('players', (s) => (players = parsePlayers(s.val())), offs)
            }
            if (meta.round !== watchedRound) watchRound(meta.round)
            emit()
          },
          (error) => !stopped && onError(toRoomError(error)),
        ),
      )
    })
    .catch((error: unknown) => onError(toRoomError(error)))

  return () => {
    stopped = true
    offs.forEach((off) => off())
    roundOffs.forEach((off) => off())
  }
}

/** Marks the player online now and offline (with the time) if the connection drops. */
export function trackPresence(code: string, uid: string): () => void {
  let stopped = false
  let off: (() => void) | null = null
  void connect().then(({ db, api }) => {
    if (stopped) return
    const playerRef = api.ref(db, `rooms/${code}/players/${uid}`)
    const watcher = api.onValue(api.ref(db, '.info/connected'), (snapshot) => {
      if (snapshot.val() !== true) return
      api
        .onDisconnect(playerRef)
        .update({ connected: false, lastSeen: api.serverTimestamp() })
        .then(() => api.update(playerRef, { connected: true, lastSeen: api.serverTimestamp() }))
        .catch(() => undefined)
    })
    off = () => {
      watcher()
      void api.onDisconnect(playerRef).cancel().catch(() => undefined)
    }
  })
  return () => {
    stopped = true
    off?.()
  }
}

async function write(path: string, value: unknown): Promise<void> {
  try {
    const { db, api } = await connect()
    await withTimeout(api.set(api.ref(db, path), value))
  } catch (error) {
    throw toRoomError(error)
  }
}

export function setReady(code: string, uid: string, round: number | null): Promise<void> {
  return write(`rooms/${code}/players/${uid}/readyRound`, round)
}

/** The host starts the countdown on the server's clock; both players use the same start time. */
export async function startMatch(code: string): Promise<void> {
  try {
    const { db, api } = await connect()
    await withTimeout(api.update(api.ref(db, `rooms/${code}/meta`), { status: 'live', countdownAt: api.serverTimestamp() }))
  } catch (error) {
    throw toRoomError(error)
  }
}

export function requestRematch(code: string, round: number, uid: string): Promise<void> {
  return write(`rooms/${code}/rematch/${round}/${uid}`, true)
}

/** The host opens the next round once both players asked for a rematch. */
export async function beginNextRound(code: string, round: number): Promise<void> {
  try {
    const { db, api } = await connect()
    await withTimeout(
      api.update(api.ref(db, `rooms/${code}/meta`), { round: round + 1, seed: randomSeed(), status: 'waiting', countdownAt: null }),
    )
  } catch (error) {
    throw toRoomError(error)
  }
}

/**
 * Sends one player's catches to the server in order. Each write claims one cup
 * and raises the stored score by exactly its points; the catch that reaches the
 * target carries the win with it, so "first to the target" is decided by the
 * server's order of writes.
 */
export class ScoreReporter {
  private confirmed = 0
  private decided = false
  private pending = 0
  private queue: Promise<unknown> = Promise.resolve()
  /** Called whenever the last outstanding catch has been answered by the server. */
  onIdle: (() => void) | null = null
  private readonly code: string
  private readonly round: number
  private readonly uid: string
  private readonly target: number

  constructor(code: string, round: number, uid: string, target: number) {
    this.code = code
    this.round = round
    this.uid = uid
    this.target = target
  }

  /** The score the server has accepted so far. */
  get score(): number {
    return this.confirmed
  }

  /**
   * True while catches are waiting for the server. The database shows a
   * client's own writes before the server accepts them, so what this player
   * sees of the round is only final once this is false.
   */
  get busy(): boolean {
    return this.pending > 0
  }

  report(cupId: number, points: number): Promise<boolean> {
    this.pending += 1
    const task = this.queue
      .then(() => this.send(cupId, points))
      .finally(() => {
        this.pending -= 1
        if (this.pending === 0) this.onIdle?.()
      })
    this.queue = task.catch(() => undefined)
    return task
  }

  private async send(cupId: number, points: number): Promise<boolean> {
    const { db, api } = await connect()
    const roomRef = api.ref(db, `rooms/${this.code}`)
    const next = this.confirmed + points
    const updates: Record<string, unknown> = {
      [`scores/${this.round}/${this.uid}`]: { score: next, lastCup: cupId },
      [`caught/${this.round}/${this.uid}/${cupId}`]: points,
    }
    const claimsWin = !this.decided && next >= this.target
    if (claimsWin) {
      updates[`results/${this.round}`] = { winner: this.uid, reason: 'target', decidedAt: api.serverTimestamp() }
    }
    try {
      await api.update(roomRef, updates)
    } catch (error) {
      if (!claimsWin || !isPermissionDenied(error)) return false
      // The win could not be claimed (the round may already be decided): still record the catch.
      delete updates[`results/${this.round}`]
      try {
        await api.update(roomRef, updates)
      } catch {
        return false
      }
      this.confirmed = next
      return true
    }
    this.confirmed = next
    if (claimsWin) this.decided = true
    return true
  }

  /** Resolves once every catch reported so far has been answered by the server. */
  flush(): Promise<unknown> {
    return this.queue
  }
}

async function readRound(code: string, round: number) {
  const { db, api } = await connect()
  const roomRef = api.ref(db, `rooms/${code}`)
  const [metaSnap, scoresSnap, resultSnap] = await withTimeout(
    Promise.all([api.get(api.child(roomRef, 'meta')), api.get(api.child(roomRef, `scores/${round}`)), api.get(api.child(roomRef, `results/${round}`))]),
  )
  return { api, roomRef, meta: parseMeta(metaSnap.val()), scores: parseScores(scoresSnap.val()), decided: resultSnap.exists() }
}

/** Once time is up, records the result decided by the stored scores (retrying if a late catch lands meanwhile). */
export async function claimTimeResult(code: string, round: number): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { api, roomRef, meta, scores, decided } = await readRound(code, round)
      if (decided || !meta || meta.round !== round || meta.status !== 'live') return
      const outcome = decideResult({ meta, players: {}, scores }, serverNow())
      if (outcome?.reason === 'time') {
        await withTimeout(
          api.set(api.child(roomRef, `results/${round}`), { winner: outcome.winner, reason: 'time', decidedAt: api.serverTimestamp() }),
        )
        return
      }
    } catch (error) {
      if (!isPermissionDenied(error) && !(error instanceof RoomError)) throw toRoomError(error)
    }
    await sleep(500)
  }
}

/** Ends the round as a forfeit: `winner` is the player who stays (or the opponent, when leaving). */
export async function claimForfeit(code: string, round: number, winner: string): Promise<void> {
  try {
    const { db, api } = await connect()
    await withTimeout(
      api.set(api.ref(db, `rooms/${code}/results/${round}`), { winner, reason: 'forfeit', decidedAt: api.serverTimestamp() }),
    )
  } catch (error) {
    throw toRoomError(error)
  }
}

/**
 * Leaves a room. A round in progress is forfeited first; the host closes the
 * room (or removes it when nobody joined), a guest frees the seat.
 */
export async function leaveRoom(entry: RoomEntry, room: RoomSnapshot | null): Promise<void> {
  const { db, api } = await connect()
  const roomRef = api.ref(db, `rooms/${entry.code}`)
  const meta = room?.meta
  if (meta && meta.status === 'live' && !room.result) {
    const opponent = meta.hostUid === entry.uid ? meta.guestUid : meta.hostUid
    if (opponent) await claimForfeit(entry.code, meta.round, opponent).catch(() => undefined)
  }
  if (entry.role === 'guest') {
    await withTimeout(api.update(roomRef, { 'meta/guestUid': null, [`players/${entry.uid}`]: null }))
  } else if (!meta?.guestUid) {
    await withTimeout(api.remove(roomRef))
  } else {
    await withTimeout(api.update(roomRef, { 'meta/status': 'closed', [`players/${entry.uid}`]: null }))
  }
}
