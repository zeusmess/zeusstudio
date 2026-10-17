import type { AvatarId } from '../../types'
import { svgDocument } from './svg'

function star(cx: number, cy: number, r: number, fill: string, inner = 0.45): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

/** Original circular emblem: a cup in a green seal with a gold star. Not the Starbucks logo. */
export function emblemSvg(size?: number): string {
  const body = `
  <defs>
    <radialGradient id="seal" cx="50%" cy="40%" r="65%">
      <stop offset="0" stop-color="#0b8a5a"/><stop offset="1" stop-color="#00573a"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="98" fill="#0b2b22"/>
  <circle cx="100" cy="100" r="90" fill="url(#seal)"/>
  <circle cx="100" cy="100" r="82" fill="none" stroke="#f2f0eb" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
  ${star(100, 42, 15, '#e3c88a')}
  <path d="M84 62 Q80 52 88 46" fill="none" stroke="#f2f0eb" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round"/>
  <path d="M116 62 Q120 52 112 46" fill="none" stroke="#f2f0eb" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round"/>
  <path d="M70 76 L130 76 L121 150 Q120 154 116 154 L84 154 Q80 154 79 150 Z" fill="#fbf8f2"/>
  <rect x="64" y="66" width="72" height="13" rx="6.5" fill="#fbf8f2"/>
  <rect x="64" y="74" width="72" height="5" rx="2.5" fill="#d9cdb6"/>
  <path d="M75 108 L125 108 L122 132 L78 132 Z" fill="#b5804e"/>
  <circle cx="100" cy="94" r="9" fill="#00704a"/>
  ${star(100, 94.5, 5, '#f2f0eb')}
  <path d="M60 160 Q100 182 140 160" fill="none" stroke="#e3c88a" stroke-width="5" stroke-linecap="round"/>`
  return svgDocument('0 0 200 200', body, size, size)
}

const AVATAR_ART: Record<AvatarId, { bg: string; art: string }> = {
  'hot-cup': {
    bg: '#00704a',
    art: `<path d="M36 40 L64 40 L60 80 L40 80 Z" fill="#fbf8f2"/><rect x="32" y="33" width="36" height="8" rx="4" fill="#fff"/>
      <rect x="36" y="56" width="28" height="12" fill="#b5804e"/><path d="M44 26 Q40 20 46 15 M56 26 Q52 20 58 15" stroke="#f2f0eb" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  'iced-coffee': {
    bg: '#c98d55',
    art: `<rect x="56" y="14" width="5" height="30" rx="2.5" fill="#00704a" transform="rotate(14 58 30)"/>
      <path d="M34 36 L66 36 L61 82 L39 82 Z" fill="#5a3218"/><path d="M34 36 L66 36 L64 50 L36 50 Z" fill="#f4e4cc"/>
      <path d="M34 36 L66 36 L61 82 L39 82 Z" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="2"/>`,
  },
  frappe: {
    bg: '#f2c38a',
    art: `<path d="M35 44 L65 44 L60 84 L40 84 Z" fill="#9b5f30"/>
      <path d="M33 46 Q31 34 41 34 Q43 24 50 24 Q57 24 59 34 Q69 34 67 46 Z" fill="#fff"/>
      <path d="M38 38 Q50 44 62 38" stroke="#c98a3c" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  matcha: {
    bg: '#5c9a45',
    art: `<path d="M34 36 L66 36 L61 82 L39 82 Z" fill="#a8d888"/><path d="M34 36 L66 36 L64 48 L36 48 Z" fill="#fbf6ec"/>
      <path d="M34 36 L66 36 L61 82 L39 82 Z" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="2"/>`,
  },
  'pink-drink': {
    bg: '#f07fa6',
    art: `<rect x="56" y="14" width="5" height="30" rx="2.5" fill="#2b9a6c" transform="rotate(14 58 30)"/>
      <path d="M34 36 L66 36 L61 82 L39 82 Z" fill="#f9c1d6"/><circle cx="46" cy="62" r="5" fill="#e2384d"/><circle cx="56" cy="72" r="4" fill="#e2384d"/>
      <path d="M34 36 L66 36 L61 82 L39 82 Z" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="2"/>`,
  },
  bean: {
    bg: '#4a2c1d',
    art: `<ellipse cx="50" cy="50" rx="20" ry="27" fill="#a0673d" transform="rotate(-20 50 50)"/>
      <path d="M45 26 C58 38 40 56 55 74" stroke="#4a2c1d" stroke-width="5" fill="none" stroke-linecap="round" transform="rotate(-20 50 50)"/>`,
  },
  croissant: {
    bg: '#e9c46a',
    art: `<path d="M18 62 Q50 18 82 62 Q74 70 66 62 Q50 40 34 62 Q26 70 18 62 Z" fill="#c98a3c"/>
      <path d="M36 50 L42 62 M50 42 L50 58 M64 50 L58 62" stroke="#8d5428" stroke-width="3" stroke-linecap="round"/>`,
  },
  'cake-pop': {
    bg: '#f6a3c2',
    art: `<rect x="47" y="52" width="6" height="36" rx="3" fill="#fbf8f2"/><circle cx="50" cy="40" r="20" fill="#e2578f"/>
      <rect x="40" y="30" width="6" height="2.5" rx="1" fill="#fff" transform="rotate(30 43 31)"/><rect x="54" y="34" width="6" height="2.5" rx="1" fill="#ffe08a" transform="rotate(-20 57 35)"/>
      <rect x="46" y="44" width="6" height="2.5" rx="1" fill="#7fd1c7" transform="rotate(60 49 45)"/>`,
  },
  star: { bg: '#1e3932', art: star(50, 52, 28, '#e3c88a') },
  crescent: {
    bg: '#0b2b22',
    art: `<path d="M58 22 A30 30 0 1 0 74 72 A24 24 0 1 1 58 22 Z" fill="#e3c88a"/>${star(68, 34, 7, '#f2f0eb')}`,
  },
  crown: {
    bg: '#7c5f27',
    art: `<path d="M24 70 L28 36 L40 52 L50 28 L60 52 L72 36 L76 70 Z" fill="#f6dc96"/><rect x="24" y="68" width="52" height="8" rx="3" fill="#e3c88a"/>
      <circle cx="50" cy="56" r="4" fill="#00704a"/>`,
  },
  bear: {
    bg: '#f6d3dc',
    art: `<circle cx="32" cy="34" r="10" fill="#f09bb0"/><circle cx="68" cy="34" r="10" fill="#f09bb0"/>
      <circle cx="50" cy="54" r="26" fill="#f7b6c6"/><ellipse cx="50" cy="62" rx="11" ry="8" fill="#fde6ec"/>
      <circle cx="41" cy="50" r="3" fill="#2a1a12"/><circle cx="59" cy="50" r="3" fill="#2a1a12"/><path d="M47 60 L53 60 L50 64 Z" fill="#2a1a12"/>`,
  },
}

export const AVATAR_IDS = Object.keys(AVATAR_ART) as AvatarId[]

export function avatarSvg(id: AvatarId, size?: number): string {
  const avatar = AVATAR_ART[id] ?? AVATAR_ART['hot-cup']
  const body = `<circle cx="50" cy="50" r="50" fill="${avatar.bg}"/>
    <circle cx="50" cy="50" r="49" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="2"/>${avatar.art}`
  return svgDocument('0 0 100 100', body, size, size)
}
