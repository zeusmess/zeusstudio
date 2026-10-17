import type { CSSProperties } from 'react'
import { useI18n } from '../locales/i18n'
import styles from './Wordmark.module.css'

interface WordmarkProps {
  animate?: boolean
  size?: 'hero' | 'compact'
}

/** "STARBUCKS CUP CATCHER" set as the game's title, with an optional letter-by-letter reveal. */
export function Wordmark({ animate = false, size = 'hero' }: WordmarkProps) {
  const { t, lang } = useI18n()
  const title = t('app.title')
  const [first, ...rest] = title.split(' ')
  const second = rest.join(' ')
  let index = 0
  const letters = (word: string) =>
    [...word].map((char, i) => (
      <span
        key={`${char}-${i}`}
        className={animate ? styles.letter : undefined}
        style={{ '--i': index++ } as CSSProperties}
      >
        {char === ' ' ? '\u00a0' : char}
      </span>
    ))

  return (
    <h1 className={[styles.wordmark, styles[size]].join(' ')} aria-label={title}>
      <span className={styles.top} lang="en" dir="ltr" aria-hidden="true">
        {letters(first)}
      </span>
      <span className={styles.bottom} lang="en" dir="ltr" aria-hidden="true">
        {letters(second)}
      </span>
      {lang === 'ar' && t('app.titleLocal') && (
        <span className={[styles.local, animate ? styles.fadeUp : ''].join(' ')}>{t('app.titleLocal')}</span>
      )}
    </h1>
  )
}
