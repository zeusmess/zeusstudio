import ar from './ar.json'
import en from './en.json'
import { createI18n, formatNumber, translate, translatePlural } from './i18n'

/** Every translatable string, keyed by its dotted path. */
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const found = new Map<string, string>()
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') found.set(path, value)
    else for (const [p, v] of leaves(value, path)) found.set(p, v)
  }
  return found
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const isPlural = (path: string) => path.startsWith('plurals.')

describe('translations', () => {
  const english = leaves(en)
  const arabic = leaves(ar)

  it('has the same strings in Arabic and English', () => {
    const singular = (map: Map<string, string>) => [...map.keys()].filter((k) => !isPlural(k)).sort()
    expect(singular(arabic)).toEqual(singular(english))
    expect(Object.keys(ar.plurals).sort()).toEqual(Object.keys(en.plurals).sort())
  })

  it('keeps every placeholder in the Arabic version', () => {
    for (const [path, text] of english) {
      if (isPlural(path)) continue
      expect({ path, placeholders: placeholders(arabic.get(path) ?? '') }).toEqual({ path, placeholders: placeholders(text) })
    }
  })

  it('leaves no string empty', () => {
    // The Arabic title line under the wordmark exists only in Arabic.
    const onlyInArabic = new Set(['app.titleLocal'])
    for (const [path, text] of english) {
      if (!onlyInArabic.has(path)) expect({ path, empty: text.trim() === '' }).toEqual({ path, empty: false })
    }
    for (const [path, text] of arabic) expect({ path, empty: text.trim() === '' }).toEqual({ path, empty: false })
  })

  it('uses no hidden bidi overrides (only plain direction marks)', () => {
    for (const [path, text] of arabic) expect({ path, bad: /[\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF]/u.test(text) }).toEqual({ path, bad: false })
  })

  it('gives Arabic every plural category it needs', () => {
    for (const forms of Object.values(ar.plurals)) {
      expect(Object.keys(forms).sort()).toEqual(['few', 'many', 'one', 'other', 'two', 'zero'])
    }
  })
})

describe('switching language', () => {
  it('translates the same screen text in both languages', () => {
    expect(translate('en', 'menu.playNow')).toBe('Play Now')
    expect(translate('ar', 'menu.playNow')).not.toBe(translate('en', 'menu.playNow'))
    expect(translate('ar', 'menu.playNow')).toMatch(/\p{Script=Arabic}/u)
  })

  it('reads right to left in Arabic and left to right in English', () => {
    expect(createI18n('ar').dir).toBe('rtl')
    expect(createI18n('en').dir).toBe('ltr')
  })

  it('fills in values with the same Western digits in both languages', () => {
    expect(formatNumber('en', 14500)).toBe('14,500')
    expect(formatNumber('ar', 14500)).toBe('14,500')
    const arabic = translate('ar', 'lobby.lengthDetail', { target: 5500, minutes: 2.5 })
    expect(arabic).toContain('5,500')
    expect(arabic).toContain('2.5')
    expect(arabic).not.toMatch(/[٠-٩]/u)
  })

  it('picks the right Arabic plural form', () => {
    const forms = new Set([0, 1, 2, 3, 11, 100].map((n) => translatePlural('ar', 'cups', n)))
    expect(forms.size).toBe(6)
    expect(translatePlural('en', 'cups', 1)).not.toBe(translatePlural('en', 'cups', 2))
  })
})
