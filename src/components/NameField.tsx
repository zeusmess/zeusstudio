import { useId } from 'react'
import { useI18n } from '../locales/i18n'
import { NAME_MAX, type NameError } from '../profile/validation'
import styles from './NameField.module.css'

interface NameFieldProps {
  value: string
  onChange: (value: string) => void
  error: NameError | null
  onSubmit?: () => void
  autoFocus?: boolean
}

/** Display-name input: accepts Arabic and English, shows its rule and any error under it. */
export function NameField({ value, onChange, error, onSubmit, autoFocus }: NameFieldProps) {
  const { t } = useI18n()
  const id = useId()
  const hintId = useId()
  const errorId = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t('profile.nameLabel')}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        dir="auto"
        value={value}
        maxLength={NAME_MAX * 2}
        placeholder={t('profile.namePlaceholder')}
        autoComplete="nickname"
        autoCapitalize="words"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={error !== null}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit?.()
        }}
        data-testid="name-input"
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert" data-testid="name-error">
          {t(`profile.errors.${error}`)}
        </p>
      ) : null}
      <p id={hintId} className={styles.hint}>
        {t('profile.nameHint')}
      </p>
    </div>
  )
}
