import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: number
  /** Announced to screen readers; omit when a nearby label already says it. */
  label?: string
}

export function Spinner({ size = 24, label }: SpinnerProps) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
