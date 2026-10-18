import { expect, type Browser, type Page } from '@playwright/test'

/** The development test hooks the game exposes (src/main.tsx, controllerStore.ts). */
interface Store<T> {
  getState: () => T
}
interface TestHooks {
  app: Store<{ screen: string; play: Record<string, unknown> | null; startRun: (request: Record<string, unknown>) => boolean }>
  profile: Store<{ record: { profile: Record<string, unknown>; progress: Record<string, unknown> }; replaceRecord: (record: unknown) => void }>
  controller: { enableBot: (skill?: string) => void; session: { basket: { x: number } } | null }
  room: Store<Record<string, unknown>>
}

declare global {
  interface Window {
    __scc: TestHooks
  }
}

export type Language = 'en' | 'ar'

/** Opens the game with a first-visit language, skips the intro and waits for the menu. */
export async function openGame(page: Page, options: { language?: Language } = {}): Promise<void> {
  const language = options.language ?? 'en'
  await page.addInitScript((lang) => {
    if (!localStorage.getItem('scc:v1:settings')) {
      localStorage.setItem('scc:v1:settings', JSON.stringify({ state: { language: lang }, version: 1 }))
    }
  }, language)
  await page.goto('/')
  await skipIntro(page)
}

export async function skipIntro(page: Page): Promise<void> {
  const skip = page.getByTestId('skip-intro')
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined)
  await expect(page.getByTestId('play-now')).toBeVisible()
}

export function currentScreen(page: Page): Promise<string> {
  return page.evaluate(() => window.__scc.app.getState().screen)
}

export async function waitForScreen(page: Page, screen: string, timeout = 30_000): Promise<void> {
  await page.waitForFunction((target) => window.__scc?.app.getState().screen === target, screen, { timeout })
}

/** Hands the running game to the simulated player (it only moves the basket, like a finger). */
export async function letBotPlay(page: Page, skill: 'perfect' | 'skilled' | 'normal' | 'casual' = 'perfect'): Promise<void> {
  await waitForScreen(page, 'PLAYING')
  await page.evaluate((s) => window.__scc.controller.enableBot(s), skill)
}

/** Marks levels 1…n as cleared on this device. */
export async function clearLevels(page: Page, count: number): Promise<void> {
  await page.evaluate((n) => {
    const store = window.__scc.profile.getState()
    const record = structuredClone(store.record) as { profile: Record<string, unknown>; progress: Record<string, unknown> }
    const levels = Array.from({ length: n }, (_, i) => i + 1)
    record.progress.completedLevels = levels
    record.progress.unlockedLevel = Math.min(15, n + 1)
    record.progress.bestScores = Object.fromEntries(levels.map((l) => [String(l), 500 + 1000 * (l - 1)]))
    record.profile.identityChosen = true
    store.replaceRecord(record)
  }, count)
}

/** A second, independent player: its own browser context, storage and (online) account. */
export async function newPlayer(browser: Browser, language: Language): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 412, height: 860 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await openGame(page, { language })
  return page
}
