import { useId } from 'react'
import styles from './Mascot.module.css'

interface MascotProps {
  size?: number
  /** `once`: a single wink after a short pause; `loop`: winks every few seconds. */
  wink?: 'once' | 'loop' | 'none'
  label?: string
  className?: string
}

/**
 * The game's original mascot: a cheerful coffee cup that winks. Used in the
 * victory celebration (beside the logo, which is never altered or animated).
 */
export function Mascot({ size = 120, wink = 'once', label, className }: MascotProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={[styles.mascot, styles[`wink-${wink}`], className].filter(Boolean).join(' ')}
    >
      <defs>
        <linearGradient id={`cup${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#e2dbcc" />
          <stop offset="0.3" stopColor="#fdfbf6" />
          <stop offset="0.75" stopColor="#fdfbf6" />
          <stop offset="1" stopColor="#ddd5c4" />
        </linearGradient>
        <clipPath id={`clip${id}`}>
          <path d="M24 46 L96 46 L86 138 Q85 141 82 141 L38 141 Q35 141 34 138 Z" />
        </clipPath>
      </defs>
      <g className={styles.steam}>
        <path d="M48 26 Q42 18 48 10 Q53 4 49 -2" fill="none" stroke="#f2f0eb" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 26 Q76 18 70 10 Q65 4 69 -2" fill="none" stroke="#f2f0eb" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className={styles.body}>
        <ellipse cx="60" cy="145" rx="30" ry="4" fill="#000" opacity="0.25" />
        <path d="M18 92 Q4 84 8 70" fill="none" stroke="#fbf8f2" strokeWidth="8" strokeLinecap="round" />
        <g className={styles.wave}>
          <path d="M102 90 Q116 80 114 64" fill="none" stroke="#fbf8f2" strokeWidth="8" strokeLinecap="round" />
          <circle cx="114" cy="61" r="6" fill="#fbf8f2" />
        </g>
        <path d="M24 46 L96 46 L86 138 Q85 141 82 141 L38 141 Q35 141 34 138 Z" fill={`url(#cup${id})`} />
        <g clipPath={`url(#clip${id})`}>
          <rect x="0" y="104" width="120" height="26" fill="#00704a" />
          <rect x="0" y="104" width="120" height="2.5" fill="#fff" opacity="0.25" />
        </g>
        <polygon
          points="60,108 63.1,114.3 70,115.3 65,120.1 66.2,127 60,123.7 53.8,127 55,120.1 50,115.3 56.9,114.3"
          fill="#e3c88a"
        />
        <rect x="17" y="34" width="86" height="14" rx="7" fill="#ffffff" />
        <rect x="17" y="43" width="86" height="5" rx="2.5" fill="#d9cdb6" />
        <path d="M28 34 Q34 22 60 22 Q86 22 92 34 Z" fill="#ffffff" />
        <ellipse cx="44" cy="75" rx="5" ry="6.5" fill="#2a1a12" />
        <circle cx="45.6" cy="72.6" r="1.6" fill="#fff" />
        <g className={styles.winkEye}>
          <ellipse className={styles.eyeOpen} cx="76" cy="75" rx="5" ry="6.5" fill="#2a1a12" />
          <circle className={styles.eyeOpen} cx="77.6" cy="72.6" r="1.6" fill="#fff" />
          <path className={styles.eyeClosed} d="M69 76 Q76 70 83 76" fill="none" stroke="#2a1a12" strokeWidth="3.4" strokeLinecap="round" />
        </g>
        <ellipse cx="36" cy="86" rx="6" ry="3.6" fill="#f3a6b5" opacity="0.8" />
        <ellipse cx="84" cy="86" rx="6" ry="3.6" fill="#f3a6b5" opacity="0.8" />
        <path className={styles.smile} d="M50 86 Q60 96 70 86" fill="none" stroke="#2a1a12" strokeWidth="3.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}
