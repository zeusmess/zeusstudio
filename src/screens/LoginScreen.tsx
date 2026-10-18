import { useEffect, useState } from 'react'
import { useApp } from '../app/appStore'
import { signInWithGoogle } from '../auth/authService'
import { isNativeApp } from '../services/platform'
import { isGoogleSignedIn, useAuth } from '../auth/authStore'
import { AvatarPicker } from '../components/AvatarPicker'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { GoogleMark, Icon } from '../components/Icon'
import { NameField } from '../components/NameField'
import { Notice } from '../components/Notice'
import { Screen, ScreenHeader } from '../components/Screen'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { validateDisplayName, type NameError } from '../profile/validation'
import type { AvatarId } from '../types'
import styles from './LoginScreen.module.css'

export default function LoginScreen() {
  const { t } = useI18n()
  const go = useApp((s) => s.go)
  const previous = useApp((s) => s.previous)
  const auth = useAuth()
  const google = isGoogleSignedIn(auth)
  const record = useProfile((s) => s.record)
  const setDisplayName = useProfile((s) => s.setDisplayName)
  const setAvatar = useProfile((s) => s.setAvatar)
  const chooseGuest = useProfile((s) => s.chooseGuest)
  const [name, setName] = useState(record.profile.displayName)
  const [avatar, setAvatarChoice] = useState<AvatarId>(record.profile.avatarId)
  const [error, setError] = useState<NameError | null>(null)

  const back = () => go(previous === 'PROFILE' ? 'PROFILE' : 'MENU')

  // Signing in with Google from here returns to where the player came from.
  useEffect(() => {
    if (google) go(previous === 'PROFILE' ? 'PROFILE' : 'MENU')
  }, [google, go, previous])

  const startAsGuest = () => {
    const validation = validateDisplayName(name)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setDisplayName(validation.value)
    setAvatar(avatar)
    chooseGuest()
    back()
  }

  const unconfigured = auth.status === 'unconfigured'

  return (
    <Screen testId="login-screen">
      <ScreenHeader title={t('login.title')} onBack={back} />

      <Card title={t('login.googleTitle')}>
        <p className={styles.body}>{t('login.googleBody')}</p>
        {unconfigured ? (
          <Notice tone="warning" title={t('login.notConfiguredTitle')} testId="google-unconfigured">
            {t('login.notConfiguredBody')}
          </Notice>
        ) : isNativeApp() ? (
          <Notice tone="info" title={t('login.inAppTitle')} testId="google-in-app">
            {t('login.inAppBody')}
          </Notice>
        ) : (
          <Button
            variant="google"
            size="lg"
            block
            icon={<GoogleMark />}
            loading={auth.status === 'signing-in' || auth.status === 'initializing'}
            onClick={() => void signInWithGoogle()}
            data-testid="google-continue"
          >
            {auth.status === 'signing-in' ? t('login.signingIn') : t('login.googleButton')}
          </Button>
        )}
        {auth.error && (
          <Notice tone="error" testId="google-error">
            {t(`login.errors.${auth.error}`)}
          </Notice>
        )}
      </Card>

      <div className={styles.divider} aria-hidden="true">
        <span>{t('app.or')}</span>
      </div>

      <Card title={t('login.guestTitle')}>
        <p className={styles.body}>{t('login.guestBody')}</p>
        <NameField
          value={name}
          onChange={(value) => {
            setName(value)
            setError(null)
          }}
          error={error}
          onSubmit={startAsGuest}
        />
        <div className={styles.avatars}>
          <span className={styles.label}>{t('profile.avatar')}</span>
          <AvatarPicker value={avatar} onChange={setAvatarChoice} unlocked={record.progress.unlockedCosmetics} onlyAvailable />
        </div>
        <Button size="lg" block icon={<Icon name="play" />} onClick={startAsGuest} data-testid="guest-start">
          {t('login.guestButton')}
        </Button>
      </Card>
    </Screen>
  )
}
