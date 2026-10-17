import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../../components/Art'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { ProgressBar } from '../../components/ProgressBar'
import { useHud } from '../../game/hudStore'
import { useI18n } from '../../locales/i18n'
import type { AvatarId } from '../../types'
import styles from './Hud.module.css'

interface HudProps {
  onPause: () => void
  canPause: boolean
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function LifeCup({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 24" width="18" height="22" aria-hidden="true" className={filled ? styles.lifeOn : styles.lifeOff}>
      <path d="M3 6h14l-1.6 15.2a1.6 1.6 0 0 1-1.6 1.4H6.2a1.6 1.6 0 0 1-1.6-1.4z" />
      <rect x="1.5" y="2.5" width="17" height="4" rx="2" />
    </svg>
  )
}

export function Hud({ onPause, canPause }: HudProps) {
  const { t, num } = useI18n()
  const hud = useHud()
  const [shake, setShake] = useState(false)
  const [bump, setBump] = useState(false)
  const lastPulse = useRef(hud.hitPulse)
  const lastScore = useRef(hud.score)

  useEffect(() => {
    if (hud.hitPulse === lastPulse.current) return
    lastPulse.current = hud.hitPulse
    setShake(true)
    const timer = window.setTimeout(() => setShake(false), 420)
    return () => window.clearTimeout(timer)
  }, [hud.hitPulse])

  useEffect(() => {
    if (hud.score <= lastScore.current) {
      lastScore.current = hud.score
      return
    }
    lastScore.current = hud.score
    setBump(true)
    const timer = window.setTimeout(() => setBump(false), 160)
    return () => window.clearTimeout(timer)
  }, [hud.score])

  const progress = hud.target > 0 ? hud.score / hud.target : 0
  const levelLabel =
    hud.mode === 'endless'
      ? t('hud.wave', { wave: hud.wave })
      : hud.mode === 'versus'
        ? t(`levels.themes.versus`)
        : t('hud.level', { level: hud.levelId })

  return (
    <header className={styles.hud} data-testid="hud">
      <div className={styles.row}>
        {canPause ? (
          <IconButton label={t('hud.pause')} onClick={onPause} data-testid="pause-button">
            <Icon name="pause" />
          </IconButton>
        ) : (
          <span className={styles.spacer} />
        )}
        <div className={styles.center}>
          <span className={styles.level}>{levelLabel}</span>
          {hud.timeLeftMs !== null && (
            <span className={`${styles.clock} num`} aria-label={t('match.timeLeft')} data-testid="match-clock">
              {formatClock(hud.timeLeftMs)}
            </span>
          )}
        </div>
        {hud.mode === 'versus' ? (
          <span className={styles.spacer} />
        ) : (
          <div
            className={[styles.lives, shake ? styles.shake : ''].join(' ')}
            role="img"
            aria-label={t('hud.livesValue', { count: hud.lives })}
            data-testid="hud-lives"
            data-lives={hud.lives}
          >
            {Array.from({ length: hud.maxLives }, (_, i) => (
              <LifeCup key={i} filled={i < hud.lives} />
            ))}
            <span className={`${styles.livesCount} num`} aria-hidden="true">
              {num(hud.lives)}
            </span>
          </div>
        )}
      </div>

      <div className={styles.scoreRow}>
        <div className={styles.scoreBlock}>
          <span className={styles.label}>{t('hud.score')}</span>
          <span className={styles.scoreLine}>
            <bdi className={[styles.score, 'num', bump ? styles.bump : ''].join(' ')} data-testid="hud-score">
              {num(hud.score)}
            </bdi>
            {hud.target > 0 && (
              <bdi className={`${styles.target} num`}>
                / {num(hud.target)}
              </bdi>
            )}
          </span>
        </div>
        <div className={styles.badges}>
          {hud.multiplier > 1 && (
            <span className={`${styles.combo} num`} data-testid="hud-combo">
              {t('hud.combo')} ×{num(hud.multiplier)}
            </span>
          )}
          {hud.streak >= 3 && (
            <span className={`${styles.streak} num`}>
              {t('hud.streak')} {num(hud.streak)}
            </span>
          )}
        </div>
      </div>

      {hud.target > 0 && (
        <ProgressBar
          value={progress}
          label={t('hud.progress', { percent: Math.min(100, Math.round(progress * 100)) })}
          tone={progress >= 0.75 ? 'gold' : 'green'}
          testId="hud-progress"
        />
      )}

      {hud.opponent && (
        <div className={styles.opponent} data-testid="hud-opponent">
          <Avatar id={hud.opponent.avatar as AvatarId} size={28} />
          <bdi className={styles.opponentName}>{hud.opponent.name}</bdi>
          <span className={`${styles.opponentScore} num`} data-testid="hud-opponent-score">
            {num(hud.opponent.score)}
          </span>
          <span
            className={[styles.dot, hud.opponent.connected ? styles.online : styles.offline].join(' ')}
            title={hud.opponent.connected ? t('lobby.connected') : t('lobby.disconnected')}
          />
          <div className={styles.opponentBar}>
            <ProgressBar
              value={hud.target > 0 ? hud.opponent.score / hud.target : 0}
              label={`${t('hud.opponent')}: ${num(hud.opponent.score)}`}
              tone="cream"
              size="sm"
            />
          </div>
        </div>
      )}
    </header>
  )
}
