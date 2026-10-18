import { useI18n } from '../locales/i18n'
import { AVATAR_ORDER, avatarUnlockedBy, isAvatarAvailable } from '../profile/cosmetics'
import type { AvatarId } from '../types'
import { Avatar } from './Art'
import { Icon } from './Icon'
import styles from './AvatarPicker.module.css'

interface AvatarPickerProps {
  value: AvatarId
  onChange: (avatar: AvatarId) => void
  unlocked: readonly string[]
  /** Hide avatars that are still locked (first-time setup). */
  onlyAvailable?: boolean
}

/** Avatar choice as a radiogroup; locked avatars say which achievement unlocks them. */
export function AvatarPicker({ value, onChange, unlocked, onlyAvailable = false }: AvatarPickerProps) {
  const { t } = useI18n()
  const avatars = AVATAR_ORDER.filter((a) => !onlyAvailable || isAvatarAvailable(a, unlocked))
  return (
    <div role="radiogroup" aria-label={t('profile.avatar')} className={styles.grid}>
      {avatars.map((avatar) => {
        const available = isAvatarAvailable(avatar, unlocked)
        const achievement = available ? null : avatarUnlockedBy(avatar)
        const name = t(`avatars.${avatar}`)
        return (
          <button
            key={avatar}
            type="button"
            role="radio"
            aria-checked={value === avatar}
            aria-disabled={!available}
            aria-label={t('profile.chooseAvatar', { name })}
            title={achievement ? t('profile.unlockHint', { achievement: t(`achievements.items.${achievement}.title`) }) : name}
            className={styles.option}
            onClick={() => available && onChange(avatar)}
            data-testid={`avatar-${avatar}`}
          >
            <Avatar id={avatar} size={52} />
            {!available && (
              <span className={styles.lock}>
                <Icon name="lock" size={16} />
              </span>
            )}
            {value === avatar && (
              <span className={styles.check}>
                <Icon name="check" size={14} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
