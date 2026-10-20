import '@fontsource-variable/cairo'
import '@fontsource-variable/inter'
import './styles/main.css'
import './styles/legacy.css'
import './styles/app.css'
import { on } from './core/events.js'
import { game, hooks, startGame } from './legacy/game.js'
import { APP_VERSION, compareVersions } from './platform/config.js'
import { createSync } from './platform/sync.js'
import { installSystems } from './systems/install.js'
import { ensureSbc } from './systems/sbc.js'
import { installAdmin } from './ui/admin.js'
import { installChrome } from './ui/chrome.js'
import { installIncidentsUI } from './ui/incidentsUI.js'
import { openModal } from './ui/modal.js'
import { runSplash } from './ui/splash.js'
import { installCareerTab } from './ui/tabs/careerTab.js'
import { installCommunityTab } from './ui/tabs/communityTab.js'
import { installGuideTab } from './ui/tabs/guideTab.js'
import { installMissionsTab } from './ui/tabs/missionsTab.js'
import { installShiftTab } from './ui/tabs/shiftTab.js'

async function main() {
  const session = await runSplash(document.getElementById('sbcSplashRoot'))
  const sync = createSync(session, game, hooks)
  const savedState = await sync.loadInitialState()

  hooks.playerName = () => session.identity.name

  let config = session.config || {}
  const getConfig = () => config
  const openTab = (key) => document.querySelector(`.nav-tab[data-tab="${key}"]`)?.click()

  // The systems listen to the game's events, so they are installed before it starts.
  const systems = installSystems({ game, hooks, identity: session.identity, getConfig, openTab })
  sync.setProgressSource(systems.progress)

  const admin = installAdmin({ session, getConfig })
  const tabs = {
    missions: installMissionsTab({ game, systems }),
    shift: installShiftTab({ game, systems }),
    career: installCareerTab({ game, systems, identity: session.identity }),
    community: installCommunityTab({ game, session, systems }),
    guide: installGuideTab(),
  }
  installIncidentsUI({ game, systems })
  const chrome = installChrome({ game, session, sync, systems, getConfig, openAdmin: admin.open })

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => tabs[btn.getAttribute('data-tab')]?.render())
  })
  document.getElementById('roleCardsContainer')?.addEventListener('click', () => setTimeout(chrome.lockRoles, 0))
  on('onboarding:done', () => {
    systems.career.syncRole()
    chrome.lockRoles()
  })
  on('sync:saved', ({ at }) => {
    if (game.state) ensureSbc(game.state).flags.lastCloudSave = at
  })

  startGame({ savedState })
  sync.start()

  // The owner's live settings: announcements, events, maintenance, versions, bans.
  if (session.cloud) {
    let blocked = null
    const block = (title, text) => {
      if (blocked) return
      sync.flush()
      game.state.paused = true
      blocked = openModal({ title, closable: false, tone: 'rose' })
      blocked.setBody(`<p class="text-sm text-emerald-100 leading-relaxed">${text}</p><p class="text-[11px] text-emerald-300/70 mt-3">تقدمك محفوظ على حسابك.</p>`)
    }
    session.cloud.watchConfig((c) => {
      config = c || {}
      chrome.renderAnnouncement()
      if (session.isAdmin) return
      if (config.maintenance) block('🛠️ اللعبة في صيانة الآن', config.maintenanceText || 'نعمل على تحديث جديد. ارجع بعد قليل.')
      else if (config.minVersion && compareVersions(APP_VERSION, config.minVersion) < 0) block('🆕 يوجد تحديث مطلوب', `نسختك ${APP_VERSION} قديمة. حمّل النسخة الجديدة من الرابط في رسالة المسؤول لمتابعة اللعب.`)
      else if (blocked) {
        blocked.close()
        blocked = null
        game.state.paused = false
      }
    })
    session.cloud.watchModeration((all) => {
      session.moderation = (all || {})[session.identity.uid] || {}
      if (session.moderation.banned && !session.isAdmin) block('⛔ تم إيقاف حسابك', 'تم إيقاف هذا الحساب بواسطة مسؤول اللعبة. للاستفسار تواصل معه مباشرة.')
    })
  }

  // Handy for support and for the end-to-end tests.
  window.__sbc = { game, session, sync, systems, tabs }
}

main().catch((error) => {
  console.error('[main] failed to start', error)
})
