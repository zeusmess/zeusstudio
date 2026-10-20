// Runs the 1000 missions: which five are active, how far along each one is,
// failing day/shift missions when a constraint breaks, rewarding completions.
import { emit, on } from '../../core/events.js'
import { cairoDateKey } from '../../platform/time.js'
import { ensureMetrics } from '../metrics.js'
import { ensureSbc } from '../sbc.js'
import { allMissions, TOTAL_MISSIONS } from './generator.js'

export const ACTIVE_COUNT = 5
export const DEFER_COST = 25

export function ensureMissions(state) {
  const sbc = ensureSbc(state)
  const ms = sbc.missions
  ms.done ??= []
  ms.active ??= {}
  ms.deferred ??= {}
  ms.recent ??= []
  ms.todayKey ??= ''
  ms.todayCount ??= 0
  ms.chapterDone ??= []
  sbc.career.xp ??= 0
  sbc.career.cp ??= 0
  return ms
}

export function doneSet(state) {
  const ms = ensureMissions(state)
  if (!ms._set || ms._setSize !== ms.done.length) {
    Object.defineProperty(ms, '_set', { value: new Set(ms.done), writable: true, enumerable: false, configurable: true })
    Object.defineProperty(ms, '_setSize', { value: ms.done.length, writable: true, enumerable: false, configurable: true })
  }
  return ms._set
}

export function missionsDone(state) {
  return ensureMissions(state).done.length
}

export function currentChapter(state) {
  const done = doneSet(state)
  const missions = allMissions()
  for (let n = 1; n <= 10; n++) {
    const from = (n - 1) * 100
    for (let i = from; i < from + 100; i++) if (!done.has(i)) return n
  }
  return 11
}

function snapshot(state, mission) {
  const m = ensureMetrics(state)
  const keys = [...mission.req.map((r) => r.metric), ...mission.constraints.map((c) => c.metric)]
  const base = {}
  const dayBase = {}
  const shiftBase = {}
  for (const k of keys) {
    base[k] = m.life[k] || 0
    dayBase[k] = m.day[k] || 0
    shiftBase[k] = m.shift[k] || 0
  }
  return { base, dayBase, shiftBase }
}

function newEntry(state, mission) {
  const m = ensureMetrics(state)
  return {
    idx: mission.idx,
    since: { day: state.day, shift: m.shiftKey },
    ...snapshot(state, mission),
    run: {},
    failedDay: null,
    failedShift: null,
    resets: 0,
  }
}

/** Value of one metric for a mission, counted the way its scope says. */
export function scopedValue(state, mission, entry, metric) {
  const m = ensureMetrics(state)
  switch (mission.scope) {
    case 'life':
      return (m.life[metric] || 0) - (entry.base[metric] || 0)
    case 'day':
      return (m.day[metric] || 0) - (entry.dayBase[metric] || 0)
    case 'shift':
      return (m.shift[metric] || 0) - (entry.shiftBase[metric] || 0)
    case 'streak':
      return entry.run[metric] || 0
    case 'total':
      return m.life[metric] || 0
    default:
      return 0
  }
}

/** { ratio 0..1, parts: [{metric,value,target}], failed: 'day'|'shift'|null } */
export function progressOf(state, mission, entry) {
  if (!entry) return { ratio: 0, parts: mission.req.map((r) => ({ ...r, value: 0 })), failed: null }
  const parts = mission.req.map((r) => {
    const value = Math.max(0, scopedValue(state, mission, entry, r.metric))
    return { metric: r.metric, target: r.target, value: Math.min(value, r.target) }
  })
  const ratio = parts.reduce((acc, p) => Math.min(acc, p.target ? p.value / p.target : 1), 1)
  const m = ensureMetrics(state)
  let failed = null
  if (mission.scope === 'day' && entry.failedDay === state.day) failed = 'day'
  if (mission.scope === 'shift' && entry.failedShift && entry.failedShift === m.shiftKey) failed = 'shift'
  return { ratio, parts, failed }
}

export function installMissions({ getState, game, getRewardMultiplier = () => 1 }) {
  const missions = allMissions()
  let queued = false

  function refreshActive() {
    const state = getState()
    const ms = ensureMissions(state)
    const done = doneSet(state)
    const chapter = currentChapter(state)
    if (chapter > 10) {
      ms.active = {}
      return
    }
    const from = (chapter - 1) * 100
    const open = []
    for (let i = from; i < from + 100; i++) if (!done.has(i)) open.push(i)
    const ready = open.filter((i) => !(ms.deferred[i] > state.day))
    const pool = ready.length > 0 ? ready : open
    const pick = pool.slice(0, ACTIVE_COUNT)
    const next = {}
    for (const i of pick) next[i] = ms.active[i] || newEntry(state, missions[i])
    ms.active = next
  }

  function checkConstraints(state) {
    const ms = ensureMissions(state)
    const m = ensureMetrics(state)
    for (const key of Object.keys(ms.active)) {
      const entry = ms.active[key]
      const mission = missions[entry.idx]
      for (const c of mission.constraints) {
        const value = scopedValue(state, mission, entry, c.metric)
        if (value <= c.max) continue
        if (mission.scope === 'day' && entry.failedDay !== state.day) {
          entry.failedDay = state.day
          game.showToast(`⚠️ فشلت مهمة «${mission.title}» اليوم — تقدر تعيدها بكرة من أول اليوم.`)
        } else if (mission.scope === 'shift' && entry.failedShift !== m.shiftKey) {
          entry.failedShift = m.shiftKey
          game.showToast(`⚠️ فشلت مهمة «${mission.title}» في هذه الوردية — تقدر تعيدها الوردية الجاية.`)
        } else if (mission.scope === 'life') {
          Object.assign(entry, snapshot(state, mission))
          entry.resets += 1
          game.showToast(`🔄 تم تصفير تقدم «${mission.title}» بسبب زبون غاضب — ابدأ من جديد!`)
        }
      }
    }
  }

  function complete(state, mission) {
    const ms = ensureMissions(state)
    const career = ensureSbc(state).career
    if (doneSet(state).has(mission.idx)) return
    ms.done.push(mission.idx)
    delete ms.active[mission.idx]
    delete ms.deferred[mission.idx]
    const mult = Math.max(0.5, Math.min(3, Number(getRewardMultiplier()) || 1))
    const money = Math.round(mission.reward.money * mult)
    const xp = Math.round(mission.reward.xp * mult)
    state.money = +(state.money + money).toFixed(2)
    career.xp = (career.xp || 0) + xp
    career.cp = (career.cp || 0) + mission.reward.cp
    const today = cairoDateKey()
    if (ms.todayKey !== today) {
      ms.todayKey = today
      ms.todayCount = 0
    }
    ms.todayCount += 1
    ms.recent.unshift({ idx: mission.idx, day: state.day, at: Date.now() })
    ms.recent = ms.recent.slice(0, 30)

    game.playSound('fanfare')
    game.addFloatingText(`🏆 مهمة #${mission.number} +$${money}`, 480, 170, '#fbbf24')
    game.spawnSparkles(480, 180, '#CBA258')
    game.showToast(`🏆 أنجزت المهمة #${mission.number}: «${mission.title}» (+$${money} • +${xp} XP)`)
    emit('mission:completed', { mission, count: ms.done.length, money, xp })

    const chapterLeft = missions.filter((x) => x.chapter === mission.chapter && !doneSet(state).has(x.idx)).length
    if (chapterLeft === 0 && !ms.chapterDone.includes(mission.chapter)) {
      ms.chapterDone.push(mission.chapter)
      emit('mission:chapterDone', { chapter: mission.chapter })
    }
    if (ms.done.length >= TOTAL_MISSIONS) emit('missions:allDone', { at: Date.now() })
  }

  function evaluate() {
    queued = false
    const state = getState()
    if (!state) return
    refreshActive()
    checkConstraints(state)
    const ms = ensureMissions(state)
    let completedAny = false
    for (const key of Object.keys(ms.active)) {
      const entry = ms.active[key]
      const mission = missions[entry.idx]
      const p = progressOf(state, mission, entry)
      if (!p.failed && p.ratio >= 1) {
        complete(state, mission)
        completedAny = true
      }
    }
    if (completedAny) {
      refreshActive()
      // A new mission may already be satisfied (a "total" one).
      queue()
    }
    emit('missions:changed', {})
  }

  function queue() {
    if (queued) return
    queued = true
    queueMicrotask(evaluate)
  }

  on('metric:inc', queue)
  on('metric:streak', ({ key }) => {
    const state = getState()
    const ms = ensureMissions(state)
    for (const entry of Object.values(ms.active)) {
      const mission = missions[entry.idx]
      if (mission.scope === 'streak' && mission.req.some((r) => r.metric === key)) entry.run[key] = (entry.run[key] || 0) + 1
    }
    queue()
  })
  on('metric:break', ({ key }) => {
    const state = getState()
    const ms = ensureMissions(state)
    for (const entry of Object.values(ms.active)) {
      const mission = missions[entry.idx]
      if (mission.scope === 'streak' && entry.run[key]) entry.run[key] = 0
    }
    queue()
  })
  // Day and shift missions are judged before their counters reset.
  on('shift:end', () => evaluate())
  on('day:end', () => evaluate())
  on('day:start', () => {
    const ms = ensureMissions(getState())
    for (const entry of Object.values(ms.active)) {
      entry.dayBase = {}
      entry.failedDay = null
    }
    queue()
  })
  on('shift:start', () => {
    const ms = ensureMissions(getState())
    for (const entry of Object.values(ms.active)) {
      entry.shiftBase = {}
      entry.failedShift = null
    }
    queue()
  })
  on('game:started', queue)
  on('game:reset', queue)

  function defer(idx) {
    const state = getState()
    const ms = ensureMissions(state)
    const mission = missions[idx]
    if (!mission || !ms.active[idx]) return false
    if (state.money < DEFER_COST) {
      game.showToast(`⚠️ تأجيل المهمة يكلف $${DEFER_COST}.`)
      game.playSound('angry')
      return false
    }
    state.money = +(state.money - DEFER_COST).toFixed(2)
    ms.deferred[idx] = state.day + 1
    delete ms.active[idx]
    refreshActive()
    game.showToast(`⏭️ تم تأجيل «${mission.title}» ليوم واحد — جاءت مهمة جديدة مكانها.`)
    emit('missions:changed', {})
    return true
  }

  return {
    evaluate,
    refresh: queue,
    defer,
    missions,
    activeEntries() {
      const state = getState()
      const ms = ensureMissions(state)
      return Object.values(ms.active)
        .map((entry) => ({ entry, mission: missions[entry.idx], progress: progressOf(state, missions[entry.idx], entry) }))
        .sort((a, b) => a.mission.idx - b.mission.idx)
    },
    summary() {
      const state = getState()
      const ms = ensureMissions(state)
      const today = cairoDateKey()
      return {
        done: ms.done.length,
        chapter: currentChapter(state),
        today: ms.todayKey === today ? ms.todayCount : 0,
        recent: ms.recent,
      }
    },
  }
}
