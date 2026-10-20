// Small DOM helpers shared by the new screens.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Everything a player typed (names, stores…) goes through this before innerHTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

export function $(id) {
  return document.getElementById(id)
}

/** Replaces the children only when the markup changed, so taps are never lost to a re-render. */
export function setHtml(el, html) {
  if (!el || el._sbcHtml === html) return
  el.innerHTML = html
  el._sbcHtml = html
}

export function show(el, visible = true) {
  if (!el) return
  el.classList.toggle('hidden', !visible)
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-US')
}

export function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
