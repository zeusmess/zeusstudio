import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio/audioEngine'
import { Icon } from '../../components/Icon'
import { useHud } from '../../game/hudStore'
import { useI18n } from '../../locales/i18n'
import styles from './Countdown.module.css'

interface CountdownProps {
  /** performance.now() time at which play begins (online matches share it). */
  goAt?: number
  /** Otherwise the countdown lasts this long from when it appears. */
  durationMs?: number
  /** Called once, when play should begin. */
  onGo: () => void
  /** Milliseconds per count step. */
  stepMs: number
}

/** 3 · 2 · 1 · GO! with the level's intro card (and the tutorial on level 1). */
export function Countdown({ goAt: sharedGoAt, durationMs = 0, onGo, stepMs }: CountdownProps) {
  const { t, num } = useI18n()
  const hud = useHud()
  const [goAt] = useState(() => sharedGoAt ?? performance.now() + durationMs)
  const [display, setDisplay] = useState<number | 'go'>(() => Math.max(1, Math.ceil((goAt - performance.now()) / stepMs)))
  const fired = useRef(false)
  const last = useRef<number | 'go' | null>(null)

  useEffect(() => {
    let frame = 0
    const loop = () => {
      const remaining = goAt - performance.now()
      const next: number | 'go' = remaining > 0 ? Math.max(1, Math.ceil(remaining / stepMs)) : 'go'
      if (next !== last.current) {
        last.current = next
        setDisplay(next)
        audio.play(next === 'go' ? 'go' : 'tick')
      }
      if (next === 'go') {
        if (!fired.current) {
          fired.current = true
          onGo()
        }
        return
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [goAt, onGo, stepMs])

  const tutorial = hud.mode === 'campaign' && hud.levelId === 1
  const title =
    hud.mode === 'endless'
      ? t('levels.endlessCard')
      : hud.mode === 'versus'
        ? t('levels.themes.versus')
        : t('levels.level', { level: hud.levelId })

  return (
    <div className={styles.overlay} data-testid="countdown">
      <div className={styles.card}>
        <p className={styles.kicker}>{t(`levels.themes.${hud.theme}`)}</p>
        <h2 className={styles.title}>{title}</h2>
        {hud.target > 0 && <p className={`${styles.target} num`}>{t('levels.target', { target: hud.target })}</p>}
        {tutorial && (
          <ul className={styles.tips}>
            <li>
              <span className={styles.hand} aria-hidden="true">
                <Icon name="back" size={16} />
                <Icon name="chevron" size={16} />
              </span>
              {t('game.tutorialDrag')}
            </li>
            <li>{t('game.tutorialKeys')}</li>
            <li>{t('game.tutorialCatch')}</li>
            <li>{t('game.tutorialGoal', { target: hud.target })}</li>
          </ul>
        )}
      </div>
      <div key={String(display)} className={`${styles.count} num`} aria-live="assertive">
        {display === 'go' ? t('game.go') : num(display)}
      </div>
    </div>
  )
}
