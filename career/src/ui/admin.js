// The owner's control panel. Only an account listed under /career/admins in
// the database sees it, and the database rules refuse these writes to anyone
// else, so the panel is a convenience — the rules are the lock.
import { $, esc, fmtNum } from './dom.js'
import { openModal } from './modal.js'
import { APP_VERSION } from '../platform/config.js'
import { cairoDateKey } from '../platform/time.js'
import { RANKS } from '../systems/career/career.js'

const TABS = [
  ['overview', '📊 نظرة عامة'],
  ['announce', '📣 الإعلانات والفعاليات'],
  ['settings', '⚙️ إعدادات اللعبة'],
  ['players', '👥 اللاعبون'],
  ['log', '📜 سجل الإجراءات'],
]

function input(name, value, attrs = '') {
  return `<input name="${name}" value="${esc(value ?? '')}" ${attrs} class="w-full bg-[#0b1915] border border-emerald-600/60 rounded-xl px-3 py-2 text-xs font-bold text-white" />`
}

function field(label, control, hint = '') {
  return `<label class="block"><span class="block text-[11px] font-extrabold text-[#CBA258] mb-1">${label}</span>${control}${hint ? `<span class="block text-[10px] text-emerald-300/70 mt-0.5">${hint}</span>` : ''}</label>`
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function installAdmin({ session, getConfig }) {
  const { cloud, identity } = session
  if (!session.isAdmin || !cloud) return { open() {} }
  const live = { players: [], moderation: {} }
  cloud.watchPlayers((rows) => (live.players = rows), 1000)
  cloud.watchModeration((m) => (live.moderation = m || {}))

  function open() {
    const ui = { tab: 'overview', search: '', selected: null, priv: null, log: null, msg: '' }
    const m = openModal({ title: '👑 لوحة تحكم المسؤول', subtitle: `أنت المتحكم الوحيد في اللعبة • UID: ${identity.uid}`, size: 'xl' })

    const note = () => (ui.msg ? `<div class="mb-3 p-2 rounded-xl bg-black/85 border border-[#CBA258] text-xs font-bold text-amber-200">${ui.msg}</div>` : '')

    function overview() {
      const t = cloud.serverNow()
      const players = live.players
      const active = players.filter((p) => t - (p.lastSeen || 0) < 3 * 60_000).length
      const today = cairoDateKey(new Date(t))
      const joinedToday = players.filter((p) => p.joinedAt && cairoDateKey(new Date(p.joinedAt)) === today).length
      const total = players.reduce((a, p) => a + (p.missionsDone || 0), 0)
      const finished = players.filter((p) => (p.missionsDone || 0) >= 1000).length
      const banned = Object.values(live.moderation).filter((x) => x.banned).length
      const byRank = RANKS.map((r) => `${r.short}: <strong class="font-num">${players.filter((p) => (p.rank || 'barista') === r.key).length}</strong>`).join(' • ')
      const tile = (k, v) => `<div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-2.5 text-center"><div class="text-[10px] text-emerald-300/80">${k}</div><div class="text-base font-extrabold font-num text-[#CBA258]">${v}</div></div>`
      const versions = {}
      players.forEach((p) => (versions[p.appVersion || '؟'] = (versions[p.appVersion || '؟'] || 0) + 1))
      return `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          ${tile('المسجلون', fmtNum(players.length))}
          ${tile('نشطون الآن', fmtNum(active))}
          ${tile('انضموا اليوم', fmtNum(joinedToday))}
          ${tile('مجموع المهام', fmtNum(total))}
          ${tile('أنهوا الألف', fmtNum(finished))}
          ${tile('محظورون', fmtNum(banned))}
          ${tile('نسختك', APP_VERSION)}
          ${tile('أعلى إنجاز', fmtNum(Math.max(0, ...players.map((p) => p.missionsDone || 0))))}
        </div>
        <div class="p-2.5 rounded-xl bg-[#0b1915] border border-emerald-800/70 text-[11px] text-emerald-100 mb-2">توزيع المناصب: ${byRank}</div>
        <div class="p-2.5 rounded-xl bg-[#0b1915] border border-emerald-800/70 text-[11px] text-emerald-100">إصدارات اللاعبين: ${Object.entries(versions).map(([v, n]) => `<span class="font-num">${esc(v)}</span>: <strong class="font-num">${n}</strong>`).join(' • ')}</div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" data-a="export" class="px-3 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">⬇️ تصدير قائمة اللاعبين (CSV)</button>
        </div>`
    }

    function announce() {
      const c = getConfig()
      const a = c.announcement || {}
      return `<form data-form="announce" class="space-y-3">
          ${field('نص الإعلان (يظهر أعلى اللعبة لكل اللاعبين فوراً)', `<textarea name="text" rows="3" maxlength="500" class="w-full bg-[#0b1915] border border-emerald-600/60 rounded-xl px-3 py-2 text-xs font-bold text-white">${esc(a.text || '')}</textarea>`)}
          ${field('نوع الإعلان', `<select name="level" class="w-full bg-[#0b1915] border border-emerald-600/60 rounded-xl px-3 py-2 text-xs font-bold text-white">${['info', 'success', 'warning', 'danger'].map((l) => `<option value="${l}" ${a.level === l ? 'selected' : ''}>${{ info: 'معلومة', success: 'خبر سعيد', warning: 'تنبيه', danger: 'هام جداً' }[l]}</option>`).join('')}</select>`)}
          ${field('عنوان فعالية (اختياري)', input('eventTitle', c.eventTitle || '', 'maxlength="120"'), 'مثال: أسبوع الذروة — مضاعفة مكافآت المهام')}
          ${field('مضاعف مكافآت المهام (0.5 – 3)', input('rewardMultiplier', c.rewardMultiplier ?? 1, 'type="number" step="0.1" min="0.5" max="3"'))}
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" data-a="clear-announce" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-white">مسح الإعلان</button>
            <button type="submit" class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">نشر الآن</button>
          </div>
        </form>`
    }

    function settings() {
      const c = getConfig()
      const check = (name, v, label) => `<label class="flex items-center gap-2 p-2 rounded-xl bg-[#0b1915] border border-emerald-800/70 text-xs font-bold text-white"><input type="checkbox" name="${name}" ${v ? 'checked' : ''} class="w-4 h-4 accent-[#CBA258]" />${label}</label>`
      return `<form data-form="settings" class="space-y-3">
          ${check('maintenance', !!c.maintenance, '🛠️ وضع الصيانة (يمنع الجميع من الدخول ما عدا المسؤول)')}
          ${field('رسالة الصيانة', input('maintenanceText', c.maintenanceText || '', 'maxlength="300"'))}
          ${check('registrationOpen', c.registrationOpen !== false, '🪪 التسجيل بالرقم الوظيفي مفتوح للحسابات الجديدة')}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${field('أحدث إصدار (يظهر للاعبين تنبيه تحديث)', input('latestVersion', c.latestVersion || '', 'placeholder="2.0.0" pattern="[0-9]+\\.[0-9]+\\.[0-9]+"'))}
            ${field('أقل إصدار مسموح (الأقدم منه لا يدخل)', input('minVersion', c.minVersion || '', 'placeholder="2.0.0" pattern="[0-9]+\\.[0-9]+\\.[0-9]+"'))}
            ${field('رابط الويب المباشر', input('webUrl', c.webUrl || '', 'maxlength="300" placeholder="https://…"'))}
            ${field('رابط تحميل الـ APK', input('apkUrl', c.apkUrl || '', 'maxlength="300" placeholder="https://…"'))}
            ${field('معدل المشكلات المعقدة (0.25 – 4)', input('incidentRate', c.incidentRate ?? 1, 'type="number" step="0.25" min="0.25" max="4"'), '1 = الطبيعي، 2 = ضعف عدد المشكلات')}
          </div>
          <div class="flex justify-end"><button type="submit" class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">حفظ الإعدادات</button></div>
        </form>`
    }

    function players() {
      const q = ui.search.trim().toLowerCase()
      const rows = live.players
        .filter((p) => !q || [p.name, p.title, p.store, p.uid].some((v) => String(v || '').toLowerCase().includes(q)))
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .slice(0, 150)
      const list = rows
        .map((p) => {
          const mod = live.moderation[p.uid] || {}
          return `<button type="button" data-pick="${esc(p.uid)}" class="w-full text-right flex items-center justify-between gap-2 p-2 rounded-xl ${ui.selected === p.uid ? 'bg-[#16382d] border-2 border-[#CBA258]' : 'bg-[#0b1915] border border-emerald-800/70'}">
              <span class="min-w-0"><span class="block text-xs font-extrabold text-white truncate">${esc(p.name)} ${mod.banned ? '⛔' : ''}${mod.hidden ? '🙈' : ''}</span><span class="block text-[10px] text-emerald-300/80 truncate">${esc([p.title, p.store].filter(Boolean).join(' • '))}</span></span>
              <span class="text-[11px] font-num font-extrabold text-[#CBA258] shrink-0">${fmtNum(p.missionsDone || 0)}</span>
            </button>`
        })
        .join('')
      let detail = '<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">اختر لاعباً لعرض بياناته والتحكم فيه.</div>'
      const p = live.players.find((x) => x.uid === ui.selected)
      if (p) {
        const mod = live.moderation[p.uid] || {}
        const priv = ui.priv
        const line = (k, v) => `<div class="flex items-center justify-between gap-2 py-1 border-b border-emerald-900/60 text-[11px]"><span class="text-emerald-200">${k}</span><span class="font-bold text-white text-left break-all">${v}</span></div>`
        detail = `
          <div class="text-sm font-black text-white mb-1">${esc(p.name)}</div>
          ${line('UID', `<span class="font-num">${esc(p.uid)}</span>`)}
          ${line('الاسم الكامل', esc(priv?.fullName || '…'))}
          ${line('الرقم الوظيفي', `<span class="font-num">${esc(priv?.employeeId || '—')}</span>`)}
          ${line('المسمى', esc(p.title))}
          ${line('الفرع', esc(p.store || '—'))}
          ${line('البريد', esc(priv?.email || '—'))}
          ${line('الدخول', p.provider === 'google' ? 'Google' : 'رقم وظيفي')}
          ${line('المهام / XP', `<span class="font-num">${fmtNum(p.missionsDone || 0)} / ${fmtNum(p.xp || 0)}</span>`)}
          ${line('المنصب', esc((RANKS.find((r) => r.key === p.rank) || RANKS[0]).title))}
          ${line('الإصدار', `<span class="font-num">${esc(p.appVersion || '—')}</span>`)}
          ${line('آخر ظهور', p.lastSeen ? new Date(p.lastSeen).toLocaleString('ar-EG') : '—')}
          ${line('انضم', p.joinedAt ? new Date(p.joinedAt).toLocaleString('ar-EG') : '—')}
          <div class="flex flex-wrap gap-1.5 mt-3">
            <button type="button" data-a="hide" class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-slate-800 hover:bg-slate-700 text-white">${mod.hidden ? '👁️ إظهار في القوائم' : '🙈 إخفاء من القوائم'}</button>
            <button type="button" data-a="ban" class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold ${mod.banned ? 'bg-emerald-800 hover:bg-emerald-700' : 'bg-rose-800 hover:bg-rose-700'} text-white">${mod.banned ? '✅ رفع الحظر' : '⛔ حظر'}</button>
            <button type="button" data-a="reset" class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-amber-700 hover:bg-amber-600 text-white">🔄 تصفير التقدم</button>
            <button type="button" data-a="remove" class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700/60">🗑️ حذف اللاعب</button>
          </div>
          <form data-form="transfer" class="mt-3 p-2.5 rounded-xl bg-[#0b1915] border border-emerald-800/70 space-y-2">
            <div class="text-[11px] font-extrabold text-[#CBA258]">📦 نقل تقدم هذا اللاعب إلى حساب جديد (موبايل جديد أو إعادة تثبيت)</div>
            ${input('to', '', 'placeholder="UID الحساب الجديد (يظهر للاعب في ملفه)" required')}
            <div class="flex justify-end"><button type="submit" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold sb-btn-gold">نقل التقدم</button></div>
          </form>`
      }
      return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <input data-psearch type="search" value="${esc(ui.search)}" placeholder="🔍 بحث بالاسم أو الفرع أو UID…" class="w-full bg-[#0b1915] border border-emerald-600/60 rounded-xl px-3 py-2 text-xs font-bold text-white mb-2" />
            <div class="space-y-1.5 max-h-[52vh] overflow-y-auto pl-1">${list || '<div class="text-xs text-emerald-300 p-3 text-center">لا يوجد لاعبون.</div>'}</div>
          </div>
          <div class="p-3 rounded-xl bg-black/30 border border-emerald-800/70">${detail}</div>
        </div>`
    }

    function logView() {
      if (!ui.log) return '<div class="text-xs text-emerald-300 p-3 text-center">جارٍ التحميل…</div>'
      if (!ui.log.length) return '<div class="text-xs text-emerald-300 p-3 text-center">لا توجد إجراءات بعد.</div>'
      return `<div class="space-y-1.5 max-h-[55vh] overflow-y-auto">${ui.log
        .map((l) => `<div class="p-2 rounded-xl bg-[#0b1915] border border-emerald-800/70 text-[11px]"><span class="font-extrabold text-[#CBA258]">${esc(l.action)}</span> <span class="text-emerald-200 font-num">${esc(l.target || '')}</span> <span class="text-emerald-300/70">${esc(l.detail || '')}</span><span class="float-left text-emerald-300/70 font-num">${l.at ? new Date(l.at).toLocaleString('ar-EG') : ''}</span></div>`)
        .join('')}</div>`
    }

    function draw() {
      const tabs = TABS.map(([k, label]) => `<button type="button" data-tab-admin="${k}" class="px-3 py-1.5 rounded-xl text-xs font-extrabold ${ui.tab === k ? 'bg-[#CBA258] text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'}">${label}</button>`).join('')
      const body = { overview, announce, settings, players, log: logView }[ui.tab]()
      m.setBody(`<div class="flex flex-wrap gap-1.5 mb-3">${tabs}</div>${note()}${body}`)
    }

    async function act(fn, ok) {
      try {
        await fn()
        ui.msg = `✅ ${ok}`
      } catch (error) {
        console.warn('[admin]', error)
        ui.msg = `⚠️ فشل الإجراء: ${esc(error?.message || error)}`
      }
      draw()
    }

    m.body.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-tab-admin]')
      if (tab) {
        ui.tab = tab.getAttribute('data-tab-admin')
        ui.msg = ''
        if (ui.tab === 'log') {
          ui.log = null
          cloud.adminLoadLog(150).then((l) => {
            ui.log = l
            if (ui.tab === 'log') draw()
          }).catch(() => {
            ui.log = []
            draw()
          })
        }
        draw()
        return
      }
      const pick = e.target.closest('[data-pick]')
      if (pick) {
        ui.selected = pick.getAttribute('data-pick')
        ui.priv = null
        draw()
        cloud.adminGetPrivate(ui.selected).then((p) => {
          ui.priv = p || {}
          draw()
        }).catch(() => {})
        return
      }
      const a = e.target.closest('[data-a]')?.getAttribute('data-a')
      if (!a) return
      const uid = ui.selected
      const mod = live.moderation[uid] || {}
      if (a === 'export') {
        const header = ['uid', 'name', 'title', 'store', 'provider', 'missionsDone', 'xp', 'rank', 'chapter', 'joinedAt', 'lastSeen', 'appVersion']
        const lines = [header.join(',')].concat(live.players.map((p) => header.map((h) => csvCell(h === 'joinedAt' || h === 'lastSeen' ? (p[h] ? new Date(p[h]).toISOString() : '') : p[h])).join(',')))
        const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `starbucks-career-players-${cairoDateKey()}.csv`
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 5000)
        ui.msg = '✅ تم تجهيز الملف.'
        draw()
      } else if (a === 'clear-announce') {
        await act(() => cloud.adminSetConfig({ announcement: null, eventTitle: null }), 'تم مسح الإعلان.')
      } else if (a === 'hide' && uid) {
        await act(() => cloud.adminModerate(uid, { hidden: !mod.hidden }), mod.hidden ? 'أصبح ظاهراً في القوائم.' : 'تم إخفاؤه من القوائم.')
      } else if (a === 'ban' && uid) {
        if (uid === identity.uid) return
        const note = mod.banned ? '' : window.prompt('سبب الحظر (اختياري):') || ''
        await act(() => cloud.adminModerate(uid, { banned: !mod.banned }, note), mod.banned ? 'تم رفع الحظر.' : 'تم الحظر.')
      } else if (a === 'reset' && uid) {
        if (!window.confirm('تصفير تقدم هذا اللاعب بالكامل (الحفظ والمهام والترتيب)؟')) return
        await act(() => cloud.adminResetPlayer(uid), 'تم تصفير التقدم.')
      } else if (a === 'remove' && uid) {
        if (!window.confirm('حذف اللاعب وكل بياناته نهائياً؟')) return
        await act(() => cloud.adminRemovePlayer(uid), 'تم حذف اللاعب.')
        ui.selected = null
        draw()
      }
    })

    m.body.addEventListener('input', (e) => {
      if (!e.target.matches('[data-psearch]')) return
      ui.search = e.target.value
      const pos = e.target.selectionStart
      draw()
      const el = m.body.querySelector('[data-psearch]')
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })

    m.body.addEventListener('submit', async (e) => {
      e.preventDefault()
      const form = e.target
      const data = new FormData(form)
      const kind = form.getAttribute('data-form')
      if (kind === 'announce') {
        const text = String(data.get('text') || '').trim()
        const mult = Math.max(0.5, Math.min(3, Number(data.get('rewardMultiplier')) || 1))
        const eventTitle = String(data.get('eventTitle') || '').trim()
        await act(
          () => cloud.adminSetConfig({ announcement: text ? { text, level: String(data.get('level') || 'info'), updatedAt: Date.now() } : null, eventTitle: eventTitle || null, rewardMultiplier: mult }),
          'تم النشر لكل اللاعبين.',
        )
      } else if (kind === 'settings') {
        const v = (k) => String(data.get(k) || '').trim()
        const ver = (k) => (/^\d+\.\d+\.\d+$/.test(v(k)) ? v(k) : null)
        await act(
          () =>
            cloud.adminSetConfig({
              maintenance: data.get('maintenance') === 'on',
              maintenanceText: v('maintenanceText') || null,
              registrationOpen: data.get('registrationOpen') === 'on',
              latestVersion: ver('latestVersion'),
              minVersion: ver('minVersion'),
              webUrl: v('webUrl') || null,
              apkUrl: v('apkUrl') || null,
              incidentRate: Math.max(0.25, Math.min(4, Number(data.get('incidentRate')) || 1)),
            }),
          'تم حفظ الإعدادات.',
        )
      } else if (kind === 'transfer' && ui.selected) {
        const to = String(data.get('to') || '').trim()
        if (!to || to === ui.selected) return
        if (!window.confirm(`نقل تقدم هذا اللاعب إلى ${to}؟ سيتم إخفاء الحساب القديم.`)) return
        await act(() => cloud.adminTransferProgress(ui.selected, to), 'تم نقل التقدم. يدخل اللاعب بحسابه الجديد ليجد تقدمه.')
      }
    })

    draw()
  }

  return { open }
}

export function adminEntryVisible(session) {
  return !!(session.isAdmin && session.cloud && $('sbcProfileChip'))
}
