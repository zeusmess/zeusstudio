// Keeps the player's progress safe: the whole game on the device every few
// seconds and in the cloud every minute, published progress for the live
// lists, and a heartbeat for "active now".
import { emit, on } from '../core/events.js'
import { chooseSave, clearLegacySave, readLegacySave, readLocalSave, writeLocalSave } from './saves.js'

const LOCAL_EVERY_MS = 15_000
const CLOUD_EVERY_MS = 60_000
const HEARTBEAT_MS = 60_000
const PROGRESS_RETRY_MS = 25_000

export function createSync(session, game, hooks) {
  const { identity, cloud } = session
  const uid = identity.uid
  let progressSource = () => null
  let lastCloudSave = 0
  let cloudDirty = true
  let timers = []
  let progressTimer = null
  let pendingProgress = false
  let lastPublished = -1

  async function loadInitialState() {
    const local = readLocalSave(uid)
    let remote = null
    if (cloud) {
      try {
        remote = await cloud.loadSave()
      } catch (error) {
        console.warn('[sync] cloud save unavailable', error)
      }
    }
    const chosen = chooseSave(local, remote)
    if (chosen) return chosen.state
    // First start on this account: bring over a save from the first version of the app.
    const legacy = readLegacySave()
    if (legacy) {
      clearLegacySave()
      setTimeout(() => game.showToast('📦 تم نقل تقدمك من النسخة السابقة إلى حسابك الجديد!'), 2500)
      return legacy
    }
    return null
  }

  function saveLocal() {
    writeLocalSave(uid, game.state)
    cloudDirty = true
  }

  async function saveCloud(force = false) {
    if (!cloud || session.moderation?.banned) return
    if (!force && !cloudDirty) return
    if (!force && Date.now() - lastCloudSave < 10_000) return
    try {
      const progress = progressSource() || {}
      await cloud.writeSave(game.state, progress.missionsDone || 0)
      lastCloudSave = Date.now()
      cloudDirty = false
      emit('sync:saved', { at: lastCloudSave })
    } catch (error) {
      console.warn('[sync] cloud save failed', error)
      emit('sync:error', { error })
    }
  }

  async function publishProgress() {
    progressTimer = null
    if (!cloud || session.moderation?.banned) return
    const progress = progressSource()
    if (!progress) return
    try {
      const sent = await cloud.syncProgress(progress)
      lastPublished = sent ?? lastPublished
      if (sent !== null && sent < progress.missionsDone) schedulePublish(PROGRESS_RETRY_MS)
    } catch (error) {
      console.warn('[sync] progress publish failed', error)
      schedulePublish(PROGRESS_RETRY_MS)
    }
  }

  function schedulePublish(delay = 3_000) {
    pendingProgress = true
    if (progressTimer) return
    progressTimer = setTimeout(() => {
      pendingProgress = false
      void publishProgress()
    }, delay)
  }

  function flush() {
    saveLocal()
    void saveCloud(true)
  }

  function start() {
    hooks.onSave = () => saveLocal()
    timers.push(setInterval(saveLocal, LOCAL_EVERY_MS))
    if (cloud) {
      timers.push(setInterval(() => void saveCloud(), CLOUD_EVERY_MS))
      timers.push(
        setInterval(() => {
          if (document.visibilityState === 'visible') void cloud.heartbeat()
        }, HEARTBEAT_MS),
      )
      void cloud.heartbeat()
      schedulePublish(4_000)
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
      else if (cloud) void cloud.heartbeat()
    })
    window.addEventListener('pagehide', flush)
    // Moments worth saving straight away.
    for (const type of ['mission:completed', 'career:promoted', 'shift:end', 'day:end', 'quiz:finished']) {
      on(type, () => {
        saveLocal()
        if (cloud) {
          schedulePublish(2_500)
          setTimeout(() => void saveCloud(), 4_000)
        }
      })
    }
  }

  function stop() {
    timers.forEach(clearInterval)
    timers = []
  }

  return {
    loadInitialState,
    start,
    stop,
    flush,
    saveLocal,
    saveCloud,
    schedulePublish,
    setProgressSource: (fn) => (progressSource = fn),
    get lastPublished() {
      return lastPublished
    },
    get pending() {
      return pendingProgress
    },
  }
}
