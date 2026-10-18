// @vitest-environment jsdom
import { bindDocumentSettings, SETTINGS_KEY, useSettings } from './settings'

describe('language and direction', () => {
  let unbind: () => void

  beforeEach(() => {
    useSettings.getState().setLanguage('en')
    unbind = bindDocumentSettings()
  })

  afterEach(() => unbind())

  it('switches the page between Arabic (right to left) and English (left to right)', () => {
    const root = document.documentElement
    expect(root.lang).toBe('en')
    expect(root.dir).toBe('ltr')

    useSettings.getState().setLanguage('ar')
    expect(root.lang).toBe('ar')
    expect(root.dir).toBe('rtl')

    useSettings.getState().toggleLanguage()
    expect(root.lang).toBe('en')
    expect(root.dir).toBe('ltr')
  })

  it('remembers the chosen language for the next visit', () => {
    useSettings.getState().setLanguage('ar')
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { state?: { language?: string } }
    expect(saved.state?.language).toBe('ar')
  })

  it('applies reduced motion to the page', () => {
    useSettings.getState().update({ motion: 'reduced' })
    expect(document.documentElement.dataset.motion).toBe('reduced')
    useSettings.getState().update({ motion: 'full' })
    expect(document.documentElement.dataset.motion).toBe('full')
  })

  it('keeps volumes between 0 and 1', () => {
    useSettings.getState().update({ musicVolume: 3, sfxVolume: -1 })
    expect(useSettings.getState().musicVolume).toBe(1)
    expect(useSettings.getState().sfxVolume).toBe(0)
  })
})
