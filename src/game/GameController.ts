import Phaser from 'phaser'
import { getApp } from '../app/appStore'
import { getSettings, prefersReducedMotion } from '../app/settings'
import { audio, vibrate } from '../audio/audioEngine'
import { currentI18n } from '../locales/i18n'
import { achievementsFromEvent } from '../profile/achievements'
import { getProfile, useProfile } from '../profile/profileStore'
import { markEndlessRunStart, submitEndlessScore } from '../services/leaderboard'
import type { BasketSkinId } from '../types'
import { Bot, BOT_SKILLS, type BotSkillName } from './bot'
import { GameSession } from './core/GameSession'
import type { GameEvent, SessionResult } from './core/types'
import { useHud } from './hudStore'
import { sessionConfigFor, type PlayRequest } from './levels/modes'
import { PlayScene, type SceneHost } from './scenes/PlayScene'

const DPR_CAP = 2
const TUTORIAL_MOVE_MS = 4500
const TUTORIAL_GOAL_MS = 3200

export interface RunEnd {
  result: SessionResult
  outcome: SessionResult['outcome']
}

type EventListener = (event: GameEvent, session: GameSession) => void

/**
 * Owns the Phaser game (one instance for the life of the page) and the
 * current GameSession. Routes simulation events to rendering, sound, the HUD,
 * achievements and the app state machine.
 */
export class GameController implements SceneHost {
  private game: Phaser.Game | null = null
  private scene: PlayScene | null = null
  private host: HTMLElement | null = null
  private observer: ResizeObserver | null = null
  private bot: Bot | null = null
  private running = false
  private finished = false
  private clock: (() => number) | null = null
  private skin: BasketSkinId = 'classic'
  private introduced = new Set<string>()
  private tutorialSince = 0
  private lastTimerUpdate = 0
  private readonly listeners = new Set<EventListener>()
  session: GameSession | null = null
  request: PlayRequest | null = null
  /** Online matches decide their own result screen. */
  onVersusEnd: ((end: RunEnd) => void) | null = null

  mount(host: HTMLElement): void {
    if (this.game) {
      this.wake()
      return
    }
    this.host = host
    const scene = new PlayScene()
    scene.host = this
    const { width, height } = host.getBoundingClientRect()
    const dpr = this.dpr()
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      transparent: true,
      width: Math.max(1, Math.round(width * dpr)),
      height: Math.max(1, Math.round(height * dpr)),
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
      banner: false,
      disableContextMenu: true,
      render: { antialias: true, powerPreference: 'high-performance' },
      scene: [scene],
    })
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    useProfile.subscribe((state) => {
      if (state.record.profile.basketSkin !== this.skin) this.applySkin()
    })
  }

  private dpr(): number {
    return Math.min(globalThis.devicePixelRatio || 1, DPR_CAP)
  }

  private resize(): void {
    if (!this.game || !this.host) return
    const { width, height } = this.host.getBoundingClientRect()
    if (width < 2 || height < 2) return
    const dpr = this.dpr()
    this.game.scale.setZoom(1 / dpr)
    this.game.scale.resize(Math.round(width * dpr), Math.round(height * dpr))
    this.scene?.resize(width, height, dpr)
  }

  private applySkin(): void {
    this.skin = getProfile().profile.basketSkin
    this.scene?.setSkin(this.skin)
  }

  sleep(): void {
    this.game?.loop.sleep()
  }

  wake(): void {
    this.game?.loop.wake()
    this.resize()
  }

  /* ---------------------------- SceneHost methods --------------------------- */

  onSceneReady(scene: PlayScene): void {
    this.scene = scene
    this.resize()
    this.applySkin()
    if (this.session) scene.reset(this.session)
  }

  reducedMotion(): boolean {
    return prefersReducedMotion()
  }

  fontFamily(): string {
    return '"Cairo Variable", Cairo, system-ui, sans-serif'
  }

  isRtl(): boolean {
    return getSettings().language === 'ar'
  }

  /* -------------------------------- lifecycle ------------------------------- */

  /** Sets up a fresh session for a run. Nothing carries over from the previous run. */
  prepare(request: PlayRequest, run: number): void {
    this.abandon()
    const config = sessionConfigFor(request)
    this.request = request
    this.session = new GameSession(config, request.seed)
    this.running = false
    this.finished = false
    this.clock = null
    this.introduced = new Set()
    this.tutorialSince = 0
    const opponent = request.mode === 'versus' ? useHud.getState().opponent : null
    useHud.setState({
      active: true,
      run,
      mode: config.mode,
      levelId: config.level.id,
      theme: config.level.theme,
      score: 0,
      target: config.target,
      lives: Number.isFinite(config.lives) ? config.lives : 0,
      maxLives: Number.isFinite(config.lives) ? config.lives : 0,
      multiplier: 1,
      streak: 0,
      wave: 1,
      timeLeftMs: config.timeLimitMs > 0 ? config.timeLimitMs : null,
      banner: null,
      tutorial: config.level.tutorial ? 'move' : null,
      opponent,
    })
    this.applySkin()
    this.scene?.reset(this.session)
  }

  /** Starts the simulation. Online matches pass a shared clock (ms since match start). */
  start(clock?: () => number): void {
    const session = this.session
    if (!session || this.finished) return
    session.start()
    this.clock = clock ?? null
    this.running = true
    this.tutorialSince = session.time
    const theme = session.config.level.theme
    audio.setMusic(theme === 'finale' ? 'finale' : 'game', 0)
    if (session.config.mode === 'endless') void markEndlessRunStart()
  }

  get isRunning(): boolean {
    return this.running
  }

  pause(): void {
    if (!this.running) return
    this.running = false
    this.session?.setAxis(0)
    this.session?.setPointer(null)
    audio.play('pause')
  }

  resume(): void {
    if (!this.session || this.finished || this.running || this.session.status !== 'running') return
    this.running = true
    audio.play('resume')
  }

  /** Leaves the current run (quit or restart); cups caught so far still count. */
  abandon(): void {
    const session = this.session
    if (session && !this.finished && session.status === 'running' && session.config.mode !== 'versus') {
      useProfile.getState().recordAbandoned(session.result('gameOver'))
    }
    this.session = null
    this.running = false
    this.clock = null
    this.bot = null
  }

  /** Called when the game screen is left for the menus. */
  release(): void {
    this.abandon()
    useHud.setState({ active: false, banner: null, tutorial: null })
    audio.setMusic('menu')
  }

  /** Online matches: the server decided the round (e.g. the opponent reached the target first). */
  haltVersus(): void {
    const session = this.session
    if (!session || session.config.mode !== 'versus' || this.finished) return
    this.finished = true
    this.running = false
    this.bot = null
    session.setAxis(0)
    session.setPointer(null)
    this.scene?.freeze()
  }

  /** Subscribe to simulation events (used by online matches). */
  addListener(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /* ---------------------------------- input --------------------------------- */

  setAxis(axis: -1 | 0 | 1): void {
    this.session?.setAxis(axis)
    if (axis !== 0) this.markMoved()
  }

  /** Pointer x in CSS pixels from the game area's left edge, or null when released. */
  setPointer(cssX: number | null): void {
    if (!this.session) return
    if (cssX === null || !this.scene) {
      this.session.setPointer(null)
      return
    }
    this.session.setPointer(this.scene.screenToFieldX(cssX))
    this.markMoved()
  }

  private markMoved(): void {
    const hud = useHud.getState()
    if (hud.tutorial === 'move' && this.running) hud.set({ tutorial: 'catch' })
  }

  /** Lets a simulated player take over (development and end-to-end tests only). */
  enableBot(skill: BotSkillName = 'perfect'): void {
    this.bot = new Bot(BOT_SKILLS[skill], 1)
  }

  /* ---------------------------------- frame --------------------------------- */

  tick(deltaMs: number): void {
    const session = this.session
    if (!session || !this.running) return
    if (this.bot) this.bot.update(session, deltaMs)
    if (this.clock) session.advanceTo(this.clock())
    else session.advance(deltaMs)
    for (const event of session.drainEvents()) {
      this.handle(event, session)
      for (const listener of this.listeners) listener(event, session)
    }
    this.updateTimers(session)
  }

  private updateTimers(session: GameSession): void {
    const hud = useHud.getState()
    if (hud.tutorial === 'move' && session.time - this.tutorialSince > TUTORIAL_MOVE_MS) hud.set({ tutorial: 'catch' })
    if (hud.tutorial === 'goal' && session.time - this.tutorialSince > TUTORIAL_GOAL_MS) hud.set({ tutorial: null })
    if (session.config.timeLimitMs > 0 && session.time - this.lastTimerUpdate >= 200) {
      this.lastTimerUpdate = session.time
      hud.set({ timeLeftMs: Math.max(0, session.config.timeLimitMs - session.time) })
    }
    if (session.config.target > 0) audio.setIntensity(session.progress)
  }

  private introduce(kind: 'golden' | 'special' | 'obstacle'): void {
    if (this.introduced.has(kind)) return
    this.introduced.add(kind)
    const levelId = this.session?.config.level.id
    const introLevel = { golden: 4, special: 6, obstacle: 12 }[kind]
    if (this.session?.config.mode === 'campaign' && levelId === introLevel) {
      useHud.getState().showBanner(kind === 'golden' ? 'goldenIntro' : kind === 'special' ? 'specialIntro' : 'obstacleIntro')
    }
  }

  private handle(event: GameEvent, session: GameSession): void {
    const scene = this.scene
    const hud = useHud.getState()
    const { t } = currentI18n()
    switch (event.type) {
      case 'spawn':
        if (event.cup.kind !== 'normal') this.introduce(event.cup.kind)
        break
      case 'catch': {
        scene?.catchFx(event.cupId, event.x, event.kind, event.points.total, event.points.multiplier)
        audio.play(event.kind === 'golden' ? 'golden' : event.kind === 'special' ? 'special' : 'catch', {
          combo: event.combo,
        })
        hud.set({ score: session.score, streak: event.streak, lives: Number.isFinite(event.lives) ? event.lives : 0 })
        if (event.lifeRefilled) {
          hud.showBanner('refill')
          scene?.refillFx(event.x, t('game.refill'))
          audio.play('refill')
        }
        if (hud.tutorial === 'catch' || hud.tutorial === 'move') {
          this.tutorialSince = session.time
          hud.set({ tutorial: 'goal' })
        }
        const earned = achievementsFromEvent(event)
        if (earned.some((id) => getProfile().progress.achievements[id] === undefined)) {
          useProfile.getState().unlock(earned)
        }
        if (session.config.target > 0 && session.score >= session.config.target && session.config.mode === 'versus') {
          hud.showBanner('targetReached')
        }
        break
      }
      case 'miss':
        scene?.missFx(event.cupId, event.x, t('game.miss'))
        audio.play('miss')
        vibrate(70)
        hud.set({
          lives: Number.isFinite(event.lives) ? event.lives : 0,
          streak: 0,
          multiplier: 1,
          hitPulse: hud.hitPulse + 1,
        })
        break
      case 'obstacleHit':
        scene?.obstacleFx(event.cupId, event.x, t('game.ouch'))
        audio.play('obstacle')
        vibrate([40, 40, 90])
        hud.set({
          lives: Number.isFinite(event.lives) ? event.lives : 0,
          streak: 0,
          multiplier: 1,
          hitPulse: hud.hitPulse + 1,
        })
        break
      case 'dodge':
        scene?.dodgeFx(event.cupId, event.x)
        break
      case 'multiplier':
        hud.set({ multiplier: event.multiplier })
        if (event.multiplier > 1) audio.play('combo')
        break
      case 'streak':
        hud.showBanner('streak', event.streak)
        audio.play('streak')
        break
      case 'wave': {
        hud.set({ wave: event.wave })
        hud.showBanner(event.bonus ? 'goldenRush' : 'wave', event.wave)
        audio.play('wave')
        scene?.pulse(event.bonus ? 'gold' : 'green')
        audio.setIntensity(Math.min(1, event.wave / 15))
        const earned = achievementsFromEvent(event)
        if (earned.length) useProfile.getState().unlock(earned)
        break
      }
      case 'finalWave':
        hud.showBanner('finalWave')
        audio.play('wave')
        scene?.pulse('gold')
        audio.setIntensity(1)
        break
      case 'milestone':
        hud.showBanner('milestone', event.score)
        audio.play('streak')
        break
      case 'complete':
      case 'gameOver':
      case 'timeUp':
        this.finish(event.result)
        break
    }
  }

  private finish(result: SessionResult): void {
    this.finished = true
    this.running = false
    this.bot = null
    const scene = this.scene
    const app = getApp()
    const reduced = this.reducedMotion()

    if (result.mode === 'versus') {
      if (result.outcome === 'complete') scene?.celebrate()
      else scene?.freeze()
      this.onVersusEnd?.({ result, outcome: result.outcome })
      return
    }

    if (result.outcome === 'complete') {
      scene?.celebrate()
      audio.play('victory')
      audio.setMusic('off')
      const summary = useProfile.getState().recordCampaign(result)
      app.setOutcome({ kind: 'campaign', result, summary })
      window.setTimeout(() => getApp().go('LEVEL_COMPLETE'), reduced ? 350 : 1150)
      return
    }

    scene?.freeze()
    audio.play('gameOver')
    audio.setMusic('off')
    if (result.mode === 'endless') {
      const summary = useProfile.getState().recordEndless(result)
      app.setOutcome({ kind: 'endless', result, summary, rank: null })
      void submitEndlessScore(result).then((rank) => {
        const outcome = getApp().outcome
        if (rank !== null && outcome?.kind === 'endless' && outcome.result === result) {
          getApp().setOutcome({ ...outcome, rank })
        }
      })
    } else {
      const summary = useProfile.getState().recordCampaign(result)
      app.setOutcome({ kind: 'campaign', result, summary })
    }
    window.setTimeout(() => getApp().go('GAME_OVER'), reduced ? 300 : 900)
  }
}

let instance: GameController | null = null

export function getController(): GameController {
  instance ??= new GameController()
  return instance
}
