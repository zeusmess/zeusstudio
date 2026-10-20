// Everything around the game: the profile chip in the header, the profile and
// About dialogs, the owner's announcement bar, the "new version" prompt, the
// install dialog with the real links, the footer and the locked roles in the
// legacy opening screen.
import { on } from '../core/events.js'
import { currentRank, RANKS } from '../systems/career/career.js'
import { missionsDone } from '../systems/missions/engine.js'
import { APP_VERSION, compareVersions, DEFAULT_LINKS } from '../platform/config.js'
import { signInWithGoogle, signOutEverywhere, authErrorMessage, googleSignInSupported } from '../platform/auth.js'
import { saveLocalIdentity } from '../platform/identity.js'
import { $, esc, fmtNum } from './dom.js'
import { icon } from './icons.js'
import { openModal } from './modal.js'

const SOURCES = [
  ['Starbucks Careers — Retail roles', 'https://careers.starbucks.com/discover-opportunities/retail/'],
  ['Green Apron Service & the 4-minute goal (Fortune, 2025)', 'https://fortune.com/2025/08/15/brian-niccol-starbucks-4-minute-order-green-apron-service'],
  ['Starbucks four-minute rule (Food Republic)', 'https://www.foodrepublic.com/2088407/starbucks-four-minute-rule/'],
  ['How to taste coffee — Smell, Slurp, Locate, Describe', 'https://www.starbucksathome.com/story/how-taste-coffee'],
  ['Egypt Labour Law 14/2025 — working hours (ZenHR)', 'https://www.zenhr.com/en/egypt-labor-law'],
  ['Egypt working hours & rest periods (Cercli)', 'https://www.cercli.com/resources/egypt-working-hours'],
  ['Labour law & working hours report (Egypt Today)', 'https://www.egypttoday.com/Article/1/145902/Report-on-Labor-Law-and-working-hour-regulations-in-Egyptian'],
  ['Food safety self-assessment & QASA audits (SafetyCulture)', 'https://safetyculture.com/'],
]

const LEVEL_CLS = {
  info: 'from-sky-950 via-[#0f231d] to-sky-950 border-sky-400 text-sky-100',
  success: 'from-emerald-950 via-[#16382d] to-emerald-950 border-emerald-400 text-emerald-100',
  warning: 'from-amber-950 via-[#2a2410] to-amber-950 border-amber-400 text-amber-100',
  danger: 'from-rose-950 via-red-950 to-rose-950 border-rose-400 text-rose-100',
}

export function installChrome({ game, session, sync, systems, getConfig, openAdmin }) {
  const { identity, cloud, fb } = session
  const links = () => ({ web: getConfig().webUrl || DEFAULT_LINKS.web, apk: getConfig().apkUrl || DEFAULT_LINKS.apk })

  // ----------------------------------------------------------- profile chip
  const controls = $('btnPause')?.parentElement
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.id = 'sbcProfileChip'
  chip.className = 'px-2 py-1 rounded-xl text-xs font-extrabold bg-[#0b1915] hover:bg-emerald-950 border border-[#CBA258]/70 text-white transition flex items-center gap-1.5 max-w-[220px]'
  chip.title = 'ملفك الشخصي'
  controls?.prepend(chip)

  function avatar(size = 'w-6 h-6', text = 'text-[10px]') {
    if (identity.photo) return `<img src="${esc(identity.photo)}" alt="" referrerpolicy="no-referrer" class="${size} rounded-full border border-[#CBA258]/70 object-cover shrink-0" />`
    const parts = String(identity.name || '؟').split(' ')
    return `<span class="${size} rounded-full bg-[#00704A] border border-[#CBA258]/70 flex items-center justify-center ${text} font-extrabold shrink-0">${esc((parts[0]?.[0] || '') + (parts[1]?.[0] || ''))}</span>`
  }

  function renderChip() {
    const state = game.state
    if (!state) return
    const rank = currentRank(state)
    const html = `${avatar()}<span class="min-w-0 text-right leading-tight"><span class="block truncate">${esc(identity.name)}</span><span class="block text-[10px] text-[#CBA258] font-num truncate">${esc(rank.short)} • ${fmtNum(missionsDone(state))}/1000</span></span>${session.isAdmin ? `<span class="text-amber-300">${icon('crown', 'w-3.5 h-3.5')}</span>` : ''}`
    if (chip._html !== html) {
      chip.innerHTML = html
      chip._html = html
    }
  }
  chip.addEventListener('click', () => {
    game.initAudio()
    openProfile()
  })
  for (const t of ['missions:changed', 'career:promoted', 'game:started']) on(t, renderChip)

  // ------------------------------------------------------------ profile
  function openProfile() {
    const state = game.state
    const rank = currentRank(state)
    const m = openModal({ title: '🪪 ملفك في Starbucks Career' })
    const providerLabel = identity.provider === 'google' ? 'حساب Google' : identity.provider === 'employee' ? 'تسجيل بالرقم الوظيفي' : 'وضع محلي (بدون إنترنت)'
    const line = (k, v) => `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-emerald-900/60 text-xs"><span class="text-emerald-200">${k}</span><span class="font-extrabold text-white text-left">${v}</span></div>`
    const lastSave = state.sbc?.flags?.lastCloudSave
    const draw = (msg = '') => {
      m.setBody(`
        <div class="flex items-center gap-3 mb-3">${avatar('w-12 h-12', 'text-base')}<div class="min-w-0"><div class="text-sm font-black text-white truncate">${esc(identity.fullName || identity.name)}</div><div class="text-[11px] text-[#CBA258]">${esc(rank.title)}</div></div></div>
        ${line('المسمى الوظيفي', esc(identity.jobTitle || '—'))}
        ${identity.employeeId ? line('الرقم الوظيفي', `<span class="font-num">${esc(identity.employeeId)}</span>`) : ''}
        ${identity.store ? line('الفرع', esc(identity.store)) : ''}
        ${identity.email ? line('البريد', `<span class="font-num">${esc(identity.email)}</span>`) : ''}
        ${line('طريقة الدخول', providerLabel)}
        ${cloud ? line('رقم الحساب (UID)', `<span class="font-num text-[10px] select-all">${esc(identity.uid)}</span>`) : ''}
        ${line('المهام المنجزة', `<span class="font-num">${fmtNum(missionsDone(state))} / 1000</span>`)}
        ${line('الحفظ', cloud ? `☁️ محفوظ على حسابك${lastSave ? ` • ${new Date(lastSave).toLocaleTimeString('ar-EG')}` : ''}` : '📱 محفوظ على هذا الجهاز فقط')}
        ${msg ? `<div class="mt-3 p-2 rounded-xl bg-black/85 border border-[#CBA258] text-xs font-bold text-amber-200">${msg}</div>` : ''}
        ${identity.provider === 'employee' && googleSignInSupported() ? '<div class="mt-3 p-2.5 rounded-xl bg-sky-950/70 border border-sky-500/50 text-[11px] text-sky-100">🔐 احمِ تقدمك: اربط حساب Google بحسابك الحالي عشان تقدر تكمّل من أي موبايل بدون ما يضيع أي إنجاز.</div>' : ''}
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          ${session.isAdmin ? `<button type="button" data-p="admin" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950">👑 لوحة تحكم المسؤول</button>` : ''}
          ${identity.provider === 'employee' && googleSignInSupported() ? '<button type="button" data-p="link" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-white text-slate-900">🔗 اربط Google</button>' : ''}
          <button type="button" data-p="about" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-white">ℹ️ عن اللعبة</button>
          <button type="button" data-p="logout" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700/60">⎋ تسجيل الخروج</button>
        </div>`)
    }
    m.body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-p]')
      if (!b) return
      const what = b.getAttribute('data-p')
      if (what === 'about') {
        m.close()
        openAbout()
      } else if (what === 'admin') {
        m.close()
        openAdmin()
      } else if (what === 'link') {
        try {
          b.disabled = true
          const user = await signInWithGoogle(fb)
          if (!user) return
          await cloud.D.update(cloud.ref(`career/players/${identity.uid}`), { provider: 'google', ...(user.photoURL ? { photo: user.photoURL } : {}), lastSeen: cloud.D.serverTimestamp() })
          identity.provider = 'google'
          identity.email = user.email || ''
          identity.photo = user.photoURL || ''
          renderChip()
          draw('✅ تم ربط حساب Google — تقدمك الآن محمي على حسابك.')
        } catch (error) {
          draw(`⚠️ ${esc(authErrorMessage(error))}`)
        }
      } else if (what === 'logout') {
        const warn =
          identity.provider === 'employee'
            ? 'تنبيه: حسابك مسجل بالرقم الوظيفي فقط وغير مربوط بـ Google. لو خرجت مش هتقدر ترجع لنفس الحساب من جهاز تاني إلا عن طريق مسؤول اللعبة. هل تريد الخروج؟'
            : 'هل تريد تسجيل الخروج؟ تقدمك محفوظ وهيرجع لما تدخل تاني.'
        if (!window.confirm(warn)) return
        sync.flush()
        try {
          if (fb) await signOutEverywhere(fb)
        } catch (error) {
          console.warn('[chrome] sign-out', error)
        }
        saveLocalIdentity(null)
        location.reload()
      }
    })
    draw()
  }

  // -------------------------------------------------------------- about
  function openAbout() {
    const l = links()
    const m = openModal({ title: '☕ عن Starbucks Career', subtitle: `الإصدار ${APP_VERSION}`, size: 'lg' })
    m.setBody(`
      <div class="text-center mb-3">
        <div class="w-16 h-16 mx-auto rounded-full bg-[#00704A] border-2 border-[#CBA258] flex items-center justify-center text-3xl shadow-lg sbc-logo-ring">☕</div>
        <div class="text-base font-black text-white mt-2">Starbucks Career</div>
        <div class="text-xs text-emerald-200">powered by <strong class="text-[#CBA258]">Youssef Ayman</strong></div>
      </div>
      <div class="space-y-2 text-xs text-emerald-100 leading-relaxed">
        <p>محاكي تشغيل فرع ومسيرة مهنية للزملاء: البار والدرايف ثرو والموبايل والدليفري، إدارة الوردية ونسبة العمالة وقانون الراحات، سجلات سلامة الغذاء، مشكلات معقدة بقرارات لها تبعات، وألف مهمة صعبة توصلك للوحة مديري المناطق.</p>
        <p>الفروع ومديرو المناطق والأوبريشن (${esc('أ. عمرو عاطف')}) والتدريب (${esc('أ. محمود أحمد')}) كما هي في النسخة الأصلية.</p>
        <div class="p-2.5 rounded-xl bg-[#0b1915] border border-emerald-800/70">
          <div class="font-extrabold text-[#CBA258] mb-1">📲 روابط اللعبة</div>
          <div class="flex flex-col gap-1.5">
            <a href="${esc(l.web)}" target="_blank" rel="noopener" class="font-num text-sky-300 break-all hover:underline">🌐 ${esc(l.web)}</a>
            <a href="${esc(l.apk)}" target="_blank" rel="noopener" class="font-num text-sky-300 break-all hover:underline">🤖 ${esc(l.apk)}</a>
          </div>
        </div>
        <details class="p-2.5 rounded-xl bg-[#0b1915] border border-emerald-800/70">
          <summary class="cursor-pointer font-extrabold text-[#CBA258]">📚 مصادر المعايير المستخدمة في اللعبة</summary>
          <ul class="mt-2 space-y-1">${SOURCES.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener" class="text-sky-300 hover:underline">${esc(t)}</a></li>`).join('')}</ul>
        </details>
        <p class="text-[10px] text-emerald-300/70">لعبة تدريبية غير رسمية صنعها زميل لزملائه، وليست تطبيقاً رسمياً من Starbucks أو الشركة المشغّلة. العلامات التجارية ملك أصحابها.</p>
      </div>
      <div class="mt-4 flex justify-end"><button type="button" data-modal-close class="px-4 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">تم</button></div>`)
  }
  $('sbcFooterAbout')?.addEventListener('click', openAbout)
  const ver = $('sbcFooterVersion')
  if (ver) ver.textContent = `v${APP_VERSION}`

  // ---------------------------------------------------- install dialog
  function rewriteApkModal() {
    const card = $('apkModal')?.firstElementChild
    if (!card) return
    const body = card.children[1]
    const l = links()
    if (body) {
      body.innerHTML = `
        <div class="p-3 rounded-xl bg-emerald-950/90 border border-emerald-600/50">
          <div class="font-extrabold text-amber-300 mb-1">🌐 الرابط المباشر (يفتح على أي موبايل أو كمبيوتر):</div>
          <a href="${esc(l.web)}" target="_blank" rel="noopener" class="font-num text-sky-300 break-all hover:underline">${esc(l.web)}</a>
          <p class="mt-1">من Chrome على الأندرويد اضغط <strong>(⋮)</strong> ثم «إضافة إلى الشاشة الرئيسية» لتثبيتها كتطبيق.</p>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-700">
          <div class="font-extrabold text-sky-300 mb-1">🤖 نسخة الأندرويد APK:</div>
          <a href="${esc(l.apk)}" target="_blank" rel="noopener" class="font-num text-sky-300 break-all hover:underline">${esc(l.apk)}</a>
          <p class="mt-1">بعد التحميل افتح الملف واسمح بتثبيت التطبيقات من مصادر غير معروفة. تقدمك محفوظ على حسابك في النسختين.</p>
        </div>`
    }
    const dl = $('btnDownloadStandaloneHtml')
    if (dl) {
      const a = document.createElement('a')
      a.href = l.apk
      a.target = '_blank'
      a.rel = 'noopener'
      a.className = dl.className
      a.textContent = '⬇️ تحميل الـ APK'
      dl.replaceWith(a)
    }
  }

  // ------------------------------------------------ announcement + update
  const annHost = $('sbcAnnouncement')
  function renderAnnouncement() {
    if (!annHost) return
    const cfg = getConfig()
    const a = cfg.announcement
    const parts = []
    if (a?.text) {
      parts.push(`<div class="mb-0 px-3.5 py-2 rounded-xl bg-gradient-to-r ${LEVEL_CLS[a.level] || LEVEL_CLS.info} border-2 flex flex-wrap items-center justify-between gap-2 shadow-xl">
          <div class="flex items-center gap-2 text-xs sm:text-sm font-extrabold min-w-0"><span class="text-xl">📣</span><span class="min-w-0">${esc(a.text)}</span></div>
          ${cfg.eventTitle ? `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-black/40">${esc(cfg.eventTitle)}${cfg.rewardMultiplier && cfg.rewardMultiplier !== 1 ? ` • مكافآت ×${cfg.rewardMultiplier}` : ''}</span>` : ''}
        </div>`)
    } else if (cfg.eventTitle) {
      parts.push(`<div class="px-3.5 py-2 rounded-xl bg-gradient-to-r ${LEVEL_CLS.success} border-2 text-xs font-extrabold">🎉 ${esc(cfg.eventTitle)}${cfg.rewardMultiplier && cfg.rewardMultiplier !== 1 ? ` • مكافآت المهام ×${cfg.rewardMultiplier}` : ''}</div>`)
    }
    if (cfg.latestVersion && compareVersions(APP_VERSION, cfg.latestVersion) < 0) {
      const l = links()
      parts.push(`<div class="mt-2 px-3.5 py-2 rounded-xl bg-gradient-to-r ${LEVEL_CLS.warning} border-2 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-extrabold">🆕 نسخة جديدة متاحة (${esc(cfg.latestVersion)}) — نسختك ${APP_VERSION}.</span>
          <a href="${esc(window.Capacitor?.isNativePlatform?.() ? l.apk : l.web)}" target="_blank" rel="noopener" class="px-3 py-1 rounded-lg text-xs font-extrabold bg-[#CBA258] text-slate-950">تحديث</a>
        </div>`)
    }
    annHost.innerHTML = parts.join('')
    annHost.classList.toggle('hidden', parts.length === 0)
  }

  // ------------------------------------------------ opening role locks
  function lockRoles() {
    const order = { barista: 0, supervisor: 1, manager: 2 }
    const state = game.state
    if (!state) return
    const allowed = order[currentRank(state).role]
    const current = state.playerProfile?.role || 'barista'
    document.querySelectorAll('[data-select-role]').forEach((card) => {
      const key = card.getAttribute('data-select-role')
      const locked = order[key] > allowed
      card.classList.toggle('opacity-50', locked)
      card.classList.toggle('grayscale', locked)
      let tag = card.querySelector('[data-lock-tag]')
      if (locked && !tag) {
        tag = document.createElement('div')
        tag.setAttribute('data-lock-tag', '')
        tag.className = 'mt-2 text-[10px] font-extrabold text-amber-300'
        tag.textContent = '🔒 يُفتح بالترقية من تبويب «المسيرة والترقيات» (مهام + شهادات + مقابلة)'
        card.appendChild(tag)
      } else if (!locked && tag) tag.remove()
      const sel = key === current
      card.className = card.className
        .replace(/bg-\[#16382d\]|bg-\[#0b1915\]/g, sel ? 'bg-[#16382d]' : 'bg-[#0b1915]')
        .replace(/border-\[#CBA258\] shadow-lg|border-emerald-800\/70 hover:border-\[#CBA258\]/g, sel ? 'border-[#CBA258] shadow-lg' : 'border-emerald-800/70 hover:border-[#CBA258]')
    })
    const summary = $('openingSelectionSummary')
    if (summary) {
      const rank = RANKS.find((r) => r.role === current) || RANKS[0]
      summary.innerHTML = `📍 الفرع المختار: <strong>${esc(state.activeSubStoreName)}</strong> • المسمى في اللعبة: <strong>${esc(current === currentRank(state).role ? currentRank(state).title : rank.title)}</strong>`
    }
  }

  // ------------------------------------------------ reset dialog wording
  const resetText = $('resetModal')?.querySelector('p')
  if (resetText) resetText.textContent = 'سيتم مسح تقدم الفرع الحالي (الخزنة، الطاقم، الطلبات) والبدء من جديد. مسيرتك المهنية والألف مهمة والشهادات والترقيات محفوظة ولن تتأثر.'

  on('game:started', () => {
    rewriteApkModal()
    lockRoles()
    renderChip()
    renderAnnouncement()
  })
  on('career:promoted', lockRoles)
  on('onboarding:done', renderChip)
  setInterval(renderChip, 5000)

  return { renderChip, renderAnnouncement, openAbout, openProfile, lockRoles }
}
