import { expect, test } from '@playwright/test'
import { fillRegistration, login, noPageErrors, openTab, PASSWORD, register, startShift } from './helpers.js'

const NS = 'demo-starbucks-career-default-rtdb'
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9100'

async function makeAdmin(uid) {
  const res = await fetch(`http://${DB}/career/admins/${uid}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 'true' })
  expect(res.status).toBe(200)
}

test('the owner announces, a colleague sees it live with the players list, and IDs stay unique', async ({ browser }) => {
  const stamp = String(Date.now()).slice(-6)
  const ownerCtx = await browser.newContext()
  const owner = await ownerCtx.newPage()
  const ownerErrors = noPageErrors(owner)
  await register(owner, { name: 'يوسف أيمن', id: `A${stamp}`, job: 'store_manager' })
  await startShift(owner)
  const uid = await owner.evaluate(() => window.__sbc.session.identity.uid)
  await makeAdmin(uid)

  // The admin flag is read when the game opens.
  await owner.reload()
  await owner.click('#sbcContinueBtn')
  await owner.waitForFunction(() => window.__sbc?.session?.isAdmin === true)
  await owner.click('#sbcProfileChip')
  await owner.click('[data-p="admin"]')
  await owner.click('[data-tab-admin="announce"]')
  const text = `أسبوع الذروة بدأ ${stamp}`
  await owner.fill('textarea[name="text"]', text)
  await owner.fill('input[name="rewardMultiplier"]', '2')
  await owner.click('form[data-form="announce"] button[type="submit"]')
  await expect(owner.locator('.sbc-modal')).toContainText('تم النشر')

  const colleagueCtx = await browser.newContext()
  const colleague = await colleagueCtx.newPage()
  const colleagueErrors = noPageErrors(colleague)

  // The owner's employee ID cannot be claimed twice.
  await fillRegistration(colleague, { name: 'هالة منير', id: `A${stamp}` })
  await colleague.click('#sbcRegisterBtn')
  await expect(colleague.locator('#sbcSplashMsg')).toContainText('عليه حساب')

  await colleague.fill('#sbcEmployeeId', `B${stamp}`)
  await colleague.click('#sbcRegisterBtn')
  await colleague.waitForFunction(() => window.__sbc?.game?.state)
  await startShift(colleague)
  await expect(colleague.locator('#sbcAnnouncement')).toContainText(text)

  await openTab(colleague, 'community')
  await expect(colleague.locator('#sbcCommunityRoot')).toContainText('يوسف أيمن')
  await expect(colleague.locator('#sbcCommunityRoot')).toContainText('هالة منير')

  // A banned player is stopped at once.
  const colleagueUid = await colleague.evaluate(() => window.__sbc.session.identity.uid)
  await owner.locator('[data-tab-admin="players"]').click()
  await owner.locator(`[data-pick="${colleagueUid}"]`).click()
  owner.once('dialog', (d) => d.accept('اختبار'))
  await owner.locator('[data-a="ban"]').click()
  await expect(colleague.locator('.sbc-modal')).toContainText('تم إيقاف حسابك')

  expect(ownerErrors).toEqual([])
  expect(colleagueErrors).toEqual([])
})

test('a partner logs in on another phone with the employee ID and password and finds their progress', async ({ browser }) => {
  const id = `L${String(Date.now()).slice(-6)}`
  const first = await (await browser.newContext()).newPage()
  const errors = noPageErrors(first)
  await register(first, { name: 'سلمى رأفت', id, job: 'barista' })
  await startShift(first)
  await first.evaluate(() => (window.__sbc.game.state.speed = 3))
  await expect.poll(() => first.evaluate(() => window.__sbc.game.state.sbc.missions.done.length), { timeout: 90_000 }).toBeGreaterThan(0)
  const done = await first.evaluate(async () => {
    await window.__sbc.sync.saveCloud(true)
    return window.__sbc.game.state.sbc.missions.done.length
  })

  // A wrong password is refused.
  const second = await (await browser.newContext()).newPage()
  await login(second, { id, password: 'wrong-password' })
  await expect(second.locator('#sbcSplashMsg')).toContainText('غير صحيحة')

  // The right one opens the same account, with the progress saved in the cloud.
  await second.fill('#sbcLoginPassword', PASSWORD)
  await second.click('#sbcLoginBtn')
  await second.waitForFunction(() => window.__sbc?.game?.state)
  expect(await second.evaluate(() => window.__sbc.session.identity.name)).toBe('سلمى رأفت')
  expect(await second.evaluate(() => window.__sbc.game.state.sbc.missions.done.length)).toBeGreaterThanOrEqual(done)
  await expect(second.locator('#openingScreenModal')).toBeHidden()
  expect(errors).toEqual([])
})
