// Who is playing: validation of the registration form and the identity kept on
// the device. Pure functions here are unit-tested.
import { JOB_TITLES } from '../data/jobTitles.js'

const IDENTITY_KEY = 'sbc_identity_v1'

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

/** Arabic-Indic and Persian digits become 0-9, everything else is unchanged. */
export function toLatinDigits(text) {
  return String(text || '').replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d)
    return String(i >= 0 ? i : PERSIAN.indexOf(d))
  })
}

export function normalizeName(text) {
  return String(text || '')
    .replace(/[ـ]/g, '') // tatweel
    .replace(/\s+/g, ' ')
    .trim()
}

// Letters of Arabic (with its diacritics) or Latin script, plus an apostrophe or hyphen inside a word.
const NAME_WORD = /^[ء-ي٠-٩ٮ-ۓۺ-ۿA-Za-z][ء-ْٮ-ۓۺ-ۿA-Za-z'-]*$/

/** @returns {string|null} an error message in Arabic, or null when the name is a valid two-part name */
export function validateTwoPartName(raw) {
  const name = normalizeName(raw)
  if (!name) return 'اكتب اسمك الثنائي (الاسم الأول واسم الأب أو العائلة).'
  if (name.length > 40) return 'الاسم طويل جداً — 40 حرفاً بحد أقصى.'
  const words = name.split(' ')
  if (words.length < 2) return 'اكتب اسمك الثنائي: كلمتان على الأقل (مثال: منى عادل).'
  if (words.length > 4) return 'يكفي الاسم الثنائي أو الثلاثي.'
  for (const word of words) {
    if (!NAME_WORD.test(word)) return 'الاسم يقبل الحروف العربية أو الإنجليزية فقط.'
    if (word.replace(/['-]/g, '').length < 2) return 'كل جزء من الاسم يجب أن يكون حرفين على الأقل.'
  }
  return null
}

export function normalizeEmployeeId(raw) {
  return toLatinDigits(raw).toUpperCase().replace(/[\s\-_.]/g, '')
}

/** @returns {string|null} */
export function validateEmployeeId(raw, { required = true } = {}) {
  const id = normalizeEmployeeId(raw)
  if (!id) return required ? 'اكتب رقمك الوظيفي في الشركة.' : null
  if (!/^[A-Z0-9]{3,12}$/.test(id)) return 'الرقم الوظيفي من 3 إلى 12 رقماً أو حرفاً إنجليزياً بدون رموز.'
  return null
}

/** @returns {string|null} */
export function validateJobTitle(key) {
  return JOB_TITLES.some((t) => t.key === key) ? null : 'اختر مسماك الوظيفي.'
}

/** Short public name for lists: first two words. */
export function displayName(fullName) {
  return normalizeName(fullName).split(' ').slice(0, 2).join(' ')
}

export function loadLocalIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.uid === 'string' && typeof parsed.name === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function saveLocalIdentity(identity) {
  try {
    if (identity) localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
    else localStorage.removeItem(IDENTITY_KEY)
  } catch {
    // Private mode or storage disabled: the identity lives for this session only.
  }
}

export function offlineUid() {
  const rand = Math.random().toString(36).slice(2, 10)
  return `offline-${Date.now().toString(36)}-${rand}`
}
