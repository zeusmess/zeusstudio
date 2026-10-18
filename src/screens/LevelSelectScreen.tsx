import { playCampaignLevel, playEndless } from '../app/actions'
import { useApp } from '../app/appStore'
import { Icon } from '../components/Icon'
import { Screen, ScreenHeader } from '../components/Screen'
import { LEVELS, LEVEL_COUNT } from '../game/levels/levels'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { isEndlessUnlocked } from '../profile/progress'
import styles from './LevelSelectScreen.module.css'

export default function LevelSelectScreen() {
  const { t, num } = useI18n()
  const go = useApp((s) => s.go)
  const progress = useProfile((s) => s.record.progress)
  const endlessUnlocked = isEndlessUnlocked(progress)

  return (
    <Screen width="wide" testId="level-select">
      <ScreenHeader
        title={t('levels.title')}
        subtitle={t('levels.progress', { done: progress.completedLevels.length, total: LEVEL_COUNT })}
        onBack={() => go('MENU')}
      />

      <ol className={styles.grid}>
        {LEVELS.map((level) => {
          const unlocked = level.id <= progress.unlockedLevel
          const completed = progress.completedLevels.includes(level.id)
          const best = progress.bestScores[String(level.id)]
          return (
            <li key={level.id}>
              <button
                type="button"
                className={styles.card}
                data-theme={level.theme}
                data-state={completed ? 'completed' : unlocked ? 'open' : 'locked'}
                disabled={!unlocked}
                onClick={() => playCampaignLevel(level.id)}
                aria-label={`${t('levels.play', { level: level.id })} — ${t('levels.target', { target: level.target })}`}
                data-testid={`level-${level.id}`}
              >
                <span className={styles.top}>
                  <span className={`${styles.number} num`}>{num(level.id)}</span>
                  {completed && (
                    <span className={styles.done} title={t('levels.completed')}>
                      <Icon name="check" size={16} />
                    </span>
                  )}
                  {!unlocked && <Icon name="lock" size={18} className={styles.lockIcon} />}
                </span>
                <span className={styles.theme}>{t(`levels.themes.${level.theme}`)}</span>
                <span className={`${styles.target} num`}>{t('levels.target', { target: level.target })}</span>
                <span className={`${styles.best} num`}>
                  {!unlocked
                    ? t('levels.locked', { level: level.id - 1 })
                    : best
                      ? t('levels.best', { score: best })
                      : '\u00a0'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        className={styles.endless}
        disabled={!endlessUnlocked}
        onClick={() => playEndless()}
        data-testid="level-endless"
      >
        <span className={styles.endlessIcon}>
          <Icon name={endlessUnlocked ? 'infinity' : 'lock'} size={28} />
        </span>
        <span className={styles.endlessText}>
          <strong>{t('levels.endlessCard')}</strong>
          <span>
            {endlessUnlocked
              ? progress.endlessBest
                ? t('levels.endlessBest', { score: progress.endlessBest.score, wave: progress.endlessBest.wave })
                : t('levels.endlessDesc')
              : t('menu.endlessLocked')}
          </span>
        </span>
        {endlessUnlocked && <Icon name="chevron" />}
      </button>
    </Screen>
  )
}
