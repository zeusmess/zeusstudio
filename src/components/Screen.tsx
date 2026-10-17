import type { ReactNode } from 'react'
import { useI18n } from '../locales/i18n'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import styles from './Screen.module.css'

interface ScreenProps {
  children: ReactNode
  /** Accessible name for the page landmark. */
  label?: string
  className?: string
  /** Content width: `narrow` for forms and lists, `wide` for grids. */
  width?: 'narrow' | 'wide' | 'full'
  testId?: string
}

/** The page holder every screen uses: a scrollable <main> with safe-area padding. */
export function Screen({ children, label, className, width = 'narrow', testId }: ScreenProps) {
  return (
    <main
      className={[styles.screen, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-testid={testId}
    >
      <div className={[styles.content, styles[width]].join(' ')}>{children}</div>
    </main>
  )
}

interface ScreenHeaderProps {
  title: ReactNode
  onBack?: () => void
  actions?: ReactNode
  subtitle?: ReactNode
}

export function ScreenHeader({ title, onBack, actions, subtitle }: ScreenHeaderProps) {
  const { t } = useI18n()
  return (
    <header className={styles.header}>
      <div className={styles.headerSide}>
        {onBack && (
          <IconButton label={t('app.back')} onClick={onBack} data-testid="back-button">
            <Icon name="back" />
          </IconButton>
        )}
      </div>
      <div className={styles.headerTitle}>
        <h1>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={[styles.headerSide, styles.headerEnd].join(' ')}>{actions}</div>
    </header>
  )
}
