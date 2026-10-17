import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  /** 0–1 */
  value: number
  label: string
  tone?: 'green' | 'gold' | 'cream'
  size?: 'sm' | 'md'
  testId?: string
}

/** Fills from the inline start, so it grows right-to-left in Arabic. */
export function ProgressBar({ value, label, tone = 'green', size = 'md', testId }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      className={[styles.track, styles[size]].join(' ')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      data-testid={testId}
    >
      <div className={[styles.fill, styles[tone]].join(' ')} style={{ inlineSize: `${percent}%` }} />
    </div>
  )
}
