import { useMemo, type CSSProperties } from 'react'
import { NORMAL_CUP_ART, GOLDEN_CUP_ART } from '../game/art/assets'
import styles from './FallingCups.module.css'

interface FallingCupsProps {
  count?: number
}

/** Decorative cups drifting down behind the menus. Hidden from screen readers. */
export function FallingCups({ count = 12 }: FallingCupsProps) {
  const cups = useMemo(() => {
    const art = [...NORMAL_CUP_ART, GOLDEN_CUP_ART]
    return Array.from({ length: count }, (_, i) => {
      const depth = (i % 4) / 3
      return {
        key: i,
        src: art[i % art.length].url,
        style: {
          '--x': `${(i * 37 + 11) % 100}%`,
          '--size': `${26 + depth * 30}px`,
          '--dur': `${16 - depth * 6 + (i % 3)}s`,
          '--delay': `${-((i * 2.3) % 14)}s`,
          '--spin': `${(i % 2 ? 1 : -1) * (8 + (i % 5) * 4)}deg`,
          '--alpha': `${0.18 + depth * 0.32}`,
          '--blur': `${(1 - depth) * 2.5}px`,
        } as CSSProperties,
      }
    })
  }, [count])

  return (
    <div className={styles.layer} aria-hidden="true">
      {cups.map((cup) => (
        <img key={cup.key} src={cup.src} alt="" className={styles.cup} style={cup.style} draggable={false} />
      ))}
    </div>
  )
}
