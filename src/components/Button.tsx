import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger' | 'google'
export type ButtonSize = 'lg' | 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  icon?: ReactNode
  /** Small second line under the label (e.g. "Level 4 · Target 3,500"). */
  hint?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  hint,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 16 : 20} /> : icon}
      <span className={styles.text}>
        <span className={styles.label}>{children}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </button>
  )
}
