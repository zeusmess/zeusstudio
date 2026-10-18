import { expect, test } from '@playwright/test'
import { openGame, waitForScreen } from './helpers'

test('plays the intro, can skip it, and credits the creator', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('opening-screen')).toBeVisible()
  await expect(page.getByText('BY YOUSSEF AYMAN')).toBeVisible()
  await page.getByTestId('skip-intro').click()
  await expect(page.getByTestId('play-now')).toBeVisible()
  await expect(page.getByTestId('play-with-friend')).toBeVisible()
})

test('every menu button leads somewhere real', async ({ page }) => {
  await openGame(page)
  const destinations: Array<[string, string]> = [
    ['open-levels', 'LEVEL_SELECT'],
    ['open-achievements', 'ACHIEVEMENTS'],
    ['open-settings', 'SETTINGS'],
    ['play-with-friend', 'LOBBY'],
    ['guest-play', 'LOGIN'],
    ['profile-chip', 'PROFILE'],
  ]
  for (const [button, screen] of destinations) {
    await page.getByTestId(button).click()
    await waitForScreen(page, screen)
    await page.getByTestId('back-button').click()
    await waitForScreen(page, 'MENU')
  }
  await page.getByTestId('play-now').click()
  await waitForScreen(page, 'COUNTDOWN')
})

test('keeps Endless Mode locked until the campaign is complete', async ({ page }) => {
  await openGame(page)
  const endless = page.getByTestId('open-endless')
  // Locked but still focusable, so it can explain itself to every player.
  await expect(endless).toHaveAttribute('aria-disabled', 'true')
  await expect(endless).toHaveAttribute('aria-describedby', /\S/)
  await endless.click({ force: true })
  await expect(page.getByText('Finish all 15 levels to unlock Endless Mode')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__scc.app.getState().screen)).toBe('MENU')
})

test('says online features await configuration instead of pretending', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('play-with-friend').click()
  await expect(page.getByTestId('lobby-unconfigured')).toBeVisible()
  await expect(page.getByTestId('create-room')).toHaveCount(0)
  await page.getByTestId('back-button').click()

  await page.getByTestId('google-sign-in').click()
  await waitForScreen(page, 'LOGIN')
  await expect(page.getByTestId('google-unconfigured')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__scc.profile.getState().record.profile.kind)).toBe('guest')
})
