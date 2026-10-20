// Shift tab: the live shift (labour %, service, grade), the Play Builder
// (who is on which station), partners' hours under the breaks law, the Daily
// Records Book, the opening and closing checklists, recent problems and the
// shift reports.
import { on } from '../../core/events.js'
import { CATEGORY_LABELS } from '../../systems/incidents/bank.js'
import {
  CLOSING_WINDOW,
  ensureShift,
  fmtTime,
  gradeShift,
  isDriveThruStore,
  isOnShift,
  LABOR_TARGET,
  MAX_CONSECUTIVE_MIN,
  OPENING_WINDOW,
  phaseFor,
  STAFF_SHIFTS,
} from '../../systems/shift/shift.js'
import { $, esc, fmtMoney, fmtNum, setHtml } from '../dom.js'
import { openModal } from '../modal.js'
import { pill, section } from '../section.js'

const SHIFT_LABEL = { morning: 'صباحي 6ص–2م', peak: 'ذروة 11ص–7م', evening: 'مسائي 3م–10م', sick: 'إجازة مرضية' }
const GRADE_CLS = {
  'A+': 'bg-emerald-600 text-white',
  A: 'bg-emerald-700 text-white',
  'B+': 'bg-sky-700 text-white',
  B: 'bg-sky-800 text-white',
  C: 'bg-amber-600 text-slate-950',
  D: 'bg-orange-700 text-white',
  F: 'bg-rose-700 text-white',
}
const DRB_CHOICES = {
  fridge: [
    { id: 'log', label: '✅ القراءة سليمة (≤ 5°م) — تسجيل' },
    { id: 'adjust', label: '🔧 5–7°م — ضبط الثرموستات وإعادة القياس' },
    { id: 'discard', label: '🗑️ أعلى من 7°م — إعدام الأصناف وطلب صيانة' },
  ],
  sanitizer: [
    { id: 'log', label: '✅ 150–400 ppm — تسجيل' },
    { id: 'refresh', label: '🧪 أقل من 150 — تحضير محلول جديد' },
    { id: 'dilute', label: '💧 أعلى من 400 — تخفيف المحلول' },
  ],
  bucket: [
    { id: 'change', label: '🪣 تغيير المحلول والجرادل الآن' },
    { id: 'skip', label: '⏭️ تأجيل للوردية التالية' },
  ],
}


export function installShiftTab({ game, systems }) {
  const root = $('sbcShiftRoot')
  if (!root) return { render() {} }
  const api = systems.shift
  root.innerHTML = `
    <div class="sb-card rounded-2xl p-3.5 shadow-xl">
      <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
        <h3 class="text-sm font-extrabold text-[#CBA258]">⏱️ إدارة الوردية (Shift Supervisor Playbook)</h3>
        <p class="text-[11px] text-emerald-200/80">نسبة العمالة، توزيع المحطات، قانون الراحات (لا أكثر من 5 ساعات متصلة)، دفتر DRB وقوائم الافتتاح والإغلاق — وتقرير بتقدير في نهاية كل وردية.</p>
      </div>
      <div data-sec="status"></div>
    </div>
    <div data-sec="checklist"></div>
    <div data-sec="drb"></div>
    <div data-sec="play"></div>
    <div data-sec="team"></div>
    <div data-sec="problems"></div>
    <div data-sec="reports"></div>`
  const sec = (k) => root.querySelector(`[data-sec="${k}"]`)

  // ------------------------------------------------------------ status
  function statusHtml(state) {
    const sh = ensureShift(state)
    const c = sh.cur
    const phase = phaseFor(state.dayMinutes)
    if (!c) return '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لا توجد وردية جارية.</div>'
    const g = gradeShift(c, { cleanliness: state.cleanliness, machineHealth: state.machineHealth, openComplaints: (state.complaints || []).filter((x) => !x.resolved && x.inStore).length, laborManaged: api.canLead() })
    const laborCls = c.sales <= 0 ? 'text-slate-300' : g.laborOnTarget ? 'text-emerald-300' : g.laborPct > LABOR_TARGET.max ? 'text-rose-300' : 'text-amber-300'
    const dtAvg = c.dtTimes.length ? Math.round(c.dtTimes.reduce((a, b) => a + b, 0) / c.dtTimes.length) : 0
    const onFloor = game.getActiveBranchStaff().length
    const tile = (label, value, cls = 'text-white') => `
      <div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-2 text-center">
        <div class="text-[10px] text-emerald-300/80">${label}</div>
        <div class="text-sm font-extrabold font-num ${cls}">${value}</div>
      </div>`
    return `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div class="text-xs font-extrabold text-white">${esc(phase.label)} <span class="text-emerald-300 font-num">(${fmtTime(phase.from)} – ${fmtTime(phase.to)})</span></div>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-emerald-300">التقدير المتوقع</span>
          <span class="text-xs font-black font-num px-2.5 py-0.5 rounded-lg ${GRADE_CLS[g.grade]}">${g.grade} • ${g.score}</span>
        </div>
      </div>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        ${tile('على الأرضية', fmtNum(onFloor))}
        ${tile('الطلبات', fmtNum(c.orders))}
        ${tile('غاضبون', fmtNum(c.angry), c.angry ? 'text-rose-300' : 'text-emerald-300')}
        ${tile('المبيعات', fmtMoney(c.sales), 'text-[#CBA258]')}
        ${tile(`العمالة (${LABOR_TARGET.min}–${LABOR_TARGET.max}%)`, c.sales > 0 ? `${g.laborPct}%` : '—', laborCls)}
        ${tile('متوسط الدرايف', dtAvg ? `${dtAvg} ث` : '—', dtAvg && dtAvg > 45 ? 'text-rose-300' : 'text-sky-300')}
      </div>
      <div class="text-[10px] text-emerald-200/70 mt-2">تكلفة العمالة حتى الآن ${fmtMoney(c.laborCost)} • مخالفات الراحات ${c.breakViolations} • DRB ${c.drbDone}/${c.drbDue} • مشكلات ${c.incidentsBest}/${c.incidents} بأفضل قرار</div>`
  }

  // --------------------------------------------------------- checklists
  function checklistHtml(state) {
    const sh = ensureShift(state)
    const lists = sh.checklists
    const minutes = state.dayMinutes
    const lead = api.canLead()
    const kind = minutes < 900 ? 'opening' : 'closing'
    const c = lists[kind]
    if (!c) return ''
    const win = kind === 'opening' ? OPENING_WINDOW : CLOSING_WINDOW
    const open = minutes >= win[0] && minutes < win[1] && !c.done && !c.missed && !c.skipped
    const title = kind === 'opening' ? '🌅 قائمة الافتتاح (Opening Checklist)' : '🌙 قائمة الإغلاق (Closing Checklist)'
    let badge
    if (c.done) badge = pill('✅ مكتملة', 'bg-emerald-700 text-white')
    else if (c.missed) badge = pill('⚠️ فاتت', 'bg-rose-700 text-white')
    else if (c.skipped) badge = pill('— بدأت اليوم بعد موعدها', 'bg-slate-700 text-slate-200')
    else if (open) badge = pill(`⏳ حتى ${fmtTime(win[1])}`, 'bg-amber-500 text-slate-950')
    else badge = pill(`🕐 تبدأ ${fmtTime(win[0])}`, 'bg-slate-800 text-emerald-200')

    const item = (done, label, action) => `
      <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b1915] border ${done ? 'border-emerald-600/60' : 'border-emerald-800/70'}">
        <span class="text-[11px] font-bold ${done ? 'text-emerald-300' : 'text-white'}">${done ? '✅' : '⬜'} ${label}</span>
        ${done || !open ? '' : action}
      </div>`
    const btn = (attrs, label) => `<button type="button" ${attrs} class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold sb-btn-gold shrink-0">${label}</button>`
    const rows = []
    if (kind === 'opening') {
      const d = c.dialin
      let dial = btn('data-ck="dialin-start"', '☕ ابدأ المعايرة')
      if (d && !d.done) {
        const cls = d.shot >= 18 && d.shot <= 23 ? 'text-emerald-300' : 'text-rose-300'
        dial = `<div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] font-num font-extrabold ${cls}">⏱️ ${d.shot} ث</span>
            <button type="button" data-ck="finer" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800 hover:bg-slate-700 text-white">أنعم (أبطأ)</button>
            <button type="button" data-ck="coarser" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800 hover:bg-slate-700 text-white">أخشن (أسرع)</button>
            ${btn('data-ck="approve"', 'اعتماد')}
          </div>`
      }
      rows.push(item(!!d?.done, `معايرة الإسبريسو (الشوت 18–23 ثانية)${d?.done ? ` — ${d.shot} ث${d.perfect ? ' من أول مرة' : ''}` : ''}`, dial))
      rows.push(tillItem(c, 'opening', open, lead, item, btn))
      rows.push(item(c.pastry, 'فحص تواريخ المخبوزات (Day Dots) وسحب المنتهي', btn('data-ck="simple" data-kind="opening" data-key="pastry"', '🥐 تم الفحص')))
      rows.push(item(c.brew, 'تحضير قهوة اليوم المقطرة (Pike Place) وتسجيل وقتها', btn('data-ck="simple" data-kind="opening" data-key="brew"', '☕ تم التحضير')))
    } else {
      const w = c.waste
      let waste = btn('data-ck="waste-start"', '🗑️ سجّل الهدر')
      if (w && !w.done) {
        waste = `<div class="w-full mt-1.5">
            <div class="text-[10px] text-emerald-200 mb-1">${w.items.map((it) => `${esc(it.name)}: <strong class="font-num">${it.n}</strong>`).join(' • ')}</div>
            <div class="flex flex-wrap gap-1.5">${w.options.map((o) => btn(`data-ck="waste" data-value="${o}"`, `${o} أصناف`)).join('')}</div>
          </div>`
      }
      rows.push(item(!!w?.done, `سجل الهدر (Waste Log)${w?.done ? ` — ${w.correct ? 'دقيق' : 'غير دقيق'}` : ''}`, waste))
      rows.push(tillItem(c, 'closing', open, lead, item, btn))
      rows.push(item(c.clean, 'تنظيف ماكينات الإسبريسو والخلاطات (Close Clean)', btn('data-ck="simple" data-kind="closing" data-key="clean"', '🧽 تم ($0)')))
      rows.push(item(c.restock, 'تموين المحطات للوردية القادمة', btn('data-ck="simple" data-kind="closing" data-key="restock"', '📦 تم ($15)')))
    }
    return section(title, open ? 'نفّذ البنود قبل انتهاء الوقت — كل بند صحيح يرفع جاهزية الفرع وتقييم العمليات.' : '', `<div class="space-y-1.5">${rows.join('')}</div>`, 'amber', badge)
  }

  function tillItem(c, kind, open, lead, item, btn) {
    const t = c.till
    const label = `عدّ درج الكاش (${kind === 'opening' ? 'الفلوت 1500 ج.م' : 'تسوية الإغلاق'})`
    if (!lead) return item(!!t?.done, `${label} — ${t?.done ? 'عدّه مشرف الوردية' : 'من مهام مشرف الوردية'}`, '')
    let action = btn(`data-ck="till-start" data-kind="${kind}"`, '🧮 ابدأ العد')
    if (t && !t.done) {
      const counts = Object.entries(t.counts)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([d, n]) => `<span class="px-1.5 py-0.5 rounded bg-black/40 font-num">${d} × ${n}</span>`)
        .join(' ')
      action = `<div class="w-full mt-1.5">
          <div class="flex flex-wrap gap-1 text-[10px] text-emerald-100 mb-1.5">${counts}</div>
          <div class="text-[10px] text-emerald-300 mb-1">كم إجمالي الدرج؟</div>
          <div class="flex flex-wrap gap-1.5">${t.options.map((o) => btn(`data-ck="till" data-kind="${kind}" data-value="${o}"`, `${fmtNum(o)} ج.م`)).join('')}</div>
        </div>`
    }
    return item(!!t?.done, `${label}${t?.done ? ` — ${t.correct ? 'صحيح' : 'خطأ'}` : ''}`, action)
  }

  // ------------------------------------------------------------- DRB
  function drbHtml(state) {
    const sh = ensureShift(state)
    const tasks = sh.drb.tasks || []
    const statusPill = (t) =>
      ({
        scheduled: pill(`🕐 ${fmtTime(t.at)}`, 'bg-slate-800 text-emerald-200'),
        pending: pill(`⏳ حتى ${fmtTime(t.due)}`, 'bg-amber-500 text-slate-950'),
        done: pill(t.correct ? '✅ صحيح' : '❌ إجراء خاطئ', t.correct ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'),
        missed: pill('⚠️ فات', 'bg-rose-800 text-white'),
        skipped: pill('—', 'bg-slate-800 text-slate-400'),
      })[t.status] || ''
    const rows = tasks
      .map((t) => {
        let body = ''
        if (t.status === 'pending') {
          const reading = t.kind === 'fridge' ? `القراءة: <strong class="font-num text-white">${t.reading}°م</strong>` : t.kind === 'sanitizer' ? `القراءة: <strong class="font-num text-white">${t.reading} ppm</strong>` : 'مرّت 4 ساعات على آخر تغيير'
          body = `<div class="mt-1.5 text-[11px] text-emerald-200">${reading}</div>
            <div class="flex flex-col gap-1 mt-1.5">${DRB_CHOICES[t.kind].map((ch) => `<button type="button" data-drb="${t.id}" data-choice="${ch.id}" class="text-right px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-[#0f231d] hover:bg-emerald-900 border border-emerald-700/60 text-white">${ch.label}</button>`).join('')}</div>`
        }
        return `<div class="p-2 rounded-xl bg-[#0b1915] border ${t.status === 'pending' ? 'border-amber-400' : 'border-emerald-800/70'}">
            <div class="flex items-center justify-between gap-2"><span class="text-[11px] font-bold text-white">${esc(t.label)}</span>${statusPill(t)}</div>
            ${body}
          </div>`
      })
      .join('')
    return section('📒 دفتر السجلات اليومي (DRB)', 'سجّل حرارة الثلاجات (الحد 5°م / 41°ف) وتركيز المعقم وتغيير الجرادل في موعدها. القرار الخاطئ أو الفائت يخفض جاهزية زيارة الـ NSF.', `<div class="space-y-1.5">${rows}</div>`, 'sky')
  }

  // ------------------------------------------------------- Play Builder
  function playHtml(state) {
    const team = game.getActiveBranchStaff()
    const roles = game.STATION_ROLES
    const covered = (id) => team.some((s) => s.role === id && !s.onBreak)
    const flex = team.filter((s) => s.role === 'flex' && !s.onBreak).length
    const needs = [
      { id: 'hot_bar', label: 'البار الساخن' },
      { id: 'cold_bar', label: 'البار البارد' },
      { id: 'warming_dtr', label: isDriveThruStore(state.activeSubStoreName) ? 'الفرن وشباك الدرايف' : 'الفرن والتسليم' },
      { id: 'cs', label: 'الدعم والنظافة (CS)' },
    ]
    let flexLeft = flex
    const gaps = needs.filter((n) => {
      if (covered(n.id)) return false
      if (flexLeft > 0) {
        flexLeft -= 1
        return false
      }
      return true
    })
    const advice = gaps.length
      ? `<div class="p-2 rounded-xl bg-rose-950/70 border border-rose-500/50 text-[11px] text-rose-200 font-bold mb-2">⚠️ محطات بدون تغطية: ${gaps.map((g) => g.label).join('، ')}. أي محطة فارغة تبطئ كل الطلبات التي تمر بها.</div>`
      : `<div class="p-2 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-[11px] text-emerald-200 font-bold mb-2">✅ كل المحطات مغطاة — توزيع متوازن للذروة.</div>`
    const lead = api.canLead()
    const rows = team
      .map(
        (s) => `<div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b1915] border border-emerald-800/70">
          <span class="text-[11px] font-bold text-white min-w-0 truncate">${s.onBreak ? '🛋️' : '👤'} ${esc(s.cleanName || s.name)}</span>
          <select data-play="${s.id}" ${lead ? '' : 'disabled'} class="bg-slate-900 border border-emerald-600/60 text-white text-[11px] font-bold rounded-lg px-2 py-1 max-w-[55%]">
            ${roles.map((r) => `<option value="${r.id}" ${s.role === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
          </select>
        </div>`,
      )
      .join('')
    return section(
      '🧩 توزيع المحطات (Play Builder)',
      lead ? 'وزّع الموجودين على الأرضية حسب ضغط القنوات: ساخن، بارد، فرن/شباك، ودعم. التوزيع من صلاحيات مشرف الوردية.' : '🔒 توزيع المحطات من صلاحيات مشرف الوردية — اعرض التوزيع الحالي فقط.',
      advice + (rows ? `<div class="space-y-1.5">${rows}</div>` : '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لا يوجد موظفون على الأرضية الآن.</div>'),
      'emerald',
    )
  }

  // ------------------------------------------------------------- team
  function teamHtml(state) {
    const sh = ensureShift(state)
    const team = game.getStoreTeam()
    const lead = api.canLead()
    const callIns = sh.cur?.callIns || 0
    const rows = team
      .map((s) => {
        const p = sh.partners[s.id] || { worked: 0 }
        const on = isOnShift(state, s)
        const hours = Math.floor((p.worked || 0) / 60)
        const mins = (p.worked || 0) % 60
        const nearLimit = on && !s.onBreak && p.worked >= MAX_CONSECUTIVE_MIN - 60
        const energy = Math.round(s.energy || 0)
        let status
        if (s.sickLeave || s.shift === 'sick') status = pill('🏥 مرضية', 'bg-purple-800 text-white')
        else if (s.onBreak) status = pill('🛋️ استراحة', 'bg-sky-700 text-white')
        else if (on) status = pill('🟢 على الأرضية', 'bg-emerald-700 text-white')
        else status = pill('⚪ خارج الوردية', 'bg-slate-700 text-slate-200')
        const actions = []
        if (on && !s.onBreak) actions.push(`<button type="button" data-break="${s.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-sky-800 hover:bg-sky-700 text-white">🛋️ راحة</button>`)
        if (lead && on && !s.onBreak) actions.push(`<button type="button" data-home="${s.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800 hover:bg-slate-700 text-white">🏠 انصراف مبكر</button>`)
        if (lead && !on && !s.sickLeave && s.shift !== 'sick') actions.push(`<button type="button" data-callin="${s.id}" ${callIns >= 2 ? 'disabled' : ''} class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-40">📞 استدعاء</button>`)
        return `<div class="p-2 rounded-xl bg-[#0b1915] border ${nearLimit ? 'border-rose-400' : 'border-emerald-800/70'}">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <span class="text-[11px] font-bold text-white min-w-0 truncate">${esc(s.cleanName || s.name)} <span class="text-emerald-300/70 font-normal">• ${esc(SHIFT_LABEL[s.shift] || '')}</span></span>
              ${status}
            </div>
            <div class="flex flex-wrap items-center justify-between gap-1.5 mt-1.5">
              <span class="text-[10px] font-num ${nearLimit ? 'text-rose-300 font-extrabold' : 'text-emerald-200/80'}">⚡ ${energy}% • ⏱️ متصل ${hours}س ${String(mins).padStart(2, '0')}د${nearLimit ? ' — اقترب من حد الـ 5 ساعات!' : ''}</span>
              <div class="flex flex-wrap gap-1">${actions.join('')}</div>
            </div>
          </div>`
      })
      .join('')
    return section(
      '👥 الفريق وقانون الراحات',
      `قانون العمل رقم 14 لسنة 2025: 8 ساعات يومياً بحد أقصى، وراحة لا تقل عن ساعة بحيث لا يعمل أحد أكثر من 5 ساعات متصلة. الاستدعاء والانصراف المبكر من صلاحيات المشرف (استدعاءان لكل وردية: ${callIns}/2).`,
      `<div class="space-y-1.5 max-h-[360px] overflow-y-auto pl-1">${rows}</div>`,
      'purple',
    )
  }

  // --------------------------------------------------------- problems
  function problemsHtml() {
    const mods = systems.incidents.activeModifiers()
    const log = systems.incidents.log().slice(0, 6)
    const modRows = mods.length
      ? mods
          .map((m) => {
            const pct = Math.round((m.mult - 1) * 100)
            const what = m.kind === 'spawn' ? 'تدفق الزبائن' : m.kind === 'patience' ? 'صبر الزبائن' : m.key && m.key !== 'all' ? `محطة ${m.key}` : 'كل المحطات'
            return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${pct < 0 ? 'bg-rose-950 text-rose-200 border border-rose-600/50' : 'bg-emerald-950 text-emerald-200 border border-emerald-600/50'}">${what} ${pct > 0 ? '+' : ''}${pct}% • ${m.minutesLeft} د</span>`
          })
          .join(' ')
      : '<span class="text-[11px] text-emerald-300">لا توجد تأثيرات نشطة.</span>'
    const rows = log.length
      ? log
          .map(
            (l) => `<div class="p-2 rounded-xl bg-[#0b1915] border ${l.best ? 'border-emerald-600/60' : l.timedOut || l.later ? 'border-rose-500/60' : 'border-amber-500/50'}">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-extrabold text-white min-w-0">${l.later ? '⏳' : l.best ? '🏅' : l.timedOut ? '⏰' : '⚠️'} ${esc(l.title)}</span>
                <span class="text-[10px] text-emerald-300/80 font-num shrink-0">اليوم ${l.day} • ${fmtTime(l.minutes)}</span>
              </div>
              ${l.choice ? `<div class="text-[10px] text-emerald-200 mt-1">قرارك: ${esc(l.choice)}</div>` : ''}
              <div class="text-[10px] text-emerald-100/80 mt-0.5">${esc(l.outcome)}</div>
              ${l.bestLabel ? `<div class="text-[10px] text-amber-300 mt-0.5">💡 أفضل ممارسة: ${esc(l.bestLabel)}</div>` : ''}
            </div>`,
          )
          .join('')
      : '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لم تواجه مشكلات معقدة بعد في هذه المسيرة.</div>'
    return section('🚨 المشكلات المعقدة وتبعاتها', `الأعطال والحوادث وقرارات الفريق تظهر فجأة بعداد تنازلي. ${Object.values(CATEGORY_LABELS).join(' • ')}.`, `<div class="flex flex-wrap gap-1.5 mb-2">${modRows}</div><div class="space-y-1.5">${rows}</div>`, 'rose')
  }

  // ---------------------------------------------------------- reports
  function reportsHtml(state) {
    const sh = ensureShift(state)
    const hist = sh.history.slice(0, 8)
    if (!hist.length) return section('📊 تقارير الورديات', 'يصلك تقرير بتقدير (A+ إلى F) في نهاية كل وردية: الخدمة، العمالة، الراحات، DRB، الجودة والمشكلات.', '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لم تكتمل أي وردية بعد.</div>', 'indigo')
    const rows = hist
      .map(
        (r, i) => `<button type="button" data-report="${i}" class="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b1915] border border-emerald-800/70 hover:border-[#CBA258] text-right">
          <span class="text-[11px] font-bold text-white min-w-0 truncate">اليوم ${r.day} • ${esc(r.label)}</span>
          <span class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px] font-num text-emerald-300">${r.orders} طلب • عمالة ${r.laborPct}%</span>
            <span class="text-xs font-black font-num px-2 py-0.5 rounded-lg ${GRADE_CLS[r.grade]}">${r.grade}</span>
          </span>
        </button>`,
      )
      .join('')
    return section('📊 تقارير الورديات', 'اضغط أي وردية لعرض التقرير الكامل.', `<div class="space-y-1.5">${rows}</div>`, 'indigo')
  }

  function render() {
    const state = game.state
    if (!state) return
    setHtml(sec('status'), statusHtml(state))
    setHtml(sec('checklist'), checklistHtml(state))
    setHtml(sec('drb'), drbHtml(state))
    setHtml(sec('play'), playHtml(state))
    setHtml(sec('team'), teamHtml(state))
    setHtml(sec('problems'), problemsHtml())
    setHtml(sec('reports'), reportsHtml(state))
  }

  // ------------------------------------------------------------ report modal
  function showReport(r) {
    const m = openModal({ title: `📊 تقرير ${r.label} — اليوم ${r.day}`, subtitle: r.store })
    const line = (k, v, cls = 'text-white') => `<div class="flex items-center justify-between py-1.5 border-b border-emerald-900/60 text-xs"><span class="text-emerald-200">${k}</span><span class="font-num font-extrabold ${cls}">${v}</span></div>`
    m.setBody(`
      <div class="flex items-center justify-center gap-3 mb-3">
        <span class="text-3xl font-black font-num px-4 py-1 rounded-2xl ${GRADE_CLS[r.grade]}">${r.grade}</span>
        <span class="text-sm font-extrabold text-emerald-100 font-num">${r.score} / 100</span>
      </div>
      ${line('الطلبات المسلّمة', fmtNum(r.orders))}
      ${line('زبائن غاضبون', fmtNum(r.angry), r.angry ? 'text-rose-300' : 'text-emerald-300')}
      ${line('طلبات سريعة', `${r.fastPct}%`)}
      ${line('متوسط زمن الدرايف ثرو', r.dtAvg ? `${r.dtAvg} ثانية` : '—')}
      ${line('المبيعات', fmtMoney(r.sales), 'text-[#CBA258]')}
      ${line('تكلفة العمالة', fmtMoney(r.laborCost))}
      ${line(`نسبة العمالة (المستهدف ${LABOR_TARGET.min}–${LABOR_TARGET.max}%)`, `${r.laborPct}%${r.laborManaged === false ? ' — يديرها المشرف' : ''}`, r.laborOnTarget ? 'text-emerald-300' : 'text-amber-300')}
      ${line('مخالفات قانون الراحات', r.breakViolations, r.breakViolations ? 'text-rose-300' : 'text-emerald-300')}
      ${line('سجلات DRB', `${r.drbDone}/${r.drbDue}`)}
      ${line('مشكلات معقدة (أفضل قرار/الكل)', `${r.incidentsBest}/${r.incidents}`)}
      ${line('شكاوى محلولة', r.complaintsResolved)}
      ${line('أقصى عدد على الأرضية', r.staffOnShift)}
      <div class="mt-4 flex justify-end gap-2"><button type="button" data-modal-close class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">تم</button></div>`)
  }

  // ------------------------------------------------------------ events
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button')
    if (!t || t.disabled) return
    game.initAudio()
    const state = game.state
    const ck = t.getAttribute('data-ck')
    if (ck === 'dialin-start') api.dialInStart()
    else if (ck === 'finer') api.dialInAdjust('finer')
    else if (ck === 'coarser') api.dialInAdjust('coarser')
    else if (ck === 'approve') api.dialInApprove()
    else if (ck === 'till-start') api.tillPuzzle(t.getAttribute('data-kind'))
    else if (ck === 'till') api.tillAnswer(t.getAttribute('data-kind'), Number(t.getAttribute('data-value')))
    else if (ck === 'waste-start') api.wastePuzzle()
    else if (ck === 'waste') api.wasteAnswer(Number(t.getAttribute('data-value')))
    else if (ck === 'simple') api.simpleItem(t.getAttribute('data-kind'), t.getAttribute('data-key'))
    else if (t.hasAttribute('data-drb')) api.logDrb(t.getAttribute('data-drb'), t.getAttribute('data-choice'))
    else if (t.hasAttribute('data-break')) game.sendBaristaToBreak(Number(t.getAttribute('data-break')), false)
    else if (t.hasAttribute('data-home')) api.sendHome(Number(t.getAttribute('data-home')))
    else if (t.hasAttribute('data-callin')) api.callIn(Number(t.getAttribute('data-callin')))
    else if (t.hasAttribute('data-report')) {
      const r = ensureShift(state).history[Number(t.getAttribute('data-report'))]
      if (r) showReport(r)
      return
    } else return
    game.updateHUD()
    render()
  })
  root.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-play]')
    if (!sel) return
    const s = game.getStoreTeam().find((x) => x.id === Number(sel.getAttribute('data-play')))
    if (!s || !api.canLead()) return
    s.role = sel.value
    game.playSound('step')
    game.showToast(`🧩 «${s.cleanName || s.name}» الآن على: ${game.STATION_ROLES.find((r) => r.id === s.role)?.label || s.role}`)
    game.renderStaffTab()
    render()
  })

  const visible = () => !$('tab-shift')?.classList.contains('hidden')
  const updateDot = () => {
    const state = game.state
    if (!state?.sbc?.shift?.drb) return
    const sh = ensureShift(state)
    const pendingDrb = (sh.drb.tasks || []).some((t) => t.status === 'pending')
    const m = state.dayMinutes
    const openList = (k, win) => {
      const c = sh.checklists?.[k]
      return c && !c.done && !c.missed && !c.skipped && m >= win[0] && m < win[1]
    }
    $('sbcShiftDot')?.classList.toggle('hidden', !(pendingDrb || openList('opening', OPENING_WINDOW) || openList('closing', CLOSING_WINDOW)))
  }
  on('sim:tick', () => {
    updateDot()
    if (visible()) render()
  })
  on('shift:changed', () => visible() && render())
  on('shift:end', ({ report }) => {
    if (!report) return
    game.showToast(`📊 انتهت ${report.label}: التقدير ${report.grade} (${report.score}/100) — نسبة العمالة ${report.laborPct}%. التفاصيل في تبويب الوردية.`)
  })

  return { render, showReport, STAFF_SHIFTS }
}
