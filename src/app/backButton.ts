import type { AppScreen } from '../types'
import { getApp, useApp } from './appStore'

/**
 * Makes the phone's back gesture (and the browser's Back) act inside the game
 * instead of leaving it. While any screen other than the main menu is showing,
 * one history entry guards the page; going back presses that screen's own back
 * control — or dismisses the open dialog — so it does exactly what the visible
 * button does.
 */

/** The controls that mean "back" on each kind of screen, in order of preference. */
const BACK_CONTROLS = ['back-button', 'pause-button', 'leave-match', 'victory-menu', 'gameover-menu', 'match-menu']

const unguarded = (screen: AppScreen) => screen === 'MENU' || screen === 'INITIALIZING'

/** Menu screens that simply return to the main menu (used while one is still loading). */
const MENU_SCREENS: ReadonlySet<AppScreen> = new Set(['LOGIN', 'PROFILE', 'SETTINGS', 'ACHIEVEMENTS', 'LEVEL_SELECT', 'LEADERBOARD', 'LOBBY'])

function pressBack(): void {
  if (document.querySelector('[role="dialog"][data-dismissable="true"]')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return
  }
  for (const id of BACK_CONTROLS) {
    const control = document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)
    if (control && !control.disabled) {
      control.click()
      return
    }
  }
  const app = getApp()
  if (MENU_SCREENS.has(app.screen)) app.go('MENU')
}

export function bindBackButton(): () => void {
  let guarded = false
  let ignoreNextPop = false

  const sync = (screen: AppScreen) => {
    if (!unguarded(screen) && !guarded) {
      history.pushState({ sccGuard: true }, '')
      guarded = true
    } else if (unguarded(screen) && guarded) {
      // Back on the menu through the game's own buttons: drop the guard entry.
      guarded = false
      ignoreNextPop = true
      history.back()
    }
  }

  const onPopState = () => {
    if (ignoreNextPop) {
      ignoreNextPop = false
      return
    }
    guarded = false
    pressBack()
    // Still away from the menu (a dialog closed, the game paused): guard again.
    setTimeout(() => sync(getApp().screen), 0)
  }

  window.addEventListener('popstate', onPopState)
  const unsubscribe = useApp.subscribe((state) => sync(state.screen))
  sync(getApp().screen)
  return () => {
    window.removeEventListener('popstate', onPopState)
    unsubscribe()
  }
}
