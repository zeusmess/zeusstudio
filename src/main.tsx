import '@fontsource-variable/cairo'
import '@fontsource-variable/fraunces/soft.css'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { useApp } from './app/appStore'
import { bindDocumentSettings, useSettings } from './app/settings'
import { exposeTestHooks } from './game/controllerStore'
import { useHud } from './game/hudStore'
import { useProfile } from './profile/profileStore'

bindDocumentSettings()
exposeTestHooks({ app: useApp, settings: useSettings, profile: useProfile, hud: useHud })

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
