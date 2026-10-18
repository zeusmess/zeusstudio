import { BRAND_TEXT, editionName, isBrandedEdition } from './edition'

describe('choosing the edition', () => {
  it('builds the Starbucks edition unless VITE_BRAND_ASSETS is "off"', () => {
    expect(isBrandedEdition(undefined)).toBe(true)
    expect(isBrandedEdition('')).toBe(true)
    expect(isBrandedEdition('on')).toBe(true)
    expect(isBrandedEdition('off')).toBe(false)
    expect(isBrandedEdition(' OFF ')).toBe(false)
  })

  it('names each edition', () => {
    expect(editionName(true)).toBe('Starbucks Cup Catcher')
    expect(editionName(false)).toBe('Cup Catcher')
    expect(BRAND_TEXT.test(editionName(false))).toBe(false)
  })

  it('recognises the brand name and photo paths in built files', () => {
    for (const text of ['STARBUCKS CUP CATCHER', 'لعبة صيّاد أكواب ستاربكس', 'src="./assets/brand/logo-siren.webp"']) {
      expect({ text, found: BRAND_TEXT.test(text) }).toEqual({ text, found: true })
    }
    for (const text of ['CUP CATCHER', 'صيّاد الأكواب', './assets/index-Bx3k.js']) {
      expect({ text, found: BRAND_TEXT.test(text) }).toEqual({ text, found: false })
    }
  })
})
