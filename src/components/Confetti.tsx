import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../app/settings'
import { readToken } from '../styles/theme'
import styles from './Confetti.module.css'

interface ConfettiProps {
  /** Number of pieces. */
  count?: number
  /** Delay before the burst (ms). */
  delay?: number
}

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  color: string
  round: boolean
}

/** Green, cream and gold confetti on a canvas. Skipped entirely with reduced motion. */
export function Confetti({ count = 140, delay = 350 }: ConfettiProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || prefersReducedMotion()) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const colors = ['--green-500', '--green-300', '--cream-50', '--gold-300', '--gold-500'].map((token) =>
      readToken(token, '#cba258'),
    )
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()
    const width = () => canvas.clientWidth
    const height = () => canvas.clientHeight
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      const fromSide = i % 2 === 0 ? -1 : 1
      return {
        x: width() / 2 + fromSide * width() * 0.1 * Math.random(),
        y: height() * 0.62,
        vx: (Math.random() - 0.5) * 900,
        vy: -500 - Math.random() * 800,
        size: 6 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 14,
        color: colors[i % colors.length],
        round: i % 4 === 0,
      }
    })
    let frame = 0
    let start = 0
    let previous = 0
    const step = (now: number) => {
      if (!start) start = previous = now
      const elapsed = now - start
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width(), height())
      if (elapsed >= delay) {
        for (const p of pieces) {
          p.vy += 1100 * dt
          p.vx *= 0.985
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.rotation += p.spin * dt
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.globalAlpha = Math.max(0, 1 - (elapsed - delay) / 4200)
          ctx.fillStyle = p.color
          if (p.round) {
            ctx.beginPath()
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          }
          ctx.restore()
        }
      }
      if (elapsed < delay + 4300) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [count, delay])

  return <canvas ref={ref} className={styles.confetti} aria-hidden="true" />
}
