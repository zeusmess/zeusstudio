import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { playEndless, playNow } from '../app/actions'
import { useApp } from '../app/appStore'
import { prefersReducedMotion, useSettings } from '../app/settings'
import { signInWithGoogle } from '../auth/authService'
import { isGoogleSignedIn, useAuth } from '../auth/authStore'
import { Button } from '../components/Button'
import { FallingCups } from '../components/FallingCups'
import { GoogleMark, Icon } from '../components/Icon'
import { IconButton } from '../components/IconButton'
import { LanguageToggle } from '../components/LanguageToggle'
import { ProfileChip } from '../components/ProfileChip'
import { toast } from '../components/toastStore'
import { Wordmark } from '../components/Wordmark'
import { BACKDROP, HERO_CUP_ART } from '../game/art/assets'
import { basketSvg } from '../game/art/basket'
import { svgDataUrl } from '../game/art/svg'
import { getLevel } from '../game/levels/levels'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { isCampaignComplete, isEndlessUnlocked, nextPlayableLevel } from '../profile/progress'
import styles from './OpeningScreen.module.css'

const INTRO_MS = 3400

export function OpeningScreen() {
  const { t, num } = useI18n()
  const go = useApp((s) => s.go)
  const introSeen = useApp((s) => s.introSeen)
  const markIntroSeen = useApp((s) => s.markIntroSeen)
  const motion = useSettings((s) => s.motion)
  const profile = useProfile((s) => s.record.profile)
  const progress = useProfile((s) => s.record.progress)
  const authStatus = useAuth((s) => s.status)
  const googleSignedIn = useAuth((s) => isGoogleSignedIn(s))

  const [intro, setIntro] = useState<'playing' | 'done'>(() =>
    introSeen || prefersReducedMotion(motion) ? 'done' : 'playing',
  )

  const finishIntro = useCallback(() => {
    setIntro('done')
    markIntroSeen()
  }, [markIntroSeen])

  useEffect(() => {
    if (intro !== 'playing') return
    const timer = window.setTimeout(finishIntro, INTRO_MS)
    const onKey = () => finishIntro()
    window.addEventListener('keydown', onKey, { once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [intro, finishIntro])

  const basketBack = useMemo(() => svgDataUrl(basketSvg(profile.basketSkin, 'back')), [profile.basketSkin])
  const basketFront = useMemo(() => svgDataUrl(basketSvg(profile.basketSkin, 'front')), [profile.basketSkin])

  const campaignDone = isCampaignComplete(progress)
  const endlessUnlocked = isEndlessUnlocked(progress)
  const nextLevel = nextPlayableLevel(progress)
  const showIdentity = !googleSignedIn && !profile.identityChosen

  const onGoogle = async () => {
    if (authStatus === 'unconfigured') {
      go('LOGIN')
      return
    }
    await signInWithGoogle()
  }

  const onEndless = () => {
    if (!endlessUnlocked) {
      toast({ tone: 'info', title: t('menu.endlessLocked') })
      return
    }
    playEndless()
  }

  return (
    <main
      className={[styles.screen, intro === 'playing' ? styles.intro : styles.done].join(' ')}
      onPointerDown={intro === 'playing' ? finishIntro : undefined}
      data-testid="opening-screen"
      data-intro={intro}
    >
      <div className={styles.backdrop} aria-hidden="true">
        {BACKDROP && <img className={styles.photo} src={BACKDROP.blurred} alt="" />}
        <div className={styles.glow} />
        <div className={styles.bokeh}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <FallingCups />
      </div>
      <div className={styles.fade} aria-hidden="true" />

      <div className={styles.layout}>
        <header className={styles.topBar}>
          <LanguageToggle />
          <div className={styles.topEnd}>
            <ProfileChip onClick={() => go('PROFILE')} />
            <IconButton label={t('menu.settings')} onClick={() => go('SETTINGS')} data-testid="open-settings">
              <Icon name="settings" />
            </IconButton>
          </div>
        </header>

        <section className={styles.hero}>
          <Wordmark animate={intro === 'playing'} />
          <p className={styles.subtitle}>{t('app.subtitle')}</p>

          <div className={styles.stage} aria-hidden="true">
            <div className={styles.ring} />
            <img className={styles.basketBack} src={basketBack} alt="" />
            <img
              className={styles.heroCup}
              src={HERO_CUP_ART.url}
              alt=""
              style={{ aspectRatio: `${HERO_CUP_ART.aspect}` }}
            />
            <img className={styles.basketFront} src={basketFront} alt="" />
            <div className={styles.burst}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ '--a': `${i * 36}deg` } as CSSProperties} />
              ))}
            </div>
            <span className={`${styles.pop} num`}>+{num(100)}</span>
          </div>
        </section>

        <nav className={styles.actions} aria-label={t('app.title')}>
          <Button
            size="lg"
            block
            icon={<Icon name="play" />}
            hint={
              campaignDone
                ? t('menu.playNowEndless')
                : t('menu.playNowHint', { level: nextLevel, target: getLevel(nextLevel).target })
            }
            onClick={() => playNow()}
            data-testid="play-now"
          >
            {t('menu.playNow')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            block
            icon={<Icon name="users" />}
            hint={t('menu.playWithFriendHint')}
            onClick={() => go('LOBBY')}
            data-testid="play-with-friend"
          >
            {t('menu.playWithFriend')}
          </Button>

          <div className={styles.tiles}>
            <button type="button" className={styles.tile} onClick={() => go('LEVEL_SELECT')} data-testid="open-levels">
              <Icon name="grid" />
              <span>{t('menu.levels')}</span>
              <small className="num">{t('menu.progress', { done: progress.completedLevels.length, total: 15 })}</small>
            </button>
            <button
              type="button"
              className={[styles.tile, endlessUnlocked ? '' : styles.tileLocked].join(' ')}
              onClick={onEndless}
              aria-disabled={!endlessUnlocked}
              aria-describedby={endlessUnlocked ? undefined : 'endless-lock-hint'}
              data-testid="open-endless"
            >
              <Icon name={endlessUnlocked ? 'infinity' : 'lock'} />
              <span>{t('menu.endless')}</span>
              <small id="endless-lock-hint">{endlessUnlocked ? t('levels.endlessDesc') : t('app.locked')}</small>
            </button>
            <button
              type="button"
              className={styles.tile}
              onClick={() => go('ACHIEVEMENTS')}
              data-testid="open-achievements"
            >
              <Icon name="trophy" />
              <span>{t('menu.achievements')}</span>
              <small className="num">{Object.keys(progress.achievements).length}/12</small>
            </button>
          </div>

          {showIdentity ? (
            <div className={styles.identity}>
              <Button
                variant="google"
                block
                icon={<GoogleMark />}
                loading={authStatus === 'signing-in'}
                onClick={onGoogle}
                data-testid="google-sign-in"
              >
                {t('menu.signInGoogle')}
              </Button>
              <Button variant="ghost" block onClick={() => go('LOGIN')} data-testid="guest-play">
                {t('menu.guestPlay')}
              </Button>
            </div>
          ) : (
            <button type="button" className={styles.leaderboardLink} onClick={() => go('LEADERBOARD')}>
              <Icon name="chart" size={18} />
              {t('menu.leaderboard')}
            </button>
          )}
        </nav>

        <footer className={styles.footer}>
          <p className={styles.credit}>{t('app.credit')}</p>
          <p className={styles.disclaimer}>{t('app.disclaimer')}</p>
        </footer>
      </div>

      {intro === 'playing' && (
        <button type="button" className={styles.skip} onClick={finishIntro} data-testid="skip-intro">
          {t('app.skip')}
        </button>
      )}
    </main>
  )
}
