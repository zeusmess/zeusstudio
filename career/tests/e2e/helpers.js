import { expect } from '@playwright/test'

/** Fills the opening screen's employee form and waits for the game. */
export async function register(page, { name, id, job = 'barista' }) {
  await page.goto('/')
  await page.waitForSelector('#sbcRegisterForm')
  await page.fill('#sbcName', name)
  await page.fill('#sbcEmployeeId', id)
  await page.selectOption('#sbcJob', job)
  await page.check('#sbcConsent')
  await page.click('#sbcRegisterBtn')
  await page.waitForFunction(() => window.__sbc?.game?.state)
}

export async function startShift(page) {
  await expect(page.locator('#openingScreenModal')).toBeVisible()
  await page.click('#btnStartCareerNow')
  await expect(page.locator('#openingScreenModal')).toBeHidden()
}

export async function openTab(page, key) {
  await page.click(`.nav-tab[data-tab="${key}"]`)
  await expect(page.locator(`#tab-${key}`)).toBeVisible()
}

export function noPageErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}
