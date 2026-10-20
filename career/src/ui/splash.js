// The opening screen colleagues see first: Google sign-in on top, or a
// registration with their two-part name, employee ID and job title.
// Resolves once the player presses "start", with who they are.
import { ALL_STORES, INITIAL_BRANCHES } from '../data/branches.js'
import { JOB_TITLES, jobTitleLabel } from '../data/jobTitles.js'
import { authErrorMessage, completeRedirect, googleSignInSupported, signInAsEmployee, signInWithGoogle, signOutEverywhere } from '../platform/auth.js'
import { Cloud } from '../platform/cloud.js'
import { APP_VERSION, compareVersions, isOnlineConfigured } from '../platform/config.js'
import { loadFirebase } from '../platform/firebase.js'
import {
  displayName,
  loadLocalIdentity,
  normalizeEmployeeId,
  normalizeName,
  offlineUid,
  saveLocalIdentity,
  validateEmployeeId,
  validateJobTitle,
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
        لا يُطلب منك أي كلمة سر هنا.
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
      form: { name: '', employeeId: '', job: '', store: '', consent: false },
      fb: null,
      user: null,
      profile: null,
      cloud: null,
      offlineIdentity: null,
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
    }

    function validate({ employeeIdRequired }) {
      const nameErr = validateTwoPartName(ui.form.name)
      if (nameErr) return nameErr
      const idErr = validateEmployeeId(ui.form.employeeId, { required: employeeIdRequired })
      if (idErr) return idErr
      const jobErr = validateJobTitle(ui.form.job)
      if (jobErr) return jobErr
      if (!ui.form.consent) return 'وافق على ظهور اسمك ومسماك في قائمة اللاعبين للمتابعة.'
      return null
    }

    function formFields({ employeeIdRequired, nameReadOnly = false }) {
      return `
        <div class="space-y-2.5">
          <div>
            <label for="sbcName" class="${LABEL_CLS}">الاسم الثنائي</label>
            <input id="sbcName" type="text" autocomplete="name" maxlength="40" ${nameReadOnly ? '' : ''}
              value="${esc(ui.form.name)}" placeholder="مثال: منى عادل" class="${INPUT_CLS}" />
          </div>
          <div>
            <label for="sbcEmployeeId" class="${LABEL_CLS}">الرقم الوظيفي في الشركة ${employeeIdRequired ? '' : '<span class="text-emerald-300/70 font-bold">(اختياري)</span>'}</label>
            <input id="sbcEmployeeId" type="text" dir="ltr" autocomplete="off" maxlength="16"
              value="${esc(ui.form.employeeId)}" placeholder="12345" class="${INPUT_CLS} text-left font-num tracking-wider" />
          </div>
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
        const googleOk = isOnlineConfigured && googleSignInSupported()
        body = `
          ${brandBlock()}
          <button id="sbcGoogleBtn" type="button" ${googleOk && !ui.busy ? '' : 'disabled'}
            class="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-white text-slate-800 text-sm font-black shadow-xl hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed">
            ${GOOGLE_G}<span>الدخول بحساب Google</span>
          </button>
          ${
            !isOnlineConfigured
              ? '<p class="mt-1.5 text-[10px] text-amber-200/80 text-center">الدخول بـ Google والقوائم المباشرة تعمل بعد ربط اللعبة بخادم Firebase — يمكنك اللعب الآن وسيُحفظ تقدمك على جهازك.</p>'
              : !googleSignInSupported()
                ? '<p class="mt-1.5 text-[10px] text-amber-200/80 text-center">الدخول بـ Google غير مفعّل في نسخة الأندرويد هذه — سجّل برقمك الوظيفي أو استخدم نسخة الويب.</p>'
                : ''
          }
          <div class="flex items-center gap-3 my-4 text-[11px] font-extrabold text-emerald-300/80">
            <span class="flex-1 h-px bg-emerald-800"></span><span>أو سجّل ببياناتك الوظيفية</span><span class="flex-1 h-px bg-emerald-800"></span>
          </div>
          <form id="sbcRegisterForm" novalidate>
            ${formFields({ employeeIdRequired: true })}
            ${messageLine(ui.message, ui.messageKind)}
            <button id="sbcRegisterBtn" type="submit" ${ui.busy ? 'disabled' : ''}
              class="mt-3 w-full px-6 py-2.5 rounded-2xl text-sm font-black sb-btn-gold shadow-xl flex items-center justify-center gap-2 disabled:opacity-60">
              ${ui.busy ? '<span class="sbc-spinner sbc-spinner-dark" aria-hidden="true"></span>' : icon('rocket', 'w-4 h-4')}
              <span>${ui.busy ? 'جاري التسجيل…' : 'سجّل وابدأ اللعب'}</span>
            </button>
          </form>`
      } else if (ui.view === 'profile') {
        body = `
          ${brandBlock()}
          <div class="mb-3 p-3 rounded-xl bg-[#0b1915] border border-emerald-700/70 flex items-center gap-2.5">
            ${ui.user?.photoURL ? `<img src="${esc(ui.user.photoURL)}" alt="" class="w-9 h-9 rounded-full border border-[#CBA258]" referrerpolicy="no-referrer" />` : icon('user', 'w-8 h-8 text-[#CBA258]')}
            <div class="text-xs">
              <div class="font-extrabold text-white">${esc(ui.user?.displayName || 'حساب Google')}</div>
              <div class="text-[11px] text-emerald-300/80" dir="ltr">${esc(ui.user?.email || '')}</div>
            </div>
          </div>
          <p class="text-[11px] text-emerald-100/90 mb-2.5">خطوة أخيرة: أكمل بياناتك الوظيفية لتظهر لزملائك في قائمة اللاعبين.</p>
          <form id="sbcProfileForm" novalidate>
            ${formFields({ employeeIdRequired: false })}
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
      const err = validate({ employeeIdRequired: true })
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
      try {
        const user = await signInAsEmployee(ui.fb)
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
        await onContinue()
      } catch (error) {
        console.warn('[splash] register', error)
        ui.busy = false
        const denied = /permission/i.test(error?.message || '') || error?.code === 'PERMISSION_DENIED'
        ui.message = denied
          ? 'الرقم الوظيفي ده مسجّل قبل كده، أو التسجيل مغلق حالياً. لو ده رقمك ادخل بحساب Google اللي ربطته، أو كلّم مسؤول اللعبة.'
          : authErrorMessage(error)
        ui.messageKind = 'error'
        render()
      }
    }

    async function onCompleteProfile(event) {
      event.preventDefault()
      if (ui.busy) return
      readForm()
      const err = validate({ employeeIdRequired: false })
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
          provider: 'google',
          email: ui.user?.email || '',
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
          email: ui.user.email || '',
          photo: ui.user.photoURL || '',
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
