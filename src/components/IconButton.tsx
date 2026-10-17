import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string
  children: ReactNode
  variant?: 'glass' | 'plain' | 'solid'
  size?: 'md' | 'lg'
  badge?: ReactNode
}

export function IconButton({
  label,
  children,
  variant = 'glass',
  size = 'md',
  badge,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[styles.iconButton, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
      {badge !== undefined && <span className={styles.badge}>{badge}</span>}
    </button>
  )
}
