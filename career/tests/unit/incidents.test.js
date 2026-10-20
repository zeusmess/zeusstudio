import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllListeners, emit, on } from '../../src/core/events.js'
import { CATEGORY_LABELS, INCIDENTS, personalize } from '../../src/systems/incidents/bank.js'
import {
  absMinutes,
  describeEffects,
  eligibleIncidents,
  ensureIncidents,
  hasAuthority,
  installIncidents,
  pickWeighted,
} from '../../src/systems/incidents/engine.js'
import { clearProviders, installModifierHooks } from '../../src/systems/modifiers.js'

const EFFECT_KEYS = new Set(['money', 'reputation', 'dm', 'ops', 'cleanliness', 'machine', 'energy', 'supplies', 'nsfFood', 'nsfHygiene', 'sanitizer', 'training', 'complaint', 'lp', 'equipment'])
const SUPPLY_KEYS = new Set(['beans', 'milk', 'ice', 'cups', 'food'])
const STEP_KEYS = new Set(['shot', 'milk', 'cold', 'syrup', 'oven', 'all'])
const EQUIPMENT_IDS = new Set(['eq_mastrena_1', 'eq_mastrena_2', 'eq_siren_blender', 'eq_turbochef', 'eq_ice_maker', 'eq_pastry_chill'])

function checkEffects(where, effects = {}) {
  for (const [k, v] of Object.entries(effects)) {
    expect(EFFECT_KEYS.has(k), `${where}: unknown effect ${k}`).toBe(true)
    if (k === 'supplies') for (const s of Object.keys(v)) expect(SUPPLY_KEYS.has(s), `${where}: supply ${s}`).toBe(true)
    if (k === 'equipment') expect(EQUIPMENT_IDS.has(v.id), `${where}: equipment ${v.id}`).toBe(true)
    if (k === 'complaint') expect(['low', 'medium', 'high']).toContain(v.severity)
  }
}

function checkMods(where, mods = []) {
  for (const m of mods) {
    expect(['step', 'spawn', 'patience'], where).toContain(m.kind)
    if (m.kind === 'step' && m.key) expect(STEP_KEYS.has(m.key), `${where}: step ${m.key}`).toBe(true)
    // A spawn multiplier of 0 closes the doors (an evacuation); a station can only slow down.
    if (m.kind === 'spawn') expect(m.mult).toBeGreaterThanOrEqual(0)
    else expect(m.mult).toBeGreaterThan(0)
    expect(m.minutes).toBeGreaterThan(0)
  }
}

describe('the incident bank', () => {
  it('has unique keys in known categories, at least 35 problems', () => {
    expect(INCIDENTS.length).toBeGreaterThanOrEqual(35)
    expect(new Set(INCIDENTS.map((x) => x.key)).size).toBe(INCIDENTS.length)
    for (const x of INCIDENTS) expect(Object.keys(CATEGORY_LABELS)).toContain(x.category)
  })

  it('gives every problem one best practice, a timeout and valid effects', () => {
    for (const x of INCIDENTS) {
      expect(x.choices.length, x.key).toBeGreaterThanOrEqual(2)
      expect(x.choices.filter((c) => c.best).length, `${x.key} best`).toBe(1)
      expect(x.timeout?.outcome, `${x.key} timeout`).toBeTruthy()
      expect(x.timeLimit).toBeGreaterThanOrEqual(20)
      expect(x.when.minHour).toBeLessThan(x.when.maxHour)
      for (const [i, c] of x.choices.entries()) {
        const where = `${x.key}#${i}`
        expect(c.label, where).toBeTruthy()
        if (c.requires) expect(['supervisor', 'manager']).toContain(c.requires)
        checkEffects(where, c.effects)
        checkMods(where, c.mods)
        for (const l of c.later || []) {
          expect(l.inMinutes).toBeGreaterThan(0)
          checkEffects(`${where} later`, l.effects)
        }
        if (c.chance) {
          expect(c.chance.p).toBeGreaterThan(0)
          expect(c.chance.p).toBeLessThan(1)
          checkEffects(`${where} success`, c.chance.success.effects)
          checkEffects(`${where} fail`, c.chance.fail.effects)
          checkMods(`${where} fail`, c.chance.fail.mods)
        } else {
          expect(c.outcome, where).toBeTruthy()
        }
        // The best practice never needs a gamble.
        if (c.best) expect(c.chance, `${where} best gamble`).toBeFalsy()
      }
      checkEffects(`${x.key} timeout`, x.timeout.effects)
      checkMods(`${x.key} timeout`, x.timeout.mods)
    }
  })

  it('fills every placeholder', () => {
    const names = { partner: 'سامح', partner2: 'طارق', customer: 'أحمد', store: 'Arkan Plaza' }
    for (const x of INCIDENTS) {
      const p = personalize(x, names)
      const text = JSON.stringify(p)
      expect(text, x.key).not.toMatch(/\{(partner2?|customer|store)\}/)
    }
  })

  it('matches problems to the hour and the kind of store', () => {
    const night = eligibleIncidents({ hour: 23, driveThru: false })
    expect(night.every((x) => x.when.maxHour > 23)).toBe(true)
    const dt = eligibleIncidents({ hour: 12, driveThru: true })
    expect(dt.some((x) => x.when.dtOnly)).toBe(true)
    expect(dt.some((x) => x.when.notDt)).toBe(false)
    const cafe = eligibleIncidents({ hour: 12, driveThru: false })
    expect(cafe.some((x) => x.when.dtOnly)).toBe(false)
    const recent = eligibleIncidents({ hour: 12, driveThru: false, recent: ['mastrena_jam'] })
    expect(recent.some((x) => x.key === 'mastrena_jam')).toBe(false)
  })

  it('picks by weight and checks authority by role', () => {
    const list = [{ key: 'a', weight: 1 }, { key: 'b', weight: 3 }]
    expect(pickWeighted(list, () => 0.1).key).toBe('a')
    expect(pickWeighted(list, () => 0.9).key).toBe('b')
    expect(hasAuthority('barista', 'supervisor')).toBe(false)
    expect(hasAuthority('supervisor', 'supervisor')).toBe(true)
    expect(hasAuthority('supervisor', 'manager')).toBe(false)
    expect(hasAuthority('manager', 'supervisor')).toBe(true)
    expect(hasAuthority('barista', undefined)).toBe(true)
  })

  it('describes effects and modifiers in words', () => {
    const lines = describeEffects({ money: -35, ops: 3, supplies: { ice: 40 } }, [{ kind: 'step', key: 'shot', mult: 0.75, minutes: 60 }])
    expect(lines.join(' ')).toContain('$35')
    expect(lines.join(' ')).toContain('الثلج')
    expect(lines.join(' ')).toContain('60 دقيقة')
  })
})

// ------------------------------------------------------------------ engine

function makeGame(state) {
  const toasts = []
  return {
    toasts,
    complaints: [],
    lp: [],
    showToast: (m) => toasts.push(m),
    playSound: () => {},
    updateHUD: () => {},
    getActiveBranch: () => ({ dmSatisfaction: 90 }),
    getActiveBranchStaff: () => state.staff,
    getStoreTeam: () => state.staff,
    getUniqueName: () => 'أحمد علي',
    createCustomerComplaint(name, drink, issue, severity) {
      this.complaints.push({ name, drink, issue, severity })
    },
    spawnLpCase(type) {
      this.lp.push(type)
    },
  }
}

function makeState(role = 'barista') {
  return {
    day: 1,
    dayMinutes: 600,
    money: 1000,
    reputation: 90,
    dmSatisfaction: 90,
    opsScore: 90,
    cleanliness: 90,
    machineHealth: 90,
    activeSubStoreName: 'Nile City Cairo',
    supplies: { beans: 100, milk: 100, ice: 100, cups: 100, food: 100 },
    nsfAudit: { foodTempAndDates: 90, partnerHygiene: 90, sanitizerPpm: 200 },
    equipmentList: [{ id: 'eq_pastry_chill', health: 60 }],
    staff: [
      { id: 1, cleanName: 'سامح النجار', energy: 80, speedMult: 1.1 },
      { id: 2, cleanName: 'طارق سليم', energy: 70, speedMult: 1.2 },
    ],
    playerProfile: { role, onboardingDone: true },
  }
}

describe('the incident engine', () => {
  let state
  let game
  let api
  const hooks = {}
  beforeEach(() => {
    clearAllListeners()
    clearProviders()
    state = makeState()
    game = makeGame(state)
    installModifierHooks(hooks)
    api = installIncidents({ getState: () => state, game })
  })

  it('applies the chosen effects, slows the bar for a while and logs the best practice', () => {
    api.spawn('mastrena_jam')
    const resolved = []
    on('incident:resolved', (e) => resolved.push(e))
    const r = api.choose(0)
    expect(r.best).toBe(true)
    expect(state.money).toBe(965)
    expect(hooks.stepSpeedMultiplier('shot')).toBeCloseTo(0.75)
    expect(hooks.stepSpeedMultiplier('cold')).toBe(1)
    expect(resolved[0]).toMatchObject({ category: 'equipment', best: true, timedOut: false })
    // An hour later the Mastrena is fixed.
    state.dayMinutes += 62
    emit('sim:step', {})
    expect(hooks.stepSpeedMultiplier('shot')).toBe(1)
  })

  it('refuses a choice above the role and lets a barista escalate', () => {
    api.spawn('mastrena_jam')
    expect(api.choose(1)).toBeNull()
    expect(api.current().choices[1].locked).toBe(true)
    expect(api.current().canEscalate).toBe(true)
    const r = api.escalate()
    expect(r.escalated).toBe(true)
    expect(r.best).toBe(false)
    expect(api.current()).toBeNull()
  })

  it('brings delayed consequences later in the day', () => {
    api.spawn('fridge_hot')
    api.choose(1) // sell the warm items quickly
    expect(game.complaints).toHaveLength(0)
    state.dayMinutes += 121
    emit('sim:step', {})
    expect(game.complaints).toHaveLength(1)
    expect(game.complaints[0].severity).toBe('high')
  })

  it('times out with the worst outcome when nobody decides', () => {
    const resolved = []
    on('incident:resolved', (e) => resolved.push(e))
    const a = api.spawn('mastrena_jam')
    for (let i = 0; i < a.timeLimit; i++) emit('sim:tick', {})
    expect(resolved[0]).toMatchObject({ timedOut: true, best: false })
    expect(hooks.stepSpeedMultiplier('shot')).toBeCloseTo(0.4)
  })

  it('spawns on its own after the interval, only once the store has opened', () => {
    ensureIncidents(state).nextIn = 2
    state.dayMinutes = 380 // a café before 07:00
    emit('sim:step', {})
    emit('sim:step', {})
    expect(api.current()).toBeNull()
    state.dayMinutes = 600
    emit('sim:step', {})
    emit('sim:step', {})
    expect(api.current()).not.toBeNull()
  })

  it('keeps time continuous across nights', () => {
    expect(absMinutes({ day: 1, dayMinutes: 1318 })).toBeLessThan(absMinutes({ day: 2, dayMinutes: 360 }))
  })
})
