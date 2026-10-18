import { expect, test } from '@playwright/test'
import { clearLevels, currentScreen, letBotPlay, openGame, skipIntro, waitForScreen } from './helpers'

test('clears level 1, celebrates once, saves it and moves on to level 2', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('play-now').click()
  await letBotPlay(page)
  await waitForScreen(page, 'LEVEL_COMPLETE', 90_000)

  const victory = page.getByTestId('victory')
  await expect(victory).toBeVisible()
  await expect(victory).toContainText('500')
  const score = Number((await page.getByTestId('victory-score').innerText()).replace(/\D/g, ''))
  expect(score).toBeGreaterThanOrEqual(500)

  const progress = await page.evaluate(() => window.__scc.profile.getState().record.progress)
  expect(progress.completedLevels).toEqual([1])
  expect(progress.unlockedLevel).toBe(2)

  await page.getByTestId('next-level').click()
  await waitForScreen(page, 'COUNTDOWN')
  expect(await page.evaluate(() => window.__scc.app.getState().play)).toMatchObject({ mode: 'campaign', levelId: 2 })

  // Progress survives a reload.
  await page.reload()
  await skipIntro(page)
  await page.getByTestId('open-levels').click()
  await expect(page.getByTestId('level-2')).toBeEnabled()
})

test('pauses, resumes, restarts and quits a level', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('play-now').click()
  await waitForScreen(page, 'PLAYING')

  await page.getByTestId('pause-button').click()
  await expect(page.getByTestId('pause-dialog')).toBeVisible()
  await page.getByTestId('resume').click()
  await waitForScreen(page, 'PLAYING')

  await page.keyboard.press('Escape')
  await waitForScreen(page, 'PAUSED')
  await page.getByTestId('restart').click()
  await waitForScreen(page, 'COUNTDOWN')
  await expect(page.getByTestId('hud-score')).toHaveText('0')

  await waitForScreen(page, 'PLAYING')
  await page.getByTestId('pause-button').click()
  await page.getByTestId('quit').click()
  await waitForScreen(page, 'MENU')
})

test('the keyboard moves the basket both ways', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('play-now').click()
  await waitForScreen(page, 'PLAYING')
  const x = () => page.evaluate(() => window.__scc.controller.session?.basket.x ?? 0)
  const start = await x()
  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(350)
  await page.keyboard.up('ArrowLeft')
  const left = await x()
  expect(left).toBeLessThan(start)
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(700)
  await page.keyboard.up('KeyD')
  expect(await x()).toBeGreaterThan(left)
})

test('running out of lives ends the run once, with a way back in', async ({ page }) => {
  await openGame(page)
  await clearLevels(page, 1)
  await page.getByTestId('open-levels').click()
  await page.getByTestId('level-2').click()
  await waitForScreen(page, 'PLAYING')
  // Nobody moves the basket: the cups that miss it cost lives until none are left.
  await waitForScreen(page, 'GAME_OVER', 240_000)
  await expect(page.getByTestId('game-over')).toBeVisible()
  await expect(page.getByTestId('hud-lives')).toHaveAttribute('data-lives', '0')
  await page.getByTestId('retry').click()
  await waitForScreen(page, 'COUNTDOWN')
  expect(await currentScreen(page)).toBe('COUNTDOWN')
})
