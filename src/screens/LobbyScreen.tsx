import { useEffect, useId, useState, type FormEvent } from 'react'
import { playNow } from '../app/actions'
import { useApp } from '../app/appStore'
import { isFirebaseConfigured } from '../auth/firebase'
import { Avatar } from '../components/Art'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Segmented } from '../components/Controls'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { Screen, ScreenHeader } from '../components/Screen'
import { MATCH_PRESETS } from '../game/levels/modes'
import { useI18n } from '../locales/i18n'
import { useProfile } from '../profile/profileStore'
import { CODE_LENGTH, isValidRoomCode, normalizeRoomCode } from '../multiplayer/roomCode'
import { canStart, isReady, matchStartAt, type RoomPlayer, type RoomSnapshot } from '../multiplayer/roomLogic'
import { useRoom } from '../multiplayer/roomStore'
import type { MatchLength } from '../types'
import styles from './LobbyScreen.module.css'

const LENGTHS: MatchLength[] = ['quick', 'classic', 'marathon']

export default function LobbyScreen() {
  const { t } = useI18n()
  const go = useApp((s) => s.go)
  const entry = useRoom((s) => s.entry)
  const configured = isFirebaseConfigured()

  const back = () => {
    if (useRoom.getState().entry) void useRoom.getState().leave()
    go('MENU')
  }

  return (
    <Screen testId="lobby-screen">
      <ScreenHeader title={t('lobby.title')} onBack={back} />
      {!configured ? <NotConfigured /> : entry ? <RoomView /> : <EntryView />}
    </Screen>
  )
}

function NotConfigured() {
  const { t } = useI18n()
  return (
    <Notice
      tone="warning"
      title={t('lobby.notConfiguredTitle')}
      testId="lobby-unconfigured"
      action={
        <Button size="sm" icon={<Icon name="play" size={16} />} onClick={() => playNow()}>
          {t('lobby.playSolo')}
        </Button>
      }
    >
      {t('lobby.notConfiguredBody')}
    </Notice>
  )
}

/* ------------------------------- create / join ------------------------------ */

function EntryView() {
  const { t, num } = useI18n()
  const busy = useRoom((s) => s.busy)
  const error = useRoom((s) => s.error)
  const notice = useRoom((s) => s.notice)
  const inviteCode = useRoom((s) => s.inviteCode)
  const [length, setLength] = useState<MatchLength>('classic')
  const [code, setCode] = useState(inviteCode)
  const [action, setAction] = useState<'create' | 'join' | null>(null)
  const [formatError, setFormatError] = useState(false)
  const codeId = useId()
  const errorId = useId()

  const create = () => {
    setAction('create')
    void useRoom.getState().create(length)
  }

  const join = (event: FormEvent) => {
    event.preventDefault()
    setAction('join')
    if (!isValidRoomCode(code)) {
      setFormatError(true)
      return
    }
    setFormatError(false)
    void useRoom.getState().join(code)
  }

  const joinError = action === 'join' ? (formatError ? 'invalidCode' : error) : null
  const createError = action === 'create' ? error : null

  return (
    <>
      {notice && (
        <Notice tone="info" testId="lobby-notice" action={<DismissButton />}>
          {t(`lobby.notices.${notice}`)}
        </Notice>
      )}

      <Card title={t('lobby.create')} testId="create-card">
        <p className={styles.hint}>{t('lobby.createHint')}</p>
        <Segmented<MatchLength>
          label={t('lobby.matchLength')}
          value={length}
          onChange={setLength}
          options={LENGTHS.map((value) => ({
            value,
            label: t(`lobby.lengths.${value}`),
            hint: t('lobby.lengthDetail', {
              target: num(MATCH_PRESETS[value].target),
              minutes: num(MATCH_PRESETS[value].timeLimitMs / 60_000),
            }),
            testId: `length-${value}`,
          }))}
        />
        <Button
          size="lg"
          block
          icon={<Icon name="users" />}
          loading={busy === 'creating'}
          disabled={busy !== null}
          onClick={create}
          data-testid="create-room"
        >
          {busy === 'creating' ? t('lobby.creating') : t('lobby.create')}
        </Button>
        {createError && (
          <p className={styles.error} role="alert" data-testid="create-error">
            {t(`lobby.errors.${createError}`)}
          </p>
        )}
      </Card>

      <Card title={t('lobby.join')} testId="join-card">
        <form className={styles.joinForm} onSubmit={join} noValidate>
          <label htmlFor={codeId} className={styles.label}>
            {t('lobby.codeLabel')}
          </label>
          <p className={styles.hint}>{t('lobby.joinHint')}</p>
          <input
            id={codeId}
            className={styles.codeInput}
            type="text"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            placeholder={t('lobby.codePlaceholder')}
            aria-invalid={joinError !== null}
            aria-describedby={joinError ? errorId : undefined}
            onChange={(event) => {
              setCode(normalizeRoomCode(event.target.value).slice(0, CODE_LENGTH))
              setFormatError(false)
            }}
            data-testid="join-code"
          />
          {joinError && (
            <p id={errorId} className={styles.error} role="alert" data-testid="join-error">
              {t(`lobby.errors.${joinError}`)}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            variant="gold"
            block
            icon={<Icon name="play" />}
            loading={busy === 'joining'}
            disabled={busy !== null}
            data-testid="join-room"
          >
            {busy === 'joining' ? t('lobby.joining') : t('lobby.join')}
          </Button>
        </form>
      </Card>
    </>
  )
}

function DismissButton() {
  const { t } = useI18n()
  return (
    <Button size="sm" variant="ghost" onClick={() => useRoom.getState().dismiss()}>
      {t('app.close')}
    </Button>
  )
}

/* --------------------------------- the room -------------------------------- */

function inviteUrl(code: string): string {
  const url = new URL(globalThis.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('room', code)
  return url.toString()
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers and non-secure pages: copy through a temporary field.
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.append(field)
    field.select()
    const copied = document.execCommand('copy')
    field.remove()
    return copied
  }
}

function RoomView() {
  const { t, num } = useI18n()
  const entry = useRoom((s) => s.entry)
  const room = useRoom((s) => s.room)
  const busy = useRoom((s) => s.busy)
  const error = useRoom((s) => s.error)
  const notice = useRoom((s) => s.notice)
  const online = useRoom((s) => s.online)
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  if (!entry) return null
  const code = entry.code
  const isHost = entry.role === 'host'

  const share = () => {
    navigator
      .share({ title: t('app.title'), text: t('lobby.shareText', { code, title: t('app.title') }), url: inviteUrl(code) })
      .catch(() => undefined)
  }

  return (
    <>
      {!online && (
        <Notice tone="warning" testId="lobby-offline">
          {t('lobby.reconnecting')}
        </Notice>
      )}
      {notice && (
        <Notice tone="info" testId="lobby-notice" action={<DismissButton />}>
          {t(`lobby.notices.${notice}`)}
        </Notice>
      )}

      <Card tone="gold" className={styles.codeCard} testId="room-card">
        <span className={styles.codeLabel}>{t('lobby.codeLabel')}</span>
        <strong className={styles.code} dir="ltr" aria-label={`${t('lobby.codeLabel')}: ${code.split('').join(' ')}`} data-testid="room-code">
          {code}
        </strong>
        <div className={styles.codeActions}>
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name={copied ? 'check' : 'copy'} size={16} />}
            onClick={() => void copyText(code).then(setCopied)}
            data-testid="copy-code"
          >
            {copied ? t('lobby.copied') : t('lobby.copy')}
          </Button>
          {canShare && (
            <Button size="sm" variant="secondary" icon={<Icon name="share" size={16} />} onClick={share}>
              {t('lobby.share')}
            </Button>
          )}
        </div>
        <span className="visually-hidden" role="status" aria-live="polite">
          {copied ? t('lobby.copied') : ''}
        </span>
        {room && (
          <p className={styles.matchInfo}>
            {t(`lobby.lengths.${room.meta.length}`)} ·{' '}
            {t('lobby.lengthDetail', {
              target: num(MATCH_PRESETS[room.meta.length].target),
              minutes: num(MATCH_PRESETS[room.meta.length].timeLimitMs / 60_000),
            })}
          </p>
        )}
      </Card>

      {room ? <Players room={room} uid={entry.uid} /> : <p className={styles.loading}>{t('lobby.connecting')}</p>}

      {room && <RoomActions room={room} uid={entry.uid} isHost={isHost} busy={busy} />}

      {error && (
        <p className={styles.error} role="alert" data-testid="room-error">
          {t(`lobby.errors.${error}`)}
        </p>
      )}

      <Button
        variant="ghost"
        block
        icon={<Icon name="logout" />}
        loading={busy === 'leaving'}
        onClick={() => void useRoom.getState().leave()}
        data-testid="leave-room"
      >
        {isHost ? t('lobby.cancelRoom') : t('lobby.leave')}
      </Button>
    </>
  )
}

function Players({ room, uid }: { room: RoomSnapshot; uid: string }) {
  const { t } = useI18n()
  const { meta, players } = room
  return (
    <ul className={styles.players} aria-label={t('lobby.players')} data-testid="room-players">
      <PlayerRow player={players[meta.hostUid]} host you={meta.hostUid === uid} ready={isReady(meta, players[meta.hostUid])} />
      {meta.guestUid ? (
        <PlayerRow player={players[meta.guestUid]} you={meta.guestUid === uid} ready={isReady(meta, players[meta.guestUid])} />
      ) : (
        <li className={[styles.player, styles.empty].join(' ')} data-testid="open-seat">
          <span className={styles.emptyAvatar} aria-hidden="true">
            <Icon name="user" />
          </span>
          <span className={styles.playerText}>
            <strong>{t('lobby.emptySlot')}</strong>
            <small>{t('lobby.waitingForFriend')}</small>
          </span>
        </li>
      )}
    </ul>
  )
}

function PlayerRow({ player, host, you, ready }: { player?: RoomPlayer; host?: boolean; you: boolean; ready: boolean }) {
  const { t } = useI18n()
  const fallbackName = useProfile((s) => s.record.profile.displayName)
  const name = player?.name ?? (you ? fallbackName : '—')
  const connected = player?.connected ?? you
  return (
    <li className={styles.player} data-testid={you ? 'player-me' : 'player-opponent'} data-ready={ready}>
      <Avatar id={player?.avatar ?? 'hot-cup'} size={44} />
      <span className={styles.playerText}>
        <span className={styles.nameLine}>
          <bdi className={styles.playerName}>{name}</bdi>
          {you && <span className={styles.tag}>{t('leaderboard.you')}</span>}
          {host && <span className={[styles.tag, styles.hostTag].join(' ')}>{t('lobby.host')}</span>}
        </span>
        <small className={connected ? styles.online : styles.offline}>
          <span className={styles.dot} aria-hidden="true" />
          {connected ? t('lobby.connected') : t('lobby.disconnected')}
        </small>
      </span>
      <span className={ready ? styles.ready : styles.notReady} data-testid="ready-state">
        {ready && <Icon name="check" size={16} />}
        {ready ? t('lobby.isReady') : t('lobby.notReady')}
      </span>
    </li>
  )
}

function RoomActions({ room, uid, isHost, busy }: { room: RoomSnapshot; uid: string; isHost: boolean; busy: string | null }) {
  const { t } = useI18n()
  const { meta } = room
  if (meta.status === 'live') {
    const startAt = matchStartAt(meta)
    return (
      <p className={styles.waiting} role="status">
        {startAt !== null && !room.result ? t('lobby.matchStarting') : t('lobby.notices.matchInProgress')}
      </p>
    )
  }
  const meReady = isReady(meta, room.players[uid])
  const startable = canStart(room, uid)
  return (
    <div className={styles.actions}>
      <Button
        size="lg"
        block
        variant={meReady ? 'gold' : 'secondary'}
        aria-pressed={meReady}
        icon={<Icon name="check" />}
        loading={busy === 'ready'}
        disabled={busy !== null && busy !== 'ready'}
        onClick={() => void useRoom.getState().toggleReady()}
        data-testid="ready-toggle"
      >
        {t('lobby.ready')}
      </Button>
      {isHost ? (
        <Button
          size="lg"
          block
          icon={<Icon name="play" />}
          disabled={!startable || busy !== null}
          loading={busy === 'starting'}
          hint={startable ? undefined : meta.guestUid ? t('lobby.waitingForReady') : t('lobby.waitingForFriend')}
          onClick={() => void useRoom.getState().start()}
          data-testid="start-match"
        >
          {t('lobby.start')}
        </Button>
      ) : (
        <p className={styles.waiting} role="status">
          {t('lobby.waitingForHost')}
        </p>
      )}
    </div>
  )
}
