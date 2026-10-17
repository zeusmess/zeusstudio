import { isGoogleSignedIn, useAuth } from '../auth/authStore'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { Avatar } from './Art'
import styles from './ProfileChip.module.css'

interface ProfileChipProps {
  onClick: () => void
}

/** Avatar preview with name and account type; opens the profile. */
export function ProfileChip({ onClick }: ProfileChipProps) {
  const { t } = useI18n()
  const profile = useProfile((s) => s.record.profile)
  const google = useAuth((s) => isGoogleSignedIn(s))
  return (
    <button
      type="button"
      className={styles.chip}
      onClick={onClick}
      aria-label={t('menu.openProfile', { name: profile.displayName })}
      data-testid="profile-chip"
    >
      <Avatar id={profile.avatarId} size={34} />
      <span className={styles.text}>
        <bdi className={styles.name}>{profile.displayName}</bdi>
        <span className={styles.kind}>{google ? t('menu.accountGoogle') : t('menu.accountGuest')}</span>
      </span>
    </button>
  )
}
