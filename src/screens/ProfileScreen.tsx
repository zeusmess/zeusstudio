import { useState } from 'react'
import { useApp } from '../app/appStore'
import { signInWithGoogle, signOutUser } from '../auth/authService'
import { isGoogleSignedIn, useAuth } from '../auth/authStore'
import { Avatar, BasketImage } from '../components/Art'
import { AvatarPicker } from '../components/AvatarPicker'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { GoogleMark, Icon } from '../components/Icon'
import { NameField } from '../components/NameField'
import { Notice } from '../components/Notice'
import { ProgressBar } from '../components/ProgressBar'
import { Screen, ScreenHeader } from '../components/Screen'
import { toast } from '../components/toastStore'
import { LEVEL_COUNT } from '../game/levels/levels'
import { useI18n } from '../locales/i18n'
import { ACHIEVEMENTS } from '../profile/achievements'
import { BASKET_ORDER, basketUnlockedBy, isBasketAvailable } from '../profile/cosmetics'
import { useProfile } from '../profile/profileStore'
import { bestScore, nextPlayableLevel } from '../profile/progress'
import { validateDisplayName, type NameError } from '../profile/validation'
import type { AvatarId } from '../types'
import styles from './ProfileScreen.module.css'

export default function ProfileScreen() {
  const { t, num, date } = useI18n()
  const go = useApp((s) => s.go)
  const record = useProfile((s) => s.record)
  const setDisplayName = useProfile((s) => s.setDisplayName)
  const setAvatar = useProfile((s) => s.setAvatar)
  const setBasket = useProfile((s) => s.setBasket)
  const auth = useAuth()
  const google = isGoogleSignedIn(auth)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(record.profile.displayName)
  const [error, setError] = useState<NameError | null>(null)
  const { profile, progress } = record
  const unlockedCount = Object.keys(progress.achievements).length

  const saveName = () => {
    const validation = validateDisplayName(draft)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setDisplayName(validation.value)
    setEditing(false)
    toast({ tone: 'success', title: t('profile.saved') })
  }

  const stats: Array<[string, string]> = [
    [t('profile.currentLevel'), num(nextPlayableLevel(progress))],
    [t('profile.bestScore'), num(bestScore(progress))],
    [t('profile.totalCups'), num(progress.totalCupsCaught)],
    [t('profile.levelsDone'), `${num(progress.completedLevels.length)}/${num(LEVEL_COUNT)}`],
    [t('profile.endlessBest'), progress.endlessBest ? num(progress.endlessBest.score) : '—'],
    [t('profile.gamesPlayed'), num(progress.gamesPlayed)],
  ]

  return (
    <Screen testId="profile-screen">
      <ScreenHeader title={t('profile.title')} onBack={() => go('MENU')} />

      <Card className={styles.identity}>
        <div className={styles.identityRow}>
          <Avatar id={profile.avatarId} size={84} label={t(`avatars.${profile.avatarId}`)} />
          <div className={styles.identityText}>
            {editing ? (
              <NameField
                value={draft}
                onChange={(value) => {
                  setDraft(value)
                  setError(null)
                }}
                error={error}
                onSubmit={saveName}
                autoFocus
              />
            ) : (
              <>
                <h2 className={styles.name} data-testid="profile-name">
                  <bdi>{profile.displayName}</bdi>
                </h2>
                <span className={styles.kind}>{google ? t('menu.accountGoogle') : t('menu.accountGuest')}</span>
              </>
            )}
          </div>
        </div>
        {editing ? (
          <div className={styles.editActions}>
            <Button onClick={saveName} data-testid="save-name">
              {t('profile.save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setDraft(profile.displayName)
                setError(null)
              }}
            >
              {t('app.cancel')}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="edit" size={16} />}
            onClick={() => {
              setDraft(profile.displayName)
              setEditing(true)
            }}
            data-testid="edit-name"
          >
            {t('profile.edit')}
          </Button>
        )}
      </Card>

      <Card title={t('profile.account')}>
        {google ? (
          <>
            <Notice tone={auth.sync === 'error' ? 'warning' : 'success'} title={t('profile.googleNotice')} testId="sync-status">
              {auth.sync === 'syncing' && t('login.syncing')}
              {auth.sync === 'synced' && t('login.synced')}
              {auth.sync === 'error' && t('login.syncFailed')}
            </Notice>
            <Button variant="secondary" icon={<Icon name="logout" />} onClick={() => void signOutUser()} data-testid="sign-out">
              {t('login.signOut')}
            </Button>
          </>
        ) : (
          <>
            <Notice tone="info">{t('profile.guestNotice')}</Notice>
            {auth.status === 'unconfigured' ? (
              <Notice tone="warning" title={t('login.notConfiguredTitle')}>
                {t('login.notConfiguredBody')}
              </Notice>
            ) : (
              <Button
                variant="google"
                icon={<GoogleMark />}
                loading={auth.status === 'signing-in'}
                onClick={() => void signInWithGoogle()}
              >
                {t('menu.signInGoogle')}
              </Button>
            )}
            {auth.error && <Notice tone="error">{t(`login.errors.${auth.error}`)}</Notice>}
          </>
        )}
      </Card>

      <Card title={t('profile.avatar')}>
        <AvatarPicker
          value={profile.avatarId}
          onChange={(avatar: AvatarId) => setAvatar(avatar)}
          unlocked={progress.unlockedCosmetics}
        />
      </Card>

      <Card title={t('profile.stats')}>
        <dl className={styles.stats} data-testid="profile-stats">
          {stats.map(([label, value]) => (
            <div key={label} className={styles.stat}>
              <dt>{label}</dt>
              <dd className="num">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title={t('achievements.title')}
        aside={t('profile.achievementsSummary', { unlocked: unlockedCount, total: ACHIEVEMENTS.length })}
      >
        <ProgressBar
          value={unlockedCount / ACHIEVEMENTS.length}
          label={t('profile.achievementsSummary', { unlocked: unlockedCount, total: ACHIEVEMENTS.length })}
          tone="gold"
        />
        <Button variant="secondary" size="sm" icon={<Icon name="trophy" size={16} />} onClick={() => go('ACHIEVEMENTS')}>
          {t('profile.viewAll')}
        </Button>
      </Card>

      <Card title={t('profile.basket')}>
        <div className={styles.baskets} role="radiogroup" aria-label={t('profile.basket')}>
          {BASKET_ORDER.map((skin) => {
            const available = isBasketAvailable(skin, progress.unlockedCosmetics)
            const achievement = available ? null : basketUnlockedBy(skin)
            return (
              <button
                key={skin}
                type="button"
                role="radio"
                aria-checked={profile.basketSkin === skin}
                aria-disabled={!available}
                className={styles.basket}
                onClick={() => available && setBasket(skin)}
                data-testid={`basket-${skin}`}
              >
                <BasketImage skin={skin} width={96} />
                <span className={styles.basketName}>{t(`baskets.${skin}`)}</span>
                <span className={styles.basketState}>
                  {!available && achievement
                    ? t('profile.unlockHint', { achievement: t(`achievements.items.${achievement}.title`) })
                    : profile.basketSkin === skin
                      ? t('profile.equipped')
                      : t('profile.equip')}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card
        title={t('profile.matches')}
        aside={t('profile.record', {
          wins: progress.matchStats.wins,
          losses: progress.matchStats.losses,
          ties: progress.matchStats.ties,
        })}
      >
        {progress.matchHistory.length === 0 ? (
          <p className={styles.empty}>{t('profile.matchesEmpty')}</p>
        ) : (
          <ul className={styles.matches}>
            {progress.matchHistory.map((match) => (
              <li key={match.id} className={styles.match}>
                <Avatar id={match.opponentAvatar} size={36} />
                <span className={styles.matchText}>
                  <bdi className={styles.matchName}>{t('profile.vs', { name: match.opponentName })}</bdi>
                  <span className={styles.matchMeta}>
                    {t(`lobby.lengths.${match.length}`)} · {date(match.at)}
                  </span>
                </span>
                <span className={`${styles.matchScore} num`} dir="ltr">
                  {num(match.myScore)} – {num(match.opponentScore)}
                </span>
                <span className={styles.outcome} data-outcome={match.outcome}>
                  {t(`profile.outcome.${match.outcome}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Screen>
  )
}
