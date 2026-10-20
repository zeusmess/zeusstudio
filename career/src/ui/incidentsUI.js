// The banner and the decision dialog for complex problems in the store.
import { on } from '../core/events.js'
import { describeEffects } from '../systems/incidents/engine.js'
import { $, esc } from './dom.js'
import { anyModalOpen, openModal } from './modal.js'

const CATEGORY_ICON = { equipment: '🔧', supply: '📦', people: '👥', safety: '🦺', customer: '🙋', tech: '💻', crisis: '🚨' }

export function installIncidentsUI({ game, systems }) {
  const api = systems.incidents
  const banner = $('sbcIncidentBanner')
  const bannerText = $('sbcIncidentBannerText')
  const bannerTimer = $('sbcIncidentBannerTimer')
  let modal = null

  function syncBanner() {
    const cur = api.current()
    if (!banner) return
    banner.classList.toggle('hidden', !cur)
    if (!cur) return
    bannerText.textContent = `${CATEGORY_ICON[cur.category] || '🚨'} ${cur.title}`
    bannerTimer.textContent = `${Math.max(0, cur.timeLeft)}ث`
  }

  function choiceButton(c) {
    const lock = c.locked ? `<span class="text-[10px] text-rose-300 font-extrabold block mt-0.5">🔒 ${c.requires === 'manager' ? 'من صلاحيات مدير الفرع' : 'من صلاحيات مشرف الوردية'}</span>` : ''
    const gamble = c.gamble ? '<span class="text-[10px] text-amber-300 font-extrabold block mt-0.5">🎲 قرار فيه مخاطرة — النتيجة غير مضمونة</span>' : ''
    return `<button type="button" data-choice="${c.index}" ${c.locked ? 'disabled' : ''} class="w-full text-right p-2.5 rounded-xl border-2 ${c.locked ? 'bg-slate-900/70 border-slate-700 text-slate-400 cursor-not-allowed' : 'bg-[#0b1915] border-emerald-800/70 hover:border-[#CBA258] text-white'} text-xs font-bold transition">${esc(c.label)}${lock}${gamble}</button>`
  }

  function drawDecision() {
    const cur = api.current()
    if (!modal || modal.closed) return
    if (!cur) return
    const pct = Math.max(0, (cur.timeLeft / cur.timeLimit) * 100)
    modal.setTitle(`${CATEGORY_ICON[cur.category] || '🚨'} ${cur.title}`)
    modal.setBody(`
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/50">${esc(cur.categoryLabel)}</span>
        <span class="text-xs font-extrabold font-num px-2.5 py-0.5 rounded bg-black/50 ${cur.timeLeft <= 10 ? 'text-rose-300' : 'text-white'}" data-inc-timer>⏳ ${cur.timeLeft}ث</span>
      </div>
      <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3"><div data-inc-bar class="h-full bg-gradient-to-l from-rose-500 to-amber-400 transition-all duration-700" style="width:${pct}%"></div></div>
      <p class="text-xs text-emerald-100 leading-relaxed mb-3">${esc(cur.text)}</p>
      <div class="text-[11px] font-extrabold text-[#CBA258] mb-1.5">ماذا تفعل؟</div>
      <div class="space-y-2">${cur.choices.map(choiceButton).join('')}</div>
      ${cur.canEscalate ? `<div class="mt-3 pt-3 border-t border-emerald-800/70 flex flex-wrap items-center justify-between gap-2"><span class="text-[11px] text-emerald-200/80">كباريستا تقدر تبلّغ مشرف الوردية فوراً — يتصرف حسب المعيار لكن بدون تقييم «أفضل قرار» لك.</span><button type="button" data-escalate class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-sky-800 hover:bg-sky-700 text-white">📞 إبلاغ المشرف</button></div>` : ''}
      <p class="text-[10px] text-emerald-300/70 mt-3">لو انتهى الوقت بدون قرار تقع التبعات الأسوأ. تقدر تغلق النافذة وتعود لها من الشريط الأحمر أعلى الفرع.</p>`)
  }

  function drawResult(r) {
    if (!modal || modal.closed) modal = openModal({ title: r.title })
    const lines = (r.lines || []).map((l) => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 text-emerald-100 border border-emerald-800/70">${esc(l)}</span>`).join(' ')
    const head = r.best ? '🏅 أفضل قرار حسب المعايير!' : r.timedOut ? '⏰ انتهى الوقت بدون قرار' : r.escalated ? '📞 تم التصعيد للمشرف' : '⚠️ قرار مقبول لكنه ليس الأفضل'
    const headCls = r.best ? 'text-emerald-300' : r.timedOut ? 'text-rose-300' : 'text-amber-300'
    modal.setTitle(r.title)
    modal.setBody(`
      <div class="text-sm font-black ${headCls} mb-2">${head}</div>
      ${r.choice ? `<div class="text-[11px] text-emerald-200 mb-1.5">قرارك: <strong class="text-white">${esc(r.choice)}</strong></div>` : ''}
      <div class="p-2.5 rounded-xl bg-[#0b1915] border border-emerald-800/70 text-xs text-emerald-100 leading-relaxed mb-2">${esc(r.outcome)}</div>
      ${lines ? `<div class="flex flex-wrap gap-1.5 mb-2">${lines}</div>` : ''}
      ${r.bestLabel ? `<div class="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-[11px] text-amber-200 font-bold">💡 أفضل ممارسة: ${esc(r.bestLabel)}</div>` : ''}
      <div class="mt-4 flex justify-end"><button type="button" data-modal-close class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">متابعة الشغل ☕</button></div>`)
  }

  function openDecision() {
    const cur = api.current()
    if (!cur) return
    if (modal && !modal.closed) {
      drawDecision()
      return
    }
    modal = openModal({ title: cur.title, tone: 'rose', size: 'lg' })
    modal.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-choice]')
      if (b && !b.disabled) {
        game.initAudio()
        const r = api.choose(Number(b.getAttribute('data-choice')))
        if (r) drawResult(r)
        return
      }
      if (e.target.closest('[data-escalate]')) {
        game.initAudio()
        const r = api.escalate()
        if (r) drawResult(r)
      }
    })
    modal.onClose(() => (modal = null))
    drawDecision()
  }

  $('sbcIncidentBannerOpen')?.addEventListener('click', () => {
    game.initAudio()
    openDecision()
  })

  on('incident:started', () => {
    syncBanner()
    game.showToast('🚨 مشكلة جديدة في الفرع تحتاج قرارك — الوقت يمر!')
    const onboarding = !$('openingScreenModal')?.classList.contains('hidden')
    if (!onboarding && !anyModalOpen()) openDecision()
  })
  on('incident:tick', ({ timeLeft, timeLimit }) => {
    if (bannerTimer) bannerTimer.textContent = `${timeLeft}ث`
    if (modal && !modal.closed) {
      const t = modal.el.querySelector('[data-inc-timer]')
      const bar = modal.el.querySelector('[data-inc-bar]')
      if (t) {
        t.textContent = `⏳ ${timeLeft}ث`
        t.classList.toggle('text-rose-300', timeLeft <= 10)
      }
      if (bar) bar.style.width = `${Math.max(0, (timeLeft / timeLimit) * 100)}%`
    }
  })
  on('incident:resolved', ({ timedOut }) => {
    syncBanner()
    if (timedOut) {
      const r = api.lastResult()
      if (r && modal && !modal.closed) drawResult(r)
    }
  })
  on('incidents:changed', syncBanner)
  on('game:started', syncBanner)

  return { openDecision, describeEffects }
}
