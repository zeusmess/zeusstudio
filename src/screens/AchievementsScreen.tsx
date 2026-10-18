import { useApp } from '../app/appStore'
import { Icon, type IconName } from '../components/Icon'
import { ProgressBar } from '../components/ProgressBar'
import { Screen, ScreenHeader } from '../components/Screen'
import { useI18n } from '../locales/i18n'
import { ACHIEVEMENTS, type AchievementDefinition } from '../profile/achievements'
import { ACHIEVEMENT_REWARDS } from '../profile/cosmetics'
import { useProfile } from '../profile/profileStore'
import styles from './AchievementsScreen.module.css'

const ICONS: Record<AchievementDefinition['icon'], IconName> = {
  cup: 'cup',
  star: 'star',
  sparkle: 'sparkle',
  combo: 'bolt',
  streak: 'chart',
  trophy: 'trophy',
  crown: 'crown',
  infinity: 'infinity',
  users: 'users',
}

export default function AchievementsScreen() {
  const { t, num, date } = useI18n()
  const go = useApp((s) => s.go)
  const previous = useApp((s) => s.previous)
  const progress = useProfile((s) => s.record.progress)
  const unlocked = Object.keys(progress.achievements).length

  return (
    <Screen testId="achievements-screen">
      <ScreenHeader
        title={t('achievements.title')}
        subtitle={t('achievements.progress', { unlocked, total: ACHIEVEMENTS.length })}
        onBack={() => go(previous === 'PROFILE' ? 'PROFILE' : 'MENU')}
      />
      <ul className={styles.list}>
        {ACHIEVEMENTS.map((achievement) => {
          const at = progress.achievements[achievement.id]
          const done = at !== undefined
          const goal = achievement.goal?.(progress)
          const reward = ACHIEVEMENT_REWARDS[achievement.id]
          const rewardNames = [
            ...(reward?.avatars ?? []).map((a) => t(`avatars.${a}`)),
            ...(reward?.baskets ?? []).map((b) => t(`baskets.${b}`)),
          ]
          return (
            <li
              key={achievement.id}
              className={styles.item}
              data-done={done}
              data-testid={`achievement-${achievement.id}`}
            >
              <span className={styles.icon} aria-hidden="true">
                <Icon name={done ? ICONS[achievement.icon] : 'lock'} size={22} />
              </span>
              <div className={styles.text}>
                <h2 className={styles.title}>{t(`achievements.items.${achievement.id}.title`)}</h2>
                <p className={styles.desc}>{t(`achievements.items.${achievement.id}.desc`)}</p>
                {goal && !done && (
                  <div className={styles.goal}>
                    <ProgressBar
                      value={goal.value / goal.target}
                      label={`${num(goal.value)} / ${num(goal.target)}`}
                      size="sm"
                      tone="gold"
                    />
                    <span className="num">
                      {num(goal.value)} / {num(goal.target)}
                    </span>
                  </div>
                )}
                {rewardNames.length > 0 && (
                  <p className={styles.reward}>{t('achievements.reward', { reward: rewardNames.join(' · ') })}</p>
                )}
              </div>
              <span className={styles.state}>
                {done ? t('achievements.unlockedOn', { date: date(at) }) : t('app.locked')}
              </span>
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}
