import { useSettings } from '../app/settings'
import { useI18n } from '../locales/i18n'
import { Icon } from './Icon'
import styles from './LanguageToggle.module.css'

/** Switches English ↔ Arabic. The label is written in the language it switches to. */
export function LanguageToggle() {
  const { t } = useI18n()
  const toggleLanguage = useSettings((s) => s.toggleLanguage)
  const language = useSettings((s) => s.language)
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleLanguage}
      aria-label={t('menu.switchToLabel')}
      lang={language === 'ar' ? 'en' : 'ar'}
      data-testid="language-toggle"
    >
      <Icon name="globe" size={18} />
      <span>{t('menu.switchTo')}</span>
    </button>
  )
}
