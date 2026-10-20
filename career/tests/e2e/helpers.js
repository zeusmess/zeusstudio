import { expect } from '@playwright/test'

export const PASSWORD = 'barista2026'

/** Opens "first time? register" on the opening screen and fills the form. */
export async function fillRegistration(page, { name, id, job = 'barista', password = PASSWORD }) {
  await page.goto('/')
  await page.click('#sbcChoiceRegister')
  await page.waitForSelector('#sbcRegisterForm')
  await page.fill('#sbcName', name)
  await page.fill('#sbcEmployeeId', id)
  // Online accounts have a password; offline play keeps progress on the device only.
  if (await page.locator('#sbcPassword').count()) {
    await page.fill('#sbcPassword', password)
    await page.fill('#sbcPassword2', password)
  }
  await page.selectOption('#sbcJob', job)
  await page.check('#sbcConsent')
}

/** Registers for the first time and waits for the game. */
export async function register(page, details) {
  await fillRegistration(page, details)
  await page.click('#sbcRegisterBtn')
  await page.waitForFunction(() => window.__sbc?.game?.state)
}

/** Logs in with the employee ID and the password (another phone, a reinstall). */
export async function login(page, { id, password = PASSWORD }) {
  await page.goto('/')
  await page.click('#sbcChoiceLogin')
  await page.fill('#sbcLoginId', id)
  await page.fill('#sbcLoginPassword', password)
  await page.click('#sbcLoginBtn')
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
