// Community tab: every partner who joined (live), today's top 10 (resets at
// midnight Cairo time), the all-time top 10 and the area managers' board —
// where a player's name is written after the 1000 missions.
import { on } from '../../core/events.js'
import { INITIAL_BRANCHES, LEADERSHIP } from '../../data/branches.js'
import { RANKS } from '../../systems/career/career.js'
import { cairoDateKey } from '../../platform/time.js'
import { $, esc, fmtNum, setHtml } from '../dom.js'
import { section } from '../section.js'

const ACTIVE_MS = 3 * 60_000
const PAGE = 60
const MEDALS = ['🥇', '🥈', '🥉']

function rankShort(key) {
  return (RANKS.find((r) => r.key === key) || RANKS[0]).short
}

function ago(ms, now) {
  if (!ms) return '—'
  const d = Math.max(0, now - ms)
  if (d < ACTIVE_MS) return 'نشط الآن'
  const m = Math.floor(d / 60_000)
  if (m < 60) return `منذ ${m} د`
  const h = Math.floor(m / 60)
  if (h < 24) return `منذ ${h} س`
  const days = Math.floor(h / 24)
  return `منذ ${days} يوم`
}

function initials(name) {
  const parts = String(name || '؟').trim().split(/\s+/)
  return esc((parts[0]?.[0] || '؟') + (parts[1]?.[0] || ''))
}

export function installCommunityTab({ game, session, systems }) {
  const root = $('sbcCommunityRoot')
  if (!root) return { render() {} }
  const { cloud, identity } = session
  const data = { players: [], top: [], today: [], todayDate: cairoDateKey(), hof: [], moderation: {}, loaded: false }
  const ui = { search: '', limit: PAGE }
  const now = () => (cloud ? cloud.serverNow() : Date.now())
  const visibleRow = (r) => !(data.moderation[r.uid]?.hidden || data.moderation[r.uid]?.banned)

  if (cloud) {
    cloud.watchPlayers((rows) => {
      data.players = rows
      data.loaded = true
      changed()
      publishStats()
    }, 2000)
    cloud.watchTopAllTime((rows) => {
      data.top = rows
      changed()
    })
    cloud.watchTopToday((rows, date) => {
      data.today = rows
      data.todayDate = date
      changed()
    })
    cloud.watchHallOfFame((rows) => {
      data.hof = rows
      changed()
    })
    cloud.watchModeration((m) => {
      data.moderation = m || {}
      changed()
    })
  }

  // The counters on the opening screen (registered, in today, active now) are
  // public: every signed-in game refreshes them from the live players list.
  let lastStats = ''
  let lastStatsAt = 0
  function publishStats(force = false) {
    if (!cloud || !data.loaded) return
    const t = now()
    if (!force && t - lastStatsAt < 30_000) return
    const today = cairoDateKey(new Date(t))
    const players = data.players.filter(visibleRow)
    const registered = players.length
    const enteredToday = players.filter((p) => p.lastSeen && cairoDateKey(new Date(p.lastSeen)) === today).length
    const activeNow = Math.min(enteredToday, players.filter((p) => t - (p.lastSeen || 0) < ACTIVE_MS).length)
    const key = `${registered}/${enteredToday}/${activeNow}/${today}`
    if (key === lastStats && t - lastStatsAt < 4 * 60_000) return
    lastStats = key
    lastStatsAt = t
    cloud.D.set(cloud.ref('career/stats'), { registered, enteredToday, activeNow, date: today, updatedAt: cloud.D.serverTimestamp() }).catch((e) => console.warn('[community] stats', e))
  }
  if (cloud) setInterval(() => publishStats(true), 60_000)

  function me(row) {
    return row.uid === identity.uid
  }

  function rowHtml(i, r, value, sub) {
    const mine = me(r)
    return `<div class="flex items-center gap-2 p-2 rounded-xl ${mine ? 'bg-[#16382d] border-2 border-[#CBA258]' : 'bg-[#0b1915] border border-emerald-800/70'}">
        <span class="w-7 text-center text-sm font-black font-num ${i < 3 ? '' : 'text-emerald-300'}">${i < 3 ? MEDALS[i] : i + 1}</span>
        ${r.photo ? `<img src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer" class="w-8 h-8 rounded-full border border-[#CBA258]/60 object-cover shrink-0" />` : `<span class="w-8 h-8 rounded-full bg-[#00704A] border border-[#CBA258]/60 flex items-center justify-center text-[11px] font-extrabold text-white shrink-0">${initials(r.name)}</span>`}
        <div class="min-w-0 flex-1">
          <div class="text-xs font-extrabold text-white truncate">${esc(r.name || 'لاعب')}${mine ? ' <span class="text-[10px] text-[#CBA258]">(أنت)</span>' : ''}</div>
          <div class="text-[10px] text-emerald-300/80 truncate">${esc(sub)}</div>
        </div>
        <span class="text-sm font-black font-num text-[#CBA258] shrink-0">${value}</span>
      </div>`
  }

  function offlineNote() {
    return `<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">📴 أنت تلعب بالوضع المحلي. القوائم المباشرة (اللاعبين والتوب 10) تظهر عند الدخول بحساب Google أو بالتسجيل كموظف مع اتصال بالإنترنت.</div>`
  }

  function header() {
    const t = now()
    const players = data.players.filter(visibleRow)
    const active = players.filter((p) => t - (p.lastSeen || 0) < ACTIVE_MS).length
    const today = cairoDateKey(new Date(t))
    const joinedToday = players.filter((p) => p.joinedAt && cairoDateKey(new Date(p.joinedAt)) === today).length
    const sorted = [...players].sort((a, b) => (b.missionsDone || 0) - (a.missionsDone || 0) || (b.xp || 0) - (a.xp || 0))
    const myPos = sorted.findIndex((p) => p.uid === identity.uid) + 1
    const tile = (label, value, cls = 'text-white') => `<div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-2.5 text-center"><div class="text-[10px] text-emerald-300/80">${label}</div><div class="text-base font-extrabold font-num ${cls}">${value}</div></div>`
    return `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
          <h3 class="text-sm font-extrabold text-[#CBA258]">👥 الزملاء والترتيب المباشر</h3>
          <p class="text-[11px] text-emerald-200/80">كل الزملاء اللي انضموا للعبة، والتوب 10 في إنجاز المهام — يتحدث لحظياً، وترتيب اليوم يبدأ من جديد كل يوم 12 منتصف الليل بتوقيت القاهرة.</p>
        </div>
        ${
          cloud
            ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                ${tile('المسجلون', fmtNum(players.length), 'text-[#CBA258]')}
                ${tile('نشطون الآن', fmtNum(active), 'text-emerald-300')}
                ${tile('انضموا اليوم', fmtNum(joinedToday), 'text-sky-300')}
                ${tile('ترتيبك', myPos ? `#${fmtNum(myPos)}` : '—', 'text-amber-300')}
              </div>`
            : offlineNote()
        }
      </div>`
  }

  function todayCard() {
    if (!cloud) return ''
    const rows = data.today
      .filter(visibleRow)
      .sort((a, b) => (b.missions || 0) - (a.missions || 0) || (b.xp || 0) - (a.xp || 0))
      .slice(0, 10)
    const body = rows.length
      ? rows.map((r, i) => rowHtml(i, r, fmtNum(r.missions || 0), [r.title, r.store].filter(Boolean).join(' • '))).join('')
      : '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لم ينجز أحد مهام اليوم بعد — كن الأول! 🚀</div>'
    return section('🔥 توب 10 اليوم', `مهام أُنجزت اليوم ${esc(data.todayDate)} (بتوقيت القاهرة).`, `<div class="space-y-1.5">${body}</div>`, 'amber')
  }

  function allTimeCard() {
    if (!cloud) return ''
    const rows = data.top
      .filter(visibleRow)
      .sort((a, b) => (b.missionsDone || 0) - (a.missionsDone || 0) || (b.xp || 0) - (a.xp || 0))
      .slice(0, 10)
    const body = rows.length
      ? rows.map((r, i) => rowHtml(i, r, `${fmtNum(r.missionsDone || 0)}<span class="text-[10px] text-emerald-300/70">/1000</span>`, [rankShort(r.rank), r.title, r.store].filter(Boolean).join(' • '))).join('')
      : '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لا يوجد لاعبون بعد.</div>'
    return section('👑 توب 10 على الإطلاق', 'الأكثر إنجازاً من الألف مهمة منذ انضمامهم.', `<div class="space-y-1.5">${body}</div>`, 'emerald')
  }

  function boardCard() {
    const leaders = [
      ...INITIAL_BRANCHES.map((b) => ({ name: b.dmName, title: b.dmTitle })),
      { name: LEADERSHIP.operations.name, title: LEADERSHIP.operations.title },
      { name: LEADERSHIP.training.name, title: LEADERSHIP.training.title },
    ]
    const leaderRows = leaders
      .map((l) => `<div class="flex items-center gap-2 p-2 rounded-xl bg-[#0b1915] border border-[#CBA258]/40"><span class="text-lg">🏛️</span><div class="min-w-0"><div class="text-xs font-extrabold text-white">${esc(l.name)}</div><div class="text-[10px] text-emerald-300/80 truncate">${esc(l.title)}</div></div></div>`)
      .join('')
    const hof = data.hof
      .filter(visibleRow)
      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
    const localDone = !cloud && (game.state?.sbc?.missions?.done?.length || 0) >= 1000
    const hofRows = hof.length
      ? hof
          .map(
            (r) => `<div class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-l from-[#16382d] to-[#2a2410] border-2 border-[#CBA258]">
              <span class="text-lg">👑</span>
              <div class="min-w-0 flex-1"><div class="text-xs font-black text-[#CBA258]">${esc(r.name)}${me(r) ? ' (أنت)' : ''}</div><div class="text-[10px] text-amber-100/80 truncate">مدير منطقة فخري • ${esc([r.title, r.store].filter(Boolean).join(' • '))}</div></div>
              <span class="text-[10px] text-amber-200 font-num shrink-0">${r.completedAt ? new Date(r.completedAt).toLocaleDateString('ar-EG') : ''}</span>
            </div>`,
          )
          .join('')
      : localDone
        ? `<div class="p-2 rounded-xl border-2 border-[#CBA258] text-xs font-black text-[#CBA258]">👑 ${esc(identity.name)} — مدير منطقة فخري (محلياً)</div>`
        : '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">لم ينهِ أحد الألف مهمة بعد. أول من ينهيها يُكتب اسمه هنا مع مديري المناطق!</div>'
    return section(
      '🏛️ لوحة مديري المناطق والقيادة',
      'مديرو المناطق الخمس والأوبريشن والتدريب — وتحتهم كل زميل أنهى الألف مهمة بتاريخ إنجازه.',
      `<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">${leaderRows}</div><div class="text-[11px] font-extrabold text-amber-200 mb-1.5">✨ انضموا إليهم بإنجاز الألف مهمة</div><div class="space-y-1.5">${hofRows}</div>`,
      'amber',
    )
  }

  function playersCard() {
    if (!cloud) return ''
    const t = now()
    const q = ui.search.trim().toLowerCase()
    const rows = data.players
      .filter(visibleRow)
      .filter((r) => !q || [r.name, r.title, r.store].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    const shown = rows.slice(0, ui.limit)
    const body = shown.length
      ? shown
          .map((r) => {
            const active = t - (r.lastSeen || 0) < ACTIVE_MS
            return `<div class="flex items-center gap-2 p-2 rounded-xl ${me(r) ? 'bg-[#16382d] border-2 border-[#CBA258]' : 'bg-[#0b1915] border border-emerald-800/70'}">
                <span class="relative shrink-0">
                  ${r.photo ? `<img src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer" class="w-8 h-8 rounded-full border border-[#CBA258]/60 object-cover" />` : `<span class="w-8 h-8 rounded-full bg-[#00704A] border border-[#CBA258]/60 flex items-center justify-center text-[11px] font-extrabold text-white">${initials(r.name)}</span>`}
                  <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0b1915] ${active ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-extrabold text-white truncate">${esc(r.name || 'لاعب')} <span class="text-[10px] font-bold text-emerald-300/80">${r.provider === 'google' ? 'G' : '🪪'}</span></div>
                  <div class="text-[10px] text-emerald-300/80 truncate">${esc([r.title, r.store].filter(Boolean).join(' • '))}</div>
                </div>
                <div class="text-left shrink-0">
                  <div class="text-[11px] font-extrabold font-num text-[#CBA258]">${fmtNum(r.missionsDone || 0)} مهمة • ${esc(rankShort(r.rank))}</div>
                  <div class="text-[10px] ${active ? 'text-emerald-300 font-bold' : 'text-emerald-300/70'}">${ago(r.lastSeen, t)}</div>
                </div>
              </div>`
          })
          .join('')
      : `<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">${data.loaded ? 'لا توجد نتائج.' : 'جارٍ التحميل…'}</div>`
    const more = rows.length > ui.limit ? `<div class="flex justify-center mt-2"><button type="button" data-more class="px-3 py-1.5 rounded-xl text-xs font-extrabold sb-btn-gold">عرض المزيد (${fmtNum(rows.length - ui.limit)})</button></div>` : ''
    return section(
      `📋 كل اللاعبين المسجلين (${fmtNum(rows.length)})`,
      'مرتبون حسب آخر ظهور. النقطة الخضراء = متصل الآن.',
      `<input data-search type="search" value="${esc(ui.search)}" placeholder="🔍 ابحث بالاسم أو المسمى أو الفرع…" class="w-full bg-[#0b1915] border border-emerald-600/60 rounded-xl px-3 py-2 text-xs font-bold text-white mb-2" />
       <div data-player-list class="space-y-1.5 max-h-[480px] overflow-y-auto pl-1">${body}</div>${more}`,
      'sky',
    )
  }

  // The search box is outside the re-rendered list so typing keeps the focus.
  root.innerHTML = '<div data-c="head"></div><div data-c="today"></div><div data-c="top"></div><div data-c="board"></div><div data-c="players"></div>'
  const part = (k) => root.querySelector(`[data-c="${k}"]`)

  function render() {
    setHtml(part('head'), header())
    setHtml(part('today'), todayCard())
    setHtml(part('top'), allTimeCard())
    setHtml(part('board'), boardCard())
    const playersHost = part('players')
    const input = playersHost.querySelector('[data-search]')
    if (input && document.activeElement === input) {
      // Only the list changes while the player types.
      const tmp = document.createElement('div')
      tmp.innerHTML = playersCard()
      const list = tmp.querySelector('[data-player-list]')
      const cur = playersHost.querySelector('[data-player-list]')
      if (list && cur) setHtml(cur, list.innerHTML)
    } else {
      setHtml(playersHost, playersCard())
    }
    updateBadge()
  }

  function updateBadge() {
    const badge = $('sbcOnlineBadge')
    if (!badge) return
    if (!cloud) return badge.classList.add('hidden')
    const t = now()
    const active = data.players.filter(visibleRow).filter((p) => t - (p.lastSeen || 0) < ACTIVE_MS).length
    badge.textContent = String(active)
    badge.classList.toggle('hidden', active === 0)
  }

  root.addEventListener('input', (e) => {
    if (!e.target.matches('[data-search]')) return
    ui.search = e.target.value
    ui.limit = PAGE
    render()
  })
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) {
      ui.limit += PAGE
      render()
    }
  })

  const visible = () => !$('tab-community')?.classList.contains('hidden')
  let timer = null
  function changed() {
    updateBadge()
    if (!visible() || timer) return
    timer = setTimeout(() => {
      timer = null
      render()
    }, 300)
  }
  // "Active now" and "x minutes ago" move with the clock.
  setInterval(() => {
    updateBadge()
    if (visible()) render()
  }, 30_000)
  on('mission:completed', () => systems && visible() && changed())

  return { render, data }
}
