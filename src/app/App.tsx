import { lazy, Suspense, useEffect, useState } from 'react'
import { audio, bindAudio } from '../audio/audioEngine'
import { initAuth } from '../auth/authService'
import { Spinner } from '../components/Spinner'
import { Toasts } from '../components/Toasts'
import { toast } from '../components/toastStore'
import { currentI18n, useI18n } from '../locales/i18n'
import { onAchievementsUnlocked } from '../profile/profileStore'
import { setController } from '../game/controllerStore'
import { GameLayer } from '../screens/game/GameLayer'
import { OpeningScreen } from '../screens/OpeningScreen'
import type { AppScreen } from '../types'
import styles from './App.module.css'
import { useApp } from './appStore'
import { GAME_STATES } from './stateMachine'

const LoginScreen = lazy(() => import('../screens/LoginScreen'))
const LevelSelectScreen = lazy(() => import('../screens/LevelSelectScreen'))
const ProfileScreen = lazy(() => import('../screens/ProfileScreen'))
const SettingsScreen = lazy(() => import('../screens/SettingsScreen'))
const AchievementsScreen = lazy(() => import('../screens/AchievementsScreen'))
const LeaderboardScreen = lazy(() => import('../screens/LeaderboardScreen'))
const LobbyScreen = lazy(() => import('../screens/LobbyScreen'))
const GameScreen = lazy(() => import('../screens/GameScreen'))

function Loading() {
  const { t } = useI18n()
  return (
    <div className={styles.loading}>
      <Spinner size={32} label={t('app.loading')} />
    </div>
  )
}

function CurrentScreen({ screen }: { screen: AppScreen }) {
  if (GAME_STATES.has(screen)) return <GameScreen />
  switch (screen) {
    case 'INITIALIZING':
      return <Loading />
    case 'MENU':
      return <OpeningScreen />
    case 'LOGIN':
      return <LoginScreen />
    case 'LEVEL_SELECT':
      return <LevelSelectScreen />
    case 'PROFILE':
      return <ProfileScreen />
    case 'SETTINGS':
      return <SettingsScreen />
    case 'ACHIEVEMENTS':
      return <AchievementsScreen />
    case 'LEADERBOARD':
      return <LeaderboardScreen />
    case 'LOBBY':
      return <LobbyScreen />
    default:
      return <OpeningScreen />
  }
}

export function App() {
  const screen = useApp((s) => s.screen)
  const inGame = GAME_STATES.has(screen)
  // Phaser loads the first time a game starts, then stays alive (one WebGL context).
  const [gameMounted, setGameMounted] = useState(false)
  if (inGame && !gameMounted) setGameMounted(true)

  useEffect(() => {
    void initAuth()
    const unbindAudio = bindAudio()
    audio.setMusic('menu')
    const unsubscribe = onAchievementsUnlocked((ids) => {
      const { t } = currentI18n()
      for (const id of ids) {
        toast({ tone: 'achievement', title: t('achievements.toast'), body: t(`achievements.items.${id}.title`) })
      }
    })
    // Give the display fonts a moment so the title never flashes in a fallback face.
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    const timeout = new Promise((resolve) => setTimeout(resolve, 700))
    void Promise.race([fontsReady, timeout]).then(() => useApp.getState().go('MENU'))
    return () => {
      unsubscribe()
      unbindAudio()
    }
  }, [])

  return (
    <div className={styles.app}>
      {gameMounted && <GameLayer active={inGame} onReady={setController} />}
      <Suspense fallback={<Loading />}>
        <CurrentScreen screen={screen} />
      </Suspense>
      <Toasts />
    </div>
  )
}
