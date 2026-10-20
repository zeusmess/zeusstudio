// The opening screen colleagues see first, with three choices: log in with
// the employee ID and a password, sign in with Google, or register for the
// first time (two-part name, employee ID, password, job title).
// Resolves once the player presses "start", with who they are.
import { ALL_STORES, INITIAL_BRANCHES } from '../data/branches.js'
import { JOB_TITLES, jobTitleLabel } from '../data/jobTitles.js'
import {
  authErrorMessage,
  completeRedirect,
  googleSignInSupported,
  setEmployeePassword,
  signInWithEmployeeId,
  signInWithGoogle,
  signOutEverywhere,
  signUpWithEmployeeId,
} from '../platform/auth.js'
import { Cloud } from '../platform/cloud.js'
import { APP_VERSION, compareVersions, isOnlineConfigured } from '../platform/config.js'
import { cairoDateKey } from '../platform/time.js'
import { loadFirebase } from '../platform/firebase.js'
import {
  displayName,
  employeeIdFromEmail,
  loadLocalIdentity,
  normalizeEmployeeId,
  normalizeName,
  offlineUid,
  saveLocalIdentity,
  validateEmployeeId,
  validateJobTitle,
  validatePassword,
  validateTwoPartName,
} from '../platform/identity.js'
import { esc } from './dom.js'
import { GOOGLE_G, icon } from './icons.js'

const RANK_LABELS = {
  barista: 'باريستا',
  trainer: 'باريستا مدرب',
  supervisor: 'مشرف وردية',
  asm: 'مساعد مدير فرع',
  manager: 'مدير فرع',
  area: 'مدير منطقة فخري',
}

function storeOptions(selected) {
  const groups = INITIAL_BRANCHES.map((region) => {
    const options = region.branchNames
      .map((name) => `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(name)}</option>`)
      .join('')
    return `<optgroup label="${esc(region.dmName)}">${options}</optgroup>`
  }).join('')
  const support = 'Support Center'
  return `<option value="">— الفرع (اختياري) —</option>${groups}<optgroup label="أخرى"><option value="${support}" ${selected === support ? 'selected' : ''}>المكتب الرئيسي (Support Center)</option></optgroup>`
}

function jobOptions(selected) {
  return `<option value="">— اختر مسماك الوظيفي —</option>${JOB_TITLES.map(
    (t) => `<option value="${t.key}" ${t.key === selected ? 'selected' : ''}>${esc(t.label)}</option>`,
  ).join('')}`
}

const INPUT_CLS =
  'w-full bg-[#0b1915] border border-[#CBA258] rounded-xl px-3 py-2.5 text-xs font-extrabold text-white placeholder-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-[#CBA258]/60'
const LABEL_CLS = 'block text-[11px] font-extrabold text-[#CBA258] mb-1'

function brandBlock() {
  return `
    <div class="flex flex-col items-center text-center gap-2 mb-4">
      <div class="sbc-logo-ring">
        <img src="./icons/icon-192.png" alt="" class="w-16 h-16 rounded-full" />
      </div>
      <h2 class="text-lg sm:text-xl font-black text-white tracking-tight">Starbucks Career</h2>
      <p class="text-[11px] text-emerald-200/80 leading-relaxed max-w-sm">
        محاكي مسيرتك المهنية في فروع مصر: <strong class="text-amber-300">75 فرعاً</strong> •
        <strong class="text-amber-300">1000 مهمة صعبة</strong> • ورديات وترقيات ومشاكل حقيقية
      </p>
    </div>`
}

function footerBlock() {
  return `
    <div class="mt-4 pt-3 border-t border-emerald-800/70 text-center space-y-1.5">
      <p class="text-[11px] font-extrabold text-[#CBA258]">powered by Youssef Ayman</p>
      <p class="text-[10px] text-emerald-200/60 leading-relaxed">
        لعبة تدريبية غير رسمية للتسلية والمنافسة بين الزملاء — غير تابعة لشركة ستاربكس أو مجموعة الشايع.
        كلمة السر خاصة باللعبة فقط — ما تستخدمش كلمة سر أي حساب تاني.
      </p>
      <p class="text-[10px] text-emerald-300/50 font-num">v${esc(APP_VERSION)}</p>
    </div>`
}

function messageLine(text, kind = 'error') {
  if (!text) return '<div id="sbcSplashMsg" class="min-h-[1rem]"></div>'
  const tone = kind === 'error' ? 'text-amber-200 border-[#CBA258]' : 'text-emerald-200 border-emerald-500'
  return `<div id="sbcSplashMsg" role="alert" class="mt-2 px-3.5 py-1.5 rounded-full bg-black/85 border ${tone} text-xs font-bold text-center">${kind === 'error' ? '⚠️ ' : ''}${esc(text)}</div>`
}

export function runSplash(root) {
  return new Promise((resolve) => {
    const ui = {
      view: 'loading',
      busy: false,
      message: '',
      messageKind: 'error',
      form: { name: '', employeeId: '', job: '', store: '', consent: false, password: '', password2: '' },
      login: { id: '', password: '' },
      showPassword: false,
      fb: null,
      user: null,
      profile: null,
      cloud: null,
      offlineIdentity: null,
    }

    // Live counters from career/stats (readable before signing in).
    function statsBlock() {
      const st = ui.stats
      if (!isOnlineConfigured || !st) return '<div id="sbcStats"></div>'
      const fresh = Date.now() - (Number(st.updatedAt) || 0) < 5 * 60_000
      const today = st.date === cairoDateKey()
      const tile = (label, value, dot = '') => `
        <div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl px-2 py-2 text-center">
          <div class="text-base font-black font-num text-[#CBA258] flex items-center justify-center gap-1.5">${dot}${Number(value || 0).toLocaleString('en-US')}</div>
          <div class="text-[10px] font-bold text-emerald-200/80">${label}</div>
        </div>`
      return `<div id="sbcStats" class="grid grid-cols-3 gap-2 mb-4">
          ${tile('سجّلوا في اللعبة', st.registered)}
          ${tile('دخلوا النهارده', today ? st.enteredToday : 0)}
          ${tile('نشطين الآن', fresh && today ? st.activeNow : 0, '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>')}
        </div>`
    }
    function updateStats() {
      const el = root.querySelector('#sbcStats')
      if (el) el.outerHTML = statsBlock()
    }

    const setMessage = (text, kind = 'error') => {
      ui.message = text
      ui.messageKind = kind
      const line = root.querySelector('#sbcSplashMsg')
      if (line) line.outerHTML = messageLine(text, kind)
    }

    function readForm() {
      const q = (id) => root.querySelector(id)
      if (q('#sbcName')) ui.form.name = q('#sbcName').value
      if (q('#sbcEmployeeId')) ui.form.employeeId = q('#sbcEmployeeId').value
      if (q('#sbcJob')) ui.form.job = q('#sbcJob').value
      if (q('#sbcStore')) ui.form.store = q('#sbcStore').value
      if (q('#sbcConsent')) ui.form.consent = q('#sbcConsent').checked
      if (q('#sbcPassword')) ui.form.password = q('#sbcPassword').value
      if (q('#sbcPassword2')) ui.form.password2 = q('#sbcPassword2').value
      if (q('#sbcLoginId')) ui.login.id = q('#sbcLoginId').value
      if (q('#sbcLoginPassword')) ui.login.password = q('#sbcLoginPassword').value
    }

    function validate({ employeeIdRequired, passwordRequired = false }) {
      const nameErr = validateTwoPartName(ui.form.name)
      if (nameErr) return nameErr
      const idErr = validateEmployeeId(ui.form.employeeId, { required: employeeIdRequired })
      if (idErr) return idErr
      if (passwordRequired) {
        const pwErr = validatePassword(ui.form.password, ui.form.password2)
        if (pwErr) return pwErr
      }
      const jobErr = validateJobTitle(ui.form.job)
      if (jobErr) return jobErr
      if (!ui.form.consent) return 'وافق على ظهور اسمك ومسماك في قائمة اللاعبين للمتابعة.'
      return null
    }

    function passwordInput(id, value, placeholder, autocomplete) {
      return `<div class="relative">
          <input id="${id}" type="${ui.showPassword ? 'text' : 'password'}" dir="ltr" autocomplete="${autocomplete}" maxlength="64"
            value="${esc(value)}" placeholder="${placeholder}" class="${INPUT_CLS} text-left pl-11" />
          <button type="button" data-toggle-password class="absolute left-2 top-1/2 -translate-y-1/2 px-1.5 py-1 rounded-lg text-[10px] font-extrabold text-emerald-200 hover:text-white">${ui.showPassword ? 'إخفاء' : 'إظهار'}</button>
        </div>`
    }

    function formFields({ employeeIdRequired, withPassword = false, lockedId = '' }) {
      return `
        <div class="space-y-2.5">
          <div>
            <label for="sbcName" class="${LABEL_CLS}">الاسم الثنائي</label>
            <input id="sbcName" type="text" autocomplete="name" maxlength="40"
              value="${esc(ui.form.name)}" placeholder="مثال: منى عادل" class="${INPUT_CLS}" />
          </div>
          <div>
            <label for="sbcEmployeeId" class="${LABEL_CLS}">الرقم الوظيفي في الشركة ${employeeIdRequired ? '' : '<span class="text-emerald-300/70 font-bold">(اختياري)</span>'}</label>
            <input id="sbcEmployeeId" type="text" dir="ltr" autocomplete="username" maxlength="16" ${lockedId ? 'readonly' : ''}
              value="${esc(lockedId || ui.form.employeeId)}" placeholder="12345" class="${INPUT_CLS} text-left font-num tracking-wider ${lockedId ? 'opacity-70' : ''}" />
          </div>
          ${
            withPassword
              ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label for="sbcPassword" class="${LABEL_CLS}">كلمة السر (6 على الأقل)</label>
                    ${passwordInput('sbcPassword', ui.form.password, '••••••', 'new-password')}
                  </div>
                  <div>
                    <label for="sbcPassword2" class="${LABEL_CLS}">تأكيد كلمة السر</label>
                    ${passwordInput('sbcPassword2', ui.form.password2, '••••••', 'new-password')}
                  </div>
                </div>`
              : ''
          }
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label for="sbcJob" class="${LABEL_CLS}">المسمى الوظيفي</label>
              <select id="sbcJob" class="${INPUT_CLS}">${jobOptions(ui.form.job)}</select>
            </div>
            <div>
              <label for="sbcStore" class="${LABEL_CLS}">فرعك</label>
              <select id="sbcStore" class="${INPUT_CLS}">${storeOptions(ui.form.store)}</select>
            </div>
          </div>
          <label class="flex items-start gap-2 text-[11px] text-emerald-100/90 leading-relaxed cursor-pointer">
            <input id="sbcConsent" type="checkbox" class="mt-0.5 w-4 h-4 accent-[#00704A]" ${ui.form.consent ? 'checked' : ''} />
            <span>أوافق على ظهور اسمي الثنائي ومسماي وفرعي في قائمة اللاعبين والترتيب. <strong class="text-amber-300">الرقم الوظيفي لا يراه إلا مسؤول اللعبة.</strong></span>
          </label>
        </div>`
    }

    function render() {
      let body = ''
      if (ui.view === 'loading') {
        body = `
          ${brandBlock()}
          <div class="flex flex-col items-center gap-2 py-6 text-emerald-200 text-xs font-bold">
            <span class="sbc-spinner" aria-hidden="true"></span>
            <span>جاري تجهيز الفرع…</span>
          </div>`
      } else if (ui.view === 'welcome') {
        const online = isOnlineConfigured && !!ui.fb
        const googleOk = online && googleSignInSupported()
        const choice = (id, iconName, title, sub, disabled = false) => `
          <button id="${id}" type="button" ${disabled || ui.busy ? 'disabled' : ''}
            class="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-[#0b1915] border-2 border-[#CBA258]/80 hover:bg-emerald-950 hover:border-[#CBA258] text-right transition disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="w-11 h-11 rounded-full bg-[#00704A] border border-[#CBA258]/70 flex items-center justify-center text-white shrink-0">${icon(iconName, 'w-5 h-5')}</span>
            <span class="min-w-0"><span class="block text-sm font-black text-white">${title}</span><span class="block text-[11px] text-emerald-300/80">${sub}</span></span>
          </button>`
        body = `
          ${brandBlock()}
          ${statsBlock()}
          <div class="space-y-2.5">
            ${choice('sbcChoiceLogin', 'idCard', 'تسجيل الدخول', 'بالرقم الوظيفي وكلمة السر', !online)}
            <button id="sbcGoogleBtn" type="button" ${googleOk && !ui.busy ? '' : 'disabled'}
              class="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-white text-slate-800 text-sm font-black shadow-xl hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed">
              ${GOOGLE_G}<span>الدخول بحساب Google</span>
            </button>
            ${choice('sbcChoiceRegister', 'userPlus', 'أول مرة؟ سجّل حساب جديد', 'الاسم الثنائي والرقم الوظيفي والمسمى وكلمة سر')}
          </div>
          ${
            !isOnlineConfigured
              ? '<p class="mt-2 text-[10px] text-amber-200/80 text-center">وضع بدون إنترنت: سجّل لأول مرة وسيُحفظ تقدمك على هذا الجهاز.</p>'
              : online && !googleSignInSupported()
                ? '<p class="mt-2 text-[10px] text-amber-200/80 text-center">الدخول بـ Google غير مفعّل في نسخة الأندرويد هذه — استخدم الرقم الوظيفي وكلمة السر.</p>'
                : ''
          }
          ${messageLine(ui.message, ui.messageKind)}`
      } else if (ui.view === 'login') {
        body = `
          ${brandBlock()}
          <button type="button" data-back class="mb-3 text-[11px] font-extrabold text-emerald-300 hover:text-white">→ رجوع</button>
          <h3 class="text-sm font-black text-white mb-3">🔑 تسجيل الدخول بالرقم الوظيفي</h3>
          <form id="sbcLoginForm" novalidate class="space-y-2.5">
            <div>
              <label for="sbcLoginId" class="${LABEL_CLS}">الرقم الوظيفي</label>
              <input id="sbcLoginId" type="text" dir="ltr" autocomplete="username" maxlength="16" value="${esc(ui.login.id)}" placeholder="12345" class="${INPUT_CLS} text-left font-num tracking-wider" />
            </div>
            <div>
              <label for="sbcLoginPassword" class="${LABEL_CLS}">كلمة السر</label>
              ${passwordInput('sbcLoginPassword', ui.login.password, '••••••', 'current-password')}
            </div>
            ${messageLine(ui.message, ui.messageKind)}
            <button id="sbcLoginBtn" type="submit" ${ui.busy ? 'disabled' : ''}
              class="w-full px-6 py-2.5 rounded-2xl text-sm font-black sb-btn-gold shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              ${ui.busy ? '<span class="sbc-spinner sbc-spinner-dark" aria-hidden="true"></span>' : icon('coffee', 'w-4 h-4')}
              <span>${ui.busy ? 'جاري الدخول…' : 'دخول'}</span>
            </button>
          </form>
          <p class="mt-3 text-[11px] text-emerald-200/80 text-center leading-relaxed">نسيت كلمة السر؟ كلّم مسؤول اللعبة <strong class="text-[#CBA258]">يوسف أيمن</strong> وهيرجّعلك حسابك بتقدمه.</p>
          <button type="button" data-goto="register" class="mt-2 w-full text-[11px] font-extrabold text-[#CBA258] hover:text-white">مالكش حساب؟ سجّل لأول مرة</button>`
      } else if (ui.view === 'register') {
        const online = isOnlineConfigured && !!ui.fb
        body = `
          ${brandBlock()}
          <button type="button" data-back class="mb-3 text-[11px] font-extrabold text-emerald-300 hover:text-white">→ رجوع</button>
          <h3 class="text-sm font-black text-white mb-3">✨ تسجيل حساب جديد</h3>
          <form id="sbcRegisterForm" novalidate>
            ${formFields({ employeeIdRequired: true, withPassword: online })}
            ${online ? '<p class="mt-2 text-[10px] text-emerald-300/80">هتدخل بعد كده من أي موبايل بالرقم الوظيفي وكلمة السر دي، وتقدمك هيرجعلك زي ما هو.</p>' : ''}
            ${messageLine(ui.message, ui.messageKind)}
            <button id="sbcRegisterBtn" type="submit" ${ui.busy ? 'disabled' : ''}
              class="mt-3 w-full px-6 py-2.5 rounded-2xl text-sm font-black sb-btn-gold shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              ${ui.busy ? '<span class="sbc-spinner sbc-spinner-dark" aria-hidden="true"></span>' : icon('rocket', 'w-4 h-4')}
              <span>${ui.busy ? 'جاري التسجيل…' : 'سجّل وابدأ اللعب'}</span>
            </button>
          </form>
          ${online ? '<button type="button" data-goto="login" class="mt-3 w-full text-[11px] font-extrabold text-[#CBA258] hover:text-white">عندك حساب؟ ادخل بالرقم الوظيفي وكلمة السر</button>' : ''}`
      } else if (ui.view === 'profile') {
        body = `
          ${brandBlock()}
          <div class="mb-3 p-3 rounded-xl bg-[#0b1915] border border-emerald-700/70 flex items-center gap-2.5">
            ${ui.user?.photoURL ? `<img src="${esc(ui.user.photoURL)}" alt="" class="w-9 h-9 rounded-full border border-[#CBA258]" referrerpolicy="no-referrer" />` : icon('user', 'w-8 h-8 text-[#CBA258]')}
            <div class="text-xs">
              <div class="font-extrabold text-white">${esc(ui.user?.displayName || (employeeIdFromEmail(ui.user?.email) ? 'حسابك بالرقم الوظيفي' : 'حساب Google'))}</div>
              <div class="text-[11px] text-emerald-300/80" dir="ltr">${esc(employeeIdFromEmail(ui.user?.email) || ui.user?.email || '')}</div>
            </div>
          </div>
          <p class="text-[11px] text-emerald-100/90 mb-2.5">خطوة أخيرة: أكمل بياناتك الوظيفية لتظهر لزملائك في قائمة اللاعبين.</p>
          <form id="sbcProfileForm" novalidate>
            ${formFields({ employeeIdRequired: !!employeeIdFromEmail(ui.user?.email), lockedId: employeeIdFromEmail(ui.user?.email) })}
            ${messageLine(ui.message, ui.messageKind)}
            <button id="sbcProfileBtn" type="submit" ${ui.busy ? 'disabled' : ''}
              class="mt-3 w-full px-6 py-2.5 rounded-2xl text-sm font-black sb-btn-gold shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              ${ui.busy ? '<span class="sbc-spinner sbc-spinner-dark" aria-hidden="true"></span>' : icon('rocket', 'w-4 h-4')}
              <span>${ui.busy ? 'جاري الحفظ…' : 'حفظ وابدأ اللعب'}</span>
            </button>
          </form>
          <button id="sbcSignOutBtn" type="button" class="mt-2 w-full text-[11px] font-bold text-emerald-300/80 hover:text-white">استخدام حساب آخر</button>`
      } else if (ui.view === 'returning') {
        const pub = ui.profile?.pub || {}
        const priv = ui.profile?.priv || {}
        const isOffline = !!ui.offlineIdentity
        const name = isOffline ? ui.offlineIdentity.name : pub.name || displayName(priv.fullName || '')
        const title = isOffline ? ui.offlineIdentity.jobTitle : pub.title || priv.jobTitle || ''
        const anonymous = !isOffline && ui.user?.isAnonymous
        body = `
          ${brandBlock()}
          ${statsBlock()}
          <div class="p-3.5 rounded-2xl bg-[#0b1915] border-2 border-[#CBA258]/70 text-center space-y-1">
            <div class="text-sm font-black text-white">أهلاً بعودتك يا ${esc(name)} 👋</div>
            <div class="text-[11px] text-emerald-300">${esc(title)}${pub.store ? ` • ${esc(pub.store)}` : ''}</div>
            ${
              !isOffline
                ? `<div class="flex items-center justify-center gap-2 pt-1 text-[11px]">
                    <span class="px-2 py-0.5 rounded bg-emerald-950 text-[#CBA258] border border-[#CBA258]/40 font-extrabold">${esc(RANK_LABELS[pub.rank] || RANK_LABELS.barista)}</span>
                    <span class="px-2 py-0.5 rounded bg-emerald-950 text-amber-300 border border-amber-500/40 font-extrabold font-num">${Number(pub.missionsDone || 0)} / 1000 مهمة</span>
                  </div>`
                : '<div class="text-[10px] text-amber-200/80">وضع بدون إنترنت — تقدمك محفوظ على هذا الجهاز.</div>'
            }
          </div>
          ${messageLine(ui.message, ui.messageKind)}
          <button id="sbcContinueBtn" type="button" ${ui.busy ? 'disabled' : ''}
            class="mt-3 w-full px-6 py-2.5 rounded-2xl text-sm font-black sb-btn-gold shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
            ${ui.busy ? '<span class="sbc-spinner sbc-spinner-dark" aria-hidden="true"></span>' : icon('coffee', 'w-4 h-4')}
            <span>${ui.busy ? 'جاري تحميل تقدمك…' : 'متابعة اللعب'}</span>
          </button>
          ${
            anonymous && priv.employeeId
              ? `<div class="mt-3 p-3 rounded-2xl bg-sky-950/60 border-2 border-sky-500/60">
                  <div class="text-xs font-black text-sky-100">🔐 اعمل كلمة سر لحسابك</div>
                  <p class="text-[10px] text-sky-100/80 mt-0.5 mb-2">عشان تقدر تدخل برقمك الوظيفي <span class="font-num">${esc(priv.employeeId)}</span> من أي موبايل من غير ما تقدمك يضيع.</p>
                  <form id="sbcSetPasswordForm" novalidate class="space-y-2">
                    ${passwordInput('sbcPassword', ui.form.password, 'كلمة السر (6 على الأقل)', 'new-password')}
                    ${passwordInput('sbcPassword2', ui.form.password2, 'تأكيد كلمة السر', 'new-password')}
                    <button id="sbcSetPasswordBtn" type="submit" ${ui.busy ? 'disabled' : ''} class="w-full px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60">حفظ كلمة السر</button>
                  </form>
                </div>`
              : ''
          }
          ${
            anonymous && googleSignInSupported()
              ? `<button id="sbcLinkGoogleBtn" type="button" class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/95 text-slate-800 text-xs font-extrabold hover:bg-white">${GOOGLE_G}<span>اربط حساب Google لتفتح تقدمك من أي جهاز</span></button>`
              : ''
          }
          <button id="sbcSignOutBtn" type="button" class="mt-2 w-full text-[11px] font-bold text-emerald-300/80 hover:text-white flex items-center justify-center gap-1.5">${icon('logout', 'w-3.5 h-3.5')}<span>${isOffline ? 'تغيير اللاعب' : 'تسجيل الخروج'}</span></button>`
      } else if (ui.view === 'blocked') {
        body = `
          ${brandBlock()}
          <div class="p-4 rounded-2xl bg-rose-950/50 border-2 border-rose-500/70 text-center space-y-2">
            <div class="text-sm font-black text-rose-100">${esc(ui.blockTitle || '')}</div>
            <p class="text-[11px] text-rose-100/90 leading-relaxed">${esc(ui.blockText || '')}</p>
            ${ui.blockLink ? `<a href="${esc(ui.blockLink)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl sb-btn-gold text-xs font-black">${icon('download', 'w-4 h-4')}<span>تحميل التحديث</span></a>` : ''}
          </div>
          <button id="sbcSignOutBtn" type="button" class="mt-3 w-full text-[11px] font-bold text-emerald-300/80 hover:text-white">تسجيل الخروج</button>`
      }

      root.innerHTML = `
        <div class="sbc-splash-bg fixed inset-0 z-[60] overflow-y-auto">
          <div class="min-h-full flex items-center justify-center p-3 sm:p-6">
            <div class="sb-card-light w-full max-w-lg rounded-3xl p-4 sm:p-6 border-2 border-[#CBA258] shadow-2xl sbc-rise">
              ${body}
              ${footerBlock()}
            </div>
          </div>
        </div>`
      wire()
    }

    function wire() {
      root.querySelector('#sbcGoogleBtn')?.addEventListener('click', onGoogle)
      root.querySelector('#sbcRegisterForm')?.addEventListener('submit', onRegister)
      root.querySelector('#sbcProfileForm')?.addEventListener('submit', onCompleteProfile)
      root.querySelector('#sbcContinueBtn')?.addEventListener('click', onContinue)
      root.querySelector('#sbcSignOutBtn')?.addEventListener('click', onSignOut)
      root.querySelector('#sbcLinkGoogleBtn')?.addEventListener('click', onGoogle)
      root.querySelector('#sbcLoginForm')?.addEventListener('submit', onLogin)
      root.querySelector('#sbcSetPasswordForm')?.addEventListener('submit', onSetPassword)
      root.querySelector('#sbcChoiceLogin')?.addEventListener('click', () => go('login'))
      root.querySelector('#sbcChoiceRegister')?.addEventListener('click', () => go('register'))
      root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.getAttribute('data-goto'))))
      root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => go('welcome')))
      root.querySelectorAll('[data-toggle-password]').forEach((b) =>
        b.addEventListener('click', () => {
          readForm()
          ui.showPassword = !ui.showPassword
          render()
        }),
      )
    }

    function go(view) {
      readForm()
      ui.view = view
      ui.message = ''
      render()
    }

    async function afterSignIn(user) {
      ui.user = user
      ui.cloud?.dispose()
      ui.cloud = new Cloud(ui.fb, user.uid)
      ui.profile = await ui.cloud.loadProfile()
      if (ui.profile.priv && ui.profile.pub) {
        ui.view = 'returning'
      } else {
        ui.view = 'profile'
        ui.form.name = ui.form.name || normalizeName(user.displayName || '')
        const id = employeeIdFromEmail(user.email)
        if (id) ui.form.employeeId = id
      }
    }

    async function onGoogle() {
      if (ui.busy) return
      readForm()
      ui.busy = true
      setMessage('')
      render()
      try {
        const user = await signInWithGoogle(ui.fb)
        if (!user) return // redirect in progress
        await afterSignIn(user)
        if (ui.profile?.pub && ui.profile?.priv && ui.profile.pub.provider !== 'google') {
          // An employee account was just linked to Google: keep both records in step.
          await ui.cloud.register({
            fullName: ui.profile.priv.fullName,
            publicName: ui.profile.pub.name,
            employeeId: ui.profile.priv.employeeId || '',
            jobTitle: ui.profile.priv.jobTitle,
            store: ui.profile.priv.store || '',
            provider: 'google',
            email: user.email || '',
            photo: user.photoURL || '',
          })
          ui.profile = await ui.cloud.loadProfile()
          ui.message = 'تم ربط حساب Google — تقدمك متاح الآن على أي جهاز.'
          ui.messageKind = 'ok'
        }
      } catch (error) {
        console.warn('[splash] google', error)
        ui.message = authErrorMessage(error)
        ui.messageKind = 'error'
      } finally {
        ui.busy = false
        render()
      }
    }

    async function onRegister(event) {
      event.preventDefault()
      if (ui.busy) return
      readForm()
      const online = isOnlineConfigured && !!ui.fb
      const err = validate({ employeeIdRequired: true, passwordRequired: online })
      if (err) {
        setMessage(err)
        return
      }
      const fullName = normalizeName(ui.form.name)
      const employeeId = normalizeEmployeeId(ui.form.employeeId)
      const jobTitle = jobTitleLabel(ui.form.job)
      if (!isOnlineConfigured || !ui.fb) {
        const identity = {
          uid: offlineUid(),
          provider: 'offline',
          fullName,
          name: displayName(fullName),
          employeeId,
          jobKey: ui.form.job,
          jobTitle,
          store: ui.form.store,
          createdAt: Date.now(),
        }
        saveLocalIdentity(identity)
        finish({ identity, cloud: null, fb: null, isAdmin: false, moderation: {}, config: {} })
        return
      }
      ui.busy = true
      setMessage('')
      render()
      let user = null
      try {
        user = await signUpWithEmployeeId(ui.fb, employeeId, ui.form.password)
      } catch (error) {
        console.warn('[splash] sign-up', error)
        ui.busy = false
        ui.message = authErrorMessage(error)
        ui.messageKind = 'error'
        render()
        return
      }
      try {
        ui.user = user
        ui.cloud?.dispose()
        ui.cloud = new Cloud(ui.fb, user.uid)
        await ui.cloud.register({
          fullName,
          publicName: displayName(fullName),
          employeeId,
          jobTitle,
          store: ui.form.store,
          provider: 'employee',
        })
        ui.profile = await ui.cloud.loadProfile()
        ui.busy = false
        ui.form.password = ui.form.password2 = ''
        await onContinue()
      } catch (error) {
        console.warn('[splash] register', error)
        const denied = /permission/i.test(error?.message || '') || error?.code === 'PERMISSION_DENIED'
        // The ID belongs to an older account: do not keep a login that cannot hold it.
        if (denied) {
          try {
            await user.delete()
          } catch {
            await signOutEverywhere(ui.fb).catch(() => {})
          }
          ui.user = null
          ui.cloud?.dispose()
          ui.cloud = null
        }
        ui.busy = false
        ui.message = denied
          ? 'الرقم الوظيفي ده مسجّل بحساب تاني (أو التسجيل مقفول حالياً). لو ده رقمك ونسيت كلمة السر، كلّم مسؤول اللعبة.'
          : authErrorMessage(error)
        ui.messageKind = 'error'
        render()
      }
    }

    async function onLogin(event) {
      event.preventDefault()
      if (ui.busy) return
      readForm()
      const idErr = validateEmployeeId(ui.login.id, { required: true })
      if (idErr) return setMessage(idErr)
      if (!ui.login.password) return setMessage('اكتب كلمة السر.')
      ui.busy = true
      setMessage('')
      render()
      try {
        const user = await signInWithEmployeeId(ui.fb, normalizeEmployeeId(ui.login.id), ui.login.password)
        await afterSignIn(user)
        ui.login.password = ''
        ui.busy = false
        if (ui.view === 'returning') {
          await onContinue()
          return
        }
      } catch (error) {
        console.warn('[splash] login', error)
        ui.message = authErrorMessage(error)
        ui.messageKind = 'error'
      }
      ui.busy = false
      render()
    }

    async function onSetPassword(event) {
      event.preventDefault()
      if (ui.busy) return
      readForm()
      const err = validatePassword(ui.form.password, ui.form.password2)
      if (err) return setMessage(err)
      const employeeId = ui.profile?.priv?.employeeId
      if (!employeeId) return
      ui.busy = true
      setMessage('')
      render()
      try {
        ui.user = await setEmployeePassword(ui.fb, employeeId, ui.form.password)
        ui.form.password = ui.form.password2 = ''
        ui.message = `تم ✅ — تقدر تدخل دلوقتي من أي موبايل برقمك ${employeeId} وكلمة السر دي.`
        ui.messageKind = 'ok'
      } catch (error) {
        console.warn('[splash] set password', error)
        ui.message =
          error?.code === 'auth/email-already-in-use' || error?.code === 'auth/credential-already-in-use'
            ? 'الرقم الوظيفي ده عليه كلمة سر لحساب تاني. كلّم مسؤول اللعبة.'
            : authErrorMessage(error)
        ui.messageKind = 'error'
      }
      ui.busy = false
      render()
    }

    async function onCompleteProfile(event) {
      event.preventDefault()
      if (ui.busy) return
      readForm()
      const lockedId = employeeIdFromEmail(ui.user?.email)
      if (lockedId) ui.form.employeeId = lockedId
      const err = validate({ employeeIdRequired: !!lockedId })
      if (err) {
        setMessage(err)
        return
      }
      ui.busy = true
      setMessage('')
      render()
      try {
        const fullName = normalizeName(ui.form.name)
        await ui.cloud.register({
          fullName,
          publicName: displayName(fullName),
          employeeId: normalizeEmployeeId(ui.form.employeeId),
          jobTitle: jobTitleLabel(ui.form.job),
          store: ui.form.store,
          provider: lockedId ? 'employee' : 'google',
          email: lockedId ? '' : ui.user?.email || '',
          photo: ui.user?.photoURL || '',
        })
        ui.profile = await ui.cloud.loadProfile()
        ui.busy = false
        await onContinue()
      } catch (error) {
        console.warn('[splash] profile', error)
        ui.busy = false
        const denied = /permission/i.test(error?.message || '')
        ui.message = denied ? 'الرقم الوظيفي ده مسجّل لزميل آخر. راجع الرقم أو اتركه فارغاً.' : authErrorMessage(error)
        ui.messageKind = 'error'
        render()
      }
    }

    async function onContinue() {
      if (ui.offlineIdentity) {
        finish({ identity: ui.offlineIdentity, cloud: null, fb: null, isAdmin: false, moderation: {}, config: {} })
        return
      }
      if (!ui.cloud || !ui.profile?.pub) return
      ui.busy = true
      render()
      try {
        const config = (await ui.cloud.get('career/config').catch(() => null)) || {}
        const { pub, priv, isAdmin, moderation } = ui.profile
        if (moderation?.banned && !isAdmin) {
          return block('تم إيقاف حسابك', 'تم إيقاف هذا الحساب بواسطة مسؤول اللعبة. للاستفسار تواصل معه مباشرة.')
        }
        if (config.minVersion && compareVersions(APP_VERSION, config.minVersion) < 0) {
          return block('يوجد تحديث مطلوب', `نسختك ${APP_VERSION} قديمة. حمّل النسخة الجديدة (${config.minVersion} أو أحدث) لمتابعة اللعب.`, config.apkUrl || config.webUrl || '')
        }
        if (config.maintenance && !isAdmin) {
          return block('اللعبة في صيانة الآن', config.maintenanceText || 'نعمل على تحديث جديد. ارجع بعد قليل.')
        }
        const identity = {
          uid: ui.user.uid,
          provider: pub.provider || (ui.user.isAnonymous ? 'employee' : 'google'),
          fullName: priv?.fullName || pub.name,
          name: pub.name,
          employeeId: priv?.employeeId || '',
          jobTitle: pub.title || priv?.jobTitle || '',
          store: pub.store || priv?.store || '',
          email: employeeIdFromEmail(ui.user.email) ? '' : ui.user.email || '',
          photo: ui.user.photoURL || '',
          anonymous: !!ui.user.isAnonymous,
        }
        finish({ identity, cloud: ui.cloud, fb: ui.fb, isAdmin, moderation, config })
      } catch (error) {
        console.warn('[splash] continue', error)
        ui.busy = false
        ui.message = 'تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'
        render()
      }
    }

    function block(title, text, link = '') {
      ui.busy = false
      ui.view = 'blocked'
      ui.blockTitle = title
      ui.blockText = text
      ui.blockLink = link
      render()
    }

    async function onSignOut() {
      if (ui.offlineIdentity) {
        saveLocalIdentity(null)
        ui.offlineIdentity = null
        ui.view = 'welcome'
        render()
        return
      }
      try {
        if (ui.fb) await signOutEverywhere(ui.fb)
      } catch (error) {
        console.warn('[splash] sign out', error)
      }
      ui.cloud?.dispose()
      ui.cloud = null
      ui.user = null
      ui.profile = null
      ui.view = 'welcome'
      ui.message = ''
      render()
    }

    function finish(result) {
      try {
        ui.statsOff?.()
      } catch {
        // already detached
      }
      root.querySelector('.sbc-splash-bg')?.classList.add('sbc-fade-out')
      setTimeout(() => {
        root.innerHTML = ''
        resolve(result)
      }, 320)
    }

    // ---------------------------------------------------------------- boot
    render()
    ;(async () => {
      if (!isOnlineConfigured) {
        const local = loadLocalIdentity()
        if (local && local.provider === 'offline') {
          ui.offlineIdentity = local
          ui.view = 'returning'
        } else {
          ui.view = 'welcome'
        }
        render()
        return
      }
      ui.fb = await loadFirebase()
      if (!ui.fb) {
        ui.view = 'welcome'
        ui.message = 'تعذّر تحميل خدمات الدخول. تأكد من الإنترنت ثم أعد فتح اللعبة.'
        render()
        return
      }
      try {
        ui.statsOff = ui.fb.D.onValue(
          ui.fb.D.ref(ui.fb.db, 'career/stats'),
          (snap) => {
            ui.stats = snap.val()
            updateStats()
          },
          () => {},
        )
      } catch (error) {
        console.warn('[splash] stats', error)
      }
      await completeRedirect(ui.fb)
      const user = await new Promise((done) => {
        const off = ui.fb.A.onAuthStateChanged(ui.fb.auth, (u) => {
          off()
          done(u)
        })
      })
      if (user) {
        try {
          await afterSignIn(user)
        } catch (error) {
          console.warn('[splash] profile load', error)
          ui.view = 'welcome'
          ui.message = 'تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'
        }
      } else {
        ui.view = 'welcome'
      }
      render()
    })()
  })
}

export { ALL_STORES }
