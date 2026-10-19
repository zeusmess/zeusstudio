/**
 * Runs database.rules.json in the Firebase Realtime Database emulator.
 *
 *   npm run test:rules        # starts the emulators, runs this file, stops them
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const NOW = { '.sv': 'timestamp' }
const [dbHost, dbPort] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9100').split(':')

let env

const as = (uid) => env.authenticatedContext(uid).database()
const guest = () => env.unauthenticatedContext().database()
const seed = (path, value) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(path).set(value)
  })

const ADMIN = 'owner-uid'

function newPlayer(extra = {}) {
  return {
    name: 'Mona Adel',
    title: 'باريستا (Barista)',
    store: 'Nile City Cairo',
    provider: 'employee',
    joinedAt: NOW,
    lastSeen: NOW,
    updatedAt: NOW,
    missionsDone: 0,
    xp: 0,
    rank: 'barista',
    chapter: 1,
    ...extra,
  }
}

function seededPlayer(extra = {}) {
  const now = Date.now()
  return {
    name: 'Mona Adel',
    title: 'باريستا (Barista)',
    provider: 'employee',
    joinedAt: now - 3_600_000,
    lastSeen: now - 60_000,
    updatedAt: now - 60_000,
    missionsDone: 10,
    xp: 500,
    rank: 'barista',
    chapter: 1,
    ...extra,
  }
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-starbucks-career-rules',
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
  await seed(`career/admins/${ADMIN}`, true)
})

describe('signing in is required', () => {
  it('keeps everything closed to visitors who are not signed in', async () => {
    await assertFails(guest().ref('career/players').get())
    await assertFails(guest().ref('career/config').get())
    await assertFails(guest().ref('career/hallOfFame').get())
  })

  it('lets any signed-in player read the players list, the config and the hall of fame', async () => {
    await assertSucceeds(as('a').ref('career/players').get())
    await assertSucceeds(as('a').ref('career/config').get())
    await assertSucceeds(as('a').ref('career/hallOfFame').get())
    await assertSucceeds(as('a').ref('career/moderation').get())
  })
})

describe('players (the public list)', () => {
  it('creates a profile with no missions and server timestamps', async () => {
    await assertSucceeds(as('a').ref('career/players/a').set(newPlayer()))
  })

  it('refuses a new profile that starts with completed missions', async () => {
    await assertFails(as('a').ref('career/players/a').set(newPlayer({ missionsDone: 5 })))
  })

  it("refuses to write someone else's profile", async () => {
    await assertFails(as('b').ref('career/players/a').set(newPlayer()))
  })

  it('refuses unknown fields and bad values', async () => {
    await assertFails(as('a').ref('career/players/a').set(newPlayer({ cheat: true })))
    await assertFails(as('a').ref('career/players/a').set(newPlayer({ name: 'x' })))
    await assertFails(as('a').ref('career/players/a').set(newPlayer({ provider: 'facebook' })))
    await assertFails(as('a').ref('career/players/a').set(newPlayer({ rank: 'ceo' })))
  })

  it('allows one mission per 20 seconds since the last progress update', async () => {
    await seed('career/players/a', seededPlayer())
    // 60 seconds since the last update: up to 3 more missions.
    await assertSucceeds(as('a').ref('career/players/a').update({ missionsDone: 13, updatedAt: NOW, lastSeen: NOW }))
  })

  it('refuses progress faster than that', async () => {
    await seed('career/players/a', seededPlayer())
    await assertFails(as('a').ref('career/players/a').update({ missionsDone: 15, updatedAt: NOW, lastSeen: NOW }))
  })

  it('never lets the mission count go down', async () => {
    await seed('career/players/a', seededPlayer())
    await assertFails(as('a').ref('career/players/a').update({ missionsDone: 9, updatedAt: NOW }))
  })

  it('keeps the joining date fixed', async () => {
    await seed('career/players/a', seededPlayer())
    await assertFails(as('a').ref('career/players/a').update({ joinedAt: Date.now() - 999_999_999 }))
  })

  it('accepts a heartbeat that only moves lastSeen', async () => {
    await seed('career/players/a', seededPlayer())
    await assertSucceeds(as('a').ref('career/players/a').update({ lastSeen: NOW }))
  })

  it('lets the admin correct or reset a player', async () => {
    await seed('career/players/a', seededPlayer())
    await assertSucceeds(as(ADMIN).ref('career/players/a').update({ missionsDone: 0, updatedAt: NOW }))
    await assertSucceeds(as(ADMIN).ref('career/players/a').remove())
  })

  it('blocks a banned player from writing', async () => {
    await seed('career/players/a', seededPlayer())
    await seed('career/moderation/a', { banned: true })
    await assertFails(as('a').ref('career/players/a').update({ lastSeen: NOW }))
  })
})

describe('private data (employee ID, full name)', () => {
  const privateData = () => ({
    fullName: 'Mona Adel',
    employeeId: 'E12345',
    jobTitle: 'باريستا (Barista)',
    store: 'Nile City Cairo',
    provider: 'employee',
    createdAt: Date.now(),
    consentAt: Date.now(),
  })

  it('is written and read by its owner', async () => {
    await assertSucceeds(as('a').ref('career/private/a').set(privateData()))
    await assertSucceeds(as('a').ref('career/private/a').get())
  })

  it('is hidden from other players', async () => {
    await seed('career/private/a', privateData())
    await assertFails(as('b').ref('career/private/a').get())
    await assertFails(as('b').ref('career/private').get())
  })

  it('is readable by the admin', async () => {
    await seed('career/private/a', privateData())
    await assertSucceeds(as(ADMIN).ref('career/private/a').get())
  })

  it('refuses an employee ID in the wrong format', async () => {
    await assertFails(as('a').ref('career/private/a').set({ ...privateData(), employeeId: 'e 12/45' }))
  })
})

describe('employee IDs are unique', () => {
  it('lets the first player claim an ID', async () => {
    await assertSucceeds(as('a').ref('career/employeeIds/E12345').set('a'))
  })

  it('refuses the same ID to a second player', async () => {
    await seed('career/employeeIds/E12345', 'a')
    await assertFails(as('b').ref('career/employeeIds/E12345').set('b'))
  })

  it('refuses a claim made in somebody else’s name', async () => {
    await assertFails(as('b').ref('career/employeeIds/E99999').set('a'))
  })

  it('lets the owner keep or release their ID', async () => {
    await seed('career/employeeIds/E12345', 'a')
    await assertSucceeds(as('a').ref('career/employeeIds/E12345').set('a'))
    await assertSucceeds(as('a').ref('career/employeeIds/E12345').remove())
  })

  it('stops new claims when the admin closes registration', async () => {
    await seed('career/config', { registrationOpen: false })
    await assertFails(as('a').ref('career/employeeIds/E12345').set('a'))
  })

  it('does not reveal who owns an ID', async () => {
    await seed('career/employeeIds/E12345', 'a')
    await assertFails(as('b').ref('career/employeeIds/E12345').get())
    await assertFails(as('b').ref('career/employeeIds').get())
  })
})

describe('only the admin controls the game', () => {
  it('refuses config changes from players', async () => {
    await assertFails(as('a').ref('career/config/maintenance').set(true))
    await assertFails(as('a').ref('career/config/announcement').set({ text: 'hi', level: 'info', updatedAt: Date.now() }))
  })

  it('accepts config changes from the admin', async () => {
    await assertSucceeds(as(ADMIN).ref('career/config/announcement').set({ text: 'مرحبا', level: 'info', updatedAt: Date.now() }))
    await assertSucceeds(as(ADMIN).ref('career/config/minVersion').set('2.0.0'))
    await assertSucceeds(as(ADMIN).ref('career/config/maintenance').set(true))
  })

  it('validates config values even from the admin', async () => {
    await assertFails(as(ADMIN).ref('career/config/minVersion').set('two'))
    await assertFails(as(ADMIN).ref('career/config/rewardMultiplier').set(50))
  })

  it('cannot make anyone an admin from the app', async () => {
    await assertFails(as('a').ref('career/admins/a').set(true))
    await assertFails(as(ADMIN).ref('career/admins/b').set(true))
  })

  it('lets a player check only their own admin flag', async () => {
    await assertSucceeds(as(ADMIN).ref(`career/admins/${ADMIN}`).get())
    await assertSucceeds(as('a').ref('career/admins/a').get())
    await assertFails(as('a').ref(`career/admins/${ADMIN}`).get())
  })

  it('keeps moderation in the admin’s hands', async () => {
    await assertFails(as('a').ref('career/moderation/b').set({ hidden: true }))
    await assertSucceeds(as(ADMIN).ref('career/moderation/b').set({ hidden: true, banned: false, updatedAt: Date.now() }))
  })

  it('writes an admin log entry only as the admin, in their own name', async () => {
    await assertSucceeds(as(ADMIN).ref('career/adminLog/x1').set({ by: ADMIN, action: 'ban', target: 'b', at: NOW }))
    await assertFails(as(ADMIN).ref('career/adminLog/x2').set({ by: 'someone', action: 'ban', at: NOW }))
    await assertFails(as('a').ref('career/adminLog/x3').set({ by: 'a', action: 'ban', at: NOW }))
    await assertFails(as('a').ref('career/adminLog').get())
  })
})

describe('cloud saves', () => {
  const save = () => ({ v: 2, savedAt: Date.now(), data: 'abc', appVersion: '2.0.0', missionsDone: 3 })

  it('belong to their owner', async () => {
    await assertSucceeds(as('a').ref('career/saves/a').set(save()))
    await assertSucceeds(as('a').ref('career/saves/a').get())
    await assertFails(as('b').ref('career/saves/a').get())
    await assertFails(as('b').ref('career/saves/a').set(save()))
  })

  it('can be reset or moved by the admin', async () => {
    await seed('career/saves/a', save())
    await assertSucceeds(as(ADMIN).ref('career/saves/a').get())
    await assertSucceeds(as(ADMIN).ref('career/saves/b').set(save()))
  })
})

describe('daily top 10', () => {
  const today = new Date().toISOString().slice(0, 10)

  it('takes a new entry with at most 3 missions', async () => {
    await assertSucceeds(as('a').ref(`career/daily/${today}/a`).set({ name: 'Mona Adel', title: 'Barista', missions: 2, updatedAt: NOW }))
    await assertFails(as('b').ref(`career/daily/${today}/b`).set({ name: 'Ali Samy', title: 'Barista', missions: 9, updatedAt: NOW }))
  })

  it('grows at the same pace as the mission count', async () => {
    await seed(`career/daily/${today}/a`, { name: 'Mona Adel', title: 'Barista', missions: 2, updatedAt: Date.now() - 41_000 })
    await assertSucceeds(as('a').ref(`career/daily/${today}/a`).update({ missions: 4, updatedAt: NOW }))
  })

  it('refuses a malformed date key and other players’ rows', async () => {
    await assertFails(as('a').ref('career/daily/today/a').set({ name: 'Mona Adel', title: 'Barista', missions: 1, updatedAt: NOW }))
    await assertFails(as('b').ref(`career/daily/${today}/a`).set({ name: 'Mona Adel', title: 'Barista', missions: 1, updatedAt: NOW }))
  })
})

describe('hall of fame (area managers’ board)', () => {
  const entry = () => ({ name: 'Mona Adel', title: 'باريستا (Barista)', store: 'Nile City Cairo', completedAt: NOW })

  it('stays closed before all 1000 missions', async () => {
    await seed('career/players/a', seededPlayer({ missionsDone: 999 }))
    await assertFails(as('a').ref('career/hallOfFame/a').set(entry()))
  })

  it('opens at 1000 missions, once', async () => {
    await seed('career/players/a', seededPlayer({ missionsDone: 1000 }))
    await assertSucceeds(as('a').ref('career/hallOfFame/a').set(entry()))
    await assertFails(as('a').ref('career/hallOfFame/a').set(entry()))
  })

  it('refuses entries for other players', async () => {
    await seed('career/players/a', seededPlayer({ missionsDone: 1000 }))
    await assertFails(as('b').ref('career/hallOfFame/a').set(entry()))
  })
})
