// The career ladder: Barista → Barista Trainer → Shift Supervisor → ASM →
// Store Manager → (1000 missions) honorary Area Manager. Each step needs
// missions, KPIs from real shifts, certificates and a panel interview.
import { emit, on } from '../../core/events.js'
import { LEADERSHIP } from '../../data/branches.js'
import { ensureMetrics } from '../metrics.js'
import { missionsDone } from '../missions/engine.js'
import { ensureSbc } from '../sbc.js'
import { INTERVIEW_QUESTIONS } from './interviews.js'
import { CERTS, drawQuestions, QUESTIONS } from './quizBank.js'

export const RANKS = [
  { key: 'barista', title: 'باريستا (Barista)', short: 'باريستا', role: 'barista', passiveShare: 0 },
  { key: 'trainer', title: 'باريستا مدرب (Barista Trainer)', short: 'باريستا مدرب', role: 'barista', passiveShare: 0 },
  { key: 'supervisor', title: 'مشرف وردية (Shift Supervisor)', short: 'مشرف وردية', role: 'supervisor', passiveShare: 0.25 },
  { key: 'asm', title: 'مساعد مدير فرع (ASM)', short: 'مساعد مدير', role: 'manager', passiveShare: 0.5 },
  { key: 'manager', title: 'مدير فرع (Store Manager)', short: 'مدير فرع', role: 'manager', passiveShare: 1 },
  { key: 'area', title: 'مدير منطقة فخري (Area Manager)', short: 'مدير منطقة', role: 'manager', passiveShare: 1.5 },
]

/** The network income was tuned for an empire game; a store career earns a share of it. */
export const PASSIVE_SCALE = 0.02

/** Registered job title → the rank a fast track may reach without mission targets. */
const JOB_RANK = {
  barista: 0,
  barista_trainer: 1,
  shift_supervisor: 2,
  asm: 3,
  store_manager: 4,
  area_manager: 4,
  operations: 4,
  training: 4,
  support_center: 2,
  other: 0,
}

const REQUIREMENTS = {
  trainer: {
    missions: 25,
    certs: ['basics'],
    kpis: [
      { metric: 'served_total', need: 150, label: 'طلبات مسلّمة' },
      { metric: 'shifts_done', need: 3, label: 'ورديات مكتملة' },
    ],
    panel: ['training'],
  },
  supervisor: {
    missions: 90,
    certs: ['coffee', 'nsf'],
    kpis: [
      { metric: 'shift_B', need: 6, label: 'ورديات بتقدير B أو أعلى' },
      { metric: 'complaints_resolved', need: 8, label: 'شكاوى محلولة' },
    ],
    panel: ['training', 'area'],
  },
  asm: {
    missions: 220,
    certs: ['ssv'],
    kpis: [
      { metric: 'shift_A', need: 8, label: 'ورديات بتقدير A' },
      { metric: 'labor_target', need: 6, label: 'ورديات بعمالة في المستهدف' },
      { metric: 'audits_passed', need: 4, label: 'زيارات تفتيش ناجحة' },
      { metric: 'incidents_resolved', need: 12, label: 'مشكلات معقدة محلولة' },
    ],
    panel: ['operations'],
  },
  manager: {
    missions: 400,
    certs: ['sm'],
    kpis: [
      { metric: 'nsf_green', need: 3, label: 'زيارات NSF بتقدير GREEN' },
      { metric: 'shift_A', need: 20, label: 'ورديات بتقدير A' },
      { metric: 'retained', need: 3, label: 'موظفون سحبوا استقالاتهم' },
      { metric: 'day_zero_angry', need: 3, label: 'أيام بلا زبون غاضب' },
    ],
    panel: ['operations', 'area'],
  },
}

export function ensureCareer(state) {
  const sbc = ensureSbc(state)
  const c = sbc.career
  c.rank ??= 'barista'
  c.xp ??= 0
  c.cp ??= 0
  c.certs ??= {}
  c.examFails ??= {}
  c.interviewFails ??= {}
  c.history ??= []
  c.fastTrackUsed ??= {}
  return c
}

export function rankIndex(key) {
  return Math.max(0, RANKS.findIndex((r) => r.key === key))
}

export function currentRank(state) {
  return RANKS[rankIndex(ensureCareer(state).rank)]
}

export function nextRank(state) {
  const i = rankIndex(ensureCareer(state).rank)
  return i < 4 ? RANKS[i + 1] : null
}

export function isFastTrack(rankKey, jobKey) {
  const target = rankIndex(rankKey)
  return target <= (JOB_RANK[jobKey] ?? 0)
}

/** Every requirement for the next rank with what the player has. */
export function requirementsFor(state, rankKey, jobKey) {
  const req = REQUIREMENTS[rankKey]
  if (!req) return { items: [], ready: false, fastTrack: false }
  const career = ensureCareer(state)
  const m = ensureMetrics(state)
  const fast = isFastTrack(rankKey, jobKey)
  const items = []
  items.push({ kind: 'missions', label: 'مهام منجزة من الألف', have: missionsDone(state), need: req.missions, waived: fast })
  for (const k of req.kpis) items.push({ kind: 'kpi', label: k.label, have: m.life[k.metric] || 0, need: k.need, waived: fast })
  for (const certId of req.certs) {
    const passed = !!career.certs[certId]?.passed
    items.push({ kind: 'cert', certId, label: `شهادة ${CERTS[certId].title}`, have: passed ? 1 : 0, need: 1, waived: false })
  }
  items.forEach((it) => (it.ok = it.waived || it.have >= it.need))
  const ready = items.every((it) => it.ok)
  return { items, ready, fastTrack: fast, panel: req.panel }
}

export function examCooldown(state, certId) {
  const career = ensureCareer(state)
  const failedDay = career.examFails[certId]
  return failedDay && state.day <= failedDay ? failedDay + 1 : 0
}

export function interviewCooldown(state, rankKey) {
  const career = ensureCareer(state)
  const failedDay = career.interviewFails[rankKey]
  return failedDay && state.day <= failedDay ? failedDay + 1 : 0
}

export function startExam(certId, rand = Math.random) {
  return { certId, questions: drawQuestions(certId, 10, rand) }
}

export function gradeExam(exam, answers) {
  const total = exam.questions.length
  const correct = exam.questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0)
  const score = Math.round((correct / Math.max(1, total)) * 100)
  return { correct, total, score, passed: score >= CERTS[exam.certId].pass }
}

export function interviewPanel(state, rankKey) {
  const req = REQUIREMENTS[rankKey]
  if (!req) return []
  const region = (state.branches || []).find((b) => b.id === state.activeBranchId) || (state.branches || [])[0]
  return req.panel.map((who) => {
    if (who === 'training') return LEADERSHIP.training
    if (who === 'operations') return LEADERSHIP.operations
    return { name: region?.dmName || 'مدير المنطقة', title: region?.dmTitle || 'مدير المنطقة' }
  })
}

export function gradeInterview(rankKey, answers) {
  const qs = INTERVIEW_QUESTIONS[rankKey] || []
  const max = qs.reduce((acc, q) => acc + Math.max(...q.options.map((o) => o.score)), 0)
  const score = qs.reduce((acc, q, i) => acc + (q.options[answers[i]]?.score || 0), 0)
  const pct = Math.round((score / Math.max(1, max)) * 100)
  return { score, max, pct, passed: pct >= 70 }
}

export function installCareer({ getState, game, hooks, getJobKey, openCareer }) {
  function syncRole() {
    const state = getState()
    const rank = currentRank(state)
    if (!state.playerProfile) state.playerProfile = { name: '', role: rank.role, onboardingDone: false }
    // The player may play a lower role than they earned (e.g. a manager behind the bar), never a higher one.
    const order = { barista: 0, supervisor: 1, manager: 2 }
    if ((order[state.playerProfile.role] ?? 2) > order[rank.role]) state.playerProfile.role = rank.role
  }

  hooks.passiveMultiplier = () => PASSIVE_SCALE * currentRank(getState()).passiveShare
  hooks.canSelectRole = (roleKey) => {
    const order = { barista: 0, supervisor: 1, manager: 2 }
    const ok = (order[roleKey] ?? 0) <= order[currentRank(getState()).role]
    if (!ok) game.showToast('🔒 هذا المنصب يتطلب ترقية من تبويب «المسيرة» (اختبارات ومقابلة ومهام).')
    return ok
  }
  hooks.onPromoteSelfClicked = () => openCareer()

  function finishExam(exam, answers) {
    const state = getState()
    const career = ensureCareer(state)
    const result = gradeExam(exam, answers)
    const prev = career.certs[exam.certId]
    if (result.passed) {
      career.certs[exam.certId] = { passed: true, score: Math.max(result.score, prev?.score || 0), day: state.day, at: Date.now() }
      delete career.examFails[exam.certId]
      emit('cert:passed', { id: exam.certId, score: result.score })
      game.playSound('fanfare')
      game.showToast(`🎓 مبروك! اجتزت «${CERTS[exam.certId].title}» بدرجة ${result.score}%`)
    } else {
      career.examFails[exam.certId] = state.day
      game.playSound('angry')
      game.showToast(`📚 درجتك ${result.score}% (النجاح ${CERTS[exam.certId].pass}%). تقدر تعيد الاختبار من اليوم ${state.day + 1}.`)
    }
    emit('quiz:finished', { certId: exam.certId, score: result.score, passed: result.passed })
    return result
  }

  function finishInterview(rankKey, answers) {
    const state = getState()
    const career = ensureCareer(state)
    const result = gradeInterview(rankKey, answers)
    emit('quiz:finished', { certId: `interview_${rankKey}`, score: result.pct, passed: result.passed })
    if (!result.passed) {
      career.interviewFails[rankKey] = state.day
      game.playSound('angry')
      game.showToast(`🤝 نتيجة المقابلة ${result.pct}% (المطلوب 70%). تقدر تطلب مقابلة جديدة من اليوم ${state.day + 1}.`)
      return result
    }
    promote(rankKey, { fastTrack: requirementsFor(state, rankKey, getJobKey()).fastTrack })
    return result
  }

  function promote(rankKey, { fastTrack = false } = {}) {
    const state = getState()
    const career = ensureCareer(state)
    const from = career.rank
    career.rank = rankKey
    if (fastTrack) career.fastTrackUsed[rankKey] = true
    career.history.unshift({ rank: rankKey, from, day: state.day, at: Date.now(), fastTrack })
    const rank = RANKS[rankIndex(rankKey)]
    state.playerProfile.role = rank.role
    delete career.interviewFails[rankKey]
    game.playSound('fanfare')
    game.spawnSparkles(480, 200, '#CBA258')
    game.showToast(`🎉 مبروك الترقية! أصبحت «${rank.title}»`)
    game.pushNewEmail({
      sender: `${LEADERSHIP.training.name} و${LEADERSHIP.operations.name}`,
      roleBadge: 'قرار ترقية 🎖️',
      subject: `تهنئة بالترقية إلى ${rank.title}`,
      body: `يسعدنا إبلاغك بنجاحك في متطلبات الترقية ومقابلة اللجنة. أصبحت الآن «${rank.title}» بصلاحيات أوسع ومسؤوليات أكبر. نثق أنك ستكون قدوة لفريقك في الجودة وتجربة العميل وقانون الراحات.`,
      choices: [{ label: '🙏 شكراً — جاهز للمسؤولية (+5% رضا الإدارة)', cost: 0, dmDelta: 5, opsDelta: 3 }],
    })
    emit('career:promoted', { rank: rankKey, from })
    game.updateHUD()
  }

  on('missions:allDone', () => {
    const state = getState()
    const career = ensureCareer(state)
    if (career.rank !== 'area') promote('area')
  })
  on('game:started', syncRole)
  on('game:reset', syncRole)

  return {
    finishExam,
    finishInterview,
    promote,
    syncRole,
    requirements: (rankKey) => requirementsFor(getState(), rankKey, getJobKey()),
  }
}

export { CERTS, QUESTIONS, INTERVIEW_QUESTIONS }
