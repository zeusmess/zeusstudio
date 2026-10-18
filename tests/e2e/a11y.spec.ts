import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openGame, type Language } from './helpers'

// Automated checks catch missing names, roles, labels and low contrast; they do not replace a manual review.
const SCREENS = ['open-levels', 'open-settings', 'open-achievements', 'play-with-friend', 'profile-chip', 'guest-play']

for (const language of ['en', 'ar'] as Language[]) {
  test(`menus have no serious accessibility problems (${language})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openGame(page, { language })
    const problems: string[] = []
    const check = async (where: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      for (const violation of results.violations) {
        if (violation.impact === 'serious' || violation.impact === 'critical') {
          problems.push(`${where}: ${violation.id} (${violation.nodes.length}) ${violation.nodes[0]?.target.join(' ')}`)
        }
      }
    }
    await check('menu')
    for (const button of SCREENS) {
      await page.getByTestId(button).click()
      await page.getByTestId('back-button').waitFor()
      await check(button)
      await page.getByTestId('back-button').click()
      await expect(page.getByTestId('play-now')).toBeVisible()
    }
    expect(problems).toEqual([])
  })
}
