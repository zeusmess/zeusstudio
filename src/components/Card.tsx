import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  title?: ReactNode
  /** Right/left-aligned extra in the title row (follows reading direction). */
  aside?: ReactNode
  children: ReactNode
  tone?: 'glass' | 'cream' | 'gold'
  className?: string
  testId?: string
}

/** A titled panel: a <section> with an <h2> when titled. */
export function Card({ title, aside, children, tone = 'glass', className, testId }: CardProps) {
  return (
    <section className={[styles.card, styles[tone], className].filter(Boolean).join(' ')} data-testid={testId}>
      {(title || aside) && (
        <div className={styles.titleRow}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
