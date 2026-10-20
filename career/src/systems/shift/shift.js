// Shift management: who is on the floor (from the weekly schedule), what the
// shift costs (wages → labour %), breaks under Egypt's Labour Law No. 14 of 2025
// (nobody works more than 5 consecutive hours), the Daily Records Book (DRB),
// the opening and closing checklists, and a graded report at the end of every
// shift.
import { emit, on } from '../../core/events.js'
import { ensureMetrics, resetShift } from '../metrics.js'
import { addProvider } from '../modifiers.js'
import { ensureSbc } from '../sbc.js'

export const PHASES = [
  { key: 'opening', label: 'وردية الافتتاح', short: 'الافتتاح', from: 360, to: 660 },
  { key: 'peak', label: 'وردية الذروة والظهيرة', short: 'الذروة', from: 660, to: 960 },
  { key: 'closing', label: 'وردية المساء والإغلاق', short: 'الإغلاق', from: 960, to: 1320 },
]

/** The schedule's shifts in game minutes (the legacy schedule table uses these keys). */
export const STAFF_SHIFTS = {
  morning: [360, 840], // 06:00 – 14:00
  peak: [660, 1140], // 11:00 – 19:00
  evening: [900, 1320], // 15:00 – 22:00
}

/** $ per game hour. */
export const WAGES = { store_manager: 8, assistant_manager: 6.5, shift_supervisor: 5.5, barista: 4.5, barista_delivery: 4.5 }
export const LABOR_TARGET = { min: 18, max: 25 }
export const MAX_CONSECUTIVE_MIN = 300 // Labour Law No. 14/2025, art. 118
export const MIN_BREAK_MIN = 20
export const STORE_OPENS = 420 // 07:00 (drive-thru stores open around the clock)
export const OPENING_WINDOW = [360, 450] // 06:00 – 07:30
export const CLOSING_WINDOW = [1230, 1320] // 20:30 – 22:00

const DRB_SCHEDULE = [
  { id: 'fridge_open', kind: 'fridge', at: 375, label: 'حرارة الثلاجات — الافتتاح' },
  { id: 'sanit_open', kind: 'sanitizer', at: 380, label: 'تركيز محلول التعقيم — الافتتاح' },
  { id: 'fridge_mid', kind: 'fridge', at: 630, label: 'حرارة الثلاجات — منتصف اليوم' },
  { id: 'bucket_1', kind: 'bucket', at: 870, label: 'تغيير جرادل التعقيم (كل 4 ساعات)' },
  { id: 'fridge_aft', kind: 'fridge', at: 990, label: 'حرارة الثلاجات — العصر' },
  { id: 'bucket_2', kind: 'bucket', at: 1110, label: 'تغيير جرادل التعقيم (كل 4 ساعات)' },
  { id: 'fridge_close', kind: 'fridge', at: 1270, label: 'حرارة الثلاجات — الإغلاق' },
]
const DRB_GRACE_MIN = 90

export function isDriveThruStore(name) {
  return /dt|drive|chill out|airport|toll|rest/i.test(name || '')
}

export function phaseFor(minutes) {
  return PHASES.find((p) => minutes >= p.from && minutes < p.to) || PHASES[PHASES.length - 1]
}

export function fmtTime(minutes) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const ampm = h >= 12 ? 'م' : 'ص'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function ensureShift(state) {
  const sbc = ensureSbc(state)
  const sh = sbc.shift
  sh.key ??= ''
  sh.cur ??= null
  sh.partners ??= {}
  sh.history ??= []
  sh.overrides ??= { day: state.day, extra: {}, sentHome: {} }
  if (sh.overrides.day !== state.day) sh.overrides = { day: state.day, extra: {}, sentHome: {} }
  sh.drb ??= { day: 0, tasks: [] }
  sh.checklists ??= { day: 0 }
  return sh
}

export function isOnShift(state, staff) {
  if (!staff || staff.sickLeave || staff.shift === 'sick') return false
  const sh = ensureShift(state)
  const minutes = state.dayMinutes
  if (sh.overrides.sentHome[staff.id]) return false
  if (sh.overrides.extra[staff.id] && minutes < sh.overrides.extra[staff.id]) return true
  const win = STAFF_SHIFTS[staff.shift || 'morning']
  if (!win) return false
  return minutes >= win[0] && minutes < win[1]
}

function rand(a, b) {
  return a + Math.random() * (b - a)
}

/** A shift's score out of 100 and its letter grade. Exported for the tests. */
export function gradeShift(c, { cleanliness = 100, machineHealth = 100, openComplaints = 0 } = {}) {
  const orders = c.orders || 0
  const angry = c.angry || 0
  const fastPct = orders ? (c.fast || 0) / orders : 0
  const laborPct = c.sales > 0 ? (c.laborCost / c.sales) * 100 : c.laborCost > 0 ? 100 : 0
  const laborOnTarget = c.sales > 0 && laborPct >= LABOR_TARGET.min && laborPct <= LABOR_TARGET.max
  const service = orders === 0 ? 20 : 35 * Math.max(0, 1 - (angry / orders) * 4) * (0.6 + 0.4 * fastPct)
  let labor
  if (orders === 0) labor = 10
  else if (laborOnTarget) labor = 20
  else if (laborPct < LABOR_TARGET.min) labor = angry <= 1 ? 17 : 9
  else if (laborPct <= 30) labor = 12
  else labor = 4
  const breaks = Math.max(0, 10 - 5 * (c.breakViolations || 0))
  const drb = c.drbDue > 0 ? 10 * Math.min(1, (c.drbDone || 0) / c.drbDue) : 10
  const quality = ((cleanliness + machineHealth) / 200) * 15
  const problems = Math.max(0, 10 - 3 * openComplaints - 4 * (c.incidentTimeouts || 0))
  const score = Math.round(Math.max(0, Math.min(100, service + labor + breaks + drb + quality + problems)))
  const grade = score >= 93 ? 'A+' : score >= 85 ? 'A' : score >= 78 ? 'B+' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F'
  return { score, grade, laborPct: Math.round(laborPct * 10) / 10, laborOnTarget, fastPct }
}

export function installShift({ getState, game, hooks, getRankRole }) {
  hooks.isOnShift = (staff) => isOnShift(getState(), staff)

  // Store hours: before 07:00 only drive-thru stores serve.
  addProvider('spawn', () => {
    const state = getState()
    if (state.dayMinutes < STORE_OPENS) return isDriveThruStore(state.activeSubStoreName) ? 0.35 : 0
    return 1
  })

  const canLead = () => getRankRole() !== 'barista'

  function newCur(state, phase) {
    return {
      key: `${state.day}-${phase.key}`,
      phase: phase.key,
      day: state.day,
      sales: 0,
      laborCost: 0,
      orders: 0,
      angry: 0,
      fast: 0,
      dtTimes: [],
      complaintsResolved: 0,
      incidents: 0,
      incidentsBest: 0,
      incidentTimeouts: 0,
      breakViolations: 0,
      drbDue: 0,
      drbDone: 0,
      staffOnShift: 0,
      callIns: 0,
    }
  }

  function startShift(state, phase) {
    const sh = ensureShift(state)
    sh.cur = newCur(state, phase)
    sh.key = sh.cur.key
    resetShift(state, sh.key)
    const team = game.getActiveBranchStaff()
    sh.cur.staffOnShift = team.length
    emit('shift:start', { phase: phase.key, label: phase.label, staff: team.length })
    game.showToast(`🕐 بدأت ${phase.label} — على الأرضية ${team.length} موظفين. راقب نسبة العمالة والراحات وسجلات DRB.`)
  }

  function endShift(state) {
    const sh = ensureShift(state)
    const c = sh.cur
    if (!c) return null
    const openComplaints = (state.complaints || []).filter((x) => !x.resolved && x.inStore).length
    const g = gradeShift(c, { cleanliness: state.cleanliness, machineHealth: state.machineHealth, openComplaints })
    const dtAvg = c.dtTimes.length ? Math.round(c.dtTimes.reduce((a, b) => a + b, 0) / c.dtTimes.length) : 0
    const phase = PHASES.find((p) => p.key === c.phase) || PHASES[0]
    const report = {
      key: c.key,
      day: c.day,
      phase: c.phase,
      label: phase.label,
      store: state.activeSubStoreName,
      orders: c.orders,
      angry: c.angry,
      sales: Math.round(c.sales * 100) / 100,
      laborCost: Math.round(c.laborCost * 100) / 100,
      laborPct: g.laborPct,
      laborOnTarget: g.laborOnTarget,
      dtAvg,
      fastPct: Math.round(g.fastPct * 100),
      breakViolations: c.breakViolations,
      drbDue: c.drbDue,
      drbDone: c.drbDone,
      incidents: c.incidents,
      incidentsBest: c.incidentsBest,
      complaintsResolved: c.complaintsResolved,
      staffOnShift: c.staffOnShift,
      score: g.score,
      grade: g.grade,
      at: Date.now(),
    }
    sh.history.unshift(report)
    sh.history = sh.history.slice(0, 40)
    sh.lastReport = report
    sh.cur = null
    // The area manager and operations notice how shifts go.
    const branch = game.getActiveBranch()
    if (report.grade === 'A+' || report.grade === 'A') {
      state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 2).toFixed(1))
      state.opsScore = Math.min(100, +(state.opsScore + 2).toFixed(1))
      if (branch) branch.dmSatisfaction = Math.min(100, (branch.dmSatisfaction || 90) + 2)
    } else if (report.grade === 'D' || report.grade === 'F') {
      state.dmSatisfaction = Math.max(15, +(state.dmSatisfaction - 3).toFixed(1))
      state.opsScore = Math.max(15, +(state.opsScore - 3).toFixed(1))
      if (branch) branch.dmSatisfaction = Math.max(20, (branch.dmSatisfaction || 90) - 3)
    }
    emit('shift:end', { report })
    return report
  }

  // ------------------------------------------------------------- DRB & lists

  function planDay(state) {
    const sh = ensureShift(state)
    if (sh.drb.day !== state.day) {
      sh.drb = {
        day: state.day,
        // A day joined late (a new game, a reload) skips what was due before the player arrived.
        tasks: DRB_SCHEDULE.map((t) => ({ ...t, due: t.at + DRB_GRACE_MIN, status: t.at + DRB_GRACE_MIN < state.dayMinutes ? 'skipped' : 'scheduled', reading: null, choice: null, correct: null })),
      }
    }
    if (sh.checklists.day !== state.day) {
      const float = 1500
      sh.checklists = {
        day: state.day,
        opening: { dialin: null, till: null, pastry: false, brew: false, done: false, missed: false },
        closing: { waste: null, till: null, clean: false, restock: false, done: false, missed: false },
        float,
      }
      if (state.dayMinutes > OPENING_WINDOW[0] + 20) sh.checklists.opening.skipped = true
      if (state.dayMinutes > CLOSING_WINDOW[0] + 20) sh.checklists.closing.skipped = true
    }
    if (state.dayMinutes <= 362) sh.partners = {}
  }

  function fridgeReading(state) {
    const eq = (state.equipmentList || []).find((e) => e.id === 'eq_pastry_chill')
    const health = eq ? eq.health : 90
    const base = state.nsfAudit?.fridgeTempC ?? 3.8
    const anomaly = Math.random() < (health < 70 ? 0.45 : 0.18)
    if (!anomaly) return Math.round(Math.min(4.9, Math.max(1.5, base + rand(-0.6, 0.8))) * 10) / 10
    return Math.round((Math.random() < 0.6 ? rand(5.3, 7) : rand(7.2, 9.4)) * 10) / 10
  }

  function sanitizerReading(state) {
    const base = state.nsfAudit?.sanitizerPpm ?? 200
    const r = Math.random()
    if (r < 0.2) return Math.round(rand(50, 140) / 10) * 10
    if (r < 0.3) return Math.round(rand(420, 600) / 10) * 10
    return Math.round(Math.min(380, Math.max(160, base + rand(-30, 40))) / 10) * 10
  }

  function stepDrb(state) {
    const sh = ensureShift(state)
    const minutes = state.dayMinutes
    for (const t of sh.drb.tasks) {
      if (t.status === 'scheduled' && minutes >= t.at) {
        t.status = 'pending'
        if (t.kind === 'fridge') t.reading = fridgeReading(state)
        if (t.kind === 'sanitizer') t.reading = sanitizerReading(state)
        if (sh.cur) sh.cur.drbDue += 1
        emit('drb:due', { task: t })
        game.showToast(`📋 مطلوب الآن في دفتر DRB: ${t.label} (تبويب الوردية)`)
      } else if (t.status === 'pending' && minutes > t.due) {
        t.status = 'missed'
        t.correct = false
        if (state.nsfAudit) state.nsfAudit.foodTempAndDates = Math.max(40, state.nsfAudit.foodTempAndDates - 5)
        state.opsScore = Math.max(15, +(state.opsScore - 1.5).toFixed(1))
        emit('drb:logged', { task: t, onTime: false, correct: false })
        game.showToast(`⚠️ فات موعد «${t.label}» في دفتر DRB — نقطة سلبية في جاهزية الـ NSF.`)
      }
    }
  }

  function correctDrbChoice(t) {
    if (t.kind === 'fridge') return t.reading <= 5 ? 'log' : t.reading <= 7 ? 'adjust' : 'discard'
    if (t.kind === 'sanitizer') return t.reading < 150 ? 'refresh' : t.reading > 400 ? 'dilute' : 'log'
    return 'change'
  }

  function logDrb(taskId, choice) {
    const state = getState()
    const sh = ensureShift(state)
    const t = sh.drb.tasks.find((x) => x.id === taskId)
    if (!t || t.status !== 'pending') return null
    const correct = choice === correctDrbChoice(t)
    t.status = 'done'
    t.choice = choice
    t.correct = correct
    if (sh.cur) sh.cur.drbDone += 1
    const nsf = state.nsfAudit
    if (nsf) {
      if (correct) nsf.foodTempAndDates = Math.min(100, nsf.foodTempAndDates + 3)
      else nsf.foodTempAndDates = Math.max(40, nsf.foodTempAndDates - 6)
    }
    if (t.kind === 'fridge' && (choice === 'adjust' || choice === 'discard') && nsf) nsf.fridgeTempC = 3.6
    if (t.kind === 'fridge' && choice === 'discard') {
      state.supplies.food = Math.max(0, state.supplies.food - 20)
      state.money = +(state.money - 12).toFixed(2)
    }
    if (t.kind === 'sanitizer' && correct && nsf) nsf.sanitizerPpm = 200
    if (t.kind === 'bucket' && choice === 'change' && nsf) {
      nsf.sanitizerPpm = 200
      state.cleanliness = Math.min(100, state.cleanliness + 5)
    }
    if (t.kind === 'bucket' && choice !== 'change' && nsf) nsf.sanitizerPpm = Math.max(60, nsf.sanitizerPpm - 60)
    emit('drb:logged', { task: t, onTime: true, correct })
    game.playSound(correct ? 'step' : 'angry')
    game.showToast(correct ? `✅ تم تسجيل «${t.label}» بالإجراء الصحيح.` : `❌ تم التسجيل لكن الإجراء غير صحيح حسب معايير سلامة الغذاء.`)
    return { correct, expected: correctDrbChoice(t) }
  }

  // Opening and closing checklists ------------------------------------------

  function dialInStart() {
    const sh = ensureShift(getState())
    const o = sh.checklists.opening
    if (!o.dialin || o.dialin.done) o.dialin = { shot: Math.round(rand(11, 33)), adjustments: 0, approvals: 0, done: false, perfect: false }
    return o.dialin
  }

  function dialInAdjust(direction) {
    const state = getState()
    const d = ensureShift(state).checklists.opening.dialin || dialInStart()
    if (d.done) return d
    const delta = Math.round(rand(3, 5.5))
    // A finer grind slows the shot down; a coarser grind speeds it up.
    d.shot = Math.max(8, Math.min(40, d.shot + (direction === 'finer' ? delta : -delta)))
    d.adjustments += 1
    game.playSound('step')
    return d
  }

  function dialInApprove() {
    const state = getState()
    const sh = ensureShift(state)
    const d = sh.checklists.opening.dialin || dialInStart()
    if (d.done) return d
    d.approvals += 1
    if (d.shot >= 18 && d.shot <= 23) {
      d.done = true
      d.perfect = d.approvals === 1
      state.machineHealth = Math.min(100, state.machineHealth + 4)
      state.reputation = Math.min(100, +(state.reputation + 0.5).toFixed(1))
      emit('dialin:result', { perfect: d.perfect, shot: d.shot })
      game.playSound('fanfare')
      game.showToast(`☕ معايرة ممتازة: الشوت ${d.shot} ثانية (المعيار 18–23).`)
      afterChecklistItem(state)
    } else {
      state.reputation = Math.max(10, +(state.reputation - 0.4).toFixed(1))
      game.playSound('angry')
      game.showToast(`❌ الشوت ${d.shot} ثانية خارج المعيار (18–23) — ${d.shot < 18 ? 'نعّم الطحنة' : 'خشّن الطحنة'} وحاول مرة أخرى.`)
    }
    return d
  }

  function tillPuzzle(kind) {
    const state = getState()
    const lists = ensureShift(state).checklists
    const slot = lists[kind]
    if (slot.till && !slot.till.done) return slot.till
    const counts = { 200: Math.floor(rand(1, 5)), 100: Math.floor(rand(2, 7)), 50: Math.floor(rand(2, 8)), 20: Math.floor(rand(4, 12)), 10: Math.floor(rand(4, 12)), 5: Math.floor(rand(2, 10)) }
    const actual = Object.entries(counts).reduce((acc, [d, n]) => acc + Number(d) * n, 0)
    const expected = kind === 'opening' ? lists.float : actual + (Math.random() < 0.25 ? Math.round(rand(1, 6)) * 10 : 0)
    const deltas = [-50, -20, -10, 10, 20, 50].sort(() => Math.random() - 0.5).slice(0, 2)
    const options = [actual, actual + deltas[0], actual + deltas[1]].sort(() => Math.random() - 0.5)
    slot.till = { counts, actual, expected, options, done: false, correct: null }
    return slot.till
  }

  function tillAnswer(kind, value) {
    const state = getState()
    const lists = ensureShift(state).checklists
    const t = lists[kind].till
    if (!t || t.done) return t
    t.done = true
    t.correct = Number(value) === t.actual
    const variance = Number(value) - t.actual
    emit('till:counted', { kind, variance })
    if (t.correct) {
      game.playSound('step')
      if (t.actual !== t.expected) {
        const diff = t.actual - t.expected
        game.showToast(`🧮 عدّ صحيح — الدرج ${diff < 0 ? 'به عجز' : 'به زيادة'} ${Math.abs(diff)} ج.م عن المتوقع، تم التوثيق وإبلاغ LP.`)
      } else {
        game.showToast('🧮 عدّ صحيح للدرج ومطابق للمتوقع.')
      }
    } else {
      game.playSound('angry')
      state.opsScore = Math.max(15, +(state.opsScore - 1).toFixed(1))
      game.showToast(`❌ العدّ غير صحيح — المبلغ الفعلي ${t.actual} ج.م. راجع الفئات بهدوء المرة القادمة.`)
    }
    afterChecklistItem(state)
    return t
  }

  function wastePuzzle() {
    const state = getState()
    const c = ensureShift(state).checklists.closing
    if (c.waste && !c.waste.done) return c.waste
    const items = [
      { name: 'كرواسون (Date Dot منتهي)', n: Math.floor(rand(0, 5)), cost: 1.2 },
      { name: 'ساندويتشات منتهية', n: Math.floor(rand(0, 4)), cost: 2.1 },
      { name: 'شرائح كيك منتهية', n: Math.floor(rand(0, 3)), cost: 1.6 },
    ]
    const actual = items.reduce((a, it) => a + it.n, 0)
    const options = [actual, actual + 1, Math.max(0, actual - 1) === actual ? actual + 2 : Math.max(0, actual - 1)].sort(() => Math.random() - 0.5)
    c.waste = { items, actual, options: [...new Set(options)], done: false, correct: null }
    return c.waste
  }

  function wasteAnswer(value) {
    const state = getState()
    const c = ensureShift(state).checklists.closing
    const w = c.waste
    if (!w || w.done) return w
    w.done = true
    w.correct = Number(value) === w.actual
    const cost = w.items.reduce((a, it) => a + it.n * it.cost, 0)
    state.money = +(state.money - cost).toFixed(2)
    emit('waste:logged', { accurate: w.correct, count: w.actual, cost })
    game.playSound(w.correct ? 'step' : 'angry')
    game.showToast(w.correct ? `🗑️ سجل الهدر دقيق: ${w.actual} أصناف (-$${cost.toFixed(2)}).` : `❌ سجل الهدر غير دقيق (الفعلي ${w.actual}).`)
    afterChecklistItem(state)
    return w
  }

  function simpleItem(kind, key) {
    const state = getState()
    const lists = ensureShift(state).checklists
    if (lists[kind][key]) return
    lists[kind][key] = true
    if (key === 'pastry' && state.nsfAudit) state.nsfAudit.foodTempAndDates = Math.min(100, state.nsfAudit.foodTempAndDates + 3)
    if (key === 'brew') state.reputation = Math.min(100, +(state.reputation + 0.5).toFixed(1))
    if (key === 'clean') {
      state.machineHealth = 100
      state.cleanliness = Math.min(100, state.cleanliness + 15)
    }
    if (key === 'restock') {
      const cost = 15
      state.money = +(state.money - cost).toFixed(2)
      Object.keys(state.supplies).forEach((k) => (state.supplies[k] = 100))
    }
    game.playSound('step')
    afterChecklistItem(state)
  }

  function checklistDone(kind, lists) {
    const c = lists[kind]
    if (kind === 'opening') return !!(c.dialin?.done && c.till?.done && c.pastry && c.brew)
    return !!(c.waste?.done && c.till?.done && c.clean && c.restock)
  }

  function afterChecklistItem(state) {
    const lists = ensureShift(state).checklists
    for (const kind of ['opening', 'closing']) {
      if (!lists[kind].done && !lists[kind].missed && checklistDone(kind, lists)) {
        lists[kind].done = true
        emit('checklist:done', { kind })
        game.playSound('fanfare')
        game.showToast(kind === 'opening' ? '✅ قائمة الافتتاح مكتملة — الفرع جاهز لاستقبال الزبائن!' : '✅ قائمة الإغلاق مكتملة — تسليم ممتاز للوردية القادمة.')
      }
    }
    emit('shift:changed', {})
  }

  function stepChecklists(state) {
    const sh = ensureShift(state)
    const lists = sh.checklists
    const minutes = state.dayMinutes
    // A partner who cannot count the till leaves it to the shift supervisor on duty.
    for (const [kind, win] of [['opening', OPENING_WINDOW], ['closing', CLOSING_WINDOW]]) {
      const c = lists[kind]
      if (!c || c.skipped) continue
      if (c && !c.announced && minutes >= win[0] && minutes < win[1]) {
        c.announced = true
        game.playSound('ding')
        game.showToast(kind === 'opening' ? '📋 بدأ وقت قائمة الافتتاح (حتى 7:30 ص): معايرة الإسبريسو، عدّ الدرج، تواريخ المخبوزات، تحضير القهوة — تبويب «الوردية».' : '📋 بدأ وقت قائمة الإغلاق (حتى 10:00 م): سجل الهدر، عدّ الدرج، تنظيف الماكينات، التموين — تبويب «الوردية».')
        emit('shift:changed', {})
      }
      if (!canLead() && minutes >= win[0] + 30 && c && !c.till?.done) {
        tillPuzzle(kind)
        c.till.done = true
        c.till.correct = Math.random() < 0.85
        c.till.byNpc = true
        afterChecklistItem(state)
      }
      if (c && !c.done && !c.missed && minutes >= win[1] - 2 && minutes >= win[0]) {
        c.missed = true
        state.opsScore = Math.max(15, +(state.opsScore - 2).toFixed(1))
        game.showToast(kind === 'opening' ? '⚠️ انتهى وقت قائمة الافتتاح قبل اكتمالها.' : '⚠️ انتهى اليوم قبل اكتمال قائمة الإغلاق.')
        emit('shift:changed', {})
      }
    }
  }

  // ------------------------------------------------------------- breaks law

  function stepPartners(state) {
    const sh = ensureShift(state)
    const team = game.getStoreTeam()
    for (const s of team) {
      const p = (sh.partners[s.id] ??= { worked: 0, rest: 0, breakMin: 0, violated: false, wasOnBreak: false })
      const on = isOnShift(state, s)
      if (s.onBreak) {
        p.rest += 2
        p.breakMin += 2
      } else if (on) {
        if (p.wasOnBreak && p.breakMin >= MIN_BREAK_MIN) {
          p.worked = 0
          p.violated = false
        }
        p.breakMin = 0
        p.worked += 2
        if (p.worked > MAX_CONSECUTIVE_MIN && !p.violated) {
          p.violated = true
          if (sh.cur) sh.cur.breakViolations += 1
          state.opsScore = Math.max(15, +(state.opsScore - 2).toFixed(1))
          emit('breaks:violation', { staffId: s.id })
          game.showToast(`⚖️ مخالفة قانون العمل: «${s.cleanName || s.name}» يعمل أكثر من 5 ساعات متصلة بدون راحة!`)
        }
      } else {
        p.breakMin = 0
      }
      p.wasOnBreak = !!s.onBreak
    }
  }

  // --------------------------------------------------------------- labour

  function stepLabor(state) {
    const sh = ensureShift(state)
    if (!sh.cur) return
    const onFloor = game.getActiveBranchStaff()
    sh.cur.staffOnShift = Math.max(sh.cur.staffOnShift, onFloor.length)
    const cost = onFloor.reduce((acc, s) => acc + (WAGES[s.jobCode] || WAGES.barista) / 30, 0)
    sh.cur.laborCost += cost
    state.money = +(state.money - cost).toFixed(2)
  }

  // ------------------------------------------------------------- events

  on('sim:step', () => {
    const state = getState()
    planDay(state)
    const phase = phaseFor(state.dayMinutes)
    const sh = ensureShift(state)
    const key = `${state.day}-${phase.key}`
    if (sh.key !== key) {
      if (sh.cur) endShift(state)
      startShift(state, phase)
    }
    stepLabor(state)
    stepPartners(state)
    stepDrb(state)
    stepChecklists(state)
  })
  // The closing shift ends with the day, before the day's counters reset.
  on('day:end', () => {
    const state = getState()
    if (ensureShift(state).cur) endShift(state)
  })
  on('order:served', ({ order, earned, ratioLeft, elapsed }) => {
    const c = ensureShift(getState()).cur
    if (!c) return
    c.orders += 1
    c.sales += Math.max(0, +earned || 0)
    if (ratioLeft > 0.5) c.fast += 1
    if (order.channel === 'drive_thru') c.dtTimes.push(elapsed)
  })
  on('order:angry', () => {
    const c = ensureShift(getState()).cur
    if (c) c.angry += 1
  })
  on('complaint:resolved', () => {
    const c = ensureShift(getState()).cur
    if (c) c.complaintsResolved += 1
  })
  on('incident:resolved', ({ best, timedOut }) => {
    const c = ensureShift(getState()).cur
    if (!c) return
    c.incidents += 1
    if (best) c.incidentsBest += 1
    if (timedOut) c.incidentTimeouts += 1
  })
  on('game:started', () => {
    const state = getState()
    planDay(state)
    ensureMetrics(state)
  })

  // ------------------------------------------------------- leader actions

  function callIn(staffId) {
    const state = getState()
    if (!canLead()) return game.showToast('🔒 استدعاء موظف إضافي من صلاحيات مشرف الوردية فأعلى.')
    const sh = ensureShift(state)
    if (!sh.cur) return
    if (sh.cur.callIns >= 2) return game.showToast('⚠️ الحد الأقصى استدعاءان في الوردية الواحدة.')
    const staff = game.getStoreTeam().find((s) => s.id === staffId)
    if (!staff || isOnShift(state, staff)) return
    if (staff.sickLeave) return game.showToast('🏥 لا يمكن استدعاء موظف في إجازة مرضية.')
    const phase = phaseFor(state.dayMinutes)
    sh.overrides.extra[staffId] = phase.to
    delete sh.overrides.sentHome[staffId]
    sh.cur.callIns += 1
    staff.energy = Math.max(staff.energy, 85)
    game.playSound('ding')
    game.showToast(`📞 تم استدعاء «${staff.cleanName || staff.name}» لدعم ${phase.short} حتى ${fmtTime(phase.to)}.`)
    emit('shift:changed', {})
  }

  function sendHome(staffId) {
    const state = getState()
    if (!canLead()) return game.showToast('🔒 الانصراف المبكر من صلاحيات مشرف الوردية فأعلى.')
    const sh = ensureShift(state)
    const onFloor = game.getActiveBranchStaff()
    const staff = onFloor.find((s) => s.id === staffId)
    if (!staff) return
    if (onFloor.length <= 1) return game.showToast('⚠️ لا يمكن ترك الفرع بدون أي موظف على الأرضية.')
    sh.overrides.sentHome[staffId] = true
    delete sh.overrides.extra[staffId]
    game.playSound('step')
    game.showToast(`🏠 انصراف مبكر لـ «${staff.cleanName || staff.name}» لضبط نسبة العمالة.`)
    emit('shift:changed', {})
  }

  return {
    logDrb,
    correctDrbChoice,
    dialInStart,
    dialInAdjust,
    dialInApprove,
    tillPuzzle,
    tillAnswer,
    wastePuzzle,
    wasteAnswer,
    simpleItem,
    callIn,
    sendHome,
    canLead,
    isOnShift: (staff) => isOnShift(getState(), staff),
    endShiftNow: () => endShift(getState()),
  }
}
