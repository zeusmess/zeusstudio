import { MATCH_PRESETS } from '../game/levels/modes'
import type { AvatarId, MatchEndReason, MatchLength, MatchOutcome } from '../types'

/**
 * Pure rules of an online match. The same rules are enforced again on the
 * server by database.rules.json; these copies drive the UI and are unit-tested.
 */

/** Rooms waiting for a second player expire after 30 minutes. */
export const ROOM_JOIN_TTL_MS = 30 * 60 * 1000
/** Countdown between the host pressing Start and the first cup (shared clock). */
export const MATCH_COUNTDOWN_MS = 4000
/** An opponent offline this long during a match forfeits it. */
export const FORFEIT_AFTER_MS = 15_000
/** Rooms older than this may be cleared out by anyone. */
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000

export type RoomStatus = 'waiting' | 'live' | 'closed'

export interface RoomMeta {
  hostUid: string
  guestUid?: string | null
  status: RoomStatus
  length: MatchLength
  seed: number
  round: number
  createdAt: number
  countdownAt?: number | null
}

export interface RoomPlayer {
  name: string
  avatar: AvatarId
  readyRound?: number
  connected: boolean
  lastSeen?: number
}

export interface RoomScore {
  score: number
  lastCup: number
}

/** What the server stores when a round ends. */
export interface StoredResult {
  /** The winner's uid, or 'tie'. */
  winner: string
  reason: MatchEndReason
  decidedAt: number
}

/** A round's result with the final scores (read from the score nodes, which freeze once a result exists). */
export interface MatchResultRecord extends StoredResult {
  hostScore: number
  guestScore: number
}

/** A room as one player sees it; scores, result and rematch belong to the current round. */
export interface RoomSnapshot {
  code: string
  meta: RoomMeta
  players: Record<string, RoomPlayer>
  scores: Record<string, RoomScore>
  result: MatchResultRecord | null
  rematch: Record<string, boolean>
}

export type JoinCheck = 'ok' | 'notFound' | 'expired' | 'full' | 'started' | 'ownRoom' | 'alreadyJoined'

export function checkJoin(meta: RoomMeta | null, uid: string, serverNow: number): JoinCheck {
  if (!meta || meta.status === 'closed') return 'notFound'
  if (meta.hostUid === uid) return 'ownRoom'
  if (meta.guestUid === uid) return 'alreadyJoined'
  if (meta.guestUid) return 'full'
  if (meta.status !== 'waiting') return 'started'
  if (serverNow - meta.createdAt > ROOM_JOIN_TTL_MS) return 'expired'
  return 'ok'
}

export function isMember(meta: RoomMeta, uid: string): boolean {
  return meta.hostUid === uid || meta.guestUid === uid
}

export function opponentOf(meta: RoomMeta, uid: string): string | null {
  if (meta.hostUid === uid) return meta.guestUid ?? null
  if (meta.guestUid === uid) return meta.hostUid
  return null
}

export function isReady(meta: RoomMeta, player: RoomPlayer | undefined): boolean {
  return player?.readyRound === meta.round
}

export function bothReady(room: Pick<RoomSnapshot, 'meta' | 'players'>): boolean {
  const { meta, players } = room
  if (!meta.guestUid) return false
  return isReady(meta, players[meta.hostUid]) && isReady(meta, players[meta.guestUid])
}

export function canStart(room: Pick<RoomSnapshot, 'meta' | 'players'>, uid: string): boolean {
  return room.meta.status === 'waiting' && room.meta.hostUid === uid && bothReady(room)
}

/** Server time at which the first cup of the match starts falling. */
export function matchStartAt(meta: RoomMeta): number | null {
  return typeof meta.countdownAt === 'number' ? meta.countdownAt + MATCH_COUNTDOWN_MS : null
}

export function targetFor(length: MatchLength): number {
  return MATCH_PRESETS[length].target
}

export function timeLimitFor(length: MatchLength): number {
  return MATCH_PRESETS[length].timeLimitMs
}

/**
 * Decides a match from the stored scores, or returns null while it is still on.
 * `targetReachedBy` is the player whose catch just crossed the target (first
 * to reach it wins). Time up: higher score wins; equal scores tie.
 */
export function decideResult(
  room: Pick<RoomSnapshot, 'meta' | 'players' | 'scores'>,
  serverNow: number,
  options: { targetReachedBy?: string; forfeitBy?: string } = {},
): MatchResultRecord | null {
  const { meta, scores } = room
  const guest = meta.guestUid
  if (!guest) return null
  const hostScore = scores[meta.hostUid]?.score ?? 0
  const guestScore = scores[guest]?.score ?? 0
  const base = { decidedAt: serverNow, hostScore, guestScore }

  if (options.forfeitBy) {
    const winner = options.forfeitBy === meta.hostUid ? guest : meta.hostUid
    return { ...base, winner, reason: 'forfeit' }
  }

  const target = targetFor(meta.length)
  if (options.targetReachedBy) {
    const score = options.targetReachedBy === meta.hostUid ? hostScore : guestScore
    if (score >= target) return { ...base, winner: options.targetReachedBy, reason: 'target' }
  }

  const start = matchStartAt(meta)
  if (start !== null && serverNow >= start + timeLimitFor(meta.length)) {
    const winner = hostScore === guestScore ? 'tie' : hostScore > guestScore ? meta.hostUid : guest
    return { ...base, winner, reason: 'time' }
  }
  return null
}

/** Whether the opponent has been offline long enough to forfeit. */
export function opponentForfeits(player: RoomPlayer | undefined, serverNow: number): boolean {
  if (!player) return true
  return !player.connected && typeof player.lastSeen === 'number' && serverNow - player.lastSeen >= FORFEIT_AFTER_MS
}

export function outcomeFor(result: MatchResultRecord, uid: string): MatchOutcome {
  if (result.winner === 'tie') return 'tie'
  return result.winner === uid ? 'win' : 'loss'
}

export function bothWantRematch(room: Pick<RoomSnapshot, 'meta' | 'rematch'>): boolean {
  const { meta, rematch } = room
  return Boolean(meta.guestUid && rematch[meta.hostUid] && rematch[meta.guestUid])
}
