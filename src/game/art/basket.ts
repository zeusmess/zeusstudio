import type { BasketSkinId } from '../../types'
import { svgDocument } from './svg'

/**
 * The basket is drawn in two layers so a caught cup can sink *into* it:
 * `back` (dark interior and back rim) renders behind cups, `front` (woven
 * body and front rim) renders in front of them. `full` combines both for UI.
 */
export interface BasketPalette {
  body: string
  shade: string
  light: string
  rim: string
  rimShade: string
  band: string
  emblem: string
  interior: string
}

export const BASKET_PALETTES: Record<BasketSkinId, BasketPalette> = {
  classic: {
    body: '#c58d56',
    shade: '#8b5a31',
    light: '#e7b97f',
    rim: '#f3e6cb',
    rimShade: '#cdb48a',
    band: '#00704a',
    emblem: '#e3c88a',
    interior: '#4a2c1d',
  },
  siren: {
    body: '#126447',
    shade: '#0a3d2c',
    light: '#2a8a63',
    rim: '#f2f0eb',
    rimShade: '#c9c3b5',
    band: '#cba258',
    emblem: '#f2f0eb',
    interior: '#062a1f',
  },
  cream: {
    body: '#efe3cb',
    shade: '#c9b28d',
    light: '#fbf6ea',
    rim: '#d6b26c',
    rimShade: '#a8823a',
    band: '#1e3932',
    emblem: '#e3c88a',
    interior: '#5a4128',
  },
  golden: {
    body: '#d7ac57',
    shade: '#9c7426',
    light: '#f6dc96',
    rim: '#fff3cf',
    rimShade: '#e0c27c',
    band: '#1e3932',
    emblem: '#f6dc96',
    interior: '#4b3510',
  },
  midnight: {
    body: '#1d2c3b',
    shade: '#0e1924',
    light: '#2f8f7a',
    rim: '#a8e6cf',
    rimShade: '#5fb59b',
    band: '#6fc39a',
    emblem: '#f2f0eb',
    interior: '#05090d',
  },
  rival: {
    body: '#b9343d',
    shade: '#7c1f27',
    light: '#e46a71',
    rim: '#f2f0eb',
    rimShade: '#cfc8ba',
    band: '#f2f0eb',
    emblem: '#b9343d',
    interior: '#3a0d11',
  },
}

export const BASKET_VIEWBOX = { width: 160, height: 100 }

const BODY_PATH = 'M12 26 L148 26 L134 92 Q133 96 128 96 L32 96 Q27 96 26 92 Z'

function star(cx: number, cy: number, r: number, fill: string): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

function weave(p: BasketPalette): string {
  const rows: string[] = []
  for (let row = 0; row < 6; row++) {
    const y = 30 + row * 11
    const offset = row % 2 === 0 ? 0 : 9
    for (let col = -1; col < 9; col++) {
      const x = 14 + col * 18 + offset
      rows.push(`<rect x="${x}" y="${y}" width="15" height="8" rx="4" fill="${p.light}" opacity="0.55"/>`)
      rows.push(`<rect x="${x + 2}" y="${y + 5.5}" width="11" height="2.2" rx="1.1" fill="${p.shade}" opacity="0.45"/>`)
    }
  }
  return rows.join('')
}

function backLayer(p: BasketPalette): string {
  return `
    <defs>
      <radialGradient id="inside" cx="50%" cy="30%" r="70%">
        <stop offset="0" stop-color="${p.interior}" stop-opacity="0.95"/>
        <stop offset="1" stop-color="${p.interior}"/>
      </radialGradient>
    </defs>
    <ellipse cx="80" cy="26" rx="70" ry="12" fill="${p.rimShade}"/>
    <ellipse cx="80" cy="27" rx="63" ry="9" fill="url(#inside)"/>`
}

function frontLayer(p: BasketPalette): string {
  return `
    <defs>
      <linearGradient id="bodyShade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="${p.shade}"/>
        <stop offset="0.18" stop-color="${p.body}"/>
        <stop offset="0.82" stop-color="${p.body}"/>
        <stop offset="1" stop-color="${p.shade}"/>
      </linearGradient>
      <linearGradient id="bodyFade" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
      </linearGradient>
      <clipPath id="bodyClip"><path d="${BODY_PATH}"/></clipPath>
    </defs>
    <ellipse cx="80" cy="97" rx="56" ry="4" fill="#000" opacity="0.25"/>
    <path d="${BODY_PATH}" fill="url(#bodyShade)"/>
    <g clip-path="url(#bodyClip)">${weave(p)}
      <rect x="0" y="52" width="160" height="16" fill="${p.band}"/>
      <rect x="0" y="52" width="160" height="2" fill="#fff" opacity="0.18"/>
      <rect x="0" y="0" width="160" height="100" fill="url(#bodyFade)"/>
    </g>
    <circle cx="80" cy="60" r="10.5" fill="${p.band}" stroke="${p.emblem}" stroke-width="2"/>
    ${star(80, 60.5, 7, p.emblem)}
    <path d="M10 26 Q80 46 150 26 L150 30 Q80 52 10 30 Z" fill="${p.rimShade}"/>
    <path d="M8 24 Q80 42 152 24 Q153 29 148 31 Q80 48 12 31 Q7 29 8 24 Z" fill="${p.rim}"/>
    <path d="M18 27 Q80 41 142 27" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round"/>`
}

export function basketSvg(skin: BasketSkinId, part: 'back' | 'front' | 'full' = 'full', width?: number): string {
  const p = BASKET_PALETTES[skin]
  const body = part === 'back' ? backLayer(p) : part === 'front' ? frontLayer(p) : backLayer(p) + frontLayer(p)
  const height = width ? Math.round((width * BASKET_VIEWBOX.height) / BASKET_VIEWBOX.width) : undefined
  return svgDocument(`0 0 ${BASKET_VIEWBOX.width} ${BASKET_VIEWBOX.height}`, body, width, height)
}
