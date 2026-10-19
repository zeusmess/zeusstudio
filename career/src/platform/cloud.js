// Everything stored in the Realtime Database under /career. The rules
// (database.rules.json) decide who may read and write each path; this module
// only shapes the data and respects the rules' pace limits.
import { APP_VERSION } from './config.js'
import { packCloud, unpack } from './saves.js'
import { cairoDateKey } from './time.js'

/** One mission per 20 s (database.rules.json); a little margin for clock drift. */
const MS_PER_MISSION = 20_000
const MARGIN_MS = 1_500

export class Cloud {
  constructor(fb, uid) {
    this.fb = fb
    this.uid = uid
    this.D = fb.D
    this.db = fb.db
    this.serverOffset = 0
    this.player = null // last known public row (missionsDone, updatedAt…)
    this.daily = null // { date, missions, updatedAt }
    this.unsubscribers = []
    const offsetRef = this.D.ref(this.db, '.info/serverTimeOffset')
    this.unsubscribers.push(this.D.onValue(offsetRef, (snap) => (this.serverOffset = Number(snap.val()) || 0)))
  }

  serverNow() {
    return Date.now() + this.serverOffset
  }

  ref(path) {
    return this.D.ref(this.db, path)
  }

  async get(path) {
    const snap = await this.D.get(this.ref(path))
    return snap.exists() ? snap.val() : null
  }

  dispose() {
    this.unsubscribers.forEach((off) => {
      try {
        off()
      } catch {
        // already detached
      }
    })
    this.unsubscribers = []
  }

  // ---------------------------------------------------------------- profile

  async loadProfile() {
    const [pub, priv, admin, moderation] = await Promise.all([
      this.get(`career/players/${this.uid}`),
      this.get(`career/private/${this.uid}`),
      this.get(`career/admins/${this.uid}`).catch(() => null),
      this.get(`career/moderation/${this.uid}`).catch(() => null),
    ])
    this.player = pub
    return { pub, priv, isAdmin: admin === true, moderation: moderation || {} }
  }

  /**
   * Creates (or completes) the player's rows in one atomic write: the employee
   * ID claim, the private record and the public profile.
   */
  async register({ fullName, publicName, employeeId, jobTitle, store, provider, email, photo }) {
    const T = this.D.serverTimestamp()
    const existing = await this.get(`career/players/${this.uid}`)
    const updates = {}
    if (employeeId) updates[`career/employeeIds/${employeeId}`] = this.uid
    const priv = { fullName, jobTitle, provider, createdAt: Date.now(), consentAt: Date.now() }
    if (employeeId) priv.employeeId = employeeId
    if (store) priv.store = store
    if (email) priv.email = email
    updates[`career/private/${this.uid}`] = priv
    if (existing) {
      updates[`career/players/${this.uid}/name`] = publicName
      updates[`career/players/${this.uid}/title`] = jobTitle
      updates[`career/players/${this.uid}/store`] = store || ''
      updates[`career/players/${this.uid}/provider`] = provider
      updates[`career/players/${this.uid}/lastSeen`] = T
      if (photo) updates[`career/players/${this.uid}/photo`] = photo
    } else {
      const row = {
        name: publicName,
        title: jobTitle,
        store: store || '',
        provider,
        joinedAt: T,
        lastSeen: T,
        updatedAt: T,
        missionsDone: 0,
        xp: 0,
        rank: 'barista',
        chapter: 1,
        appVersion: APP_VERSION,
      }
      if (photo) row.photo = photo
      updates[`career/players/${this.uid}`] = row
    }
    // Releasing a previous employee ID when it changes.
    const oldPriv = await this.get(`career/private/${this.uid}`).catch(() => null)
    if (oldPriv?.employeeId && oldPriv.employeeId !== employeeId) updates[`career/employeeIds/${oldPriv.employeeId}`] = null
    await this.D.update(this.ref('/'), updates)
    this.player = await this.get(`career/players/${this.uid}`)
  }

  heartbeat() {
    if (!this.player) return Promise.resolve()
    return this.D.update(this.ref(`career/players/${this.uid}`), { lastSeen: this.D.serverTimestamp() }).catch(() => {})
  }

  /**
   * Publishes progress, never faster than the rules allow. Returns the mission
   * count actually written, so the caller can try again later for the rest.
   */
  async syncProgress({ missionsDone, xp, rank, chapter, missionsToday }) {
    if (!this.player) this.player = await this.get(`career/players/${this.uid}`)
    if (!this.player) return null
    const now = this.serverNow()
    const known = Number(this.player.missionsDone) || 0
    const elapsed = Math.max(0, now - (Number(this.player.updatedAt) || now) - MARGIN_MS)
    const allowed = known + Math.floor(elapsed / MS_PER_MISSION)
    const target = Math.max(known, Math.min(1000, Math.floor(missionsDone || 0)))
    const send = Math.min(target, allowed)
    const T = this.D.serverTimestamp()
    const row = { missionsDone: send, xp: Math.max(0, Math.round(xp || 0)), rank, chapter, updatedAt: T, lastSeen: T, appVersion: APP_VERSION }
    await this.D.update(this.ref(`career/players/${this.uid}`), row)
    this.player = { ...this.player, ...row, updatedAt: now }

    if (typeof missionsToday === 'number' && missionsToday > 0) await this.syncDaily(missionsToday, xp).catch((e) => console.warn('[cloud] daily', e))
    if (send >= 1000) await this.claimHallOfFame().catch(() => {})
    return send
  }

  async syncDaily(missionsToday, xp) {
    const date = cairoDateKey(new Date(this.serverNow()))
    const path = `career/daily/${date}/${this.uid}`
    if (!this.daily || this.daily.date !== date) {
      const row = await this.get(path)
      this.daily = row ? { date, missions: row.missions, updatedAt: row.updatedAt } : { date, missions: null, updatedAt: 0 }
    }
    const now = this.serverNow()
    let send
    if (this.daily.missions === null) {
      send = Math.min(3, missionsToday)
    } else {
      const elapsed = Math.max(0, now - this.daily.updatedAt - MARGIN_MS)
      send = Math.min(missionsToday, this.daily.missions + Math.floor(elapsed / MS_PER_MISSION))
      if (send <= this.daily.missions) return
    }
    const T = this.D.serverTimestamp()
    await this.D.set(this.ref(path), {
      name: this.player?.name || 'لاعب',
      title: this.player?.title || '',
      store: this.player?.store || '',
      missions: send,
      xp: Math.max(0, Math.round(xp || 0)),
      updatedAt: T,
    })
    this.daily = { date, missions: send, updatedAt: now }
  }

  async claimHallOfFame() {
    const existing = await this.get(`career/hallOfFame/${this.uid}`)
    if (existing) return existing
    await this.D.set(this.ref(`career/hallOfFame/${this.uid}`), {
      name: this.player?.name || 'لاعب',
      title: this.player?.title || '',
      store: this.player?.store || '',
      completedAt: this.D.serverTimestamp(),
    })
    return true
  }

  // ------------------------------------------------------------------ saves

  async loadSave() {
    const record = await this.get(`career/saves/${this.uid}`)
    if (!record) return null
    const state = unpack(record, 'base64')
    return state ? { savedAt: record.savedAt || 0, state } : null
  }

  async writeSave(state, missionsDone) {
    const record = packCloud(state, Date.now(), missionsDone || 0)
    await this.D.set(this.ref(`career/saves/${this.uid}`), record)
    return record.savedAt
  }

  // --------------------------------------------------------- live listeners

  /** All registered players, most recently active first. */
  watchPlayers(callback, limit = 500) {
    const q = this.D.query(this.ref('career/players'), this.D.orderByChild('lastSeen'), this.D.limitToLast(limit))
    const off = this.D.onValue(q, (snap) => callback(rows(snap)), (err) => console.warn('[cloud] players', err))
    this.unsubscribers.push(off)
    return off
  }

  watchTopAllTime(callback) {
    const q = this.D.query(this.ref('career/players'), this.D.orderByChild('missionsDone'), this.D.limitToLast(40))
    const off = this.D.onValue(q, (snap) => callback(rows(snap)), (err) => console.warn('[cloud] top', err))
    this.unsubscribers.push(off)
    return off
  }

  watchTopToday(callback) {
    let date = cairoDateKey(new Date(this.serverNow()))
    let off = null
    const attach = () => {
      const q = this.D.query(this.ref(`career/daily/${date}`), this.D.orderByChild('missions'), this.D.limitToLast(40))
      off = this.D.onValue(q, (snap) => callback(rows(snap), date), (err) => console.warn('[cloud] daily', err))
    }
    attach()
    // A new Cairo day starts a new board.
    const timer = setInterval(() => {
      const next = cairoDateKey(new Date(this.serverNow()))
      if (next !== date) {
        off?.()
        date = next
        attach()
      }
    }, 60_000)
    const stop = () => {
      clearInterval(timer)
      off?.()
    }
    this.unsubscribers.push(stop)
    return stop
  }

  watchHallOfFame(callback) {
    const off = this.D.onValue(this.ref('career/hallOfFame'), (snap) => callback(rows(snap)), (err) => console.warn('[cloud] hof', err))
    this.unsubscribers.push(off)
    return off
  }

  watchModeration(callback) {
    const off = this.D.onValue(this.ref('career/moderation'), (snap) => callback(snap.val() || {}), () => callback({}))
    this.unsubscribers.push(off)
    return off
  }

  watchConfig(callback) {
    const off = this.D.onValue(this.ref('career/config'), (snap) => callback(snap.val() || {}), () => callback({}))
    this.unsubscribers.push(off)
    return off
  }

  // ------------------------------------------------------------ admin only

  async adminLog(action, target = '', detail = '') {
    const entry = { by: this.uid, action, at: this.D.serverTimestamp() }
    if (target) entry.target = String(target).slice(0, 128)
    if (detail) entry.detail = String(detail).slice(0, 300)
    await this.D.push(this.ref('career/adminLog'), entry)
  }

  async adminSetConfig(patch) {
    await this.D.update(this.ref('career/config'), { ...patch, updatedAt: Date.now() })
    await this.adminLog('config', '', Object.keys(patch).join(','))
  }

  async adminModerate(uid, patch, note = '') {
    const value = { ...patch, updatedAt: Date.now() }
    if (note) value.note = note.slice(0, 200)
    await this.D.update(this.ref(`career/moderation/${uid}`), value)
    await this.adminLog('moderate', uid, JSON.stringify(patch))
  }

  async adminReadPrivate() {
    // The admin may read each private record; there is no list read for anyone.
    return null
  }

  async adminGetPrivate(uid) {
    return this.get(`career/private/${uid}`)
  }

  async adminResetPlayer(uid) {
    const T = this.D.serverTimestamp()
    await this.D.update(this.ref('/'), {
      [`career/saves/${uid}`]: null,
      [`career/hallOfFame/${uid}`]: null,
      [`career/players/${uid}/missionsDone`]: 0,
      [`career/players/${uid}/xp`]: 0,
      [`career/players/${uid}/rank`]: 'barista',
      [`career/players/${uid}/chapter`]: 1,
      [`career/players/${uid}/updatedAt`]: T,
    })
    await this.adminLog('reset', uid)
  }

  async adminRemovePlayer(uid) {
    const priv = await this.get(`career/private/${uid}`)
    const updates = {
      [`career/players/${uid}`]: null,
      [`career/private/${uid}`]: null,
      [`career/saves/${uid}`]: null,
      [`career/hallOfFame/${uid}`]: null,
    }
    if (priv?.employeeId) updates[`career/employeeIds/${priv.employeeId}`] = null
    await this.D.update(this.ref('/'), updates)
    await this.adminLog('remove', uid)
  }

  /** Moves a player's progress to another account (a new phone, a reinstall). */
  async adminTransferProgress(fromUid, toUid) {
    const [save, fromPub, fromPriv, toPub] = await Promise.all([
      this.get(`career/saves/${fromUid}`),
      this.get(`career/players/${fromUid}`),
      this.get(`career/private/${fromUid}`),
      this.get(`career/players/${toUid}`),
    ])
    if (!toPub) throw new Error('الحساب الجديد غير مسجل')
    const T = this.D.serverTimestamp()
    const updates = {}
    if (save) updates[`career/saves/${toUid}`] = { ...save, savedAt: Date.now() }
    if (fromPub) {
      updates[`career/players/${toUid}/missionsDone`] = Math.max(Number(fromPub.missionsDone) || 0, Number(toPub.missionsDone) || 0)
      updates[`career/players/${toUid}/xp`] = Math.max(Number(fromPub.xp) || 0, Number(toPub.xp) || 0)
      updates[`career/players/${toUid}/rank`] = fromPub.rank || toPub.rank || 'barista'
      updates[`career/players/${toUid}/chapter`] = fromPub.chapter || toPub.chapter || 1
      updates[`career/players/${toUid}/updatedAt`] = T
    }
    if (fromPriv?.employeeId) {
      updates[`career/employeeIds/${fromPriv.employeeId}`] = toUid
    }
    updates[`career/moderation/${fromUid}`] = { hidden: true, banned: false, note: `moved to ${toUid}`.slice(0, 200), updatedAt: Date.now() }
    await this.D.update(this.ref('/'), updates)
    await this.adminLog('transfer', `${fromUid}>${toUid}`)
  }

  async adminLoadLog(limit = 100) {
    const q = this.D.query(this.ref('career/adminLog'), this.D.orderByChild('at'), this.D.limitToLast(limit))
    const snap = await this.D.get(q)
    return rows(snap).reverse()
  }

  // --------------------------------------------------------- player removal

  /** "Delete my data": the player's own rows. */
  async deleteMyData() {
    const priv = await this.get(`career/private/${this.uid}`).catch(() => null)
    const updates = {
      [`career/players/${this.uid}`]: null,
      [`career/private/${this.uid}`]: null,
      [`career/saves/${this.uid}`]: null,
    }
    if (priv?.employeeId) updates[`career/employeeIds/${priv.employeeId}`] = null
    await this.D.update(this.ref('/'), updates)
  }
}

function rows(snap) {
  const out = []
  snap.forEach((child) => {
    out.push({ uid: child.key, ...child.val() })
  })
  return out
}
