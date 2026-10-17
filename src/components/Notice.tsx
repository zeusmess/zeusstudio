import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Notice.module.css'

type Tone = 'info' | 'warning' | 'error' | 'success'

const ICONS: Record<Tone, IconName> = {
  info: 'info',
  warning: 'alert',
  error: 'alert',
  success: 'check',
}

interface NoticeProps {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  testId?: string
}

/** Inline message for loading failures, configuration gaps and confirmations. */
export function Notice({ tone = 'info', title, children, action, testId }: NoticeProps) {
  return (
    <div
      className={[styles.notice, styles[tone]].join(' ')}
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
    >
      <Icon name={ICONS[tone]} className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  )
}
