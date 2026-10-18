import { useEffect, useRef } from 'react'
import { useApp } from '../../app/appStore'
import { Avatar } from '../../components/Art'
import { Button } from '../../components/Button'
import { Confetti } from '../../components/Confetti'
import { Icon } from '../../components/Icon'
import { Notice } from '../../components/Notice'
import { useI18n } from '../../locales/i18n'
import { opponentOf } from '../../multiplayer/roomLogic'
import { useRoom, type FinishedMatch } from '../../multiplayer/roomStore'
import { useProfile } from '../../profile/profileStore'
import type { AvatarId } from '../../types'
import styles from './MatchResults.module.css'

function reasonKey(match: FinishedMatch) {
  if (match.reason === 'target') return 'match.reasons.target' as const
  if (match.reason === 'forfeit') return match.outcome === 'loss' ? ('match.reasons.forfeitLoss' as const) : ('match.reasons.forfeit' as const)
  return match.outcome === 'tie' ? ('match.reasons.tieTime' as const) : ('match.reasons.time' as const)
}

export function MatchResults() {
  const { t, num } = useI18n()
  const go = useApp((s) => s.go)
  const match = useRoom((s) => s.lastMatch)
  const room = useRoom((s) => s.room)
  const entry = useRoom((s) => s.entry)
  const busy = useRoom((s) => s.busy)
  const notice = useRoom((s) => s.notice)
  const rematchAsked = useRoom((s) => s.rematchAsked)
  const profile = useProfile((s) => s.record.profile)
  const actions = useRef<HTMLDivElement>(null)

  useEffect(() => {
    actions.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])

  const leave = () => {
    void useRoom.getState().leave()
    go('MENU')
  }

  if (!match) {
    return (
      <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={t('match.mainMenu')} data-testid="match-results">
        <div className={styles.card}>
          <Button size="lg" block icon={<Icon name="home" />} onClick={leave}>
            {t('match.mainMenu')}
          </Button>
        </div>
      </div>
    )
  }

  const title = match.outcome === 'win' ? t('match.youWin') : match.outcome === 'loss' ? t('match.theyWin', { name: match.opponentName }) : t('match.tie')
  const opponent = room && entry ? opponentOf(room.meta, entry.uid) : null
  const sameRound = room?.meta.round === match.round
  const opponentAsked = Boolean(sameRound && opponent && room?.rematch[opponent])
  const rematchPossible = Boolean(entry && room?.meta.guestUid && notice !== 'roomClosed' && notice !== 'opponentLeft')

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      data-testid="match-results"
      data-outcome={match.outcome}
    >
      {match.outcome === 'win' && <Confetti />}
      <div className={styles.card}>
        <p className={styles.kicker}>{t('match.kicker', { round: num(match.round) })}</p>
        <h2 id="match-title" className={styles.title} data-testid="match-title">
          {match.outcome === 'win' && <Icon name="crown" className={styles.crown} />}
          {title}
        </h2>
        <p className={styles.subtitle} data-testid="match-reason">
          {t(reasonKey(match), { target: num(match.target) })}
        </p>

        <div className={styles.versus}>
          <PlayerScore
            name={profile.displayName}
            avatar={profile.avatarId}
            score={match.myScore}
            label={t('leaderboard.you')}
            winner={match.outcome === 'win'}
            testId="match-my-score"
          />
          <span className={styles.vs} aria-hidden="true">
            {t('match.vs')}
          </span>
          <PlayerScore
            name={match.opponentName}
            avatar={match.opponentAvatar}
            score={match.opponentScore}
            winner={match.outcome === 'loss'}
            testId="match-opponent-score"
          />
        </div>

        {(notice === 'roomClosed' || notice === 'opponentLeft') && (
          <Notice tone="info" testId="match-notice">
            {t(`lobby.notices.${notice}`)}
          </Notice>
        )}
        {opponentAsked && !rematchAsked && (
          <p className={styles.request} role="status" data-testid="rematch-requested">
            {t('match.rematchRequested', { name: match.opponentName })}
          </p>
        )}

        <div className={styles.actions} ref={actions}>
          {rematchPossible && (
            <Button
              size="lg"
              variant="gold"
              block
              icon={<Icon name="refresh" />}
              loading={busy === 'rematch'}
              disabled={rematchAsked || busy !== null}
              onClick={() => void useRoom.getState().rematch()}
              data-testid="rematch"
            >
              {rematchAsked ? t('match.rematchWaiting', { name: match.opponentName }) : t('match.rematch')}
            </Button>
          )}
          <Button variant="ghost" block icon={<Icon name="home" />} onClick={leave} data-testid="match-menu">
            {t('match.mainMenu')}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PlayerScoreProps {
  name: string
  avatar: AvatarId
  score: number
  winner: boolean
  label?: string
  testId: string
}

function PlayerScore({ name, avatar, score, winner, label, testId }: PlayerScoreProps) {
  const { t, num } = useI18n()
  return (
    <div className={styles.player} data-winner={winner}>
      <Avatar id={avatar} size={56} />
      <bdi className={styles.name}>{name}</bdi>
      {label && <span className={styles.you}>{label}</span>}
      <strong className={`${styles.score} num`} data-testid={testId}>
        {num(score)}
      </strong>
      {winner && <span className={styles.winner}>{t('match.winner')}</span>}
    </div>
  )
}
