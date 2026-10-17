import { getSettings, useSettings } from '../app/settings'

/**
 * Original sound design, synthesised with the Web Audio API — no audio files,
 * no licensing questions. Audio starts only after the player's first tap or
 * key press, as browsers require.
 */
export type SfxName =
  | 'catch'
  | 'golden'
  | 'special'
  | 'combo'
  | 'streak'
  | 'refill'
  | 'miss'
  | 'obstacle'
  | 'pause'
  | 'resume'
  | 'tick'
  | 'go'
  | 'wave'
  | 'victory'
  | 'gameOver'
  | 'ui'

export type MusicMood = 'menu' | 'game' | 'finale' | 'off'

type Wave = OscillatorType

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12)

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private mood: MusicMood = 'off'
  private intensity = 0
  private nextBeatTime = 0
  private beat = 0
  private scheduler: ReturnType<typeof setInterval> | null = null

  /** Creates/resumes the audio context. Call from a user gesture. */
  unlock(): void {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor({ latencyHint: 'interactive' })
      const compressor = this.ctx.createDynamicsCompressor()
      compressor.threshold.value = -14
      compressor.ratio.value = 4
      this.master = this.ctx.createGain()
      this.sfxBus = this.ctx.createGain()
      this.musicBus = this.ctx.createGain()
      this.sfxBus.connect(this.master)
      this.musicBus.connect(this.master)
      this.master.connect(compressor)
      compressor.connect(this.ctx.destination)
      this.noise = this.makeNoise()
      this.applySettings()
      if (this.mood !== 'off') this.startScheduler()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  applySettings(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return
    const { muted, musicVolume, sfxVolume } = getSettings()
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.03)
    this.sfxBus.gain.setTargetAtTime(sfxVolume, now, 0.03)
    this.musicBus.gain.setTargetAtTime(musicVolume * 0.42, now, 0.08)
  }

  /** Suspends all sound while the page is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return
    if (hidden) void this.ctx.suspend()
    else void this.ctx.resume()
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx as AudioContext
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    options: { type?: Wave; gain?: number; attack?: number; bus?: GainNode | null; slideTo?: number; detune?: number } = {},
  ): void {
    const ctx = this.ctx
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = options.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, start)
    if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration)
    if (options.detune) osc.detune.value = options.detune
    const peak = options.gain ?? 0.3
    const attack = options.attack ?? 0.005
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain)
    gain.connect(options.bus ?? this.sfxBus ?? ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  private noiseBurst(
    start: number,
    duration: number,
    options: { type?: BiquadFilterType; freq?: number; q?: number; gain?: number; bus?: GainNode | null; sweepTo?: number } = {},
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.noise) return
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = options.type ?? 'lowpass'
    filter.frequency.setValueAtTime(options.freq ?? 1200, start)
    if (options.sweepTo) filter.frequency.exponentialRampToValueAtTime(options.sweepTo, start + duration)
    filter.Q.value = options.q ?? 0.8
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(options.gain ?? 0.25, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(options.bus ?? this.sfxBus ?? ctx.destination)
    source.start(start, Math.random() * 0.5)
    source.stop(start + duration + 0.05)
  }

  private bell(freq: number, start: number, duration: number, gain = 0.18, bus?: GainNode | null): void {
    ;[1, 2.76, 5.4].forEach((ratio, i) =>
      this.tone(freq * ratio, start, duration / (i + 1), { gain: gain / (i * 1.6 + 1), bus }),
    )
  }

  play(name: SfxName, options: { combo?: number } = {}): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime + 0.005
    switch (name) {
      case 'catch': {
        const lift = 2 ** (Math.min(options.combo ?? 0, 10) / 12)
        this.tone(NOTE(12) * lift, t, 0.16, { type: 'sine', gain: 0.32 })
        this.tone(NOTE(19) * lift, t + 0.015, 0.14, { type: 'triangle', gain: 0.14 })
        this.noiseBurst(t, 0.04, { type: 'highpass', freq: 4000, gain: 0.08 })
        break
      }
      case 'golden':
        ;[0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(15 + n), t + i * 0.055, 0.32, { type: 'triangle', gain: 0.22 }))
        this.bell(NOTE(27), t + 0.22, 0.6, 0.12)
        break
      case 'special':
        ;[0, 3, 7, 10, 14, 19].forEach((n, i) => this.tone(NOTE(12 + n), t + i * 0.045, 0.4, { type: 'triangle', gain: 0.2 }))
        this.bell(NOTE(31), t + 0.28, 0.8, 0.12)
        break
      case 'combo':
        this.tone(NOTE(7), t, 0.16, { type: 'sine', gain: 0.18, slideTo: NOTE(19) })
        this.tone(NOTE(19), t + 0.1, 0.18, { type: 'triangle', gain: 0.14 })
        break
      case 'streak':
        this.bell(NOTE(15), t, 0.9, 0.2)
        this.bell(NOTE(22), t + 0.12, 0.9, 0.16)
        break
      case 'refill':
        this.tone(NOTE(10), t, 0.18, { type: 'triangle', gain: 0.2 })
        this.tone(NOTE(15), t + 0.12, 0.3, { type: 'triangle', gain: 0.22 })
        break
      case 'miss':
        this.tone(150, t, 0.24, { type: 'sine', gain: 0.38, slideTo: 60 })
        this.noiseBurst(t, 0.22, { type: 'lowpass', freq: 900, sweepTo: 200, gain: 0.32 })
        break
      case 'obstacle':
        this.noiseBurst(t, 0.45, { type: 'bandpass', freq: 2400, q: 1.4, sweepTo: 600, gain: 0.3 })
        this.tone(110, t, 0.3, { type: 'square', gain: 0.12, slideTo: 55 })
        break
      case 'pause':
        this.tone(NOTE(3), t, 0.1, { gain: 0.16, slideTo: NOTE(-2) })
        break
      case 'resume':
        this.tone(NOTE(-2), t, 0.1, { gain: 0.16, slideTo: NOTE(5) })
        break
      case 'tick':
        this.tone(NOTE(14), t, 0.07, { type: 'sine', gain: 0.22 })
        this.noiseBurst(t, 0.03, { type: 'highpass', freq: 3000, gain: 0.08 })
        break
      case 'go':
        ;[0, 4, 7].forEach((n) => this.tone(NOTE(14 + n), t, 0.35, { type: 'triangle', gain: 0.16 }))
        break
      case 'wave':
        this.noiseBurst(t, 0.6, { type: 'bandpass', freq: 400, q: 2, sweepTo: 3000, gain: 0.18 })
        break
      case 'victory': {
        const chords = [
          [0, 4, 7],
          [5, 9, 12],
          [7, 11, 14],
          [12, 16, 19, 24],
        ]
        chords.forEach((chord, i) => {
          chord.forEach((n) => this.tone(NOTE(3 + n), t + i * 0.24, i === 3 ? 1.4 : 0.3, { type: 'triangle', gain: 0.13 }))
          this.tone(NOTE(-21 + chord[0]), t + i * 0.24, 0.3, { type: 'sine', gain: 0.22 })
        })
        ;[0, 0.08, 0.16, 0.24].forEach((d, i) => this.bell(NOTE(27 + i * 2), t + 0.75 + d, 0.9, 0.08))
        break
      }
      case 'gameOver':
        ;[7, 3, 0, -5].forEach((n, i) => this.tone(NOTE(n), t + i * 0.22, 0.42, { type: 'triangle', gain: 0.18 }))
        break
      case 'ui':
        this.tone(NOTE(19), t, 0.04, { gain: 0.08 })
        break
    }
  }

  /* --------------------------------- music --------------------------------- */

  setMusic(mood: MusicMood, intensity = 0): void {
    this.intensity = intensity
    if (mood === this.mood) return
    this.mood = mood
    if (mood === 'off') this.stopScheduler()
    else if (this.ctx) this.startScheduler()
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.min(1, Math.max(0, intensity))
  }

  private startScheduler(): void {
    if (!this.ctx || this.scheduler) return
    this.nextBeatTime = this.ctx.currentTime + 0.1
    this.scheduler = setInterval(() => this.schedule(), 40)
  }

  private stopScheduler(): void {
    if (this.scheduler) clearInterval(this.scheduler)
    this.scheduler = null
  }

  /** Eighth-note grid, scheduled slightly ahead of time for sample-accurate timing. */
  private schedule(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const bpm = this.mood === 'menu' ? 76 : this.mood === 'finale' ? 98 : 88
    const eighth = 60 / bpm / 2
    while (this.nextBeatTime < ctx.currentTime + 0.25) {
      this.playStep(this.beat, this.nextBeatTime, eighth)
      this.nextBeatTime += eighth
      this.beat = (this.beat + 1) % 64
    }
  }

  // | Fmaj7 | Em7 | Dm7 | G7 | Cmaj7 | Am7 | Dm7 | G7sus |  (semitones from A4)
  private static CHORDS = [
    [-16, -12, -9, -5],
    [-17, -14, -10, -7],
    [-19, -16, -12, -9],
    [-14, -10, -7, -4],
    [-21, -17, -14, -10],
    [-12, -9, -5, -2],
    [-19, -16, -12, -9],
    [-14, -9, -7, -4],
  ]

  private playStep(step: number, time: number, eighth: number): void {
    const bus = this.musicBus
    const bar = Math.floor(step / 8)
    const inBar = step % 8
    const chord = AudioEngine.CHORDS[bar % 8]
    const game = this.mood !== 'menu'

    if (inBar === 0) {
      chord.forEach((n, i) =>
        this.tone(NOTE(n), time + i * 0.012, eighth * 7.5, { type: 'triangle', gain: 0.07, attack: 0.04, bus, detune: i % 2 ? 6 : -6 }),
      )
    }
    if (inBar === 0 || inBar === 3 || (game && inBar === 6)) {
      this.tone(NOTE(chord[0] - 12), time, eighth * 1.6, { type: 'sine', gain: 0.2, attack: 0.01, bus })
    }
    if (game) {
      if (inBar === 0 || inBar === 4) this.tone(110, time, 0.18, { type: 'sine', gain: 0.22, slideTo: 45, bus })
      if (inBar === 2 || inBar === 6) this.noiseBurst(time, 0.12, { type: 'bandpass', freq: 1800, q: 0.7, gain: 0.07, bus })
      if (inBar % 2 === 1 || this.intensity > 0.6) {
        this.noiseBurst(time, 0.035, { type: 'highpass', freq: 7000, gain: 0.05 + this.intensity * 0.03, bus })
      }
    }
    // A soft pentatonic sparkle that grows with intensity.
    const sparkleChance = this.mood === 'menu' ? 0.12 : 0.1 + this.intensity * 0.25
    if (inBar % 2 === 0 && Math.random() < sparkleChance) {
      const scale = [0, 2, 4, 7, 9, 12, 14]
      const n = chord[1] + 24 + scale[Math.floor(Math.random() * scale.length)] - 12
      this.tone(NOTE(n), time, eighth * 2.2, { type: 'sine', gain: 0.045, attack: 0.01, bus })
    }
  }
}

export const audio = new AudioEngine()

/** Haptic feedback on supporting devices (Android), when enabled. */
export function vibrate(pattern: number | number[]): void {
  if (!getSettings().haptics) return
  try {
    globalThis.navigator?.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

/** Unlocks audio on the first interaction and follows settings changes. */
export function bindAudio(): () => void {
  const unlock = () => audio.unlock()
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
  const unsubscribe = useSettings.subscribe(() => audio.applySettings())
  const onVisibility = () => audio.setHidden(document.visibilityState === 'hidden')
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    document.removeEventListener('visibilitychange', onVisibility)
    unsubscribe()
  }
}
