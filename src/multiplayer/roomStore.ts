import { create } from 'zustand'
import { getApp, useApp } from '../app/appStore'
import { audio } from '../audio/audioEngine'
import type { SessionResult } from '../game/core/types'
import type { GameController, RunEnd } from '../game/GameController'
import { exposeTestHooks } from '../game/controllerStore'
import { useHud } from '../game/hudStore'
import { loadController } from '../game/loadController'
import { getProfile, useProfile } from '../profile/profileStore'
import { KEY_PREFIX, safeStorage } from '../services/storage'
import type { AvatarId, MatchEndReason, MatchLength, MatchOutcome } from '../types'
import { useMatchClock } from './matchClock'
import { isValidRoomCode, normalizeRoomCode } from './roomCode'
import {
  bothReady,
  bothWantRematch,
  canStart,
  isMember,
  matchStartAt,
  opponentForfeits,
  opponentOf,
  outcomeFor,
  targetFor,
  timeLimitFor,
  type MatchResultRecord,
  type RoomSnapshot,
} from './roomLogic'
import {
  beginNextRound,
  claimForfeit,
  claimTimeResult,
  createRoom,
  joinRoom,
  leaveRoom,
  onConnectionChange,
  isConnected,
  requestRematch,
  RoomError,
  ScoreReporter,
  serverNow,
  setReady,
  startMatch,
  toRoomError,
  trackPresence,
  watchRoom,
  type RoomEntry,
  type RoomErrorCode,
} from './roomService'

/** A finished round, as the results screen shows it. */
export interface FinishedMatch {
  code: string
  round: number
  outcome: MatchOutcome
  reason: MatchEndReason
  myScore: number
  opponentScore: number
  opponentName: string
  opponentAvatar: AvatarId
  length: MatchLength
  target: number
}

export type RoomNotice = 'roomClosed' | 'opponentLeft' | 'matchInProgress'
type Busy = 'creating' | 'joining' | 'leaving' | 'ready' | 'starting' | 'rematch' | null

interface RoomState {
  entry: RoomEntry | null
  room: RoomSnapshot | null
  busy: Busy
  error: RoomErrorCode | null
  notice: RoomNotice | null
  online: boolean
  /** Code from an invitation link (?room=CODE), used to fill in the join form. */
  inviteCode: string
  lastMatch: FinishedMatch | null
  /** This player asked for a rematch of `lastMatch`. */
  rematchAsked: boolean
  /** The local game ended (target or time) and the server's result is on its way. */
  awaitingResult: boolean
  create: (length: MatchLength) => Promise<boolean>
  join: (code: string) => Promise<boolean>
  toggleReady: () => Promise<void>
  start: () => Promise<void>
  rematch: () => Promise<void>
  leave: () => Promise<void>
  dismiss: () => void
}

/** The room this device is in, so the join form can offer it again after a refresh. */
const ACTIVE_ROOM_KEY = `${KEY_PREFIX}activeRoom`
/** A player arriving this late to a running round (e.g. after a refresh) watches it end instead. */
const LATE_JOIN_MS = 2500
const TICK_MS = 500
const TIME_CLAIM_DELAY_MS = 400
const FORFEIT_RETRY_MS = 3000

/* ------------------------------ round tracking ----------------------------- */

let stopWatch: (() => void) | null = null
let stopPresence: (() => void) | null = null
let ticker: ReturnType<typeof setInterval> | null = null
let activeRound: number | null = null
let reporter: ScoreReporter | null = null
let lastPlay: SessionResult | null = null
let previousRoom: RoomSnapshot | null = null
let lastOpponent: { uid: string; name: string; avatar: AvatarId } | null = null
/** Result claims this client has sent that the server has not answered yet. */
let pendingClaims = 0
const timeClaims = new Set<string>()
const forfeitClaims = new Map<string, number>()
const rematchOpened = new Set<string>()
const autoReady = new Set<string>()
const autoStart = new Set<string>()
const attached = new WeakSet<GameController>()

const roundKey = (code: string, round: number) => `${code}:${round}`

function me(): { name: string; avatar: AvatarId } {
  const { profile } = getProfile()
  return { name: profile.displayName, avatar: profile.avatarId }
}

export const useRoom = create<RoomState>()((set, get) => {
  const fail = (error: unknown) => set({ error: toRoomError(error).code, busy: null })

  const enter = (entry: RoomEntry) => {
    stopRoom()
    set({ entry, room: null, error: null, notice: null, busy: null, lastMatch: null, rematchAsked: false })
    safeStorage.setItem(ACTIVE_ROOM_KEY, entry.code)
    stopWatch = watchRoom(entry.code, onRoom, onRoomError)
    stopPresence = trackPresence(entry.code, entry.uid)
    ticker = setInterval(tick, TICK_MS)
    // Fetch the game engine while the players get ready.
    void loadController().then(attachController)
  }

  return {
    entry: null,
    room: null,
    busy: null,
    error: null,
    notice: null,
    online: isConnected(),
    inviteCode: readInviteCode(),
    lastMatch: null,
    rematchAsked: false,
    awaitingResult: false,

    create: async (length) => {
      if (get().busy) return false
      set({ busy: 'creating', error: null, notice: null })
      try {
        enter(await createRoom(length, me()))
        return true
      } catch (error) {
        fail(error)
        return false
      }
    },

    join: async (code) => {
      if (get().busy) return false
      set({ busy: 'joining', error: null, notice: null })
      try {
        enter(await joinRoom(code, me()))
        return true
      } catch (error) {
        fail(error)
        return false
      }
    },

    toggleReady: async () => {
      const { entry, room } = get()
      if (!entry || !room || room.meta.status !== 'waiting' || get().busy) return
      const ready = room.players[entry.uid]?.readyRound === room.meta.round
      set({ busy: 'ready', error: null })
      try {
        await setReady(entry.code, entry.uid, ready ? null : room.meta.round)
        set({ busy: null })
      } catch (error) {
        fail(error)
      }
    },

    start: async () => {
      const { entry, room } = get()
      if (!entry || !room || !canStart(room, entry.uid) || get().busy) return
      set({ busy: 'starting', error: null })
      try {
        await startMatch(entry.code)
        set({ busy: null })
      } catch (error) {
        fail(error)
      }
    },

    rematch: async () => {
      const { entry, room, lastMatch } = get()
      if (!entry || !room || !lastMatch || get().rematchAsked || get().busy) return
      set({ busy: 'rematch', error: null })
      try {
        await requestRematch(entry.code, lastMatch.round, entry.uid)
        set({ busy: null, rematchAsked: true })
      } catch (error) {
        fail(error)
      }
    },

    leave: async () => {
      const { entry, room } = get()
      if (!entry) return
      set({ busy: 'leaving' })
      stopRoom()
      safeStorage.removeItem(ACTIVE_ROOM_KEY)
      try {
        await leaveRoom(entry, room)
      } catch {
        // Best effort: the server times out abandoned rooms and seats on its own.
      }
      set({ entry: null, room: null, busy: null, lastMatch: null, rematchAsked: false, awaitingResult: false })
    },

    dismiss: () => set({ error: null, notice: null }),
  }
})

function readInviteCode(): string {
  try {
    const code = normalizeRoomCode(new URLSearchParams(globalThis.location?.search ?? '').get('room') ?? '')
    if (isValidRoomCode(code)) return code
  } catch {
    // No location (tests).
  }
  const saved = safeStorage.getItem(ACTIVE_ROOM_KEY) ?? ''
  return isValidRoomCode(saved) ? saved : ''
}

onConnectionChange((online) => useRoom.setState({ online }))

function stopRoom(): void {
  stopWatch?.()
  stopPresence?.()
  if (ticker) clearInterval(ticker)
  stopWatch = null
  stopPresence = null
  ticker = null
  activeRound = null
  reporter = null
  previousRoom = null
  lastOpponent = null
  useMatchClock.getState().set(null)
  useHud.getState().set({ opponent: null })
}

/* ------------------------------ room updates ------------------------------- */

function onRoomError(error: RoomError): void {
  if (!useRoom.getState().entry) return
  useRoom.setState({ error: error.code })
}

function onRoom(room: RoomSnapshot | null): void {
  const { entry } = useRoom.getState()
  if (!entry) return
  if (!room || !isMember(room.meta, entry.uid) || (room.meta.status === 'closed' && entry.role === 'guest')) {
    roomGone()
    return
  }
  const before = previousRoom
  previousRoom = room
  const opponent = opponentOf(room.meta, entry.uid)
  const opponentPlayer = opponent ? room.players[opponent] : undefined
  if (opponent && opponentPlayer) lastOpponent = { uid: opponent, name: opponentPlayer.name, avatar: opponentPlayer.avatar }

  let notice = useRoom.getState().notice
  if (entry.role === 'host' && before?.meta.guestUid && !room.meta.guestUid) notice = 'opponentLeft'
  if (notice === 'opponentLeft' && room.meta.guestUid) notice = null
  useRoom.setState({ room, notice })

  syncOpponentHud(room, entry.uid)
  maybeStartRound(room, entry)
  maybeFinishRound(room, entry)
  maybeContinueRematch(room, entry)
}

/** The room was closed or removed by the host. */
function roomGone(): void {
  const { lastMatch } = useRoom.getState()
  stopRoom()
  safeStorage.removeItem(ACTIVE_ROOM_KEY)
  // On the results screen the last match stays visible, with rematch no longer possible.
  useRoom.setState({
    entry: null,
    room: null,
    busy: null,
    notice: 'roomClosed',
    lastMatch,
    awaitingResult: false,
  })
  const app = getApp()
  if (app.screen === 'COUNTDOWN' || app.screen === 'PLAYING') app.go('MENU')
}

function syncOpponentHud(room: RoomSnapshot, uid: string): void {
  const opponent = opponentOf(room.meta, uid)
  const player = opponent ? room.players[opponent] : undefined
  useHud.getState().set({
    opponent: player
      ? { name: player.name, avatar: player.avatar, score: room.scores[opponent!]?.score ?? 0, connected: player.connected }
      : null,
  })
}

function maybeStartRound(room: RoomSnapshot, entry: RoomEntry): void {
  const { meta } = room
  const startAt = matchStartAt(meta)
  if (meta.status !== 'live' || startAt === null || room.result || activeRound === meta.round) return
  const screen = useApp.getState().screen
  if (screen !== 'LOBBY' && screen !== 'MATCH_RESULTS') return
  if (serverNow() > startAt + LATE_JOIN_MS) {
    useRoom.setState({ notice: 'matchInProgress' })
    return
  }
  activeRound = meta.round
  lastPlay = null
  reporter = new ScoreReporter(entry.code, meta.round, entry.uid, targetFor(meta.length))
  reporter.onIdle = recheck
  // Both devices count down to the same server time.
  useMatchClock.getState().set(performance.now() + (startAt - serverNow()))
  useRoom.setState({ notice: null, error: null, awaitingResult: false, rematchAsked: false })
  getApp().startRun({ mode: 'versus', length: meta.length, seed: meta.seed, roomCode: entry.code, round: meta.round })
}

/** Looks at the latest room again once this client's own writes have been answered. */
function recheck(): void {
  const { entry } = useRoom.getState()
  if (entry && previousRoom) maybeFinishRound(previousRoom, entry)
}

/** Sends a result claim; the round is not read as final until the server has answered it. */
function claim(send: () => Promise<void>): Promise<void> {
  pendingClaims += 1
  return send().finally(() => {
    pendingClaims -= 1
    recheck()
  })
}

function maybeFinishRound(room: RoomSnapshot, entry: RoomEntry): void {
  const result = room.result
  if (!result || activeRound === null || room.meta.round !== activeRound) return
  // A result or score this client wrote may still be refused (e.g. the opponent won first).
  if (reporter?.busy || pendingClaims > 0) return
  activeRound = null
  reporter = null
  void loadController().then((controller) => controller.haltVersus())

  const finished = finishedMatch(room, result, entry)
  useRoom.setState({ lastMatch: finished, awaitingResult: false })
  useProfile.getState().recordMatch(
    {
      id: `${entry.code}-${finished.round}`,
      at: result.decidedAt,
      opponentName: finished.opponentName,
      opponentAvatar: finished.opponentAvatar,
      myScore: finished.myScore,
      opponentScore: finished.opponentScore,
      outcome: finished.outcome,
      reason: finished.reason,
      length: finished.length,
    },
    lastPlay,
  )
  audio.setMusic('off')
  audio.play(finished.outcome === 'win' ? 'victory' : finished.outcome === 'loss' ? 'gameOver' : 'streak')
  getApp().go('MATCH_RESULTS')
}

function finishedMatch(room: RoomSnapshot, result: MatchResultRecord, entry: RoomEntry): FinishedMatch {
  const { meta } = room
  const isHost = meta.hostUid === entry.uid
  const opponent = opponentOf(meta, entry.uid)
  const player = opponent ? room.players[opponent] : undefined
  return {
    code: entry.code,
    round: meta.round,
    outcome: outcomeFor(result, entry.uid),
    reason: result.reason,
    myScore: isHost ? result.hostScore : result.guestScore,
    opponentScore: isHost ? result.guestScore : result.hostScore,
    opponentName: player?.name ?? lastOpponent?.name ?? '—',
    opponentAvatar: player?.avatar ?? lastOpponent?.avatar ?? 'hot-cup',
    length: meta.length,
    target: targetFor(meta.length),
  }
}

/** Rematch: the host opens the next round, both players get ready, and the host starts it. */
function maybeContinueRematch(room: RoomSnapshot, entry: RoomEntry): void {
  const { meta } = room
  const { lastMatch, rematchAsked } = useRoom.getState()
  const isHost = meta.hostUid === entry.uid

  if (isHost && meta.status === 'live' && room.result && bothWantRematch(room)) {
    const key = roundKey(entry.code, meta.round)
    if (!rematchOpened.has(key)) {
      rematchOpened.add(key)
      beginNextRound(entry.code, meta.round).catch((error: unknown) => {
        rematchOpened.delete(key)
        useRoom.setState({ error: toRoomError(error).code })
      })
    }
  }

  const fromRematch = rematchAsked && lastMatch !== null && meta.round === lastMatch.round + 1
  if (!fromRematch || meta.status !== 'waiting') return
  const key = roundKey(entry.code, meta.round)
  if (room.players[entry.uid]?.readyRound !== meta.round && !autoReady.has(key)) {
    autoReady.add(key)
    setReady(entry.code, entry.uid, meta.round).catch(() => autoReady.delete(key))
  }
  if (isHost && bothReady(room) && !autoStart.has(key)) {
    autoStart.add(key)
    startMatch(entry.code).catch(() => autoStart.delete(key))
  }
}

/* ------------------------------ while playing ------------------------------ */

function attachController(controller: GameController): void {
  if (attached.has(controller)) return
  attached.add(controller)
  controller.addListener((event, session) => {
    if (event.type !== 'catch' || session.config.mode !== 'versus' || !reporter) return
    void reporter.report(event.cupId, event.points.total)
  })
  controller.onVersusEnd = onLocalEnd
}

function onLocalEnd({ result }: RunEnd): void {
  lastPlay = result
  if (activeRound === null) return
  useRoom.setState({ awaitingResult: true })
  useHud.getState().showBanner(result.outcome === 'complete' ? 'targetReached' : 'timeUp')
  if (result.outcome === 'timeUp') {
    const { entry } = useRoom.getState()
    const round = activeRound
    if (entry) setTimeout(() => claimTime(entry.code, round), TIME_CLAIM_DELAY_MS)
  }
}

function claimTime(code: string, round: number): void {
  const key = roundKey(code, round)
  if (timeClaims.has(key)) return
  timeClaims.add(key)
  // Let catches still on their way land first, so the final scores are complete.
  const pending = reporter?.flush() ?? Promise.resolve()
  void pending.then(() => claim(() => claimTimeResult(code, round))).catch(() => timeClaims.delete(key))
}

/** Ends the round when the time is up, or when the opponent has been gone long enough. */
function tick(): void {
  const { entry, room } = useRoom.getState()
  if (!entry || !room || activeRound === null || room.result || room.meta.round !== activeRound) return
  const startAt = matchStartAt(room.meta)
  if (startAt === null) return
  const now = serverNow()
  if (now >= startAt + timeLimitFor(room.meta.length) + TIME_CLAIM_DELAY_MS) claimTime(entry.code, activeRound)

  const opponent = opponentOf(room.meta, entry.uid)
  // Only judge presence once the player list has loaded (it always holds this player).
  if (!opponent || !room.players[entry.uid] || !opponentForfeits(room.players[opponent], now)) return
  const key = roundKey(entry.code, activeRound)
  if (now - (forfeitClaims.get(key) ?? 0) < FORFEIT_RETRY_MS) return
  forfeitClaims.set(key, now)
  const round = activeRound
  claim(() => claimForfeit(entry.code, round, entry.uid)).catch(() => undefined)
}

exposeTestHooks({ room: useRoom })
