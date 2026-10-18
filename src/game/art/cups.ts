import { svgDocument } from './svg'

/**
 * Original cup illustrations. Used by the brand-free edition
 * (VITE_BRAND_ASSETS=off) and for menu decoration and icons.
 */
export type OriginalCupId = 'latte' | 'iced' | 'frappe' | 'matcha' | 'pink' | 'golden' | 'special'

export const ORIGINAL_NORMAL_CUPS: readonly OriginalCupId[] = ['latte', 'iced', 'frappe', 'matcha', 'pink']

export const CUP_VIEWBOX = { width: 100, height: 140 }

function star(cx: number, cy: number, r: number, fill: string, inner = 0.45): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

const shadow = '<ellipse cx="50" cy="134" rx="24" ry="4" fill="#000" opacity="0.22"/>'

function hotCup(o: { cup: [string, string]; lid: string; lidShade: string; sleeve: string; emblem: string; mark: string }) {
  return `
  <defs>
    <linearGradient id="cupBody" x1="0" x2="1">
      <stop offset="0" stop-color="${o.cup[1]}"/><stop offset="0.35" stop-color="${o.cup[0]}"/>
      <stop offset="0.7" stop-color="${o.cup[0]}"/><stop offset="1" stop-color="${o.cup[1]}"/>
    </linearGradient>
    <clipPath id="cupClip"><path d="M23 38 L77 38 L69 130 Q68 132 66 132 L34 132 Q32 132 31 130 Z"/></clipPath>
  </defs>
  ${shadow}
  <path d="M23 38 L77 38 L69 130 Q68 132 66 132 L34 132 Q32 132 31 130 Z" fill="url(#cupBody)"/>
  <g clip-path="url(#cupClip)">
    <rect x="0" y="84" width="100" height="30" fill="${o.sleeve}"/>
    <rect x="0" y="84" width="100" height="2" fill="#fff" opacity="0.25"/>
    <rect x="0" y="112" width="100" height="2" fill="#000" opacity="0.15"/>
  </g>
  <circle cx="50" cy="64" r="13" fill="${o.emblem}"/>
  <circle cx="50" cy="64" r="10.2" fill="none" stroke="${o.mark}" stroke-width="1.4" opacity="0.9"/>
  ${star(50, 64.5, 6.8, o.mark)}
  <rect x="18" y="29" width="64" height="11" rx="5" fill="${o.lid}"/>
  <rect x="18" y="36" width="64" height="4" rx="2" fill="${o.lidShade}"/>
  <path d="M26 29 Q30 19 50 19 Q70 19 74 29 Z" fill="${o.lid}"/>
  <path d="M30 27 Q35 22 50 22" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>
  <path d="M30 44 L34 122" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`
}

function coldCup(o: {
  drink: [string, string]
  top?: string
  topHeight?: number
  extras?: string
  straw: string
  dome?: boolean
  cream?: boolean
}) {
  const topHeight = o.topHeight ?? 0
  return `
  <defs>
    <linearGradient id="drink" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${o.drink[0]}"/><stop offset="1" stop-color="${o.drink[1]}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.05"/>
      <stop offset="0.8" stop-color="#fff" stop-opacity="0.04"/><stop offset="1" stop-color="#fff" stop-opacity="0.3"/>
    </linearGradient>
    <clipPath id="cupClip"><path d="M21 38 L79 38 L70 130 Q69 132 67 132 L33 132 Q31 132 30 130 Z"/></clipPath>
  </defs>
  ${shadow}
  <rect x="58" y="${o.dome ? 2 : 10}" width="6" height="${o.dome ? 52 : 44}" rx="3" fill="${o.straw}" transform="rotate(14 61 40)"/>
  <g clip-path="url(#cupClip)">
    <rect x="0" y="${44 + topHeight}" width="100" height="100" fill="url(#drink)"/>
    ${o.top ? `<rect x="0" y="44" width="100" height="${topHeight + 1}" fill="${o.top}"/>` : ''}
    ${o.extras ?? ''}
  </g>
  <path d="M21 38 L79 38 L70 130 Q69 132 67 132 L33 132 Q31 132 30 130 Z" fill="url(#glass)" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5"/>
  ${
    o.cream
      ? `<path d="M22 40 Q20 26 34 26 Q36 14 50 15 Q64 14 66 26 Q80 26 78 40 Z" fill="#fbf6ec"/>
         <path d="M30 30 Q40 34 50 28 Q60 34 70 30" fill="none" stroke="#c98a3c" stroke-width="2.6" stroke-linecap="round"/>
         <path d="M34 24 Q44 27 52 22" fill="none" stroke="#c98a3c" stroke-width="2.2" stroke-linecap="round"/>`
      : ''
  }
  <rect x="17" y="33" width="66" height="8" rx="4" fill="#ffffff" fill-opacity="0.85"/>
  ${o.dome ? '<path d="M22 34 Q24 14 50 13 Q76 14 78 34 Z" fill="#fff" fill-opacity="0.22" stroke="#fff" stroke-opacity="0.6" stroke-width="1.2"/>' : ''}
  <circle cx="50" cy="86" r="11" fill="#f2f0eb" fill-opacity="0.9"/>
  ${star(50, 86.5, 6, '#00704a')}
  <path d="M27 46 L32 122" stroke="#fff" stroke-opacity="0.5" stroke-width="2.5" stroke-linecap="round"/>`
}

const ice = `
  <rect x="28" y="50" width="14" height="13" rx="3" fill="#fff" fill-opacity="0.38" transform="rotate(-12 35 56)"/>
  <rect x="47" y="47" width="15" height="14" rx="3" fill="#fff" fill-opacity="0.32" transform="rotate(9 54 54)"/>
  <rect x="38" y="62" width="13" height="12" rx="3" fill="#fff" fill-opacity="0.28" transform="rotate(20 44 68)"/>`

const BODIES: Record<OriginalCupId, () => string> = {
  latte: () =>
    hotCup({
      cup: ['#fdfbf6', '#e3dccd'],
      lid: '#ffffff',
      lidShade: '#ddd5c4',
      sleeve: '#b5804e',
      emblem: '#00704a',
      mark: '#f2f0eb',
    }),
  golden: () =>
    hotCup({
      cup: ['#f6dc96', '#b8862f'],
      lid: '#fff6dc',
      lidShade: '#e2c47e',
      sleeve: '#1e3932',
      emblem: '#1e3932',
      mark: '#f6dc96',
    }) +
    `${star(22, 52, 5, '#fffbe8', 0.3)}${star(78, 100, 4, '#fffbe8', 0.3)}${star(70, 48, 3, '#fffbe8', 0.3)}`,
  iced: () =>
    coldCup({
      drink: ['#c98d55', '#4a2a17'],
      top: '#f4e4cc',
      topHeight: 8,
      extras: ice + '<path d="M22 70 Q40 62 56 74 T80 72" fill="none" stroke="#f4e4cc" stroke-opacity="0.7" stroke-width="5"/>',
      straw: '#00704a',
    }),
  frappe: () =>
    coldCup({
      drink: ['#d9a46a', '#8d5428'],
      extras: '<path d="M22 64 Q50 56 80 66" fill="none" stroke="#6b3a1b" stroke-opacity="0.35" stroke-width="3"/>',
      straw: '#00704a',
      dome: true,
      cream: true,
    }),
  matcha: () =>
    coldCup({
      drink: ['#9fcf7c', '#5c9a45'],
      top: '#f7f2e6',
      topHeight: 12,
      extras: ice,
      straw: '#00704a',
    }),
  pink: () =>
    coldCup({
      drink: ['#f6a3c2', '#d94c86'],
      extras:
        ice +
        '<path d="M60 88 q8 -2 10 6 q-5 7 -12 2 z" fill="#e2384d"/><path d="M33 100 q8 -2 10 6 q-5 7 -12 2 z" fill="#e2384d"/>' +
        '<circle cx="63" cy="92" r="0.9" fill="#ffe08a"/><circle cx="36" cy="104" r="0.9" fill="#ffe08a"/>',
      straw: '#2b9a6c',
    }),
  special: () => `
  <defs>
    <linearGradient id="crystal" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ffd6ec"/><stop offset="0.45" stop-color="#c79bff"/><stop offset="1" stop-color="#6fd6e8"/>
    </linearGradient>
    <clipPath id="cupClip"><path d="M24 38 L76 38 L72 130 Q71 132 69 132 L31 132 Q29 132 28 130 Z"/></clipPath>
  </defs>
  ${shadow}
  <rect x="47" y="0" width="6" height="40" rx="3" fill="#f2f0eb"/>
  ${star(50, 9, 10, '#e3c88a')}
  <path d="M24 38 L76 38 L72 130 Q71 132 69 132 L31 132 Q29 132 28 130 Z" fill="url(#crystal)"/>
  <g clip-path="url(#cupClip)" fill="#fff">
    ${Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 6 }, (_, col) => {
        const x = 22 + col * 11 + (row % 2) * 5.5
        const y = 44 + row * 11
        return `<path d="M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y} Z" fill-opacity="${0.18 + ((row + col) % 3) * 0.12}"/>`
      }).join(''),
    ).join('')}
  </g>
  <rect x="20" y="31" width="60" height="9" rx="4.5" fill="#f2f0eb"/>
  <path d="M30 46 L33 124" stroke="#fff" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round"/>`,
}

export function originalCupSvg(id: OriginalCupId, width?: number): string {
  const height = width ? Math.round((width * CUP_VIEWBOX.height) / CUP_VIEWBOX.width) : undefined
  return svgDocument(`0 0 ${CUP_VIEWBOX.width} ${CUP_VIEWBOX.height}`, BODIES[id](), width, height)
}

/** The obstacle: a smouldering burnt bean — a different silhouette from every cup. */
export function burntBeanSvg(width?: number): string {
  const body = `
  <defs>
    <radialGradient id="ember" cx="50%" cy="55%" r="60%">
      <stop offset="0" stop-color="#ff7a3d" stop-opacity="0.85"/><stop offset="1" stop-color="#ff3d2e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bean" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#5a3a2a"/><stop offset="0.6" stop-color="#26150d"/><stop offset="1" stop-color="#120905"/>
    </radialGradient>
  </defs>
  <path d="M38 22 C30 12 40 4 36 -4" fill="none" stroke="#8d8d8d" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round"/>
  <path d="M60 24 C70 14 58 8 64 -2" fill="none" stroke="#9a9a9a" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="62" r="40" fill="url(#ember)"/>
  <ellipse cx="50" cy="62" rx="27" ry="34" fill="url(#bean)" stroke="#ff6a3d" stroke-width="3" transform="rotate(-18 50 62)"/>
  <path d="M44 32 C60 46 38 66 56 92" fill="none" stroke="#ff8a4a" stroke-width="4.5" stroke-linecap="round" transform="rotate(-18 50 62)"/>
  <path d="M44 32 C60 46 38 66 56 92" fill="none" stroke="#ffd2a6" stroke-width="1.4" stroke-linecap="round" transform="rotate(-18 50 62)"/>
  <path d="M28 48 Q32 40 40 38" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round"/>`
  const height = width
  return svgDocument('0 -6 100 106', body, width, height)
}
