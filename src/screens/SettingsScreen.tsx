import { useState } from 'react'
import { useApp } from '../app/appStore'
import { useSettings } from '../app/settings'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Segmented, Slider, Toggle } from '../components/Controls'
import { Dialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Screen, ScreenHeader } from '../components/Screen'
import { toast } from '../components/toastStore'
import { Wordmark } from '../components/Wordmark'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { appVersion } from '../services/config'
import type { Language, MotionPreference } from '../types'
import styles from './SettingsScreen.module.css'

export default function SettingsScreen() {
  const { t } = useI18n()
  const go = useApp((s) => s.go)
  const settings = useSettings()
  const resetProgress = useProfile((s) => s.resetProgress)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <Screen testId="settings-screen">
      <ScreenHeader title={t('settings.title')} onBack={() => go('MENU')} />

      <Card title={t('settings.language')}>
        <Segmented<Language>
          label={t('settings.language')}
          hideLabel
          value={settings.language}
          onChange={(language) => settings.setLanguage(language)}
          options={[
            { value: 'en', label: <span lang="en">{t('settings.english')}</span>, testId: 'lang-en' },
            { value: 'ar', label: <span lang="ar">{t('settings.arabic')}</span>, testId: 'lang-ar' },
          ]}
        />
      </Card>

      <Card title={t('settings.audio')}>
        <Slider
          label={t('settings.music')}
          value={settings.musicVolume}
          onChange={(musicVolume) => settings.update({ musicVolume })}
          disabled={settings.muted}
          testId="music-volume"
        />
        <Slider
          label={t('settings.sfx')}
          value={settings.sfxVolume}
          onChange={(sfxVolume) => settings.update({ sfxVolume })}
          disabled={settings.muted}
          testId="sfx-volume"
        />
        <Toggle label={t('settings.mute')} checked={settings.muted} onChange={(muted) => settings.update({ muted })} testId="mute" />
      </Card>

      <Card title={t('settings.motion')}>
        <Segmented<MotionPreference>
          label={t('settings.motion')}
          hideLabel
          value={settings.motion}
          onChange={(motion) => settings.update({ motion })}
          options={[
            { value: 'system', label: t('settings.motionSystem') },
            { value: 'reduced', label: t('settings.motionReduced'), testId: 'motion-reduced' },
            { value: 'full', label: t('settings.motionFull') },
          ]}
        />
        <p className={styles.hint}>{t('settings.motionHint')}</p>
      </Card>

      <Card title={t('settings.controls')}>
        <Toggle
          label={t('settings.arrowButtons')}
          hint={t('settings.arrowButtonsHint')}
          checked={settings.arrowButtons}
          onChange={(arrowButtons) => settings.update({ arrowButtons })}
          testId="arrow-buttons"
        />
        <Toggle
          label={t('settings.mouseControl')}
          checked={settings.mouseControl}
          onChange={(mouseControl) => settings.update({ mouseControl })}
        />
        <Toggle
          label={t('settings.haptics')}
          hint={t('settings.hapticsHint')}
          checked={settings.haptics}
          onChange={(haptics) => settings.update({ haptics })}
        />
      </Card>

      <Card title={t('settings.data')}>
        <Button variant="danger" icon={<Icon name="refresh" />} onClick={() => setConfirmReset(true)} data-testid="reset-progress">
          {t('settings.resetProgress')}
        </Button>
      </Card>

      <Card title={t('settings.about')} className={styles.about}>
        <Wordmark size="compact" />
        <p className={styles.credit}>{t('app.credit')}</p>
        <p className={styles.version}>{t('app.version', { version: appVersion })}</p>
        <p className={styles.legal}>{t('app.disclaimer')}</p>
        <p className={styles.legal}>{t('app.trademark')}</p>
      </Card>

      <Dialog
        open={confirmReset}
        tone="danger"
        title={t('settings.resetConfirmTitle')}
        description={t('settings.resetConfirmBody')}
        onClose={() => setConfirmReset(false)}
        testId="reset-dialog"
        actions={
          <>
            <Button
              variant="danger"
              block
              onClick={() => {
                resetProgress()
                setConfirmReset(false)
                toast({ tone: 'info', title: t('settings.resetDone') })
              }}
              data-testid="confirm-reset"
            >
              {t('app.confirm')}
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmReset(false)} data-autofocus>
              {t('app.cancel')}
            </Button>
          </>
        }
      />
    </Screen>
  )
}
