export const NAME_MIN = 2
export const NAME_MAX = 20

export type NameError = 'empty' | 'tooShort' | 'tooLong' | 'invalid'

export type NameValidation = { ok: true; value: string } | { ok: false; error: NameError }

/** Letters and marks of any script (Arabic, Latin…), digits, spaces and - _ . */
const ALLOWED = /^[\p{L}\p{M}\p{Nd} _.-]+$/u
/** Bidi controls and zero-width characters can spoof names; they are never allowed. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u

export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/gu, ' ').trim()
}

/** Counts user-perceived characters so Arabic with diacritics is measured fairly. */
function length(value: string): number {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Segmenter) return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length
  return [...value].length
}

export function validateDisplayName(raw: string): NameValidation {
  const value = normalizeName(raw)
  if (value.length === 0) return { ok: false, error: 'empty' }
  if (INVISIBLE.test(raw) || !ALLOWED.test(value)) return { ok: false, error: 'invalid' }
  if (!/[\p{L}\p{Nd}]/u.test(value)) return { ok: false, error: 'invalid' }
  const size = length(value)
  if (size < NAME_MIN) return { ok: false, error: 'tooShort' }
  if (size > NAME_MAX) return { ok: false, error: 'tooLong' }
  return { ok: true, value }
}
