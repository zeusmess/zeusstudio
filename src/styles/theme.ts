/**
 * Reads colour tokens from src/styles/tokens.css for the game canvas, so the
 * DOM and Phaser draw from one palette.
 */
export function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** "#rrggbb" token → 0xrrggbb for Phaser. */
export function tokenColor(name: string, fallback: string): number {
  const hex = readToken(name, fallback).replace('#', '')
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6)
  const parsed = Number.parseInt(full, 16)
  return Number.isFinite(parsed) ? parsed : Number.parseInt(fallback.replace('#', ''), 16)
}

export interface CanvasPalette {
  cream: number
  gold: number
  goldLight: number
  green: number
  greenLight: number
  greenDeep: number
  pink: number
  red: number
  coffee: number
  coffeeDark: number
  caramel: number
  scoreNormal: string
  scoreGolden: string
  scoreSpecial: string
  miss: string
  combo: string
}

export function canvasPalette(): CanvasPalette {
  return {
    cream: tokenColor('--cream-100', '#f2f0eb'),
    gold: tokenColor('--gold-500', '#cba258'),
    goldLight: tokenColor('--gold-200', '#f1dfb2'),
    green: tokenColor('--green-500', '#00754a'),
    greenLight: tokenColor('--green-300', '#6fc39a'),
    greenDeep: tokenColor('--green-900', '#0b2b22'),
    pink: tokenColor('--pink-400', '#f07fa6'),
    red: tokenColor('--red-400', '#ef6b6b'),
    coffee: tokenColor('--coffee-500', '#7a4a2e'),
    coffeeDark: tokenColor('--coffee-800', '#2f1b12'),
    caramel: tokenColor('--caramel-400', '#d9954b'),
    scoreNormal: readToken('--color-score-normal', '#f2f0eb'),
    scoreGolden: readToken('--gold-300', '#e3c88a'),
    scoreSpecial: readToken('--pink-400', '#f07fa6'),
    miss: readToken('--red-400', '#ef6b6b'),
    combo: readToken('--green-300', '#6fc39a'),
  }
}
