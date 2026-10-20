// Saving the whole game: compressed on the device (per account) and in the
// cloud, newest wins when both exist. An old save from the first version of the
// app (one shared slot) is imported once.
import LZString from 'lz-string'
import { APP_VERSION } from './config.js'

export const SAVE_VERSION = 2
const LOCAL_PREFIX = 'sbc_save_v2:'
export const LEGACY_KEY = 'sb_empire_sim_v3'

/** Strip what never needs saving (live orders, particles…). */
export function snapshotForSave(state) {
  return Object.assign({}, state, { orders: [], floatingTexts: [], particles: [] })
}

export function packLocal(state, savedAt = Date.now()) {
  const json = JSON.stringify(snapshotForSave(state))
  return { v: SAVE_VERSION, savedAt, appVersion: APP_VERSION, data: LZString.compressToUTF16(json) }
}

export function packCloud(state, savedAt = Date.now(), missionsDone = 0) {
  const json = JSON.stringify(snapshotForSave(state))
  return { v: SAVE_VERSION, savedAt, appVersion: APP_VERSION, missionsDone, data: LZString.compressToBase64(json) }
}

export function unpack(record, encoding) {
  if (!record || typeof record.data !== 'string') return null
  try {
    const json = encoding === 'base64' ? LZString.decompressFromBase64(record.data) : LZString.decompressFromUTF16(record.data)
    if (!json) return null
    const state = JSON.parse(json)
    return state && typeof state === 'object' && typeof state.money === 'number' ? state : null
  } catch {
    return null
  }
}

export function readLocalSave(uid) {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + uid)
    if (!raw) return null
    const record = JSON.parse(raw)
    const state = unpack(record, 'utf16')
    return state ? { savedAt: record.savedAt || 0, state } : null
  } catch {
    return null
  }
}

export function writeLocalSave(uid, state) {
  try {
    const record = packLocal(state)
    localStorage.setItem(LOCAL_PREFIX + uid, JSON.stringify(record))
    return record.savedAt
  } catch (error) {
    console.warn('[save] local save failed', error)
    return 0
  }
}

export function removeLocalSave(uid) {
  try {
    localStorage.removeItem(LOCAL_PREFIX + uid)
  } catch {
    // ignore
  }
}

/** The first version of the app kept one save under sb_empire_sim_v3. */
export function readLegacySave() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    return state && typeof state.money === 'number' && Array.isArray(state.staff) ? state : null
  } catch {
    return null
  }
}

export function clearLegacySave() {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
}

/**
 * Picks the save to start from.
 * @param {{savedAt:number,state:object}|null} local
 * @param {{savedAt:number,state:object}|null} cloud
 */
export function chooseSave(local, cloud) {
  if (local && cloud) return cloud.savedAt > local.savedAt ? { ...cloud, source: 'cloud' } : { ...local, source: 'local' }
  if (cloud) return { ...cloud, source: 'cloud' }
  if (local) return { ...local, source: 'local' }
  return null
}
