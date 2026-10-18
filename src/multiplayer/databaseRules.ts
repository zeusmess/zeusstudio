import { LEVEL_COUNT } from '../game/levels/levels'
import { MATCH_PRESETS, type MatchPreset } from '../game/levels/modes'
import type { MatchLength } from '../types'
import {
  CLOCK_SKEW_MS,
  CUP_ID_HEADROOM,
  CUP_IDS_PER_MS,
  ENDLESS_SCORE_HEADROOM,
  ENDLESS_SCORE_PER_MS,
  LATE_WRITE_MS,
  MATCH_SCORE_HEADROOM,
  MATCH_SCORE_PER_MS,
  maxPointsPerCatch,
} from './matchBounds'
import { CODE_PATTERN } from './roomCode'
import { FORFEIT_AFTER_MS, MATCH_COUNTDOWN_MS, ROOM_JOIN_TTL_MS, ROOM_TTL_MS } from './roomLogic'

/**
 * Firebase Realtime Database security rules, built from the game's own
 * constants so the server and the client can never disagree. They are the
 * referee of online matches: room membership, status changes, every cup scoring
 * at most once, scores rising only by the points of a newly claimed cup and
 * staying within what the elapsed time allows, and results that agree with the
 * stored scores.
 *
 * `npm run rules:build` writes them to database.rules.json;
 * databaseRules.test.ts fails if that file is out of date, and
 * tests/rules/database.rules.test.ts runs them in the Firebase emulator.
 */

export interface RuleNode {
  [key: string]: string | boolean | string[] | RuleNode
}

const and = (...parts: string[]) => parts.map((p) => `(${p})`).join(' && ')
const or = (...parts: string[]) => parts.map((p) => `(${p})`).join(' || ')
const oneOf = (expr: string, values: readonly string[]) => or(...values.map((v) => `${expr} === '${v}'`))

/** Display names are at most 20 letters; 60 code units leaves room for combining marks. */
const NAME_UNITS_MAX = 60
const ID_MAX = 24
const SEED_MAX = 0xffffffff

const signedIn = 'auth != null'

/* ---------------------------------- users ---------------------------------- */

const users: RuleNode = {
  $uid: {
    '.read': and(signedIn, 'auth.uid === $uid'),
    '.write': and(signedIn, 'auth.uid === $uid'),
    profile: {
      '.validate': "newData.hasChildren(['displayName', 'avatarId', 'basketSkin', 'updatedAt'])",
      displayName: { '.validate': and('newData.isString()', 'newData.val().length >= 2', `newData.val().length <= ${NAME_UNITS_MAX}`) },
      avatarId: { '.validate': and('newData.isString()', `newData.val().length <= ${ID_MAX}`) },
      basketSkin: { '.validate': and('newData.isString()', `newData.val().length <= ${ID_MAX}`) },
      createdAt: { '.validate': 'newData.isNumber()' },
      updatedAt: { '.validate': 'newData.isNumber()' },
      $other: { '.validate': false },
    },
    progress: {
      '.validate': "newData.hasChildren(['unlockedLevel'])",
      unlockedLevel: { '.validate': and('newData.isNumber()', 'newData.val() >= 1', `newData.val() <= ${LEVEL_COUNT}`) },
      totalCupsCaught: { '.validate': and('newData.isNumber()', 'newData.val() >= 0') },
      gamesPlayed: { '.validate': and('newData.isNumber()', 'newData.val() >= 0') },
    },
    $other: { '.validate': false },
  },
}

/* ------------------------------ endless scores ----------------------------- */

const runs: RuleNode = {
  $uid: {
    '.read': and(signedIn, 'auth.uid === $uid'),
    '.write': and(signedIn, 'auth.uid === $uid'),
    '.validate': "newData.hasChildren(['startedAt'])",
    startedAt: { '.validate': 'newData.val() === now' },
    $other: { '.validate': false },
  },
}

const runStart = "root.child('runs').child($uid).child('startedAt')"
const leaderboard: RuleNode = {
  endless: {
    '.read': true,
    '.indexOn': ['score'],
    $uid: {
      '.write': and(signedIn, 'auth.uid === $uid'),
      '.validate': and(
        "newData.hasChildren(['name', 'avatar', 'score', 'wave', 'at'])",
        // Only a better score replaces the stored one.
        or('!data.exists()', "newData.child('score').val() > data.child('score').val()"),
      ),
      name: { '.validate': and('newData.isString()', 'newData.val().length >= 2', `newData.val().length <= ${NAME_UNITS_MAX}`) },
      avatar: { '.validate': and('newData.isString()', `newData.val().length <= ${ID_MAX}`) },
      score: {
        '.validate': and(
          'newData.isNumber()',
          'newData.val() >= 0',
          'newData.val() % 1 === 0',
          `${runStart}.exists()`,
          `newData.val() <= (now - ${runStart}.val()) * ${ENDLESS_SCORE_PER_MS} + ${ENDLESS_SCORE_HEADROOM}`,
        ),
      },
      wave: { '.validate': and('newData.isNumber()', 'newData.val() >= 1', 'newData.val() <= 10000') },
      at: { '.validate': 'newData.val() === now' },
      $other: { '.validate': false },
    },
  },
}

/* ---------------------------------- rooms ---------------------------------- */

// The room as stored before the write.
const ROOM = "root.child('rooms').child($code)"
const META = `${ROOM}.child('meta')`
const HOST = `${META}.child('hostUid').val()`
const GUEST = `${META}.child('guestUid').val()`
const STATUS = `${META}.child('status').val()`
const ROUND = `${META}.child('round').val()`
const LENGTH = `${META}.child('length').val()`
const START_AT = `(${META}.child('countdownAt').val() + ${MATCH_COUNTDOWN_MS})`
const ELAPSED = `(now - ${START_AT})`
const isMember = or(`auth.uid === ${HOST}`, `auth.uid === ${GUEST}`)
const membersRead = and(signedIn, isMember)
const roundDecided = (round: string) => `${ROOM}.child('results').child(${round}).exists()`
const currentRoundDecided = roundDecided(`${ROUND} + ''`)

const LENGTHS = Object.keys(MATCH_PRESETS) as MatchLength[]
const perLength = (build: (preset: MatchPreset, length: MatchLength) => string) =>
  or(...LENGTHS.map((length) => and(`${LENGTH} === '${length}'`, build(MATCH_PRESETS[length], length))))

/** The round is the live one, its first cup is due (shared clock) and it has no result yet. */
const liveRound = (round: string) =>
  and(
    `${STATUS} === 'live'`,
    `${ROUND} + '' === ${round}`,
    `now >= ${START_AT} - ${CLOCK_SKEW_MS}`,
    `!${roundDecided(round)}`,
    perLength(({ timeLimitMs }) => `now <= ${START_AT} + ${timeLimitMs + LATE_WRITE_MS}`),
  )

// Inside rooms/$code/meta/<field>: the meta node after and before the write.
const NEW_META = 'newData.parent()'
const OLD_META = 'data.parent()'
const hostEdits = and(signedIn, `auth.uid === ${HOST}`)
const playerReady = (uid: string) =>
  `${ROOM}.child('players').child(${uid}).child('readyRound').val() === ${NEW_META}.child('round').val()`
const rematchWanted = (uid: string) => `${ROOM}.child('rematch').child(data.val() + '').child(${uid}).val() === true`

const meta: RuleNode = {
  '.read': signedIn,
  // Writing the whole node only creates a room; later changes are per field (below).
  '.write': and(signedIn, '!data.exists()', "newData.child('hostUid').val() === auth.uid"),
  '.validate': and(
    "newData.hasChildren(['hostUid', 'status', 'length', 'seed', 'round', 'createdAt'])",
    `$code.matches(/${CODE_PATTERN.source}/)`,
  ),
  hostUid: { '.validate': and('newData.isString()', or('!data.exists()', 'newData.val() === data.val()')) },
  guestUid: {
    '.write': and(
      signedIn,
      or(
        // A second player takes the open seat for themselves…
        and(
          '!data.exists()',
          `${NEW_META}.child('status').val() === 'waiting'`,
          `${NEW_META}.child('createdAt').val() + ${ROOM_JOIN_TTL_MS} > now`,
        ),
        // …or gives it up while no round is being played.
        and('data.val() === auth.uid', '!newData.exists()', or(`${OLD_META}.child('status').val() !== 'live'`, currentRoundDecided)),
      ),
    ),
    '.validate': and(
      'newData.isString()',
      'newData.val() === auth.uid',
      `newData.val() !== ${NEW_META}.child('hostUid').val()`,
      or('!data.exists()', 'newData.val() === data.val()'),
    ),
  },
  status: {
    '.write': hostEdits,
    '.validate': or(
      and(
        "newData.val() === 'waiting'",
        or(
          '!data.exists()',
          "data.val() === 'waiting'",
          // A rematch: back to the lobby for the next round.
          and("data.val() === 'live'", `${NEW_META}.child('round').val() === ${OLD_META}.child('round').val() + 1`),
        ),
      ),
      and("newData.val() === 'closed'", or("data.val() !== 'live'", currentRoundDecided)),
      and(
        "newData.val() === 'live'",
        or(
          "data.val() === 'live'",
          and(
            "data.val() === 'waiting'",
            `${NEW_META}.child('guestUid').exists()`,
            playerReady(`${NEW_META}.child('hostUid').val()`),
            playerReady(`${NEW_META}.child('guestUid').val()`),
            `${NEW_META}.child('countdownAt').val() === now`,
          ),
        ),
      ),
    ),
  },
  length: {
    '.validate': and(oneOf('newData.val()', LENGTHS), or('!data.exists()', 'newData.val() === data.val()')),
  },
  seed: {
    '.write': hostEdits,
    '.validate': and(
      'newData.isNumber()',
      'newData.val() >= 0',
      `newData.val() <= ${SEED_MAX}`,
      'newData.val() % 1 === 0',
      or('!data.exists()', 'newData.val() === data.val()', `${NEW_META}.child('round').val() === ${OLD_META}.child('round').val() + 1`),
    ),
  },
  round: {
    '.write': hostEdits,
    '.validate': and(
      'newData.isNumber()',
      or(
        and('!data.exists()', 'newData.val() === 1'),
        'newData.val() === data.val()',
        // The next round needs a result for this one and both players asking for a rematch.
        and(
          'newData.val() === data.val() + 1',
          `${NEW_META}.child('status').val() === 'waiting'`,
          roundDecided("data.val() + ''"),
          rematchWanted(HOST),
          rematchWanted(GUEST),
        ),
      ),
    ),
  },
  createdAt: { '.validate': or(and('!data.exists()', 'newData.val() === now'), 'newData.val() === data.val()') },
  countdownAt: {
    // Set by the host's Start (to the server's clock); cleared for the next round.
    '.write': and(hostEdits, or('newData.exists()', `${NEW_META}.child('status').val() !== 'live'`)),
    '.validate': or(
      and('newData.val() === now', `${OLD_META}.child('status').val() === 'waiting'`, `${NEW_META}.child('status').val() === 'live'`),
      'newData.val() === data.val()',
    ),
  },
  $other: { '.validate': false },
}

// Inside rooms/$code/players/$uid: the room after the write (one more parent() from a field).
const NEW_ROOM_FROM_PLAYER = 'newData.parent().parent()'
const players: RuleNode = {
  '.read': membersRead,
  $uid: {
    '.write': and(
      signedIn,
      'auth.uid === $uid',
      or(
        `${NEW_ROOM_FROM_PLAYER}.child('meta').child('hostUid').val() === $uid`,
        `${NEW_ROOM_FROM_PLAYER}.child('meta').child('guestUid').val() === $uid`,
        '!newData.exists()',
      ),
    ),
    '.validate': "newData.hasChildren(['name', 'avatar', 'connected'])",
    name: { '.validate': and('newData.isString()', 'newData.val().length >= 1', `newData.val().length <= ${NAME_UNITS_MAX}`) },
    avatar: { '.validate': and('newData.isString()', `newData.val().length <= ${ID_MAX}`) },
    readyRound: {
      '.validate': and('newData.isNumber()', "newData.val() === newData.parent().parent().parent().child('meta').child('round').val()"),
    },
    connected: { '.validate': 'newData.isBoolean()' },
    lastSeen: { '.validate': and('newData.isNumber()', 'newData.val() <= now') },
    $other: { '.validate': false },
  },
}

// Inside rooms/$code/scores/$round/$uid: the points recorded for the claimed cup in this same write.
const NEW_CAUGHT =
  "newData.parent().parent().parent().child('caught').child($round).child($uid).child(newData.child('lastCup').val() + '')"
const scores: RuleNode = {
  '.read': membersRead,
  $round: {
    $uid: {
      '.write': and(signedIn, 'auth.uid === $uid', isMember, liveRound('$round')),
      '.validate': and(
        "newData.hasChildren(['score', 'lastCup'])",
        "newData.child('score').isNumber()",
        "newData.child('lastCup').isNumber()",
        "newData.child('lastCup').val() >= 0",
        "newData.child('lastCup').val() % 1 === 0",
        // A cup cannot be caught before it could have fallen…
        `newData.child('lastCup').val() <= ${ELAPSED} * ${CUP_IDS_PER_MS} + ${CUP_ID_HEADROOM}`,
        // …it scores once, with its points recorded in this same write…
        `!${ROOM}.child('caught').child($round).child($uid).child(newData.child('lastCup').val() + '').exists()`,
        `${NEW_CAUGHT}.isNumber()`,
        // …the score rises by exactly those points…
        `newData.child('score').val() === (data.exists() ? data.child('score').val() : 0) + ${NEW_CAUGHT}.val()`,
        // …and stays within what the elapsed time allows.
        `newData.child('score').val() <= ${ELAPSED} * ${MATCH_SCORE_PER_MS} + ${MATCH_SCORE_HEADROOM}`,
      ),
      score: { '.validate': 'newData.val() >= 0' },
      lastCup: { '.validate': true },
      $other: { '.validate': false },
    },
  },
}

const caught: RuleNode = {
  '.read': membersRead,
  $round: {
    $uid: {
      $cup: {
        '.write': and(signedIn, 'auth.uid === $uid', isMember, '!data.exists()', liveRound('$round')),
        '.validate': and(
          'newData.isNumber()',
          'newData.val() >= 0',
          'newData.val() % 1 === 0',
          perLength((_, length) => `newData.val() <= ${maxPointsPerCatch(length)}`),
          "newData.parent().parent().parent().parent().child('scores').child($round).child($uid).child('lastCup').val() + '' === $cup",
        ),
      },
    },
  },
}

// Inside rooms/$code/results/$round: final scores as stored once this write lands.
const finalScore = (uid: string) => {
  const node = `newData.parent().parent().child('scores').child($round).child(${uid}).child('score')`
  return `(${node}.exists() ? ${node}.val() : 0)`
}
const WINNER = "newData.child('winner').val()"
const offline = (uid: string) => {
  const player = `${ROOM}.child('players').child(${uid})`
  return or(
    `!${player}.exists()`,
    and(`${player}.child('connected').val() === false`, `now - ${player}.child('lastSeen').val() >= ${FORFEIT_AFTER_MS}`),
  )
}

const results: RuleNode = {
  '.read': membersRead,
  $round: {
    '.write': and(
      signedIn,
      isMember,
      '!data.exists()',
      `${STATUS} === 'live'`,
      `${ROUND} + '' === $round`,
      `now >= ${START_AT} - ${CLOCK_SKEW_MS}`,
    ),
    '.validate': and(
      "newData.hasChildren(['winner', 'reason', 'decidedAt'])",
      or(
        // First to the target: the winner's stored score has reached it.
        and(
          "newData.child('reason').val() === 'target'",
          or(
            and(`${WINNER} === ${HOST}`, perLength(({ target }) => `${finalScore(HOST)} >= ${target}`)),
            and(`${WINNER} === ${GUEST}`, perLength(({ target }) => `${finalScore(GUEST)} >= ${target}`)),
          ),
        ),
        // Time up: the higher stored score wins; equal scores tie.
        and(
          "newData.child('reason').val() === 'time'",
          perLength(({ timeLimitMs }) => `now >= ${START_AT} + ${timeLimitMs}`),
          or(
            and(`${WINNER} === 'tie'`, `${finalScore(HOST)} === ${finalScore(GUEST)}`),
            and(`${WINNER} === ${HOST}`, `${finalScore(HOST)} > ${finalScore(GUEST)}`),
            and(`${WINNER} === ${GUEST}`, `${finalScore(GUEST)} > ${finalScore(HOST)}`),
          ),
        ),
        // Forfeit: the loser leaves (and says so), or has been offline long enough.
        and(
          "newData.child('reason').val() === 'forfeit'",
          `${WINNER} !== 'tie'`,
          or(`${WINNER} !== auth.uid`, and(`${WINNER} === ${HOST}`, offline(GUEST)), and(`${WINNER} === ${GUEST}`, offline(HOST))),
        ),
      ),
    ),
    winner: { '.validate': and('newData.isString()', or(`newData.val() === ${HOST}`, `newData.val() === ${GUEST}`, "newData.val() === 'tie'")) },
    reason: { '.validate': oneOf('newData.val()', ['target', 'time', 'forfeit']) },
    decidedAt: { '.validate': 'newData.val() === now' },
    $other: { '.validate': false },
  },
}

const rematch: RuleNode = {
  '.read': membersRead,
  $round: {
    $uid: {
      '.write': and(signedIn, 'auth.uid === $uid', isMember, roundDecided('$round')),
      '.validate': 'newData.val() === true',
    },
  },
}

const rooms: RuleNode = {
  $code: {
    // The host may remove a room between rounds; anyone may clear out abandoned ones.
    '.write': and(
      signedIn,
      '!newData.exists()',
      or(
        and(
          "data.child('meta').child('hostUid').val() === auth.uid",
          or(
            "data.child('meta').child('status').val() !== 'live'",
            "data.child('results').child(data.child('meta').child('round').val() + '').exists()",
          ),
        ),
        "!data.child('meta').exists()",
        `data.child('meta').child('createdAt').val() + ${ROOM_TTL_MS} < now`,
      ),
    ),
    meta,
    players,
    scores,
    caught,
    results,
    rematch,
    $other: { '.validate': false },
  },
}

export function buildDatabaseRules(): { rules: RuleNode } {
  return {
    rules: {
      '.read': false,
      '.write': false,
      users,
      runs,
      leaderboard,
      rooms,
    },
  }
}

/** The exact text of database.rules.json. */
export function databaseRulesJson(): string {
  return `${JSON.stringify(buildDatabaseRules(), null, 2)}\n`
}
