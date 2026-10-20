import { expect, test } from '@playwright/test'
import { noPageErrors, openTab, register, startShift } from './helpers.js'

test('a partner registers, plays every new tab and keeps the progress after a reload', async ({ page }) => {
  const errors = noPageErrors(page)
  await register(page, { name: 'منى عادل', id: '١٢٣٤٥', job: 'barista' })

  // Roles above the earned rank are locked on the opening screen.
  await expect(page.locator('[data-select-role="manager"] [data-lock-tag]')).toBeVisible()
  await startShift(page)
  await expect(page.locator('#sbcProfileChip')).toContainText('منى عادل')

  // Nothing is wider than the phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await openTab(page, 'missions')
  await expect(page.locator('#sbcMissionsRoot')).toContainText('#0001')
  await expect(page.locator('#sbcMissionsRoot')).toContainText('الفصل 1')

  await openTab(page, 'shift')
  await expect(page.locator('#sbcShiftRoot')).toContainText('توزيع المحطات')
  await expect(page.locator('#sbcShiftRoot')).toContainText('DRB')

  await openTab(page, 'career')
  await expect(page.locator('#sbcCareerRoot')).toContainText('باريستا مدرب')

  await openTab(page, 'community')
  await expect(page.locator('#sbcCommunityRoot')).toContainText('لوحة مديري المناطق')
  await expect(page.locator('#sbcCommunityRoot')).toContainText('أ. عمرو عاطف')
  await expect(page.locator('#sbcCommunityRoot')).toContainText('أ. محمود أحمد')

  await openTab(page, 'guide')
  await expect(page.locator('#sbcGuideRoot')).toContainText('18 إلى 23 ثانية')

  // A complex problem: the banner, the decision and the best practice.
  await page.evaluate(() => window.__sbc.systems.incidents.spawn('glass_in_ice'))
  await expect(page.locator('#sbcIncidentBanner')).toBeVisible()
  await expect(page.locator('.sbc-modal')).toContainText('ماذا تفعل')
  await page.locator('.sbc-modal [data-choice="0"]').click()
  await expect(page.locator('.sbc-modal')).toContainText('أفضل قرار')
  await page.locator('.sbc-modal [data-modal-close]').first().click()
  await expect(page.locator('#sbcIncidentBanner')).toBeHidden()

  // Play a little at full speed: missions complete and are saved.
  await page.evaluate(() => (window.__sbc.game.state.speed = 3))
  await expect.poll(() => page.evaluate(() => window.__sbc.game.state.sbc.missions.done.length), { timeout: 60_000 }).toBeGreaterThan(0)
  const before = await page.evaluate(() => {
    window.__sbc.sync.flush()
    return window.__sbc.game.state.sbc.missions.done.length
  })

  await page.reload()
  await page.click('#sbcContinueBtn')
  await page.waitForFunction(() => window.__sbc?.game?.state)
  const after = await page.evaluate(() => window.__sbc.game.state.sbc.missions.done.length)
  expect(after).toBeGreaterThanOrEqual(before)
  await expect(page.locator('#openingScreenModal')).toBeHidden()
  expect(errors).toEqual([])
})

test('a certification exam runs ten questions and records the result', async ({ page }) => {
  await register(page, { name: 'كريم سامي', id: 'EG100', job: 'barista' })
  await startShift(page)
  await openTab(page, 'career')
  await page.click('[data-exam="basics"]')
  for (let i = 0; i < 10; i++) {
    await page.locator('.sbc-modal [data-opt="0"]').click()
    await page.locator('.sbc-modal [data-next]').click()
  }
  await expect(page.locator('.sbc-modal')).toContainText('نتيجة اختبار')
  const recorded = await page.evaluate(() => {
    const c = window.__sbc.game.state.sbc.career
    return !!(c.certs.basics?.passed || c.examFails.basics)
  })
  expect(recorded).toBe(true)
})
