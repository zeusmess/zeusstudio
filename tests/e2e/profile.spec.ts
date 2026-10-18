import { expect, test } from '@playwright/test'
import { openGame, skipIntro } from './helpers'

test('saves an Arabic display name that survives a reload', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('profile-chip').click()
  await page.getByTestId('edit-name').click()
  await page.getByTestId('name-input').fill('يوسف أيمن')
  await page.getByTestId('save-name').click()
  await expect(page.getByTestId('profile-name')).toHaveText('يوسف أيمن')

  await page.reload()
  await skipIntro(page)
  await expect(page.getByTestId('profile-chip')).toContainText('يوسف أيمن')
})

test('explains why a name is refused', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('profile-chip').click()
  await page.getByTestId('edit-name').click()
  await page.getByTestId('name-input').fill('Y')
  await page.getByTestId('save-name').click()
  await expect(page.getByTestId('name-error')).toBeVisible()
  await page.getByTestId('name-input').fill('<b>')
  await page.getByTestId('save-name').click()
  await expect(page.getByTestId('name-error')).toBeVisible()
})
