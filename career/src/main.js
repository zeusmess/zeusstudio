import '@fontsource-variable/cairo'
import '@fontsource-variable/inter'
import './styles/main.css'
import './styles/legacy.css'
import './styles/app.css'
import { game, hooks, startGame } from './legacy/game.js'
import { createSync } from './platform/sync.js'
import { runSplash } from './ui/splash.js'

async function main() {
  const session = await runSplash(document.getElementById('sbcSplashRoot'))
  const sync = createSync(session, game, hooks)
  const savedState = await sync.loadInitialState()

  hooks.playerName = () => session.identity.name

  startGame({ savedState })
  sync.start()

  // Handy for support and for the end-to-end tests.
  window.__sbc = { game, session, sync }
}

main().catch((error) => {
  console.error('[main] failed to start', error)
})
