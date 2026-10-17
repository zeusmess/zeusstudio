import { useEffect, useRef } from 'react'
import { useApp } from '../../app/appStore'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { Spinner } from '../../components/Spinner'
import { useI18n } from '../../locales/i18n'
import { useProfile } from '../../profile/profileStore'
import styles from './GameOverScreen.module.css'

interface GameOverScreenProps {
  onRetry: () => void
  onLevels: () => void
  onMenu: () => void
  onLeaderboard: () => void
}

export function GameOverScreen({ onRetry, onLevels, onMenu, onLeaderboard }: GameOverScreenProps) {
  const { t, num } = useI18n()
  const outcome = useApp((s) => s.outcome)
  const progress = useProfile((s) => s.record.progress)
  const primary = useRef<HTMLDivElement>(null)

  useEffect(() => {
    primary.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  if (!outcome) return null
  const { result } = outcome
  const endless = outcome.kind === 'endless'
  const percent = result.target > 0 ? Math.min(99, Math.floor((result.score / result.target) * 100)) : 0
  const best = endless ? (progress.endlessBest?.score ?? result.score) : (progress.bestScores[String(result.levelId)] ?? result.score)

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="gameover-title" data-testid="game-over">
      <div className={styles.card}>
        <h2 id="gameover-title" className={styles.title}>
          {endless ? t('gameOver.endlessTitle') : t('gameOver.title')}
        </h2>
        {!endless && <p className={styles.subtitle}>{t('gameOver.subtitle', { percent })}</p>}
        {!endless && (
          <ProgressBar value={percent / 100} label={t('hud.progress', { percent })} tone="gold" />
        )}

        <div className={styles.grid}>
          <div className={styles.cell}>
            <span>{t('victory.score')}</span>
            <strong className="num" data-testid="gameover-score">
              {num(result.score)}
            </strong>
          </div>
          {endless ? (
            <div className={styles.cell}>
              <span>{t('gameOver.wave')}</span>
              <strong className="num">{num(result.wave)}</strong>
            </div>
          ) : (
            <div className={styles.cell}>
              <span>{t('victory.target')}</span>
              <strong className="num">{num(result.target)}</strong>
            </div>
          )}
          <div className={styles.cell}>
            <span>{endless ? t('gameOver.personalBest') : t('hud.best')}</span>
            <strong className="num">{num(best)}</strong>
          </div>
          <div className={styles.cell}>
            <span>{t('victory.cupsCaught')}</span>
            <strong className="num">{num(result.caught)}</strong>
          </div>
        </div>

        {endless && outcome.summary.newBest && <p className={styles.newBest}>{t('gameOver.newBest')}</p>}
        {endless && (
          <p className={styles.rank} aria-live="polite">
            {outcome.rank === null ? <Spinner size={16} /> : t('gameOver.rank', { rank: outcome.rank })}
          </p>
        )}

        <div className={styles.actions} ref={primary}>
          <Button size="lg" block icon={<Icon name="refresh" />} onClick={onRetry} data-testid="retry">
            {endless ? t('gameOver.playAgain') : t('gameOver.retry')}
          </Button>
          {endless ? (
            <Button variant="secondary" block icon={<Icon name="chart" />} onClick={onLeaderboard}>
              {t('gameOver.leaderboard')}
            </Button>
          ) : (
            <Button variant="secondary" block icon={<Icon name="grid" />} onClick={onLevels}>
              {t('gameOver.levels')}
            </Button>
          )}
          <Button variant="ghost" block icon={<Icon name="home" />} onClick={onMenu} data-testid="gameover-menu">
            {t('gameOver.mainMenu')}
          </Button>
        </div>
      </div>
    </div>
  )
}
