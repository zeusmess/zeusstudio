import { useEffect, useState } from 'react'
import { playEndless } from '../app/actions'
import { useApp } from '../app/appStore'
import { useAuth } from '../auth/authStore'
import { isFirebaseConfigured } from '../auth/firebase'
import { Avatar } from '../components/Art'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Segmented } from '../components/Controls'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { Screen, ScreenHeader } from '../components/Screen'
import { Spinner } from '../components/Spinner'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { isEndlessUnlocked } from '../profile/progress'
import { fetchGlobalTop, localEntries, type LeaderboardEntry } from '../services/leaderboard'
import styles from './LeaderboardScreen.module.css'

type Scope = 'global' | 'device'
type GlobalState = { status: 'idle' | 'loading' } | { status: 'ready'; entries: LeaderboardEntry[] } | { status: 'error' }

export default function LeaderboardScreen() {
  const { t, num } = useI18n()
  const go = useApp((s) => s.go)
  const record = useProfile((s) => s.record)
  const uid = useAuth((s) => s.user?.uid)
  const configured = isFirebaseConfigured()
  const [scope, setScope] = useState<Scope>(configured ? 'global' : 'device')
  const [global, setGlobal] = useState<GlobalState>({ status: configured ? 'loading' : 'idle' })

  useEffect(() => {
    if (!configured) return
    let alive = true
    fetchGlobalTop()
      .then((entries) => alive && setGlobal({ status: 'ready', entries }))
      .catch(() => alive && setGlobal({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [configured])

  const showGlobal = scope === 'global' && configured && global.status !== 'error'
  const entries = showGlobal ? (global.status === 'ready' ? global.entries : []) : localEntries()
  const best = record.progress.endlessBest

  return (
    <Screen testId="leaderboard-screen">
      <ScreenHeader title={t('leaderboard.title')} subtitle={t('levels.endlessCard')} onBack={() => go('MENU')} />

      <Card tone="gold">
        <div className={styles.best}>
          <Avatar id={record.profile.avatarId} size={52} />
          <div className={styles.bestText}>
            <span>{t('gameOver.personalBest')}</span>
            <strong className="num">{best ? num(best.score) : '—'}</strong>
            {best && <small className="num">{t('levels.endlessBest', { score: best.score, wave: best.wave })}</small>}
          </div>
          {isEndlessUnlocked(record.progress) && (
            <Button size="sm" icon={<Icon name="play" size={16} />} onClick={() => playEndless()}>
              {t('menu.playNow')}
            </Button>
          )}
        </div>
      </Card>

      {configured ? (
        <Segmented<Scope>
          label={t('leaderboard.title')}
          hideLabel
          value={scope}
          onChange={setScope}
          options={[
            { value: 'global', label: t('leaderboard.global') },
            { value: 'device', label: t('leaderboard.device') },
          ]}
        />
      ) : (
        <Notice tone="info" testId="leaderboard-offline">
          {t('leaderboard.offlineNotice')}
        </Notice>
      )}
      {scope === 'global' && global.status === 'error' && <Notice tone="error">{t('leaderboard.loadError')}</Notice>}

      {showGlobal && global.status === 'loading' ? (
        <div className={styles.loading}>
          <Spinner size={28} label={t('leaderboard.loading')} />
        </div>
      ) : entries.length === 0 ? (
        <p className={styles.empty} data-testid="leaderboard-empty">
          {t('leaderboard.empty')}
        </p>
      ) : (
        <ol className={styles.list} data-testid="leaderboard-list">
          {entries.map((entry, index) => {
            const mine = showGlobal ? entry.uid === uid : entry.uid === record.profile.id
            return (
              <li key={`${entry.uid}-${entry.at}-${index}`} className={styles.row} data-mine={mine}>
                <span className={`${styles.rank} num`}>{num(index + 1)}</span>
                <Avatar id={entry.avatar} size={36} />
                <span className={styles.who}>
                  <bdi className={styles.name}>{entry.name}</bdi>
                  {mine && <span className={styles.you}>{t('leaderboard.you')}</span>}
                </span>
                <span className={`${styles.wave} num`}>
                  {t('leaderboard.wave')} {num(entry.wave)}
                </span>
                <strong className={`${styles.score} num`}>{num(entry.score)}</strong>
              </li>
            )
          })}
        </ol>
      )}
    </Screen>
  )
}
