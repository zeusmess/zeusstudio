import { expect, test } from '@playwright/test'
import { openGame, skipIntro } from './helpers'

test('switches between English (left to right) and Arabic (right to left) and remembers it', async ({ page }) => {
  await openGame(page, { language: 'en' })
  const html = page.locator('html')
  await expect(html).toHaveAttribute('dir', 'ltr')
  await expect(page.getByTestId('play-now')).toContainText('Play Now')

  await page.getByTestId('language-toggle').click()
  await expect(html).toHaveAttribute('dir', 'rtl')
  await expect(html).toHaveAttribute('lang', 'ar')
  await expect(page.getByTestId('play-now')).toContainText('العب الآن')

  await page.reload()
  await skipIntro(page)
  await expect(html).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('play-now')).toContainText('العب الآن')

  await page.getByTestId('language-toggle').click()
  await expect(html).toHaveAttribute('dir', 'ltr')
  await expect(page.getByTestId('play-now')).toContainText('Play Now')
})

test('mirrors the layout in Arabic, but never the game controls', async ({ page }) => {
  await openGame(page, { language: 'ar' })
  await page.getByTestId('open-settings').click()
  const back = await page.getByTestId('back-button').boundingBox()
  const width = page.viewportSize()?.width ?? 0
  // The back button sits at the start of the line: the right-hand side in Arabic.
  expect(back && back.x > width / 2).toBe(true)

  await page.getByTestId('arrow-buttons').click()
  await page.getByTestId('back-button').click()
  await page.getByTestId('play-now').click()
  await page.waitForFunction(() => window.__scc.app.getState().screen === 'PLAYING', null, { timeout: 30_000 })
  // ◀ stays on the left and ▶ on the right in both languages: the playfield is not mirrored.
  const leftArrow = await page.getByTestId('arrow-left').boundingBox()
  const rightArrow = await page.getByTestId('arrow-right').boundingBox()
  expect(leftArrow && rightArrow && leftArrow.x < rightArrow.x).toBe(true)
  const before = await page.evaluate(() => window.__scc.controller.session?.basket.x ?? 0)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(400)
  await page.keyboard.up('ArrowRight')
  const after = await page.evaluate(() => window.__scc.controller.session?.basket.x ?? 0)
  expect(after).toBeGreaterThan(before)
})
