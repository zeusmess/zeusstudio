import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/appStore'
import { Button } from '../../components/Button'
import { Confetti } from '../../components/Confetti'
import { Icon } from '../../components/Icon'
import { Mascot } from '../../components/Mascot'
import { LOGO_ART } from '../../game/art/assets'
import { getLevel, LEVEL_COUNT } from '../../game/levels/levels'
import { useI18n } from '../../locales/i18n'
import { useProfile } from '../../profile/profileStore'
import { campaignTotal } from '../../profile/progress'
import styles from './VictoryScreen.module.css'

interface VictoryScreenProps {
  onNext: () => void
  onReplay: () => void
  onMenu: () => void
  onEndless: () => void
  onReplayCampaign: () => void
}

const READY_MS = 1500

/**
 * The signature celebration: green wipe from the basket, the logo (kept
 * static), the mascot's wink, confetti, LEVEL COMPLETED and the score — with
 * the buttons ready in about a second and a half (any tap skips ahead).
 */
export function VictoryScreen({ onNext, onReplay, onMenu, onEndless, onReplayCampaign }: VictoryScreenProps) {
  const { t, tp, num } = useI18n()
  const outcome = useApp((s) => s.outcome)
  const progress = useProfile((s) => s.record.progress)
  const [ready, setReady] = useState(false)
  const primaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), READY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (ready) primaryRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [ready])

  if (!outcome || outcome.kind !== 'campaign') return null
  const { result, summary } = outcome
  const level = getLevel(result.levelId)
  const campaignDone = summary.campaignJustCompleted || (result.levelId === LEVEL_COUNT && progress.completedLevels.length >= LEVEL_COUNT)
  const hasNext = result.levelId < LEVEL_COUNT

  return (
    <div
      className={[styles.victory, ready ? styles.ready : '', campaignDone ? styles.campaign : ''].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
      data-testid="victory"
      onPointerDown={() => setReady(true)}
    >
      <div className={styles.wipe} aria-hidden="true" />
      <div className={styles.rays} aria-hidden="true" />
      <Confetti count={campaignDone ? 220 : 140} />

      <div className={styles.content}>
        <div className={styles.emblems}>
          <img
            className={styles.logo}
            src={LOGO_ART.url}
            alt={LOGO_ART.official ? 'Starbucks' : t('app.title')}
            draggable={false}
          />
          <Mascot className={styles.mascot} wink="once" size={92} label={t('victory.winkLabel')} />
        </div>

        <h2 id="victory-title" className={styles.title}>
          {campaignDone ? t('victory.campaignCompleted') : t('victory.levelCompleted')}
        </h2>
        <p className={styles.subtitle}>
          {t('levels.level', { level: level.id })} · {t(`levels.themes.${level.theme}`)}
        </p>

        <div className={styles.scoreCard}>
          <div className={styles.scoreCell}>
            <span>{t('victory.score')}</span>
            <strong className="num" data-testid="victory-score">
              {num(result.score)}
            </strong>
          </div>
          <div className={styles.scoreCell}>
            <span>{t('victory.target')}</span>
            <strong className="num">{num(result.target)}</strong>
          </div>
          {summary.newBest && <span className={styles.newBest}>{t('victory.newBest')}</span>}
          <p className={styles.sentence}>{t('victory.caughtSentence', { cups: tp('cups', result.caught) })}</p>
          <dl className={styles.stats}>
            <div>
              <dt>{t('victory.bestStreak')}</dt>
              <dd className="num">{num(result.bestStreak)}</dd>
            </div>
            <div>
              <dt>{t('victory.livesLeft')}</dt>
              <dd className="num">{num(result.livesLeft)}</dd>
            </div>
          </dl>
        </div>

        {campaignDone && (
          <div className={styles.campaignCard}>
            <div className={styles.campaignRow}>
              <span>{t('victory.campaignTotal')}</span>
              <strong className="num">{num(campaignTotal(progress))}</strong>
            </div>
            <div className={styles.campaignRow}>
              <span>{t('victory.levelsCleared', { done: progress.completedLevels.length, total: LEVEL_COUNT })}</span>
              <span className={styles.badge}>
                <Icon name="trophy" size={16} />
                {t('victory.finalAchievement', { name: t('achievements.items.campaign_champion.title') })}
              </span>
            </div>
            <div className={styles.unlock} data-testid="endless-unlocked">
              <span className={styles.lock} aria-hidden="true">
                <Icon name="lock" size={22} />
              </span>
              <Icon name="infinity" size={22} />
              {t('victory.endlessUnlocked')}
            </div>
          </div>
        )}

        {summary.achievements.length > 0 && (
          <ul className={styles.achievements}>
            {summary.achievements.map((id) => (
              <li key={id}>
                <Icon name="trophy" size={14} />
                {t(`achievements.items.${id}.title`)}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions} ref={primaryRef}>
          {campaignDone ? (
            <>
              <Button size="lg" variant="gold" block icon={<Icon name="infinity" />} onClick={onEndless} data-testid="play-endless">
                {t('victory.playEndless')}
              </Button>
              <Button variant="secondary" block icon={<Icon name="refresh" />} onClick={onReplayCampaign}>
                {t('victory.replayCampaign')}
              </Button>
            </>
          ) : (
            <>
              {hasNext && (
                <Button size="lg" variant="gold" block icon={<Icon name="play" />} onClick={onNext} data-testid="next-level">
                  {t('victory.nextLevel')}
                </Button>
              )}
              <Button variant="secondary" block icon={<Icon name="refresh" />} onClick={onReplay} data-testid="replay-level">
                {t('victory.replay')}
              </Button>
            </>
          )}
          <Button variant="ghost" block icon={<Icon name="home" />} onClick={onMenu} data-testid="victory-menu">
            {t('victory.mainMenu')}
          </Button>
        </div>
      </div>
    </div>
  )
}
