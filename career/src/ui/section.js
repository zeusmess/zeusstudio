// Tinted section cards inside a tab (the SectionCard pattern of the Ops tab).

// Full class names (Tailwind only generates classes it can find written out).
export const TONES = {
  emerald: { box: 'border-emerald-700/60 bg-emerald-950/35', title: 'text-emerald-200', text: 'text-emerald-100/80' },
  amber: { box: 'border-amber-600/60 bg-amber-950/35', title: 'text-amber-200', text: 'text-amber-100/80' },
  sky: { box: 'border-sky-700/60 bg-sky-950/35', title: 'text-sky-200', text: 'text-sky-100/80' },
  purple: { box: 'border-purple-700/60 bg-purple-950/35', title: 'text-purple-200', text: 'text-purple-100/80' },
  rose: { box: 'border-rose-700/60 bg-rose-950/35', title: 'text-rose-200', text: 'text-rose-100/80' },
  indigo: { box: 'border-indigo-700/60 bg-indigo-950/35', title: 'text-indigo-200', text: 'text-indigo-100/80' },
  teal: { box: 'border-teal-700/60 bg-teal-950/35', title: 'text-teal-200', text: 'text-teal-100/80' },
}

export function section(title, subtitle, body, tone = 'emerald', right = '') {
  const t = TONES[tone] || TONES.emerald
  return `
    <div class="border-2 ${t.box} rounded-2xl p-3.5">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 class="text-sm font-extrabold ${t.title} flex items-center gap-1.5">${title}</h4>
        ${right}
      </div>
      ${subtitle ? `<p class="text-[11px] ${t.text} mb-2.5">${subtitle}</p>` : ''}
      ${body}
    </div>`
}

export function pill(text, cls) {
  return `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${cls}">${text}</span>`
}
