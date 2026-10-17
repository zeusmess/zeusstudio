import { useSettings } from '../../app/settings'
import { Button } from '../../components/Button'
import { Slider, Toggle } from '../../components/Controls'
import { Dialog } from '../../components/Dialog'
import { Icon } from '../../components/Icon'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useI18n } from '../../locales/i18n'
import styles from './PauseDialog.module.css'

interface PauseDialogProps {
  open: boolean
  endless: boolean
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
}

/** Pausing never loses anything: resume continues the same run exactly where it stopped. */
export function PauseDialog({ open, endless, onResume, onRestart, onQuit }: PauseDialogProps) {
  const { t } = useI18n()
  const muted = useSettings((s) => s.muted)
  const musicVolume = useSettings((s) => s.musicVolume)
  const update = useSettings((s) => s.update)

  return (
    <Dialog
      open={open}
      title={t('game.paused')}
      onClose={onResume}
      testId="pause-dialog"
      actions={
        <>
          <Button size="lg" block icon={<Icon name="play" />} onClick={onResume} data-autofocus data-testid="resume">
            {t('game.resume')}
          </Button>
          <Button variant="secondary" block icon={<Icon name="refresh" />} onClick={onRestart} data-testid="restart">
            {endless ? t('game.restartEndless') : t('game.restart')}
          </Button>
          <Button variant="ghost" block icon={<Icon name="home" />} onClick={onQuit} data-testid="quit">
            {t('game.quit')}
          </Button>
        </>
      }
    >
      <div className={styles.quick}>
        <Toggle label={t('settings.mute')} checked={muted} onChange={(value) => update({ muted: value })} />
        <Slider label={t('game.music')} value={musicVolume} onChange={(value) => update({ musicVolume: value })} />
        <div className={styles.language}>
          <span>{t('settings.language')}</span>
          <LanguageToggle />
        </div>
      </div>
    </Dialog>
  )
}
