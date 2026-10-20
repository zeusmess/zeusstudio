// Missions tab: the 1000 missions in 10 chapters, the five active ones with
// their progress, the chapter map and a browser for every mission.
import { on } from '../../core/events.js'
import { CHAPTERS, SCOPE_LABELS } from '../../systems/missions/catalog.js'
import { ACTIVE_COUNT, currentChapter, DEFER_COST, doneSet } from '../../systems/missions/engine.js'
import { TOTAL_MISSIONS } from '../../systems/missions/generator.js'
import { metricLabel } from '../../systems/missions/labels.js'
import { $, esc, fmtNum, setHtml } from '../dom.js'

const SCOPE_CHIP = {
  life: 'bg-emerald-950 text-emerald-300 border-emerald-600/40',
  day: 'bg-sky-950 text-sky-300 border-sky-600/40',
  shift: 'bg-purple-950 text-purple-300 border-purple-600/40',
  streak: 'bg-rose-950 text-rose-300 border-rose-600/40',
  total: 'bg-amber-950 text-amber-300 border-amber-500/50',
}
const KIND_LABEL = { family: '', challenge: 'تحدٍّ', final: 'مهمة الفصل الأخيرة' }

function bar(pct, cls = 'from-emerald-500 to-[#CBA258]') {
  return `<div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-l ${cls} transition-all duration-300" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`
}

export function installMissionsTab({ game, systems }) {
  const root = $('sbcMissionsRoot')
  if (!root) return { render() {} }
  const ui = { browse: null }
  const api = systems.missions

  function header(state) {
    const s = api.summary()
    const chapter = Math.min(10, s.chapter)
    const info = CHAPTERS[chapter - 1]
    const pct = (s.done / TOTAL_MISSIONS) * 100
    const career = state.sbc?.career || {}
    const finished = s.done >= TOTAL_MISSIONS
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
          <h3 class="text-sm font-extrabold text-[#CBA258]">🏆 الألف مهمة — الطريق إلى لوحة مديري المناطق</h3>
          <p class="text-[11px] text-emerald-200/80">10 فصول × 100 مهمة صعبة. أنهِ الألف ليُكتب اسمك مع مديري المناطق في لوحة الشرف. التقدّم محفوظ على حسابك ولا يضيع عند الخروج.</p>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-2.5 text-center">
            <div class="text-[10px] text-emerald-300/80">المهام المنجزة</div>
            <div class="text-base font-extrabold font-num text-[#CBA258]">${fmtNum(s.done)}<span class="text-xs text-emerald-300/70"> / ${fmtNum(TOTAL_MISSIONS)}</span></div>
          </div>
          <div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-2.5 text-center">
            <div class="text-[10px] text-emerald-300/80">أنجزت اليوم</div>
            <div class="text-base font-extrabold font-num text-emerald-300">${fmtNum(s.today)}</div>
          </div>
          <div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-2.5 text-center">
            <div class="text-[10px] text-emerald-300/80">نقاط الخبرة XP</div>
            <div class="text-base font-extrabold font-num text-sky-300">${fmtNum(career.xp || 0)}</div>
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-emerald-300 mb-1 font-num">
          <span>${finished ? '👑 أنهيت الألف مهمة — اسمك في لوحة مديري المناطق!' : `${info.icon} الفصل ${chapter}: ${esc(info.title)}`}</span>
          <span>${pct.toFixed(1)}%</span>
        </div>
        ${bar(pct)}
        ${finished ? '' : `<p class="text-[11px] text-emerald-200/80 mt-2">${esc(info.subtitle)}</p>`}
      </div>`
  }

  function chapterMap(state) {
    const done = doneSet(state)
    const cur = currentChapter(state)
    const tiles = CHAPTERS.map((c) => {
      let n = 0
      for (let i = (c.n - 1) * 100; i < c.n * 100; i++) if (done.has(i)) n++
      const locked = c.n > cur
      const complete = n === 100
      const cls = complete
        ? 'bg-[#16382d] border-[#CBA258] text-[#CBA258]'
        : c.n === cur
          ? 'bg-[#0b1915] border-emerald-400 text-white'
          : locked
            ? 'bg-slate-900/70 border-slate-700 text-slate-500'
            : 'bg-[#0b1915] border-emerald-800/70 text-emerald-200'
      return `<button type="button" data-browse-chapter="${c.n}" class="rounded-xl border-2 ${cls} p-1.5 text-center transition hover:brightness-110" title="${esc(c.title)}">
          <div class="text-lg leading-none">${locked ? '🔒' : c.icon}</div>
          <div class="text-[10px] font-extrabold mt-1">الفصل ${c.n}</div>
          <div class="text-[10px] font-num">${n}/100</div>
        </button>`
    }).join('')
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
          <h3 class="text-sm font-extrabold text-[#CBA258]">🗺️ خريطة الفصول</h3>
          <p class="text-[11px] text-emerald-200/80">كل فصل يُفتح بعد إنهاء الذي قبله. اضغط أي فصل لاستعراض مهامه المئة.</p>
        </div>
        <div class="grid grid-cols-5 gap-1.5">${tiles}</div>
      </div>`
  }

  function missionRow(state, { entry, mission, progress }) {
    const chip = SCOPE_CHIP[mission.scope] || SCOPE_CHIP.life
    const kind = KIND_LABEL[mission.kind]
    const parts = progress.parts
      .map((p) => {
        const pct = p.target ? (p.value / p.target) * 100 : 0
        return `<div class="mt-1.5">
            <div class="flex items-center justify-between text-[10px] text-emerald-300 mb-1 font-num">
              <span>${esc(metricLabel(p.metric))}: ${fmtNum(Math.floor(p.value))} / ${fmtNum(p.target)}</span><span>${Math.floor(pct)}%</span>
            </div>
            ${bar(pct)}
          </div>`
      })
      .join('')
    const constraint = mission.constraints.length
      ? `<div class="text-[10px] text-rose-300 mt-1.5">⛔ الشرط: ${mission.constraints.map((c) => `${esc(metricLabel(c.metric))} ≤ ${c.max}`).join(' • ')}</div>`
      : ''
    const failed = progress.failed
      ? `<div class="mt-2 p-2 rounded-lg bg-rose-950/70 border border-rose-500/50 text-[11px] text-rose-200 font-bold">⚠️ فشلت ${progress.failed === 'day' ? 'اليوم — تبدأ من جديد مع اليوم التالي' : 'في هذه الوردية — تبدأ من جديد مع الوردية التالية'}</div>`
      : ''
    const resets = entry.resets ? `<span class="text-[10px] text-amber-300">🔄 أُعيدت ${entry.resets}×</span>` : ''
    return `
      <div class="bg-[#0b1915] border ${progress.ratio >= 0.8 && !progress.failed ? 'border-[#CBA258]' : 'border-emerald-800/70'} rounded-xl p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span class="text-[10px] font-extrabold font-num px-1.5 py-0.5 rounded bg-black/40 text-[#CBA258]">#${String(mission.number).padStart(4, '0')}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip}">${SCOPE_LABELS[mission.scope]}</span>
              ${kind ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950 text-amber-300 border-amber-500/50">${kind}</span>` : ''}
              ${resets}
            </div>
            <div class="text-xs font-extrabold text-white">${esc(mission.title)}</div>
            <div class="text-[11px] text-emerald-200/80">${esc(mission.desc)}</div>
          </div>
          <div class="shrink-0 flex flex-col items-end gap-1">
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-amber-300 font-num">+$${mission.reward.money}</span>
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-sky-300 font-num">+${mission.reward.xp} XP</span>
          </div>
        </div>
        ${parts}${constraint}${failed}
        <div class="flex justify-end mt-2">
          <button type="button" data-defer-mission="${mission.idx}" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-200 border border-slate-600" title="تؤجل ليوم واحد وتأتي مهمة أخرى مكانها">⏭️ تأجيل ليوم ($${DEFER_COST})</button>
        </div>
      </div>`
  }

  function activeList(state) {
    const rows = api.activeEntries()
    const body = rows.length
      ? rows.map((r) => missionRow(state, r)).join('')
      : `<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">👑 لا توجد مهام متبقية — أنهيت الألف مهمة!</div>`
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
          <h3 class="text-sm font-extrabold text-[#CBA258]">🎯 مهامك النشطة الآن (${rows.length}/${ACTIVE_COUNT})</h3>
          <p class="text-[11px] text-emerald-200/80">تُحسب المهمة من لحظة ظهورها هنا. «خلال يوم/وردية» تبدأ من جديد مع اليوم أو الوردية التالية، و«متتالية» تنكسر مع أول خطأ.</p>
        </div>
        <div class="space-y-2.5">${body}</div>
      </div>`
  }

  function recent(state) {
    const s = api.summary()
    if (!s.recent.length) return ''
    const rows = s.recent
      .slice(0, 8)
      .map((r) => {
        const m = api.missions[r.idx]
        return `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-emerald-900/60 last:border-0">
            <span class="text-[11px] text-emerald-100 min-w-0 truncate">✅ <span class="font-num text-[#CBA258]">#${String(m.number).padStart(4, '0')}</span> ${esc(m.title)}</span>
            <span class="text-[10px] text-emerald-300/80 font-num shrink-0">اليوم ${r.day}</span>
          </div>`
      })
      .join('')
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-2">
          <h3 class="text-sm font-extrabold text-[#CBA258]">📜 آخر ما أنجزت</h3>
        </div>
        <div>${rows}</div>
      </div>`
  }

  function browser(state) {
    if (!ui.browse) return ''
    const c = CHAPTERS[ui.browse - 1]
    const done = doneSet(state)
    const active = new Set(Object.keys(state.sbc?.missions?.active || {}).map(Number))
    const cur = currentChapter(state)
    const rows = api.missions
      .filter((m) => m.chapter === c.n)
      .map((m) => {
        const status = done.has(m.idx) ? '✅' : active.has(m.idx) ? '🎯' : c.n > cur ? '🔒' : '⬜'
        const cls = done.has(m.idx) ? 'text-emerald-300' : active.has(m.idx) ? 'text-white font-bold' : 'text-emerald-200/70'
        return `<div class="flex items-start gap-2 py-1 border-b border-emerald-900/50 last:border-0 text-[11px] ${cls}">
            <span class="shrink-0">${status}</span>
            <span class="font-num text-[#CBA258] shrink-0">#${String(m.number).padStart(4, '0')}</span>
            <span class="min-w-0"><strong>${esc(m.title)}</strong> — ${esc(m.desc)}</span>
          </div>`
      })
      .join('')
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/60 pb-2.5 mb-3">
          <div>
            <h3 class="text-sm font-extrabold text-[#CBA258]">${c.icon} الفصل ${c.n}: ${esc(c.title)}</h3>
            <p class="text-[11px] text-emerald-200/80">${esc(c.subtitle)}</p>
          </div>
          <button type="button" data-browse-close class="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white">✕ إغلاق</button>
        </div>
        <div class="max-h-[360px] overflow-y-auto pl-1">${rows}</div>
      </div>`
  }

  function render() {
    const state = game.state
    if (!state) return
    setHtml(root, header(state) + activeList(state) + browser(state) + chapterMap(state) + recent(state))
  }

  root.addEventListener('click', (e) => {
    const defer = e.target.closest('[data-defer-mission]')
    if (defer) {
      game.initAudio()
      api.defer(Number(defer.getAttribute('data-defer-mission')))
      render()
      return
    }
    const chap = e.target.closest('[data-browse-chapter]')
    if (chap) {
      const n = Number(chap.getAttribute('data-browse-chapter'))
      ui.browse = ui.browse === n ? null : n
      render()
      return
    }
    if (e.target.closest('[data-browse-close]')) {
      ui.browse = null
      render()
    }
  })

  let queued = false
  const visible = () => !$('tab-missions')?.classList.contains('hidden')
  const schedule = () => {
    if (queued || !visible()) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      render()
    })
  }
  on('missions:changed', schedule)
  on('mission:completed', schedule)

  return { render }
}
