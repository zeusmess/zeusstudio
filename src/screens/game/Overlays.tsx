import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useHud, type Banner } from '../../game/hudStore'
import type { GameController } from '../../game/GameController'
import { useI18n, type I18n } from '../../locales/i18n'
import styles from './Overlays.module.css'

function bannerText(banner: Banner, { t, num }: I18n): string {
  switch (banner.kind) {
    case 'finalWave':
      return t('game.finalWave')
    case 'wave':
      return t('game.waveBanner', { wave: banner.value ?? 1 })
    case 'goldenRush':
      return t('game.goldenRush')
    case 'streak':
      return t('game.streakBanner', { streak: banner.value ?? 0 })
    case 'refill':
      return t('game.refill')
    case 'milestone':
      return t('game.milestone', { score: num(banner.value ?? 0) })
    case 'goldenIntro':
      return t('game.goldenIntro')
    case 'specialIntro':
      return t('game.specialIntro')
    case 'obstacleIntro':
      return t('game.obstacleIntro')
    case 'targetReached':
      return t('match.targetReached')
    case 'timeUp':
      return t('match.timeUp')
  }
}

const LONG_BANNERS = new Set(['goldenIntro', 'specialIntro', 'obstacleIntro', 'finalWave'])

/** Big transient messages: waves, streaks, the final wave, new cup types. */
export function BannerView() {
  const i18n = useI18n()
  const banner = useHud((s) => s.banner)
  const [expiredId, setExpiredId] = useState<number | null>(null)
  const visible: Banner | null = banner && banner.id !== expiredId ? banner : null

  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setExpiredId(banner.id), LONG_BANNERS.has(banner.kind) ? 2600 : 1500)
    return () => window.clearTimeout(timer)
  }, [banner])

  return (
    <div className={styles.bannerRegion} role="status" aria-live="polite">
      {visible && (
        <div
          key={visible.id}
          className={[styles.banner, styles[visible.kind] ?? ''].join(' ')}
          data-testid={`banner-${visible.kind}`}
        >
          {bannerText(visible, i18n)}
        </div>
      )}
    </div>
  )
}

/** Level-1 coaching while playing. */
export function TutorialHint() {
  const { t, num } = useI18n()
  const tutorial = useHud((s) => s.tutorial)
  const target = useHud((s) => s.target)
  if (!tutorial) return null
  const text =
    tutorial === 'move'
      ? t('game.tutorialDrag')
      : tutorial === 'catch'
        ? t('game.tutorialCatch')
        : t('game.tutorialGoal', { target: num(target) })
  return (
    <div className={styles.tutorial} data-testid={`tutorial-${tutorial}`}>
      {tutorial === 'move' && <span className={styles.swipe} aria-hidden="true" />}
      <p>{text}</p>
    </div>
  )
}

/** Optional on-screen ◀ ▶ buttons. Game controls stay physical: left is always left. */
export function TouchControls({ controller }: { controller: GameController }) {
  const { t } = useI18n()
  const bind = (axis: -1 | 1) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      controller.setAxis(axis)
    },
    onPointerUp: () => controller.setAxis(0),
    onPointerCancel: () => controller.setAxis(0),
    onLostPointerCapture: () => controller.setAxis(0),
  })
  return (
    <div className={styles.touch} dir="ltr">
      <button type="button" className={styles.arrow} aria-label={t('hud.moveLeft')} {...bind(-1)} data-testid="arrow-left">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path d="M16 4 6 12l10 8z" fill="currentColor" />
        </svg>
      </button>
      <button type="button" className={styles.arrow} aria-label={t('hud.moveRight')} {...bind(1)} data-testid="arrow-right">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path d="M8 4l10 8-10 8z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

export function RotateHint() {
  const { t } = useI18n()
  const [landscapePhone, setLandscapePhone] = useState(false)
  useEffect(() => {
    const check = () => setLandscapePhone(window.innerWidth > window.innerHeight && window.innerHeight < 500)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  if (!landscapePhone) return null
  return <div className={styles.rotate}>{t('game.rotateHint')}</div>
}
