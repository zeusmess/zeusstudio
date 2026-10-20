// Career tab: the ladder from Barista to Store Manager (and honorary Area
// Manager after the 1000 missions), what the next promotion needs, the five
// certification exams and the panel interview.
import { on } from '../../core/events.js'
import { LEADERSHIP } from '../../data/branches.js'
import {
  CERTS,
  currentRank,
  ensureCareer,
  examCooldown,
  INTERVIEW_QUESTIONS,
  interviewCooldown,
  interviewPanel,
  nextRank,
  rankIndex,
  RANKS,
  startExam,
} from '../../systems/career/career.js'
import { TOTAL_MISSIONS } from '../../systems/missions/generator.js'
import { missionsDone } from '../../systems/missions/engine.js'
import { $, esc, fmtNum, setHtml } from '../dom.js'
import { openModal } from '../modal.js'
import { pill, section } from '../section.js'

const RANK_ICON = { barista: '☕', trainer: '🎓', supervisor: '⏱️', asm: '🗝️', manager: '🏪', area: '👑' }

function shuffle(list) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function installCareerTab({ game, systems, identity }) {
  const root = $('sbcCareerRoot')
  if (!root) return { render() {} }
  const api = systems.career

  function ladder(state) {
    const cur = rankIndex(ensureCareer(state).rank)
    const rungs = RANKS.map((r, i) => {
      const cls = i < cur ? 'bg-[#16382d] border-emerald-500 text-emerald-200' : i === cur ? 'bg-[#16382d] border-[#CBA258] text-[#CBA258] shadow-lg' : 'bg-slate-900/70 border-slate-700 text-slate-500'
      return `<div class="rounded-xl border-2 ${cls} p-1.5 text-center">
          <div class="text-lg leading-none">${i > cur ? '🔒' : RANK_ICON[r.key]}</div>
          <div class="text-[10px] font-extrabold mt-1 leading-tight">${esc(r.short)}</div>
        </div>`
    }).join('')
    return `<div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">${rungs}</div>`
  }

  function headerCard(state) {
    const career = ensureCareer(state)
    const rank = currentRank(state)
    const next = nextRank(state)
    const done = missionsDone(state)
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
          <h3 class="text-sm font-extrabold text-[#CBA258]">🎖️ مسيرتك المهنية (Career Path)</h3>
          <p class="text-[11px] text-emerald-200/80">من باريستا إلى مدير فرع: مهام من الألف، أداء حقيقي في الورديات، شهادات معتمدة، ومقابلة أمام اللجنة (${esc(LEADERSHIP.training.name)} • ${esc(LEADERSHIP.operations.name)} • مدير المنطقة). وبعد الألف مهمة: مدير منطقة فخري.</p>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div class="text-[10px] text-emerald-300/80">منصبك الحالي في اللعبة</div>
            <div class="text-base font-black text-white">${RANK_ICON[rank.key]} ${esc(rank.title)}</div>
            <div class="text-[10px] text-emerald-300/80 mt-0.5">مسماك في الشركة: ${esc(identity.jobTitle || '—')}</div>
          </div>
          <div class="text-left">
            <div class="text-[10px] text-emerald-300/80">XP • مهام</div>
            <div class="text-sm font-extrabold font-num text-[#CBA258]">${fmtNum(career.xp || 0)} • ${fmtNum(done)}/${fmtNum(TOTAL_MISSIONS)}</div>
          </div>
        </div>
        ${ladder(state)}
        ${next ? '' : `<p class="text-[11px] text-amber-200 mt-3">${rank.key === 'area' ? '👑 وصلت لقمة المسيرة: اسمك على لوحة مديري المناطق.' : '🏪 وصلت لمنصب مدير الفرع. الخطوة الأخيرة: أنهِ الألف مهمة لتنضم للوحة مديري المناطق.'}</p>`}
      </div>`
  }

  function requirementsCard(state) {
    const next = nextRank(state)
    if (!next) return ''
    const req = api.requirements(next.key)
    const rows = req.items
      .map((it) => {
        const pct = it.need ? Math.min(100, (it.have / it.need) * 100) : 100
        return `<div class="p-2 rounded-xl bg-[#0b1915] border ${it.ok ? 'border-emerald-600/60' : 'border-emerald-800/70'}">
            <div class="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span class="${it.ok ? 'text-emerald-300' : 'text-white'}">${it.ok ? '✅' : '⬜'} ${esc(it.label)}</span>
              <span class="font-num ${it.waived ? 'text-amber-300' : 'text-emerald-200'}">${it.waived ? 'معفى (خبرتك الفعلية)' : `${fmtNum(Math.min(it.have, it.need))} / ${fmtNum(it.need)}`}</span>
            </div>
            ${it.kind === 'cert' || it.waived ? '' : `<div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5"><div class="h-full bg-gradient-to-l from-emerald-500 to-[#CBA258]" style="width:${pct}%"></div></div>`}
          </div>`
      })
      .join('')
    const cooldown = interviewCooldown(state, next.key)
    const panel = interviewPanel(state, next.key)
      .map((p) => esc(p.name))
      .join(' • ')
    let action
    if (!req.ready) action = `<div class="text-[11px] text-emerald-300">أكمل المتطلبات لتفتح مقابلة الترقية.</div>`
    else if (cooldown) action = `<div class="text-[11px] text-amber-300 font-bold">⏳ تقدر تطلب مقابلة جديدة من اليوم ${cooldown}.</div>`
    else action = `<button type="button" data-interview="${next.key}" class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">🤝 اطلب مقابلة الترقية الآن</button>`
    const fast = req.fastTrack ? `<div class="p-2 rounded-xl bg-amber-950/60 border border-amber-500/50 text-[11px] text-amber-200 font-bold mb-2">⚡ مسار سريع: مسماك الفعلي في الشركة يعفيك من عدد المهام ومؤشرات الأداء لهذه الترقية، لكن الشهادة والمقابلة مطلوبتان.</div>` : ''
    return section(
      `🎯 الترقية التالية: ${esc(next.title)}`,
      `لجنة المقابلة: ${panel}. النجاح من 70%.`,
      `${fast}<div class="space-y-1.5 mb-3">${rows}</div><div class="flex justify-end">${action}</div>`,
      'amber',
    )
  }

  function certsCard(state) {
    const career = ensureCareer(state)
    const next = nextRank(state)
    const needed = next ? new Set(api.requirements(next.key).items.filter((i) => i.kind === 'cert').map((i) => i.certId)) : new Set()
    const rows = Object.values(CERTS)
      .map((c) => {
        const rec = career.certs[c.id]
        const cd = examCooldown(state, c.id)
        const by = c.by === 'training' ? LEADERSHIP.training.name : LEADERSHIP.operations.name
        let right
        if (rec?.passed) right = pill(`✅ ${rec.score}%`, 'bg-emerald-700 text-white')
        else if (cd) right = pill(`⏳ اليوم ${cd}`, 'bg-slate-700 text-slate-200')
        else right = `<button type="button" data-exam="${c.id}" class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold sb-btn-gold">📝 ابدأ الاختبار</button>`
        return `<div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b1915] border ${needed.has(c.id) && !rec?.passed ? 'border-[#CBA258]' : 'border-emerald-800/70'}">
            <div class="min-w-0">
              <div class="text-[11px] font-extrabold text-white">${c.icon} ${esc(c.title)} ${needed.has(c.id) && !rec?.passed ? '<span class="text-[10px] text-amber-300">• مطلوبة للترقية</span>' : ''}</div>
              <div class="text-[10px] text-emerald-300/80">10 أسئلة • النجاح ${c.pass}% • يعتمدها ${esc(by)}</div>
            </div>
            <div class="shrink-0 flex items-center gap-1.5">
              ${rec?.passed && !cd ? `<button type="button" data-exam="${c.id}" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-200">إعادة</button>` : ''}
              ${right}
            </div>
          </div>`
      })
      .join('')
    return section('🎓 الشهادات والاختبارات', 'أسئلة من معايير ستاربكس المنشورة (الأحجام، المضخات، الشوت 18–23 ثانية، Smell/Slurp/Locate/Describe، LATTE، قاعدة الـ 4 دقائق)، وسلامة الغذاء (5°م / 41°ف)، وقانون العمل المصري 14/2025. الرسوب يعني الانتظار ليوم.', `<div class="space-y-1.5">${rows}</div>`, 'sky')
  }

  function historyCard(state) {
    const career = ensureCareer(state)
    if (!career.history.length) return ''
    const rows = career.history
      .slice(0, 10)
      .map((h) => {
        const r = RANKS[rankIndex(h.rank)]
        return `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-emerald-900/60 last:border-0 text-[11px]">
            <span class="text-emerald-100">${RANK_ICON[r.key]} ${esc(r.title)}${h.fastTrack ? ' <span class="text-amber-300">(مسار سريع)</span>' : ''}</span>
            <span class="text-emerald-300/80 font-num">اليوم ${h.day}</span>
          </div>`
      })
      .join('')
    return section('📜 سجل الترقيات', '', rows, 'indigo')
  }

  function render() {
    const state = game.state
    if (!state) return
    setHtml(root, headerCard(state) + requirementsCard(state) + certsCard(state) + historyCard(state))
  }

  // ------------------------------------------------------------------ exam
  function runExam(certId) {
    const state = game.state
    if (examCooldown(state, certId)) return
    const exam = startExam(certId)
    const cert = CERTS[certId]
    const answers = []
    let i = 0
    let picked = null
    const m = openModal({ title: `${cert.icon} اختبار ${cert.title}`, subtitle: `10 أسئلة • النجاح ${cert.pass}% • لا يمكن الرجوع للسؤال السابق`, size: 'lg' })
    const draw = () => {
      const q = exam.questions[i]
      const opts = q.options
        .map((o, k) => {
          let cls = 'bg-[#0b1915] border-emerald-800/70 hover:border-[#CBA258] text-white'
          if (picked !== null) {
            if (k === q.answer) cls = 'bg-emerald-900 border-emerald-400 text-white'
            else if (k === picked) cls = 'bg-rose-950 border-rose-500 text-rose-100'
            else cls = 'bg-[#0b1915] border-emerald-900/60 text-emerald-200/60'
          }
          return `<button type="button" data-opt="${k}" ${picked !== null ? 'disabled' : ''} class="w-full text-right p-2.5 rounded-xl border-2 ${cls} text-xs font-bold transition">${esc(o)}</button>`
        })
        .join('')
      const feedback =
        picked === null
          ? ''
          : `<div class="mt-3 p-2.5 rounded-xl ${picked === q.answer ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-200' : 'bg-rose-950/80 border border-rose-500/60 text-rose-200'} text-[11px] font-bold">${picked === q.answer ? '✅ إجابة صحيحة.' : '❌ إجابة غير صحيحة.'} ${esc(q.why || '')}</div>
             <div class="mt-3 flex justify-end"><button type="button" data-next class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">${i + 1 < exam.questions.length ? 'السؤال التالي ←' : 'إنهاء الاختبار'}</button></div>`
      m.setBody(`
        <div class="flex items-center justify-between text-[11px] text-emerald-300 font-num mb-1"><span>السؤال ${i + 1} من ${exam.questions.length}</span><span>${answers.filter((a, k) => a === exam.questions[k].answer).length} صحيحة</span></div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3"><div class="h-full bg-gradient-to-l from-emerald-500 to-[#CBA258]" style="width:${(i / exam.questions.length) * 100}%"></div></div>
        <div class="text-sm font-extrabold text-white mb-3 leading-relaxed">${esc(q.q)}</div>
        <div class="space-y-2">${opts}</div>
        ${feedback}`)
    }
    const finish = () => {
      const result = api.finishExam(exam, answers)
      m.setTitle(`${cert.icon} نتيجة اختبار ${cert.title}`)
      m.setBody(`
        <div class="text-center py-2">
          <div class="text-4xl mb-2">${result.passed ? '🎓' : '📚'}</div>
          <div class="text-2xl font-black font-num ${result.passed ? 'text-emerald-300' : 'text-rose-300'}">${result.score}%</div>
          <div class="text-xs text-emerald-200 mt-1">${result.correct} إجابات صحيحة من ${result.total} • النجاح ${cert.pass}%</div>
          <div class="text-sm font-extrabold text-white mt-3">${result.passed ? 'مبروك! تمت إضافة الشهادة لملفك.' : `للأسف لم تنجح هذه المرة. تقدر تعيد الاختبار من اليوم ${game.state.day + 1}.`}</div>
        </div>
        <div class="mt-4 flex justify-end"><button type="button" data-modal-close class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">تم</button></div>`)
      render()
    }
    m.body.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-opt]')
      if (opt && picked === null) {
        picked = Number(opt.getAttribute('data-opt'))
        answers[i] = picked
        game.playSound(picked === exam.questions[i].answer ? 'step' : 'angry')
        draw()
        return
      }
      if (e.target.closest('[data-next]')) {
        i += 1
        picked = null
        if (i >= exam.questions.length) finish()
        else draw()
      }
    })
    m.onClose(() => {
      // Leaving in the middle counts as an attempt with the answers given so far.
      if (i < exam.questions.length && answers.length > 0) finishOnLeave()
    })
    const finishOnLeave = () => {
      while (answers.length < exam.questions.length) answers.push(-1)
      api.finishExam(exam, answers)
      render()
    }
    draw()
  }

  // ------------------------------------------------------------- interview
  function runInterview(rankKey) {
    const state = game.state
    const req = api.requirements(rankKey)
    if (!req.ready || interviewCooldown(state, rankKey)) return
    const rank = RANKS[rankIndex(rankKey)]
    const panel = interviewPanel(state, rankKey)
    const questions = (INTERVIEW_QUESTIONS[rankKey] || []).map((q) => ({ ...q, order: shuffle(q.options.map((_, k) => k)) }))
    const answers = []
    let i = 0
    const m = openModal({ title: `🤝 مقابلة الترقية: ${rank.title}`, subtitle: `اللجنة: ${panel.map((p) => `${p.name} (${p.title || ''})`).join(' • ')}`, size: 'lg', closable: false })
    const draw = () => {
      const q = questions[i]
      const asker = panel[i % panel.length]
      m.setBody(`
        <div class="flex items-center justify-between text-[11px] text-emerald-300 font-num mb-1"><span>الموقف ${i + 1} من ${questions.length}</span><span>اختر أفضل تصرف</span></div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3"><div class="h-full bg-gradient-to-l from-emerald-500 to-[#CBA258]" style="width:${(i / questions.length) * 100}%"></div></div>
        <div class="p-3 rounded-xl bg-[#0b1915] border border-[#CBA258]/60 mb-3">
          <div class="text-[10px] text-amber-300 font-extrabold mb-1">🎙️ ${esc(asker.name)} يسأل:</div>
          <div class="text-sm font-extrabold text-white leading-relaxed">${esc(q.q)}</div>
        </div>
        <div class="space-y-2">${q.order.map((k) => `<button type="button" data-ans="${k}" class="w-full text-right p-2.5 rounded-xl border-2 bg-[#0b1915] border-emerald-800/70 hover:border-[#CBA258] text-white text-xs font-bold transition">${esc(q.options[k].text)}</button>`).join('')}</div>`)
    }
    m.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ans]')
      if (!b) return
      answers[i] = Number(b.getAttribute('data-ans'))
      game.playSound('step')
      i += 1
      if (i < questions.length) return draw()
      const result = api.finishInterview(rankKey, answers)
      const review = questions
        .map((q, k) => {
          const best = q.options.reduce((a, o, idx) => (o.score > q.options[a].score ? idx : a), 0)
          const mine = q.options[answers[k]]
          return `<div class="p-2 rounded-xl bg-[#0b1915] border ${mine.score === 2 ? 'border-emerald-600/60' : mine.score === 1 ? 'border-amber-500/50' : 'border-rose-500/60'} text-[11px]">
              <div class="font-bold text-white">${esc(q.q)}</div>
              <div class="text-emerald-200 mt-1">إجابتك (${mine.score}/2): ${esc(mine.text)}</div>
              ${mine.score < 2 ? `<div class="text-amber-300 mt-0.5">💡 الأفضل: ${esc(q.options[best].text)}</div>` : ''}
            </div>`
        })
        .join('')
      m.setTitle(result.passed ? `🎉 نجحت في المقابلة — ${rank.title}` : '🤝 نتيجة المقابلة')
      m.setBody(`
        <div class="text-center py-2">
          <div class="text-2xl font-black font-num ${result.passed ? 'text-emerald-300' : 'text-rose-300'}">${result.pct}%</div>
          <div class="text-xs text-emerald-200 mt-1">${result.passed ? 'قررت اللجنة ترقيتك. صلاحياتك الجديدة مفعّلة الآن.' : `المطلوب 70%. تقدر تطلب مقابلة جديدة من اليوم ${game.state.day + 1}.`}</div>
        </div>
        <div class="space-y-1.5 mt-2 max-h-[45vh] overflow-y-auto">${review}</div>
        <div class="mt-4 flex justify-end"><button type="button" data-modal-close class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">تم</button></div>`)
      render()
    })
    draw()
  }

  root.addEventListener('click', (e) => {
    const ex = e.target.closest('[data-exam]')
    if (ex) {
      game.initAudio()
      runExam(ex.getAttribute('data-exam'))
      return
    }
    const iv = e.target.closest('[data-interview]')
    if (iv) {
      game.initAudio()
      runInterview(iv.getAttribute('data-interview'))
    }
  })

  const visible = () => !$('tab-career')?.classList.contains('hidden')
  const refreshDot = () => {
    const state = game.state
    if (!state) return
    const next = nextRank(state)
    const ready = next && api.requirements(next.key).ready && !interviewCooldown(state, next.key)
    $('sbcCareerDot')?.classList.toggle('hidden', !ready)
  }
  let t = null
  const schedule = () => {
    if (t) return
    t = setTimeout(() => {
      t = null
      refreshDot()
      if (visible()) render()
    }, 400)
  }
  for (const type of ['missions:changed', 'cert:passed', 'quiz:finished', 'career:promoted', 'shift:end', 'day:end', 'game:started']) on(type, schedule)

  return { render, runExam, runInterview }
}
