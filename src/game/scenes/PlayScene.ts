import Phaser from 'phaser'
import { BASKET_ORDER } from '../../profile/cosmetics'
import { canvasPalette, type CanvasPalette } from '../../styles/theme'
import type { BasketSkinId, CupKind } from '../../types'
import {
  GOLDEN_CUP_ART,
  NORMAL_CUP_ART,
  normalCupArt,
  OBSTACLE_ART,
  SPECIAL_CUP_ART,
  type SpriteArt,
} from '../art/assets'
import { basketSvg } from '../art/basket'
import { svgDataUrl } from '../art/svg'
import { BASKET, CATCH_Y, COUNTER_Y, CUP, FIELD_HEIGHT, FIELD_WIDTH } from '../core/constants'
import type { GameSession } from '../core/GameSession'
import type { CupSpec } from '../core/types'
import { speedFactorAt } from '../systems/motion'

/** What the scene needs from the controller (kept as an interface to avoid import cycles). */
export interface SceneHost {
  tick(deltaMs: number): void
  onSceneReady(scene: PlayScene): void
  reducedMotion(): boolean
  fontFamily(): string
  isRtl(): boolean
}

const BASKET_DRAW = { width: 160, height: 100, offsetY: -11 }
const DEPTH = { shadow: 2, counter: 4, basketBack: 10, cup: 20, sink: 21, basketFront: 30, passed: 35, fx: 40, text: 50 }
const TEX = {
  glow: 'fx-glow',
  dot: 'fx-dot',
  spark: 'fx-spark',
  drop: 'fx-drop',
  ring: 'fx-ring',
  shadow: 'fx-shadow',
  star: 'fx-star',
  diamond: 'fx-diamond',
  cross: 'fx-cross',
  counter: 'fx-counter',
  shade: 'fx-shade',
  splat: 'fx-splat',
} as const

interface CupView {
  spec: CupSpec
  art: SpriteArt
  image: Phaser.GameObjects.Image
  shadow: Phaser.GameObjects.Image
  aura: Phaser.GameObjects.Image | null
  badge: Phaser.GameObjects.Image | null
  height: number
  smokeAt: number
  boosted: boolean
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function artFor(kind: CupKind, variant: number): SpriteArt {
  if (kind === 'golden') return GOLDEN_CUP_ART
  if (kind === 'special') return SPECIAL_CUP_ART
  if (kind === 'obstacle') return OBSTACLE_ART
  return normalCupArt(variant)
}

export class PlayScene extends Phaser.Scene {
  host: SceneHost | null = null
  private session: GameSession | null = null
  private views = new Map<number, CupView>()
  private basketBack!: Phaser.GameObjects.Image
  private basketFront!: Phaser.GameObjects.Image
  private basketGlow!: Phaser.GameObjects.Image
  private counter!: Phaser.GameObjects.TileSprite
  private shadeLeft!: Phaser.GameObjects.Image
  private shadeRight!: Phaser.GameObjects.Image
  private palette!: CanvasPalette
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private golds!: Phaser.GameObjects.Particles.ParticleEmitter
  private pinks!: Phaser.GameObjects.Particles.ParticleEmitter
  private drops!: Phaser.GameObjects.Particles.ParticleEmitter
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter
  private tilt = 0
  private squash = 0
  private elapsed = 0
  private frozen = false
  private cssWidth = 1
  private cssHeight = 1
  private dpr = 1
  fieldScale = 1

  constructor() {
    super({ key: 'play' })
  }

  /* --------------------------------- setup ---------------------------------- */

  preload(): void {
    for (const art of [...NORMAL_CUP_ART, GOLDEN_CUP_ART, SPECIAL_CUP_ART, OBSTACLE_ART]) {
      if (!this.textures.exists(art.key)) this.load.image(art.key, art.url)
    }
    for (const skin of BASKET_ORDER) {
      this.load.image(`basket-${skin}-back`, svgDataUrl(basketSvg(skin, 'back', 360)))
      this.load.image(`basket-${skin}-front`, svgDataUrl(basketSvg(skin, 'front', 360)))
    }
  }

  create(): void {
    this.palette = canvasPalette()
    this.makeTextures()

    this.counter = this.add.tileSprite(0, COUNTER_Y, FIELD_WIDTH, FIELD_HEIGHT - COUNTER_Y + 40, TEX.counter)
    this.counter.setOrigin(0, 0).setDepth(DEPTH.counter)
    this.shadeLeft = this.add.image(0, 0, TEX.shade).setOrigin(1, 0).setDepth(DEPTH.counter - 1).setFlipX(true)
    this.shadeRight = this.add.image(FIELD_WIDTH, 0, TEX.shade).setOrigin(0, 0).setDepth(DEPTH.counter - 1)

    const x = FIELD_WIDTH / 2
    const y = BASKET.y + BASKET_DRAW.offsetY
    this.basketGlow = this.add
      .image(x, BASKET.rimY, TEX.glow)
      .setDepth(DEPTH.basketBack - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setScale(2.4, 1.2)
    this.basketBack = this.add.image(x, y, 'basket-classic-back').setDepth(DEPTH.basketBack)
    this.basketFront = this.add.image(x, y, 'basket-classic-front').setDepth(DEPTH.basketFront)
    this.basketBack.setDisplaySize(BASKET_DRAW.width, BASKET_DRAW.height)
    this.basketFront.setDisplaySize(BASKET_DRAW.width, BASKET_DRAW.height)

    const p = this.palette
    const burst = (tints: number[], extra: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}) =>
      this.add
        .particles(0, 0, TEX.spark, {
          emitting: false,
          speed: { min: 140, max: 360 },
          angle: { min: 200, max: 340 },
          gravityY: 620,
          lifespan: { min: 420, max: 760 },
          scale: { start: 0.55, end: 0 },
          rotate: { min: 0, max: 360 },
          tint: tints,
          blendMode: Phaser.BlendModes.ADD,
          ...extra,
        })
        .setDepth(DEPTH.fx)
    this.sparks = burst([p.cream, p.greenLight, p.goldLight])
    this.golds = burst([p.goldLight, p.gold, 0xffffff], { speed: { min: 180, max: 460 }, lifespan: { min: 600, max: 1000 } })
    this.pinks = burst([p.pink, p.goldLight, 0xc79bff], { speed: { min: 180, max: 460 }, lifespan: { min: 600, max: 1000 } })
    this.drops = this.add
      .particles(0, 0, TEX.drop, {
        emitting: false,
        speed: { min: 90, max: 260 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        lifespan: { min: 380, max: 620 },
        scale: { start: 0.5, end: 0.15 },
        tint: [p.coffee, p.caramel, p.coffeeDark],
      })
      .setDepth(DEPTH.fx)
    this.smoke = this.add
      .particles(0, 0, TEX.dot, {
        emitting: false,
        speedY: { min: -70, max: -30 },
        speedX: { min: -18, max: 18 },
        lifespan: 900,
        scale: { start: 0.35, end: 1.3 },
        alpha: { start: 0.38, end: 0 },
        tint: 0x8d8d8d,
      })
      .setDepth(DEPTH.cup - 1)
    this.confetti = this.add
      .particles(0, 0, TEX.spark, {
        emitting: false,
        speed: { min: 260, max: 620 },
        angle: { min: 230, max: 310 },
        gravityY: 700,
        lifespan: { min: 900, max: 1500 },
        scale: { start: 0.7, end: 0.2 },
        rotate: { min: 0, max: 360 },
        tint: [p.green, p.greenLight, p.cream, p.goldLight, p.gold],
      })
      .setDepth(DEPTH.fx)

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.layout())
    this.host?.onSceneReady(this)
  }

  /** Procedural textures for effects and the counter. */
  private makeTextures(): void {
    const canvasTexture = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return
      const texture = this.textures.createCanvas(key, w, h)
      if (!texture) return
      draw(texture.getContext())
      texture.refresh()
    }
    canvasTexture(TEX.glow, 128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
    })
    canvasTexture(TEX.dot, 32, 32, (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 32, 32)
    })
    canvasTexture(TEX.spark, 32, 32, (ctx) => {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(16, 0)
      ctx.quadraticCurveTo(18, 14, 32, 16)
      ctx.quadraticCurveTo(18, 18, 16, 32)
      ctx.quadraticCurveTo(14, 18, 0, 16)
      ctx.quadraticCurveTo(14, 14, 16, 0)
      ctx.fill()
    })
    canvasTexture(TEX.drop, 24, 32, (ctx) => {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(12, 0)
      ctx.bezierCurveTo(24, 16, 22, 32, 12, 32)
      ctx.bezierCurveTo(2, 32, 0, 16, 12, 0)
      ctx.fill()
    })
    canvasTexture(TEX.ring, 128, 128, (ctx) => {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(64, 64, 58, 0, Math.PI * 2)
      ctx.stroke()
    })
    canvasTexture(TEX.shadow, 128, 40, (ctx) => {
      const g = ctx.createRadialGradient(64, 20, 0, 64, 20, 64)
      g.addColorStop(0, 'rgba(0,0,0,0.55)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.scale(1, 0.31)
      ctx.fillRect(0, 0, 128, 128)
    })
    canvasTexture(TEX.splat, 128, 48, (ctx) => {
      ctx.fillStyle = 'rgba(74,44,29,0.85)'
      ctx.beginPath()
      ctx.ellipse(64, 24, 54, 14, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(122,74,46,0.8)'
      for (const [x, y, r] of [
        [18, 18, 7],
        [108, 30, 6],
        [96, 12, 5],
        [30, 34, 5],
      ]) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    const starPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.45
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
      }
      ctx.closePath()
    }
    canvasTexture(TEX.star, 64, 64, (ctx) => {
      ctx.fillStyle = '#0b2b22'
      ctx.beginPath()
      ctx.arc(32, 32, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f1dfb2'
      starPath(ctx, 32, 33, 21)
      ctx.fill()
    })
    canvasTexture(TEX.diamond, 64, 64, (ctx) => {
      ctx.fillStyle = '#3b1631'
      ctx.beginPath()
      ctx.arc(32, 32, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd6ec'
      ctx.beginPath()
      ctx.moveTo(32, 10)
      ctx.lineTo(52, 32)
      ctx.lineTo(32, 54)
      ctx.lineTo(12, 32)
      ctx.closePath()
      ctx.fill()
    })
    canvasTexture(TEX.cross, 64, 64, (ctx) => {
      ctx.fillStyle = '#5a0f12'
      ctx.beginPath()
      ctx.arc(32, 32, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffd2c2'
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(20, 20)
      ctx.lineTo(44, 44)
      ctx.moveTo(44, 20)
      ctx.lineTo(20, 44)
      ctx.stroke()
    })
    canvasTexture(TEX.counter, 256, 140, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 140)
      g.addColorStop(0, '#7a4b2c')
      g.addColorStop(0.08, '#5b3620')
      g.addColorStop(1, '#2e1a0f')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 140)
      ctx.globalAlpha = 0.18
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = i % 3 === 0 ? '#c58d56' : '#1f120a'
        ctx.lineWidth = 1 + (i % 2)
        const y = 12 + i * 5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(64, y - 3, 192, y + 3, 256, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(241,223,178,0.55)'
      ctx.fillRect(0, 0, 256, 3)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 3, 256, 2)
    })
    canvasTexture(TEX.shade, 64, 4, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 64, 0)
      g.addColorStop(0, 'rgba(4,32,26,0.0)')
      g.addColorStop(1, 'rgba(4,32,26,0.55)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 64, 4)
    })
  }

  /** Fits the 540 × 960 field at the bottom-centre of the screen, at full device resolution. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = Math.max(1, cssWidth)
    this.cssHeight = Math.max(1, cssHeight)
    this.dpr = dpr
    this.layout()
  }

  private layout(): void {
    if (!this.counter) return
    const s = Math.min(this.cssWidth / FIELD_WIDTH, this.cssHeight / FIELD_HEIGHT)
    this.fieldScale = s
    const camera = this.cameras.main
    camera.setZoom(s * this.dpr)
    const visibleWidth = this.cssWidth / s
    const visibleHeight = this.cssHeight / s
    camera.centerOn(FIELD_WIDTH / 2, FIELD_HEIGHT - visibleHeight / 2)
    const left = FIELD_WIDTH / 2 - visibleWidth / 2
    const top = FIELD_HEIGHT - visibleHeight
    this.counter.setPosition(left, COUNTER_Y).setSize(visibleWidth, FIELD_HEIGHT - COUNTER_Y + 40)
    const sideWidth = Math.max(0, -left)
    this.shadeLeft.setVisible(sideWidth > 4).setPosition(0, top).setDisplaySize(sideWidth, COUNTER_Y - top)
    this.shadeRight.setVisible(sideWidth > 4).setPosition(FIELD_WIDTH, top).setDisplaySize(sideWidth, COUNTER_Y - top)
  }

  /** Converts a screen x (CSS px from the canvas's left edge) to a field x. */
  screenToFieldX(cssX: number): number {
    return FIELD_WIDTH / 2 + (cssX - this.cssWidth / 2) / this.fieldScale
  }

  /* --------------------------------- frames --------------------------------- */

  setSkin(skin: BasketSkinId): void {
    if (!this.basketBack) return
    this.basketBack.setTexture(`basket-${skin}-back`).setDisplaySize(BASKET_DRAW.width, BASKET_DRAW.height)
    this.basketFront.setTexture(`basket-${skin}-front`).setDisplaySize(BASKET_DRAW.width, BASKET_DRAW.height)
  }

  /** Starts rendering a new session (level start or restart). */
  reset(session: GameSession): void {
    this.session = session
    this.frozen = false
    this.tweens.killAll()
    this.tweens.timeScale = 1
    for (const emitter of [this.sparks, this.golds, this.pinks, this.confetti]) if (emitter) emitter.timeScale = 1
    for (const view of this.views.values()) this.destroyView(view)
    this.views.clear()
    this.children.list
      .filter((child) => child.getData?.('transient'))
      .forEach((child) => child.destroy())
    this.tilt = 0
    this.squash = 0
    this.basketBack?.setRotation(0)
    this.basketFront?.setRotation(0)
  }

  update(_time: number, delta: number): void {
    this.host?.tick(delta)
    this.elapsed += delta
    this.renderFrame(delta)
  }

  private renderFrame(delta: number): void {
    const session = this.session
    if (!session) return
    const alpha = this.frozen ? 1 : Math.min(1, session.alpha)

    const bx = lerp(session.basket.prevX, session.basket.x, alpha)
    const targetTilt = this.frozen ? 0 : Math.max(-0.11, Math.min(0.11, session.basket.vx / 7200))
    this.tilt += (targetTilt - this.tilt) * Math.min(1, delta / 90)
    this.squash *= Math.pow(0.0005, delta / 1000)
    const sx = 1 + this.squash * 0.09
    const sy = 1 - this.squash * 0.11
    const by = BASKET.y + BASKET_DRAW.offsetY + this.squash * 4
    for (const part of [this.basketBack, this.basketFront]) {
      part.setPosition(bx, by).setRotation(this.tilt)
      part.setDisplaySize(BASKET_DRAW.width * sx, BASKET_DRAW.height * sy)
    }
    this.basketGlow.setPosition(bx, BASKET.rimY)

    const seen = new Set<number>()
    for (const cup of session.cups) {
      seen.add(cup.spec.id)
      const view = this.views.get(cup.spec.id) ?? this.createView(cup.spec)
      const x = lerp(cup.prevX, cup.x, alpha)
      const y = lerp(cup.prevY, cup.y, alpha)
      const passed = cup.state === 'passed'
      const fadeIn = Math.min(1, (y - CUP.spawnY) / 60)
      const sway = (cup.x - cup.prevX) * 0.035
      const wobble = Math.sin((this.elapsed + cup.spec.id * 137) / 260) * 0.06
      const rotation = cup.spec.kind === 'obstacle' ? (this.elapsed / 900 + cup.spec.id) % (Math.PI * 2) : sway + wobble

      view.image.setPosition(x, y).setRotation(rotation).setAlpha(fadeIn)
      view.image.setDepth(passed ? DEPTH.passed : DEPTH.cup)

      const progress = Math.min(1, Math.max(0, cup.progress))
      view.shadow
        .setVisible(!passed)
        .setPosition(x, COUNTER_Y + 4)
        .setAlpha(0.1 + progress * 0.5)
        .setScale(0.35 + progress * 0.45, 0.6 + progress * 0.4)

      const pulse = 1 + Math.sin(this.elapsed / 180 + cup.spec.id) * 0.08
      if (view.aura) view.aura.setPosition(x, y).setAlpha(fadeIn * 0.85).setScale(pulse * (view.height / 70))
      if (view.badge) {
        const width = view.height * view.art.aspect
        view.badge.setPosition(x + width / 2 - 2, y - view.height / 2 + 8).setAlpha(fadeIn)
      }

      // Speed burst: the cup flashes and leaves a streak while it rushes down.
      const fast = cup.spec.burst !== null && speedFactorAt(cup.spec, session.time - cup.spec.spawnAt) > 1
      if (fast && !view.boosted) {
        view.boosted = true
        this.smoke.emitParticleAt(x, y - view.height / 2, 3)
        view.image.setTintFill(0xffffff)
        this.time.delayedCall(90, () => view.image.active && view.image.clearTint())
      }
      if (fast && !passed && this.elapsed - view.smokeAt > 50) {
        view.smokeAt = this.elapsed
        this.sparks.emitParticleAt(x, y - view.height / 2, 1)
      }
      if (cup.spec.kind === 'obstacle' && this.elapsed - view.smokeAt > 120) {
        view.smokeAt = this.elapsed
        this.smoke.emitParticleAt(x + Math.sin(this.elapsed) * 6, y - view.height * 0.45, 1)
      }
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        this.destroyView(view)
        this.views.delete(id)
      }
    }
  }

  private createView(spec: CupSpec): CupView {
    const art = artFor(spec.kind, spec.variant)
    const height = CUP.height * art.scale
    const image = this.add.image(-200, -200, art.key).setDepth(DEPTH.cup)
    image.setDisplaySize(height * art.aspect, height)
    const shadow = this.add.image(-200, -200, TEX.shadow).setDepth(DEPTH.shadow).setDisplaySize(90, 28)
    let aura: Phaser.GameObjects.Image | null = null
    let badge: Phaser.GameObjects.Image | null = null
    const p = this.palette
    if (spec.kind === 'golden' || spec.kind === 'special' || spec.kind === 'obstacle') {
      aura = this.add
        .image(-200, -200, spec.kind === 'obstacle' ? TEX.ring : TEX.glow)
        .setDepth(DEPTH.cup - 1)
        .setBlendMode(spec.kind === 'obstacle' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD)
        .setTint(spec.kind === 'golden' ? p.goldLight : spec.kind === 'special' ? p.pink : p.red)
      badge = this.add
        .image(-200, -200, spec.kind === 'golden' ? TEX.star : spec.kind === 'special' ? TEX.diamond : TEX.cross)
        .setDepth(DEPTH.cup + 1)
        .setDisplaySize(26, 26)
    }
    const view: CupView = { spec, art, image, shadow, aura, badge, height, smokeAt: 0, boosted: false }
    this.views.set(spec.id, view)
    return view
  }

  private destroyView(view: CupView): void {
    view.image.destroy()
    view.shadow.destroy()
    view.aura?.destroy()
    view.badge?.destroy()
  }

  private takeView(cupId: number): CupView | null {
    const view = this.views.get(cupId) ?? null
    if (view) this.views.delete(cupId)
    return view
  }

  /* -------------------------------- effects --------------------------------- */

  floatText(text: string, x: number, y: number, color: string, size = 34, rise = 70): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: this.host?.fontFamily() ?? 'sans-serif',
        fontSize: `${size}px`,
        fontStyle: '900',
        color,
        stroke: '#04201a',
        strokeThickness: 6,
        resolution: Math.min(3, this.fieldScale * this.dpr),
        rtl: this.host?.isRtl() ?? false,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.text)
      .setData('transient', true)
      .setScale(0.6)
    this.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.Out' })
    this.tweens.add({
      targets: label,
      y: y - rise,
      alpha: 0,
      delay: 380,
      duration: 520,
      ease: 'Cubic.In',
      onComplete: () => label.destroy(),
    })
  }

  catchFx(cupId: number, x: number, kind: CupKind, total: number, multiplier: number): void {
    const view = this.takeView(cupId)
    const p = this.palette
    if (view) {
      view.shadow.destroy()
      view.aura?.destroy()
      view.badge?.destroy()
      const image = view.image.setDepth(DEPTH.sink).setRotation(0).setAlpha(1)
      image.setData('transient', true)
      this.tweens.add({
        targets: image,
        y: CATCH_Y + 34,
        displayHeight: view.height * 0.9,
        alpha: 0,
        duration: 240,
        ease: 'Quad.In',
        onComplete: () => image.destroy(),
      })
    }
    this.squash = 1
    const emitter = kind === 'golden' ? this.golds : kind === 'special' ? this.pinks : this.sparks
    emitter.explode(kind === 'normal' ? 12 : 26, x, BASKET.rimY)
    this.basketGlow.setTint(kind === 'golden' ? p.goldLight : kind === 'special' ? p.pink : p.greenLight).setAlpha(0.55)
    this.tweens.add({ targets: this.basketGlow, alpha: 0, duration: 380, ease: 'Quad.Out' })
    const color = kind === 'golden' ? p.scoreGolden : kind === 'special' ? p.scoreSpecial : p.scoreNormal
    this.floatText(`+${total}`, x, BASKET.rimY - 46, color, kind === 'normal' ? 34 : 44)
    if (multiplier > 1) this.floatText(`×${multiplier}`, x + 62, BASKET.rimY - 20, p.combo, 24, 40)
    if (kind !== 'normal' && !this.host?.reducedMotion()) {
      const ring = this.add
        .image(x, BASKET.rimY, TEX.ring)
        .setTint(kind === 'golden' ? p.goldLight : p.pink)
        .setDepth(DEPTH.fx)
        .setScale(0.3)
        .setData('transient', true)
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 520, onComplete: () => ring.destroy() })
    }
  }

  missFx(cupId: number, x: number, label: string): void {
    const view = this.takeView(cupId)
    if (view) this.destroyView(view)
    this.drops.explode(14, x, COUNTER_Y)
    const splat = this.add
      .image(x, COUNTER_Y + 6, TEX.splat)
      .setDepth(DEPTH.counter + 1)
      .setDisplaySize(80, 26)
      .setData('transient', true)
    this.tweens.add({ targets: splat, alpha: 0, delay: 700, duration: 600, onComplete: () => splat.destroy() })
    this.floatText(label, x, COUNTER_Y - 40, this.palette.miss, 28, 46)
    if (!this.host?.reducedMotion()) this.cameras.main.shake(140, 0.004)
  }

  obstacleFx(cupId: number, x: number, label: string): void {
    const view = this.takeView(cupId)
    if (view) this.destroyView(view)
    this.smoke.explode(16, x, BASKET.rimY)
    this.basketGlow.setTint(this.palette.red).setAlpha(0.7)
    this.tweens.add({ targets: this.basketGlow, alpha: 0, duration: 520 })
    this.basketFront.setTint(0xff8a80)
    this.basketBack.setTint(0xff8a80)
    this.time.delayedCall(220, () => {
      this.basketFront.clearTint()
      this.basketBack.clearTint()
    })
    this.floatText(label, x, BASKET.rimY - 50, this.palette.miss, 30, 50)
    if (!this.host?.reducedMotion()) this.cameras.main.shake(200, 0.006)
  }

  dodgeFx(cupId: number, x: number): void {
    const view = this.takeView(cupId)
    if (view) this.destroyView(view)
    this.smoke.explode(6, x, COUNTER_Y)
  }

  refillFx(x: number, label: string): void {
    this.floatText(label, x, BASKET.rimY - 90, this.palette.combo, 30, 60)
    this.sparks.explode(10, x, BASKET.rimY - 10)
  }

  pulse(color: 'gold' | 'green' = 'gold'): void {
    if (this.host?.reducedMotion()) return
    const tint = color === 'gold' ? this.palette.goldLight : this.palette.greenLight
    this.cameras.main.flash(260, (tint >> 16) & 255, (tint >> 8) & 255, tint & 255, false)
  }

  /** Victory: everything slows to a crawl, then confetti bursts from the basket. */
  celebrate(): void {
    const session = this.session
    const x = session ? session.basket.x : FIELD_WIDTH / 2
    const reduced = this.host?.reducedMotion() ?? false
    this.frozen = true
    for (const view of this.views.values()) {
      this.tweens.add({
        targets: [view.image, view.aura, view.badge].filter(Boolean),
        y: `+=${reduced ? 0 : 26}`,
        alpha: 0,
        duration: reduced ? 200 : 900,
        ease: 'Sine.Out',
      })
      view.shadow.setVisible(false)
    }
    if (!reduced) {
      // A beat of slow motion: the last sparkles and the basket's bounce linger.
      const emitters = [this.sparks, this.golds, this.pinks, this.confetti]
      this.tweens.timeScale = 0.35
      emitters.forEach((emitter) => (emitter.timeScale = 0.35))
      window.setTimeout(() => {
        this.tweens.timeScale = 1
        emitters.forEach((emitter) => (emitter.timeScale = 1))
      }, 650)
      this.confetti.explode(60, x, BASKET.rimY)
      this.golds.explode(30, x, BASKET.rimY)
    }
    this.basketGlow.setTint(this.palette.goldLight).setAlpha(0.9)
    this.tweens.add({ targets: this.basketGlow, alpha: 0.25, duration: 1200 })
  }

  /** Game over / time up: the scene freezes and remaining cups fade. */
  freeze(): void {
    this.frozen = true
    for (const view of this.views.values()) {
      this.tweens.add({ targets: [view.image, view.aura, view.badge].filter(Boolean), alpha: 0.15, duration: 500 })
      view.shadow.setVisible(false)
    }
  }
}
