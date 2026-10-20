// Runs the complex problems from bank.js: one at a time, every few in-game
// hours, matched to the hour and the kind of store. Each has a real-time
// countdown; the choice applies its effects now, slows or speeds the floor for
// a while (modifiers), and may bring consequences later in the day.
import { emit, on } from '../../core/events.js'
import { addProvider } from '../modifiers.js'
import { ensureSbc } from '../sbc.js'
import { isDriveThruStore } from '../shift/shift.js'
import { CATEGORY_LABELS, INCIDENTS, personalize } from './bank.js'

/** Steps (2 game minutes each) between two problems, before the role adjustment. */
export const SPAWN_STEPS = { min: 120, max: 210 }
const FIRST_SPAWN_STEPS = { min: 80, max: 130 }
/** A busier role meets problems more often. */
const ROLE_PACE = { barista: 1.3, supervisor: 1, manager: 0.85 }
const ROLE_ORDER = { barista: 0, supervisor: 1, manager: 2 }
const RECENT_LIMIT = 8
const LOG_LIMIT = 40

export const SUPPLY_LABELS = { beans: 'البن', milk: 'الحليب', ice: 'الثلج', cups: 'الأكواب', food: 'المخبوزات' }
const STEP_NAMES = { shot: 'سحب الإسبريسو', milk: 'تبخير الحليب', cold: 'البار البارد', syrup: 'السيرب والإضافات', oven: 'الفرن', all: 'كل محطات البار' }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const rand = (a, b) => a + Math.random() * (b - a)

/** Game minutes since day 1 opened, continuous across nights (06:00–22:00 = 960 minutes a day). */
export function absMinutes(state) {
  return (state.day || 1) * 960 + ((state.dayMinutes || 360) - 360)
}

export function ensureIncidents(state) {
  const sbc = ensureSbc(state)
  const inc = sbc.incidents
  inc.active ??= null
  inc.nextIn ??= Math.round(rand(FIRST_SPAWN_STEPS.min, FIRST_SPAWN_STEPS.max))
  inc.mods ??= []
  inc.later ??= []
  inc.log ??= []
  inc.recent ??= []
  inc.counts ??= {}
  return inc
}

export function incidentByKey(key) {
  return INCIDENTS.find((x) => x.key === key) || null
}

/** Which problems fit this hour and this store. Exported for the tests. */
export function eligibleIncidents({ hour, driveThru, recent = [] }) {
  return INCIDENTS.filter((x) => {
    const w = x.when || {}
    if (hour < (w.minHour ?? 0) || hour >= (w.maxHour ?? 24)) return false
    if (w.dtOnly && !driveThru) return false
    if (w.notDt && driveThru) return false
    return !recent.includes(x.key)
  })
}

export function pickWeighted(list, rnd = Math.random) {
  const total = list.reduce((acc, x) => acc + (x.weight || 1), 0)
  let r = rnd() * total
  for (const x of list) {
    r -= x.weight || 1
    if (r <= 0) return x
  }
  return list[list.length - 1] || null
}

/** Does the role being played have the authority a choice needs? */
export function hasAuthority(role, requires) {
  if (!requires) return true
  return (ROLE_ORDER[role] ?? 0) >= (ROLE_ORDER[requires] ?? 0)
}

function deltaText(label, v, unit = '') {
  const sign = v > 0 ? '+' : '−'
  return `${label} ${sign}${unit}${Math.abs(v)}`
}

/** Human-readable lines for a set of effects and modifiers (shown before and after a decision). */
export function describeEffects(effects = {}, mods = []) {
  const lines = []
  if (effects.money) lines.push(deltaText('💵 الخزنة', effects.money, '$'))
  if (effects.reputation) lines.push(deltaText('⭐ السمعة', effects.reputation))
  if (effects.dm) lines.push(deltaText('🧭 رضا مدير المنطقة', effects.dm))
  if (effects.ops) lines.push(deltaText('📊 تقييم العمليات', effects.ops))
  if (effects.cleanliness) lines.push(deltaText('🧽 النظافة', effects.cleanliness))
  if (effects.machine) lines.push(deltaText('⚙️ كفاءة الماكينات', effects.machine))
  if (effects.energy) lines.push(deltaText('⚡ طاقة الفريق', effects.energy))
  for (const [k, v] of Object.entries(effects.supplies || {})) if (v) lines.push(deltaText(`📦 مخزون ${SUPPLY_LABELS[k] || k}`, v, ''))
  if (effects.nsfFood) lines.push(deltaText('🌡️ سلامة الغذاء NSF', effects.nsfFood))
  if (effects.nsfHygiene) lines.push(deltaText('🧼 النظافة الشخصية NSF', effects.nsfHygiene))
  if (effects.sanitizer != null) lines.push(`🧪 محلول التعقيم = ${effects.sanitizer} ppm`)
  if (effects.training) lines.push(deltaText('🎓 مهارة الفريق', effects.training))
  if (effects.complaint) lines.push('📣 شكوى زبون جديدة')
  if (effects.lp) lines.push('🕵️ ملف تحقيق LP جديد')
  if (effects.equipment) lines.push(`🔧 صيانة معدّة (${effects.equipment.health}%)`)
  for (const m of mods) {
    const pct = Math.round((m.mult - 1) * 100)
    if (m.kind === 'step') lines.push(`⏱️ ${STEP_NAMES[m.key || 'all'] || m.key} ${pct < 0 ? 'أبطأ' : 'أسرع'} ${Math.abs(pct)}% لمدة ${m.minutes} دقيقة`)
    if (m.kind === 'spawn') lines.push(`👥 الزبائن ${pct < 0 ? 'أقل' : 'أكثر'} ${Math.abs(pct)}% لمدة ${m.minutes} دقيقة`)
    if (m.kind === 'patience') lines.push(`⌛ صبر الزبائن ${pct < 0 ? 'أقل' : 'أطول'} ${Math.abs(pct)}% لمدة ${m.minutes} دقيقة`)
  }
  return lines
}

export function installIncidents({ getState, game, getRateMultiplier = () => 1 }) {
  // --------------------------------------------------------- modifiers
  const activeMods = (kind, stepKey) => {
    const state = getState()
    if (!state?.sbc?.incidents) return 1
    const now = absMinutes(state)
    let mult = 1
    for (const m of state.sbc.incidents.mods || []) {
      if (m.kind !== kind || m.until <= now) continue
      if (kind === 'step' && m.key && m.key !== 'all' && m.key !== stepKey) continue
      mult *= m.mult
    }
    return mult
  }
  addProvider('spawn', () => activeMods('spawn'))
  addProvider('patience', () => activeMods('patience'))
  addProvider('step', (stepKey) => activeMods('step', stepKey))

  // ---------------------------------------------------------- effects
  function staffOnFloor() {
    try {
      return game.getActiveBranchStaff() || []
    } catch {
      return []
    }
  }

  function applyEffects(state, effects = {}, names = {}) {
    if (!effects) return
    if (effects.money) state.money = +(state.money + effects.money).toFixed(2)
    if (effects.reputation) state.reputation = clamp(+(state.reputation + effects.reputation).toFixed(1), 10, 100)
    if (effects.dm) {
      state.dmSatisfaction = clamp(+(state.dmSatisfaction + effects.dm).toFixed(1), 15, 100)
      const branch = game.getActiveBranch?.()
      if (branch) branch.dmSatisfaction = clamp((branch.dmSatisfaction || 90) + effects.dm, 20, 100)
    }
    if (effects.ops) state.opsScore = clamp(+(state.opsScore + effects.ops).toFixed(1), 15, 100)
    if (effects.cleanliness) state.cleanliness = clamp(Math.round(state.cleanliness + effects.cleanliness), 15, 100)
    if (effects.machine) state.machineHealth = clamp(Math.round(state.machineHealth + effects.machine), 10, 100)
    if (effects.energy) for (const s of staffOnFloor()) s.energy = clamp(+(s.energy + effects.energy).toFixed(1), 10, 100)
    if (effects.supplies && state.supplies) {
      for (const [k, v] of Object.entries(effects.supplies)) {
        if (k in state.supplies) state.supplies[k] = clamp(Math.round(state.supplies[k] + v), 0, 100)
      }
    }
    const nsf = state.nsfAudit
    if (nsf) {
      if (effects.nsfFood) nsf.foodTempAndDates = clamp(nsf.foodTempAndDates + effects.nsfFood, 40, 100)
      if (effects.nsfHygiene) nsf.partnerHygiene = clamp(nsf.partnerHygiene + effects.nsfHygiene, 40, 100)
      if (effects.sanitizer != null) nsf.sanitizerPpm = effects.sanitizer
    }
    if (effects.training) {
      for (const s of staffOnFloor()) s.speedMult = Math.min(1.6, +((s.speedMult || 1) + 0.01 * effects.training).toFixed(2))
    }
    if (effects.complaint) {
      const c = effects.complaint
      game.createCustomerComplaint(names.customer || game.getUniqueName(), c.drink, c.issue, c.severity)
    }
    if (effects.lp) game.spawnLpCase?.(effects.lp.type)
    if (effects.equipment) {
      const eq = (state.equipmentList || []).find((e) => e.id === effects.equipment.id)
      if (eq) {
        eq.health = clamp(effects.equipment.health, 0, 100)
        if (eq.health >= 90) {
          eq.ticketOpen = false
          eq.status = 'تعمل بكفاءة'
        }
      }
    }
  }

  function addMods(state, mods = []) {
    const inc = ensureIncidents(state)
    const now = absMinutes(state)
    for (const m of mods || []) inc.mods.push({ kind: m.kind, key: m.key || null, mult: m.mult, until: now + (m.minutes || 30) })
  }

  function scheduleLater(state, later = [], ctx) {
    const inc = ensureIncidents(state)
    const now = absMinutes(state)
    for (const l of later || []) inc.later.push({ at: now + (l.inMinutes || 60), text: l.text, effects: l.effects || {}, names: ctx.names, title: ctx.title })
  }

  // ---------------------------------------------------------- spawning
  function pickNames(state) {
    const team = game.getStoreTeam?.() || []
    const nameOf = (s) => String(s?.cleanName || s?.name || '').replace(/\s*\(.*?\)\s*/g, '').trim()
    const pool = team.filter((s) => !s.sickLeave).map(nameOf).filter(Boolean)
    const a = pool[Math.floor(Math.random() * pool.length)] || 'سامح'
    const rest = pool.filter((n) => n !== a)
    const b = rest[Math.floor(Math.random() * rest.length)] || 'طارق'
    return { partner: a, partner2: b, customer: game.getUniqueName?.() || 'أحمد', store: state.activeSubStoreName || 'الفرع' }
  }

  function roleOf(state) {
    return state.playerProfile?.role || 'barista'
  }

  function nextInterval(state) {
    const pace = ROLE_PACE[roleOf(state)] || 1
    const rate = clamp(Number(getRateMultiplier()) || 1, 0.25, 4)
    return Math.round((rand(SPAWN_STEPS.min, SPAWN_STEPS.max) * pace) / rate)
  }

  function spawn(state, forcedKey) {
    const inc = ensureIncidents(state)
    const hour = Math.floor((state.dayMinutes || 360) / 60)
    const driveThru = isDriveThruStore(state.activeSubStoreName)
    let incident = forcedKey ? incidentByKey(forcedKey) : null
    if (!incident) {
      let pool = eligibleIncidents({ hour, driveThru, recent: inc.recent })
      if (pool.length === 0) pool = eligibleIncidents({ hour, driveThru })
      incident = pickWeighted(pool)
    }
    if (!incident) return null
    inc.active = {
      key: incident.key,
      names: pickNames(state),
      timeLimit: incident.timeLimit || 45,
      timeLeft: incident.timeLimit || 45,
      day: state.day,
      minutes: state.dayMinutes,
      escalated: false,
    }
    inc.recent = [incident.key, ...inc.recent.filter((k) => k !== incident.key)].slice(0, RECENT_LIMIT)
    inc.counts[incident.key] = (inc.counts[incident.key] || 0) + 1
    game.playSound('alarm')
    emit('incident:started', { key: incident.key, category: incident.category })
    emit('incidents:changed', {})
    return inc.active
  }

  // --------------------------------------------------------- resolving
  function finish(state, { incident, choiceIndex, label, outcome, effects, mods, best, timedOut, escalated }) {
    const inc = ensureIncidents(state)
    const a = inc.active
    const fast = !timedOut && a.timeLeft / a.timeLimit > 0.5
    const bestChoice = incident.choices.find((c) => c.best)
    const p = personalize(incident, a.names)
    const entry = {
      key: incident.key,
      category: incident.category,
      title: p.title,
      choice: label,
      outcome,
      best,
      fast,
      timedOut,
      escalated: !!escalated,
      bestLabel: best ? null : p.choices[incident.choices.indexOf(bestChoice)]?.label || null,
      lines: describeEffects(effects, mods),
      day: state.day,
      minutes: state.dayMinutes,
      at: Date.now(),
    }
    inc.log.unshift(entry)
    inc.log = inc.log.slice(0, LOG_LIMIT)
    inc.active = null
    inc.nextIn = nextInterval(state)
    inc.lastResult = entry
    game.playSound(best ? 'fanfare' : timedOut ? 'angry' : 'step')
    emit('incident:resolved', { key: incident.key, category: incident.category, best, fast, timedOut, escalated: !!escalated, choiceIndex })
    emit('incidents:changed', {})
    game.updateHUD()
    return entry
  }

  function choose(choiceIndex) {
    const state = getState()
    const inc = ensureIncidents(state)
    const a = inc.active
    if (!a) return null
    const incident = incidentByKey(a.key)
    if (!incident) {
      inc.active = null
      return null
    }
    const choice = incident.choices[choiceIndex]
    if (!choice) return null
    if (!hasAuthority(roleOf(state), choice.requires)) {
      game.playSound('angry')
      game.showToast(choice.requires === 'manager' ? '🔒 هذا القرار من صلاحيات مدير الفرع.' : '🔒 هذا القرار من صلاحيات مشرف الوردية فأعلى — تقدر تبلّغ المشرف.')
      return null
    }
    const p = personalize(incident, a.names)
    const pc = p.choices[choiceIndex]
    let effects = choice.effects || {}
    let mods = choice.mods || []
    let outcome = pc.outcome
    let later = choice.later || []
    if (choice.chance) {
      const won = Math.random() < choice.chance.p
      const branch = won ? choice.chance.success : choice.chance.fail
      const pbranch = won ? pc.chance.success : pc.chance.fail
      effects = { ...effects, ...(branch.effects || {}) }
      mods = [...mods, ...(branch.mods || [])]
      later = [...later, ...(branch.later || [])]
      outcome = [pc.outcome, pbranch.text].filter(Boolean).join(' ')
    }
    applyEffects(state, effects, a.names)
    addMods(state, mods)
    scheduleLater(state, later, { names: a.names, title: p.title })
    return finish(state, { incident, choiceIndex, label: pc.label, outcome, effects, mods, best: !!choice.best, timedOut: false })
  }

  /** A partner without the authority hands the problem to the shift supervisor on duty. */
  function escalate() {
    const state = getState()
    const inc = ensureIncidents(state)
    const a = inc.active
    if (!a) return null
    const incident = incidentByKey(a.key)
    const idx = incident.choices.findIndex((c) => c.best)
    const choice = incident.choices[idx]
    const p = personalize(incident, a.names)
    // The supervisor follows the standard, but the floor loses a few minutes.
    const effects = { ...(choice.effects || {}), ops: (choice.effects?.ops || 0) - 1 }
    const mods = choice.mods || []
    applyEffects(state, effects, a.names)
    addMods(state, mods)
    scheduleLater(state, choice.later || [], { names: a.names, title: p.title })
    const outcome = `أبلغت مشرف الوردية فوراً وتولّى الموقف بنفسه: ${p.choices[idx].outcome}`
    return finish(state, { incident, choiceIndex: idx, label: '📞 إبلاغ مشرف الوردية', outcome, effects, mods, best: false, timedOut: false, escalated: true })
  }

  function timeout(state) {
    const inc = ensureIncidents(state)
    const a = inc.active
    const incident = incidentByKey(a.key)
    if (!incident) {
      inc.active = null
      return null
    }
    const p = personalize(incident, a.names)
    const t = incident.timeout || {}
    applyEffects(state, t.effects || {}, a.names)
    addMods(state, t.mods || [])
    game.showToast(`⏰ انتهى وقت القرار: ${p.title}`)
    return finish(state, { incident, choiceIndex: -1, label: 'لم يُتخذ قرار', outcome: p.timeout.outcome, effects: t.effects || {}, mods: t.mods || [], best: false, timedOut: true })
  }

  // ------------------------------------------------------------ events
  on('sim:step', () => {
    const state = getState()
    const inc = ensureIncidents(state)
    const now = absMinutes(state)
    // Modifiers wear off.
    if (inc.mods.length) inc.mods = inc.mods.filter((m) => m.until > now)
    // Delayed consequences arrive.
    if (inc.later.length) {
      const due = inc.later.filter((l) => l.at <= now)
      if (due.length) {
        inc.later = inc.later.filter((l) => l.at > now)
        for (const l of due) {
          applyEffects(state, l.effects, l.names || {})
          game.playSound('angry')
          game.showToast(`⚠️ تبعات قرار سابق: ${l.text}`)
          inc.log.unshift({ key: 'later', category: 'later', title: l.title || 'تبعات قرار سابق', choice: '', outcome: l.text, best: false, fast: false, timedOut: false, lines: describeEffects(l.effects), day: state.day, minutes: state.dayMinutes, at: Date.now(), later: true })
          inc.log = inc.log.slice(0, LOG_LIMIT)
        }
        emit('incidents:changed', {})
      }
    }
    if (inc.active) return
    if (!state.playerProfile?.onboardingDone) return
    // A store that has not opened yet has nobody to have a problem with.
    if (state.dayMinutes < 420 && !isDriveThruStore(state.activeSubStoreName)) return
    inc.nextIn -= 1
    if (inc.nextIn <= 0) spawn(state)
  })

  on('sim:tick', () => {
    const state = getState()
    const inc = state?.sbc?.incidents
    if (!inc?.active) return
    inc.active.timeLeft -= 1
    if (inc.active.timeLeft <= 0) timeout(state)
    else emit('incident:tick', { timeLeft: inc.active.timeLeft, timeLimit: inc.active.timeLimit })
  })

  on('game:reset', () => {
    const inc = ensureIncidents(getState())
    inc.active = null
    inc.mods = []
    inc.later = []
    inc.nextIn = Math.round(rand(FIRST_SPAWN_STEPS.min, FIRST_SPAWN_STEPS.max))
    emit('incidents:changed', {})
  })

  return {
    choose,
    escalate,
    spawn: (key) => spawn(getState(), key),
    current() {
      const state = getState()
      const a = ensureIncidents(state).active
      if (!a) return null
      const incident = incidentByKey(a.key)
      if (!incident) return null
      const p = personalize(incident, a.names)
      const role = roleOf(state)
      return {
        ...a,
        title: p.title,
        text: p.text,
        category: incident.category,
        categoryLabel: CATEGORY_LABELS[incident.category] || incident.category,
        role,
        canEscalate: role === 'barista',
        choices: p.choices.map((c, i) => ({
          index: i,
          label: c.label,
          locked: !hasAuthority(role, incident.choices[i].requires),
          requires: incident.choices[i].requires || null,
          gamble: !!incident.choices[i].chance,
        })),
      }
    },
    log: () => ensureIncidents(getState()).log,
    lastResult: () => ensureIncidents(getState()).lastResult || null,
    activeModifiers() {
      const state = getState()
      const now = absMinutes(state)
      return ensureIncidents(state).mods.filter((m) => m.until > now).map((m) => ({ ...m, minutesLeft: m.until - now }))
    },
  }
}

export { CATEGORY_LABELS }
