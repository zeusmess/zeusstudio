import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { playCampaignLevel, playEndless } from '../app/actions'
import { useApp } from '../app/appStore'
import { useSettings } from '../app/settings'
import { useControllerStore } from '../game/controllerStore'
import { useHud } from '../game/hudStore'
import { matchElapsed, useMatchClock } from '../multiplayer/matchClock'
import { useRoom } from '../multiplayer/roomStore'
import { useI18n } from '../locales/i18n'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Countdown } from './game/Countdown'
import { GameOverScreen } from './game/GameOverScreen'
import { Hud } from './game/Hud'
import { BannerView, RotateHint, TouchControls, TutorialHint } from './game/Overlays'
import { PauseDialog } from './game/PauseDialog'
import { VictoryScreen } from './game/VictoryScreen'
import styles from './GameScreen.module.css'

const COUNT_STEP_MS = 750
// Loaded only when an online match ends.
const MatchResults = lazy(() => import('./game/MatchResults').then((module) => ({ default: module.MatchResults })))

export default function GameScreen() {
  const screen = useApp((s) => s.screen)
  const go = useApp((s) => s.go)
  const play = useApp((s) => s.play)
  const runId = useApp((s) => s.runId)
  const controller = useControllerStore((s) => s.controller)
  const arrowButtons = useSettings((s) => s.arrowButtons)
  const mouseControl = useSettings((s) => s.mouseControl)
  const goAtLocal = useMatchClock((s) => s.goAtLocal)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointerDown = useRef(false)
  const preparedRun = useHud((s) => s.run)
  const prepared = preparedRun === runId
  const awaitingResult = useRoom((s) => s.awaitingResult)
  const [leaving, setLeaving] = useState(false)
  const { t } = useI18n()

  const versus = play?.mode === 'versus'
  const canPause = !versus && screen === 'PLAYING'

  // A fresh session for every run (start, retry, next level). Nothing carries over.
  useEffect(() => {
    if (!controller || !play) return
    controller.prepare(play, runId)
    // A new run is signalled by runId; `play` changes together with it.
  }, [controller, runId]) // oxlint-disable-line react-hooks/exhaustive-deps

  // The simulation runs only in PLAYING.
  useEffect(() => {
    if (!controller || !prepared) return
    if (screen === 'PLAYING') {
      if (controller.session?.status === 'ready') controller.start(versus ? matchElapsed : undefined)
      else controller.resume()
    } else if (screen === 'PAUSED') {
      controller.pause()
    }
  }, [screen, controller, prepared, versus])

  // Leaving for the menus: record any unfinished run and put the canvas to sleep.
  useEffect(() => () => useControllerStore.getState().controller?.release(), [])

  // Keyboard: ← → / A D move (physical keys, so any keyboard layout works); P or Esc pauses.
  useEffect(() => {
    if (!controller) return
    const held = new Set<'left' | 'right'>()
    const applyAxis = () => controller.setAxis(((held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)) as -1 | 0 | 1)
    const direction = (event: KeyboardEvent) =>
      event.code === 'ArrowLeft' || event.code === 'KeyA'
        ? 'left'
        : event.code === 'ArrowRight' || event.code === 'KeyD'
          ? 'right'
          : null
    const onDown = (event: KeyboardEvent) => {
      const state = useApp.getState().screen
      const dir = direction(event)
      if (dir && state === 'PLAYING') {
        event.preventDefault()
        held.add(dir)
        applyAxis()
      } else if ((event.code === 'Escape' || event.code === 'KeyP') && state === 'PLAYING' && !versus) {
        event.preventDefault()
        go('PAUSED')
      }
    }
    const onUp = (event: KeyboardEvent) => {
      const dir = direction(event)
      if (!dir) return
      held.delete(dir)
      applyAxis()
    }
    const onBlur = () => {
      held.clear()
      applyAxis()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [controller, go, versus])

  // Hiding the tab pauses single-player games (online matches keep their shared clock).
  useEffect(() => {
    if (versus) return
    const onHide = () => {
      if (document.visibilityState === 'hidden' && useApp.getState().screen === 'PLAYING') go('PAUSED')
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [go, versus])

  const pointerX = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    return rect ? event.clientX - rect.left : event.clientX
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!controller || screen !== 'PLAYING') return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerDown.current = true
    controller.setPointer(pointerX(event))
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!controller || screen !== 'PLAYING') return
    if (pointerDown.current || (event.pointerType === 'mouse' && mouseControl)) controller.setPointer(pointerX(event))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerDown.current = false
    if (event.pointerType !== 'mouse' || !mouseControl) controller?.setPointer(null)
  }
  const onPointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && !pointerDown.current) controller?.setPointer(null)
  }

  const startPlaying = useCallback(() => go('PLAYING'), [go])
  const restart = () => {
    if (!play) return
    if (play.mode === 'campaign') playCampaignLevel(play.levelId)
    else if (play.mode === 'endless') playEndless()
  }

  return (
    <div className={styles.screen} data-testid="game-screen" data-state={screen}>
      <div
        ref={surfaceRef}
        className={styles.surface}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        data-testid="game-surface"
      />
      <Hud
        onPause={() => go('PAUSED')}
        canPause={canPause}
        onLeave={versus && (screen === 'COUNTDOWN' || screen === 'PLAYING') ? () => setLeaving(true) : undefined}
      />
      <BannerView />
      <TutorialHint />
      {controller && arrowButtons && screen === 'PLAYING' && <TouchControls controller={controller} />}
      <RotateHint />

      {screen === 'COUNTDOWN' && controller && prepared && (!versus || goAtLocal !== null) && (
        <Countdown
          key={runId}
          goAt={versus ? (goAtLocal ?? undefined) : undefined}
          durationMs={3 * COUNT_STEP_MS + 250}
          onGo={startPlaying}
          stepMs={versus ? 1000 : COUNT_STEP_MS}
        />
      )}

      {versus && awaitingResult && screen === 'PLAYING' && (
        <p className={styles.awaiting} role="status" data-testid="awaiting-result">
          {t('match.waitingResult')}
        </p>
      )}

      <Dialog
        open={leaving && versus && (screen === 'COUNTDOWN' || screen === 'PLAYING')}
        title={t('match.leaveTitle')}
        description={t('match.leaveBody')}
        tone="danger"
        onClose={() => setLeaving(false)}
        testId="leave-dialog"
        actions={
          <>
            <Button size="lg" block onClick={() => setLeaving(false)} data-autofocus>
              {t('match.keepPlaying')}
            </Button>
            <Button
              variant="danger"
              block
              icon={<Icon name="logout" />}
              onClick={() => {
                setLeaving(false)
                void useRoom.getState().leave()
                go('MENU')
              }}
              data-testid="confirm-leave"
            >
              {t('match.leave')}
            </Button>
          </>
        }
      />

      <PauseDialog
        open={screen === 'PAUSED'}
        endless={play?.mode === 'endless'}
        onResume={() => go('PLAYING')}
        onRestart={restart}
        onQuit={() => go('MENU')}
      />

      {screen === 'LEVEL_COMPLETE' && play?.mode === 'campaign' && (
        <VictoryScreen
          onNext={() => playCampaignLevel(play.levelId + 1)}
          onReplay={() => playCampaignLevel(play.levelId)}
          onMenu={() => go('MENU')}
          onEndless={() => playEndless()}
          onReplayCampaign={() => playCampaignLevel(1)}
        />
      )}

      {screen === 'GAME_OVER' && (
        <GameOverScreen
          onRetry={restart}
          onLevels={() => go('LEVEL_SELECT')}
          onMenu={() => go('MENU')}
          onLeaderboard={() => go('LEADERBOARD')}
        />
      )}

      {screen === 'MATCH_RESULTS' && (
        <Suspense fallback={null}>
          <MatchResults />
        </Suspense>
      )}
    </div>
  )
}
