// The game's modal frame (overlay, gold-bordered card, title row and the
// "✕ إغلاق" pill), used by every new dialog.
import { esc } from './dom.js'

let openCount = 0

export function anyModalOpen() {
  if (openCount > 0) return true
  // offsetParent is always null for fixed elements, so ask for boxes instead.
  return [...document.querySelectorAll('.fixed.inset-0.z-50')].some((el) => !el.classList.contains('hidden') && el.getClientRects().length > 0)
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.subtitle]
 * @param {'md'|'lg'|'xl'} [o.size]
 * @param {boolean} [o.closable] — false for decisions that must be taken
 * @param {string} [o.tone] — 'gold' (default) | 'rose'
 * @returns {{ el: HTMLElement, body: HTMLElement, setBody(html: string): void, setTitle(t: string): void, close(): void, onClose(fn): void }}
 */
export function openModal({ title, subtitle = '', size = 'md', closable = true, tone = 'gold' } = {}) {
  const width = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  const border = tone === 'rose' ? 'border-rose-400' : 'border-[#CBA258]'
  const overlay = document.createElement('div')
  overlay.className = 'sbc-modal fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto'
  overlay.innerHTML = `
    <div class="sb-card-light ${width} w-full rounded-2xl p-4 sm:p-5 border-2 ${border} shadow-2xl max-h-[92vh] overflow-y-auto sbc-rise" role="dialog" aria-modal="true">
      <div class="flex flex-wrap items-start justify-between gap-2 border-b border-emerald-800 pb-3 mb-3">
        <div class="min-w-0">
          <h3 class="text-base font-extrabold text-[#CBA258] flex items-center gap-2" data-modal-title>${esc(title)}</h3>
          ${subtitle ? `<p class="text-xs text-emerald-200 mt-0.5" data-modal-subtitle>${esc(subtitle)}</p>` : ''}
        </div>
        ${closable ? '<button type="button" data-modal-close class="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white shrink-0">✕ إغلاق</button>' : ''}
      </div>
      <div data-modal-body></div>
    </div>`
  document.body.appendChild(overlay)
  openCount += 1
  const body = overlay.querySelector('[data-modal-body]')
  const closers = []
  let closed = false
  const api = {
    el: overlay,
    body,
    setBody(html) {
      body.innerHTML = html
    },
    setTitle(t) {
      overlay.querySelector('[data-modal-title]').textContent = t
    },
    close() {
      if (closed) return
      closed = true
      openCount = Math.max(0, openCount - 1)
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      closers.forEach((fn) => fn())
    },
    onClose(fn) {
      closers.push(fn)
    },
    get closed() {
      return closed
    },
  }
  const onKey = (e) => {
    if (e.key === 'Escape' && closable) api.close()
  }
  document.addEventListener('keydown', onKey)
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) api.close()
    else if (e.target === overlay && closable) api.close()
  })
  return api
}
