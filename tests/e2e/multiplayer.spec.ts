import { expect, test, type Page } from '@playwright/test'
import { newPlayer, waitForScreen } from './helpers'

/**
 * Two players on two separate browsers (separate storage, separate accounts)
 * play an online match through an invitation code, against the Firebase
 * emulators with the real security rules loaded:
 *
 *   npm run test:e2e:multiplayer
 */

const matchView = (page: Page) =>
  page.evaluate(() => {
    const read = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\D/g, '') ?? ''
    return {
      outcome: document.querySelector('[data-testid="match-results"]')?.getAttribute('data-outcome'),
      mine: Number(read('match-my-score')),
      theirs: Number(read('match-opponent-score')),
    }
  })

test('two players create, join, play, rematch and forfeit a match', async ({ browser }) => {
  const host = await newPlayer(browser, 'en')
  const guest = await newPlayer(browser, 'ar')

  // The host opens a quick match and gets an invitation code.
  await host.getByTestId('play-with-friend').click()
  await host.getByTestId('length-quick').click()
  await host.getByTestId('create-room').click()
  const code = (await host.getByTestId('room-code').innerText()).trim()
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)

  // Wrong codes are explained, not accepted.
  await guest.getByTestId('play-with-friend').click()
  await guest.getByTestId('join-code').fill('AB1')
  await guest.getByTestId('join-room').click()
  await expect(guest.getByTestId('join-error')).toBeVisible()
  await guest.getByTestId('join-code').fill('ZZZZZZ')
  await guest.getByTestId('join-room').click()
  await expect(guest.getByTestId('join-error')).toContainText('لا توجد غرفة')

  // The friend types the code the way people do: lower case, with spaces.
  await guest.getByTestId('join-code').fill(code.toLowerCase().split('').join(' '))
  await guest.getByTestId('join-room').click()
  await expect(guest.getByTestId('room-code')).toHaveText(code)
  await expect(host.getByTestId('player-opponent')).toBeVisible()

  // A third player cannot squeeze in.
  const third = await newPlayer(browser, 'en')
  await third.getByTestId('play-with-friend').click()
  await third.getByTestId('join-code').fill(code)
  await third.getByTestId('join-room').click()
  await expect(third.getByTestId('join-error')).toContainText('two players')
  await third.context().close()

  // Both get ready; only then can the host start.
  await expect(host.getByTestId('start-match')).toBeDisabled()
  await host.getByTestId('ready-toggle').click()
  await guest.getByTestId('ready-toggle').click()
  await expect(host.getByTestId('start-match')).toBeEnabled()
  await expect(guest.getByTestId('start-match')).toHaveCount(0)
  await host.getByTestId('start-match').click()

  // Same countdown, same cups: both play the shared seed on the shared clock.
  await Promise.all([waitForScreen(host, 'COUNTDOWN'), waitForScreen(guest, 'COUNTDOWN')])
  const [hostPlay, guestPlay] = await Promise.all([host, guest].map((p) => p.evaluate(() => window.__scc.app.getState().play)))
  expect(hostPlay).toEqual(guestPlay)
  await Promise.all([waitForScreen(host, 'PLAYING'), waitForScreen(guest, 'PLAYING')])
  await host.evaluate(() => window.__scc.controller.enableBot('perfect'))
  await guest.evaluate(() => window.__scc.controller.enableBot('normal'))
  await expect(host.getByTestId('hud-opponent')).toBeVisible()

  // The server decides; both screens agree on the winner and the scores.
  await Promise.all([waitForScreen(host, 'MATCH_RESULTS', 150_000), waitForScreen(guest, 'MATCH_RESULTS', 150_000)])
  await expect(host.getByTestId('match-results')).toBeVisible()
  await expect(guest.getByTestId('match-results')).toBeVisible()
  await host.waitForTimeout(500)
  const [hostView, guestView] = await Promise.all([matchView(host), matchView(guest)])
  expect(hostView.mine).toBe(guestView.theirs)
  expect(hostView.theirs).toBe(guestView.mine)
  const outcomes = [hostView.outcome, guestView.outcome].sort()
  expect([['loss', 'win'], ['tie', 'tie']]).toContainEqual(outcomes)
  if (outcomes[0] !== 'tie') expect(Math.max(hostView.mine, guestView.mine)).toBeGreaterThanOrEqual(2500)

  // Each player's profile records the match once.
  for (const page of [host, guest]) {
    const history = await page.evaluate(() => window.__scc.profile.getState().record.progress.matchHistory as unknown[])
    expect(history).toHaveLength(1)
  }

  // Rematch: when both ask, the next round counts down by itself.
  await host.getByTestId('rematch').click()
  await expect(guest.getByTestId('rematch-requested')).toBeVisible()
  await guest.getByTestId('rematch').click()
  await Promise.all([waitForScreen(host, 'COUNTDOWN', 30_000), waitForScreen(guest, 'COUNTDOWN', 30_000)])
  expect(await host.evaluate(() => window.__scc.app.getState().play)).toMatchObject({ mode: 'versus', round: 2 })
  await Promise.all([waitForScreen(host, 'PLAYING'), waitForScreen(guest, 'PLAYING')])

  // Leaving mid-match is a forfeit: the other player wins.
  await guest.getByTestId('leave-match').click()
  await guest.getByTestId('confirm-leave').click()
  await waitForScreen(guest, 'MENU')
  await waitForScreen(host, 'MATCH_RESULTS', 30_000)
  await expect(host.getByTestId('match-results')).toHaveAttribute('data-outcome', 'win')
  await expect(host.getByTestId('match-reason')).toContainText('left the match')
  await expect(host.getByTestId('rematch')).toHaveCount(0)
})
