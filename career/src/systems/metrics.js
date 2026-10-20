// Turns what happens in the store into counters: for the whole career ("life"),
// for the current in-game day and for the current shift. Missions, the career
// ladder and the shift report all read from here.
import { emit, on } from '../core/events.js'
import { ensureSbc } from './sbc.js'

export const CATEGORY = {
  hot: 'البار الساخن',
  cold: 'البار البارد',
  frap: 'الفرابوتشينو والريفرشرز',
  food: 'فرن التسخين',
}

const ALT_MILK = /شوفان|لوز|جوز الهند/

/** Counters whose current run is tracked (a break resets the run). */
export const STREAKS = ['no_angry', 'dt_fast', 'audits_passed', 'nsf_green', 'shift_A', 'drb_correct', 'incidents_best']

export function ensureMetrics(state) {
  const sbc = ensureSbc(state)
  const m = sbc.metrics
  m.life ??= {}
  m.day ??= {}
  m.shift ??= {}
  m.streak ??= {}
  m.best ??= {}
  m.sets ??= {}
  m.sets.stores ??= []
  m.sets.regions ??= []
  m.dayIndex ??= state.day || 1
  m.shiftKey ??= ''
  return m
}

export function inc(state, key, amount = 1) {
  const m = ensureMetrics(state)
  m.life[key] = (m.life[key] || 0) + amount
  m.day[key] = (m.day[key] || 0) + amount
  m.shift[key] = (m.shift[key] || 0) + amount
  emit('metric:inc', { key, amount })
}

export function bump(state, key) {
  const m = ensureMetrics(state)
  m.streak[key] = (m.streak[key] || 0) + 1
  m.best[key] = Math.max(m.best[key] || 0, m.streak[key])
  emit('metric:streak', { key, value: m.streak[key] })
}

export function breakStreak(state, key) {
  const m = ensureMetrics(state)
  if (m.streak[key]) emit('metric:break', { key, was: m.streak[key] })
  m.streak[key] = 0
}

export function addToSet(state, setName, value, metricKey) {
  const m = ensureMetrics(state)
  if (!value || m.sets[setName].includes(value)) return
  m.sets[setName].push(value)
  inc(state, metricKey)
}

export function get(state, scope, key) {
  const m = ensureMetrics(state)
  return (m[scope] && m[scope][key]) || 0
}

export function resetDay(state) {
  const m = ensureMetrics(state)
  m.day = {}
  m.dayIndex = state.day
}

export function resetShift(state, shiftKey) {
  const m = ensureMetrics(state)
  m.shift = {}
  m.shiftKey = shiftKey
}

/** Wires the gameplay events into the counters. */
export function installMetrics(getState) {
  const S = () => getState()

  on('order:served', ({ order, earned, ratioLeft, manual, elapsed }) => {
    const state = S()
    const item = (state.menu || []).find((m) => m.id === order.itemId)
    const cat = item?.category
    inc(state, 'served_total')
    if (order.channel === 'cafe') inc(state, 'served_cafe')
    else if (order.channel === 'drive_thru') inc(state, 'served_dt')
    else if (order.channel === 'mobile') inc(state, 'served_mobile')
    else if (order.channel === 'delivery') inc(state, 'served_delivery')
    if (cat === CATEGORY.hot) inc(state, 'served_hot')
    else if (cat === CATEGORY.cold) inc(state, 'served_cold')
    else if (cat === CATEGORY.frap) inc(state, 'served_frap')
    else if (cat === CATEGORY.food) inc(state, 'served_food')
    if (order.size === 'Venti') inc(state, 'served_venti')
    if (ALT_MILK.test(order.milkChoice || '')) inc(state, 'served_altmilk')
    if (order.personalityId === 'authority') inc(state, 'served_vip')
    if (order.personalityId === 'nervous') inc(state, 'served_nervous')
    if (order.personalityId === 'rushed' && ratioLeft > 0.5) inc(state, 'served_rushed_fast')
    if (ratioLeft > 0.5) inc(state, 'served_fast')
    if (order.channel === 'drive_thru') {
      if (elapsed <= 30) {
        inc(state, 'dt_fast')
        bump(state, 'dt_fast')
      } else {
        breakStreak(state, 'dt_fast')
      }
    }
    if (manual) inc(state, 'manual_orders')
    inc(state, 'sales', Math.max(0, +earned || 0))
    bump(state, 'no_angry')
    addToSet(state, 'stores', state.activeSubStoreName, 'stores_worked')
    addToSet(state, 'regions', state.activeBranchId, 'regions_worked')
  })

  on('order:angry', ({ order }) => {
    const state = S()
    inc(state, 'angry')
    breakStreak(state, 'no_angry')
    if (order?.channel === 'drive_thru') breakStreak(state, 'dt_fast')
  })

  on('order:step', () => inc(S(), 'manual_steps'))
  on('upsell', () => inc(S(), 'upsells'))

  on('complaint:resolved', ({ complaint }) => {
    const state = S()
    inc(state, 'complaints_resolved')
    if (complaint?.severity === 'high') inc(state, 'complaints_high')
  })
  on('delivery:resolved', () => inc(S(), 'delivery_resolved'))
  on('email:resolved', () => inc(S(), 'emails_resolved'))

  on('audit:finished', ({ score, passed }) => {
    const state = S()
    inc(state, 'audits_done')
    if (passed) {
      inc(state, 'audits_passed')
      bump(state, 'audits_passed')
    } else {
      breakStreak(state, 'audits_passed')
    }
    if (score >= 90) inc(state, 'audits_90')
  })

  on('nsf:finished', ({ score, grade }) => {
    const state = S()
    inc(state, 'nsf_done')
    if (grade === 'GREEN') {
      inc(state, 'nsf_green')
      bump(state, 'nsf_green')
    } else {
      breakStreak(state, 'nsf_green')
    }
    if (score >= 95) inc(state, 'nsf_95')
  })

  on('lp:resolved', () => inc(S(), 'lp_resolved'))
  on('resignation:resolved', ({ action }) => {
    const state = S()
    if (action === 'retain_promote' || action === 'retain_train') inc(state, 'retained')
    else inc(state, 'resign_accepted')
  })

  on('clean:manual', ({ kind }) => {
    const state = S()
    inc(state, 'clean_manual')
    if (kind === 'tables') inc(state, 'clean_tables')
    if (kind === 'sanitize') inc(state, 'sanitize')
    if (kind === 'calibrate') inc(state, 'calibrate')
  })
  on('restock', () => inc(S(), 'restocks'))
  on('staff:break', ({ auto }) => {
    if (!auto) inc(S(), 'breaks_manual')
  })
  on('staff:train', () => inc(S(), 'trainings'))
  on('staff:promote', () => inc(S(), 'staff_promotions'))
  on('staff:hire', () => inc(S(), 'hires'))
  on('staff:transfer', () => inc(S(), 'transfers'))
  on('eotm', () => inc(S(), 'eotm'))
  on('disc:resolved', () => inc(S(), 'disc_resolved'))
  on('sick:approved', () => inc(S(), 'sick_approved'))
  on('weekly:ordered', () => inc(S(), 'weekly_orders'))
  on('repair', () => inc(S(), 'repairs'))
  on('tasting', () => inc(S(), 'tastings'))
  on('upgrade:bought', () => inc(S(), 'upgrades'))

  // ---- new systems
  on('shift:end', ({ report }) => {
    const state = S()
    inc(state, 'shifts_done')
    const g = report?.grade || 'F'
    if (g === 'A+' || g === 'A') {
      inc(state, 'shift_A')
      bump(state, 'shift_A')
    } else {
      breakStreak(state, 'shift_A')
    }
    if (['A+', 'A', 'B+', 'B'].includes(g)) inc(state, 'shift_B')
    if (report?.laborOnTarget) inc(state, 'labor_target')
    if (report && report.breakViolations === 0 && report.staffOnShift > 0) inc(state, 'breaks_ok')
    if (report && report.drbDue > 0 && report.drbDone >= report.drbDue) inc(state, 'drb_full')
    if (report && report.angry === 0 && report.orders >= 8) inc(state, 'shift_zero_angry')
  })
  on('drb:logged', ({ correct }) => {
    const state = S()
    inc(state, 'drb_logs')
    if (correct) {
      inc(state, 'drb_correct')
      bump(state, 'drb_correct')
    } else {
      breakStreak(state, 'drb_correct')
    }
  })
  on('checklist:done', ({ kind }) => inc(S(), kind === 'closing' ? 'closing_done' : 'opening_done'))
  on('dialin:result', ({ perfect }) => {
    const state = S()
    inc(state, 'dialins')
    if (perfect) inc(state, 'dialin_perfect')
  })
  on('till:counted', ({ variance }) => {
    const state = S()
    inc(state, 'tills')
    if (Math.abs(variance || 0) < 0.005) inc(state, 'till_exact')
  })
  on('incident:resolved', ({ category, best, fast }) => {
    const state = S()
    inc(state, 'incidents_resolved')
    if (best) {
      inc(state, 'incidents_best')
      bump(state, 'incidents_best')
    } else {
      breakStreak(state, 'incidents_best')
    }
    if (fast) inc(state, 'incidents_fast')
    if (category) inc(state, `inc_${category}`)
  })
  on('waste:logged', ({ accurate }) => {
    if (accurate) inc(S(), 'waste_ok')
  })
  on('cert:passed', ({ id }) => {
    const state = S()
    // A certificate counts once, however many times the exam is retaken.
    const m = ensureMetrics(state)
    if (!m.life[`cert_${id}`]) inc(state, `cert_${id}`)
  })
  on('quiz:finished', ({ passed, score }) => {
    const state = S()
    if (passed) inc(state, 'quizzes_passed')
    if (score >= 100) inc(state, 'quiz_perfect')
  })
  on('career:promoted', () => inc(S(), 'promotions'))

  on('day:end', () => {
    const state = S()
    const m = ensureMetrics(state)
    inc(state, 'days_done')
    if ((m.day.angry || 0) === 0 && (m.day.served_total || 0) >= 20) inc(state, 'day_zero_angry')
    if (state.reputation >= 96) inc(state, 'day_rep_96')
    if (state.cleanliness >= 90) inc(state, 'day_clean_90')
    if (state.opsScore >= 95) inc(state, 'day_ops_95')
    emit('metrics:dayClosed', { day: state.day, totals: { ...m.day } })
  })
  on('day:start', () => resetDay(S()))
}
