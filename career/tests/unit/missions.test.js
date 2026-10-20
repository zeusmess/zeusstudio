import { describe, expect, it, beforeEach } from 'vitest'
import { clearAllListeners, emit } from '../../src/core/events.js'
import { CHAPTERS } from '../../src/systems/missions/catalog.js'
import { allMissions, TOTAL_MISSIONS } from '../../src/systems/missions/generator.js'
import { ensureMissions, installMissions, missionsDone, progressOf, currentChapter } from '../../src/systems/missions/engine.js'
import { installMetrics, ensureMetrics } from '../../src/systems/metrics.js'

const KNOWN_METRICS = new Set([
  'served_total', 'served_cafe', 'served_dt', 'served_mobile', 'served_delivery', 'served_hot', 'served_cold', 'served_frap',
  'served_food', 'served_venti', 'served_altmilk', 'served_vip', 'served_nervous', 'served_rushed_fast', 'served_fast',
  'dt_fast', 'manual_orders', 'sales', 'no_angry', 'stores_worked', 'regions_worked', 'angry', 'manual_steps', 'upsells',
  'complaints_resolved', 'complaints_high', 'delivery_resolved', 'emails_resolved', 'audits_done', 'audits_passed',
  'audits_90', 'nsf_done', 'nsf_green', 'nsf_95', 'lp_resolved', 'retained', 'resign_accepted', 'clean_manual',
  'clean_tables', 'sanitize', 'calibrate', 'restocks', 'breaks_manual', 'trainings', 'staff_promotions', 'hires',
  'transfers', 'eotm', 'disc_resolved', 'sick_approved', 'weekly_orders', 'repairs', 'tastings', 'upgrades',
  'shifts_done', 'shift_A', 'shift_B', 'labor_target', 'breaks_ok', 'drb_full', 'shift_zero_angry', 'drb_logs',
  'drb_correct', 'opening_done', 'closing_done', 'dialins', 'dialin_perfect', 'tills', 'till_exact',
  'incidents_resolved', 'incidents_best', 'incidents_fast', 'inc_equipment', 'inc_supply', 'inc_people', 'inc_safety',
  'inc_customer', 'inc_tech', 'inc_crisis', 'quizzes_passed', 'quiz_perfect', 'promotions', 'days_done',
  'day_zero_angry', 'day_rep_96', 'day_clean_90', 'day_ops_95', 'waste_ok', 'cert_basics', 'cert_coffee', 'cert_nsf',
  'cert_ssv', 'cert_sm',
])

describe('the 1000 missions', () => {
  const list = allMissions()

  it('are exactly 1000, numbered M0001…M1000', () => {
    expect(list).toHaveLength(TOTAL_MISSIONS)
    expect(new Set(list.map((m) => m.id)).size).toBe(1000)
    expect(list[0].id).toBe('M0001')
    expect(list[999].id).toBe('M1000')
  })

  it('give each chapter 100 missions with a challenge every 10th and a final at the end', () => {
    for (const ch of CHAPTERS) {
      const own = list.filter((m) => m.chapter === ch.n)
      expect(own).toHaveLength(100)
      own.forEach((m, i) => {
        if ((i + 1) % 10 === 0) expect(m.kind).toBe(i === 99 ? 'final' : 'challenge')
        else expect(m.kind).toBe('family')
      })
    }
  })

  it('use only metrics the game counts, with positive targets', () => {
    for (const m of list) {
      for (const r of m.req) {
        expect(KNOWN_METRICS.has(r.metric), `${m.id} ${r.metric}`).toBe(true)
        expect(r.target).toBeGreaterThan(0)
      }
      for (const c of m.constraints) expect(KNOWN_METRICS.has(c.metric)).toBe(true)
      expect(['life', 'day', 'shift', 'streak', 'total']).toContain(m.scope)
      expect(m.desc).not.toContain('{n}')
    }
  })

  it('get harder step by step inside each family', () => {
    for (const ch of CHAPTERS) {
      for (const fam of ch.families) {
        expect(fam.targets).toHaveLength(9)
        for (let i = 1; i < 9; i++) expect(fam.targets[i]).toBeGreaterThan(fam.targets[i - 1])
      }
    }
  })

  it('pay more in later chapters', () => {
    expect(list[950].reward.money).toBeGreaterThan(list[50].reward.money)
    expect(list[999].reward.xp).toBeGreaterThan(list[99].reward.xp)
  })
})

describe('the mission engine', () => {
  let state
  const game = {
    showToast: () => {},
    playSound: () => {},
    addFloatingText: () => {},
    spawnSparkles: () => {},
  }
  let engine

  beforeEach(() => {
    clearAllListeners()
    state = { day: 1, money: 100, menu: [{ id: 'latte', category: 'البار الساخن' }], activeSubStoreName: 'Nile City Cairo', activeBranchId: 'downtown', reputation: 96, cleanliness: 100, opsScore: 95 }
    installMetrics(() => state)
    engine = installMissions({ getState: () => state, game })
  })

  const serve = (n, extra = {}) => {
    for (let i = 0; i < n; i++) {
      emit('order:served', { order: { itemId: 'latte', channel: 'cafe', size: 'Tall', milkChoice: '', ...extra }, earned: 5, ratioLeft: 0.7, manual: false, elapsed: 10 })
    }
  }

  it('starts with the first five missions of chapter 1 active', async () => {
    engine.evaluate()
    const active = engine.activeEntries()
    expect(active.map((a) => a.mission.idx)).toEqual([0, 1, 2, 3, 4])
    expect(currentChapter(state)).toBe(1)
  })

  it('completes "serve 10 orders" after 10 served orders and pays the reward', async () => {
    engine.evaluate()
    const before = state.money
    serve(10)
    await Promise.resolve()
    expect(missionsDone(state)).toBeGreaterThanOrEqual(1)
    expect(ensureMissions(state).done).toContain(0)
    expect(state.money).toBeGreaterThan(before)
    // The next mission in order joined the active five.
    expect(engine.activeEntries().map((a) => a.mission.idx)).toContain(5)
  })

  it('counts a life mission from the moment it became active', async () => {
    serve(30) // played before the mission system ever ran
    await Promise.resolve()
    const entry = ensureMissions(state).active[0]
    expect(entry.base.served_total).toBe(30)
    expect(progressOf(state, allMissions()[0], entry).ratio).toBe(0)
    serve(10)
    await Promise.resolve()
    expect(ensureMissions(state).done).toContain(0)
  })

  it('fails a day mission when its no-angry constraint breaks, and resets the next day', async () => {
    const mission = allMissions()[9] // challenge: 25 orders in a day, no angry customer
    const ms = ensureMissions(state)
    ms.done = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    engine.evaluate()
    expect(Object.keys(ms.active)).toContain('9')
    serve(5)
    emit('order:angry', { order: { channel: 'cafe' } })
    await Promise.resolve()
    expect(progressOf(state, mission, ms.active[9]).failed).toBe('day')
    emit('day:end', {})
    state.day = 2
    emit('day:start', { day: 2 })
    await Promise.resolve()
    expect(progressOf(state, mission, ms.active[9]).failed).toBe(null)
    serve(25)
    await Promise.resolve()
    expect(ms.done).toContain(9)
  })

  it('tracks streak missions from activation and resets them on a break', async () => {
    const ms = ensureMissions(state)
    ms.done = Array.from({ length: 49 }, (_, i) => i).filter((i) => i !== 49)
    engine.evaluate()
    const streak = allMissions()[59] // chapter 1 challenge 6: 30 in a row without anger
    ms.done = Array.from({ length: 59 }, (_, i) => i)
    engine.evaluate()
    expect(Object.keys(ms.active)).toContain('59')
    serve(20)
    emit('order:angry', { order: { channel: 'cafe' } })
    await Promise.resolve()
    expect(progressOf(state, streak, ms.active[59]).parts[0].value).toBe(0)
    serve(30)
    await Promise.resolve()
    expect(ms.done).toContain(59)
  })

  it('lets a mission be deferred for a day for a fee', () => {
    engine.evaluate()
    state.money = 100
    expect(engine.defer(0)).toBe(true)
    expect(state.money).toBe(75)
    expect(engine.activeEntries().map((a) => a.mission.idx)).not.toContain(0)
    expect(ensureMetrics(state)).toBeTruthy()
  })
})
