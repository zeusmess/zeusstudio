import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage } from '../services/storage'
import type { Language, MotionPreference } from '../types'

export const SETTINGS_KEY = 'scc:v1:settings'

export interface SettingsValues {
  language: Language
  musicVolume: number
  sfxVolume: number
  muted: boolean
  motion: MotionPreference
  arrowButtons: boolean
  mouseControl: boolean
  haptics: boolean
}

interface SettingsState extends SettingsValues {
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  update: (values: Partial<SettingsValues>) => void
}

/** First visit: Arabic if the browser's primary language is Arabic. */
export function detectLanguage(): Language {
  try {
    return (globalThis.navigator?.language ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export const DEFAULT_SETTINGS: SettingsValues = {
  language: 'en',
  musicVolume: 0.55,
  sfxVolume: 0.8,
  muted: false,
  motion: 'system',
  arrowButtons: false,
  mouseControl: true,
  haptics: true,
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      language: detectLanguage(),
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => set({ language: get().language === 'ar' ? 'en' : 'ar' }),
      update: (values) =>
        set({
          ...values,
          ...(values.musicVolume !== undefined && { musicVolume: clamp01(values.musicVolume) }),
          ...(values.sfxVolume !== undefined && { sfxVolume: clamp01(values.sfxVolume) }),
        }),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state): SettingsValues => ({
        language: state.language,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        muted: state.muted,
        motion: state.motion,
        arrowButtons: state.arrowButtons,
        mouseControl: state.mouseControl,
        haptics: state.haptics,
      }),
    },
  ),
)

export function getSettings(): SettingsValues {
  return useSettings.getState()
}

/** Mirrors the language on <html> so CSS (:lang, logical properties) and screen readers follow it. */
export function applyDocumentLanguage(language: Language): void {
  const root = document.documentElement
  root.lang = language
  root.dir = language === 'ar' ? 'rtl' : 'ltr'
}

const reducedQuery = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')

export function prefersReducedMotion(motion: MotionPreference = getSettings().motion): boolean {
  if (motion === 'reduced') return true
  if (motion === 'full') return false
  return reducedQuery()?.matches ?? false
}

export function applyMotionPreference(motion: MotionPreference): void {
  document.documentElement.dataset.motion = prefersReducedMotion(motion) ? 'reduced' : 'full'
}

/** Keeps <html lang dir data-motion> in sync with the settings for the life of the page. */
export function bindDocumentSettings(): () => void {
  const apply = () => {
    const { language, motion } = getSettings()
    applyDocumentLanguage(language)
    applyMotionPreference(motion)
  }
  apply()
  const unsubscribe = useSettings.subscribe(apply)
  const query = reducedQuery()
  query?.addEventListener?.('change', apply)
  return () => {
    unsubscribe()
    query?.removeEventListener?.('change', apply)
  }
}
