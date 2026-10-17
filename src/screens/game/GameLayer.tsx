import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { Spinner } from '../../components/Spinner'
import type { GameController } from '../../game/GameController'
import { useHud } from '../../game/hudStore'
import { loadController } from '../../game/loadController'
import { useI18n } from '../../locales/i18n'
import styles from './GameLayer.module.css'

interface GameLayerProps {
  active: boolean
  onReady: (controller: GameController) => void
}

/**
 * The game canvas lives here for the whole session (one Phaser instance), under
 * the screens. It sleeps while the menus are showing.
 */
export function GameLayer({ active, onReady }: GameLayerProps) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [controller, setController] = useState<GameController | null>(null)
  const theme = useHud((s) => s.theme)

  useEffect(() => {
    let cancelled = false
    loadController()
      .then((loaded) => {
        if (cancelled || !hostRef.current) return
        loaded.mount(hostRef.current)
        setController(loaded)
        setState('ready')
        onReady(loaded)
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [attempt, onReady])

  useEffect(() => {
    if (!controller) return
    if (active) controller.wake()
    else controller.sleep()
  }, [active, controller])

  return (
    <div className={styles.layer} data-active={active} data-theme={theme} aria-hidden={!active}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.light} />
        <div className={styles.lamps}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.stars} />
      </div>
      <div ref={hostRef} className={styles.host} data-testid="game-canvas-host" />
      {active && state === 'loading' && (
        <div className={styles.status}>
          <Spinner size={32} />
          <p>{t('game.loadingGame')}</p>
        </div>
      )}
      {active && state === 'error' && (
        <div className={styles.status}>
          <Notice
            tone="error"
            title={t('game.loadError')}
            action={
              <Button
                size="sm"
                onClick={() => {
                  setState('loading')
                  setAttempt((a) => a + 1)
                }}
              >
                {t('app.retry')}
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}
