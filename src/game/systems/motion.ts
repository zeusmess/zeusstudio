import { CATCH_Y, CUP } from '../core/constants'
import type { CupSpec } from '../core/types'

const TAU = Math.PI * 2

/**
 * Progress along the fall: 0 at spawn, 1 when the cup's base reaches the rim.
 * Keeps going past 1 at the final speed so missed cups fall off-screen.
 * A burst keeps the arrival time fixed — the cup dawdles, then speeds up.
 */
export function progressAt(spec: CupSpec, sinceSpawnMs: number): number {
  const u = sinceSpawnMs / spec.fallMs
  const burst = spec.burst
  if (!burst) return u
  if (u <= burst.at) return (u / burst.at) * burst.distanceAt
  const slope = (1 - burst.distanceAt) / (1 - burst.at)
  return burst.distanceAt + (u - burst.at) * slope
}

/** Fall speed multiplier relative to an even fall (1 = steady). */
export function speedFactorAt(spec: CupSpec, sinceSpawnMs: number): number {
  const burst = spec.burst
  if (!burst) return 1
  const u = sinceSpawnMs / spec.fallMs
  return u <= burst.at ? burst.distanceAt / burst.at : (1 - burst.distanceAt) / (1 - burst.at)
}

export function yAt(progress: number): number {
  return CUP.spawnY + progress * (CATCH_Y - CUP.spawnY)
}

/** Sway offset at time t; phase is chosen so the offset is 0 at arrival. */
export function swayOffset(spec: CupSpec, sinceSpawnMs: number): number {
  if (!spec.sway) return 0
  const t = Math.min(sinceSpawnMs, spec.fallMs) / 1000
  return spec.sway.amp * Math.sin(TAU * spec.sway.freq * t + spec.sway.phase)
}

export function xAt(spec: CupSpec, sinceSpawnMs: number): number {
  const u = Math.min(Math.max(sinceSpawnMs / spec.fallMs, 0), 1)
  return spec.x0 + (spec.x1 - spec.x0) * u + swayOffset(spec, sinceSpawnMs)
}

/** Where the cup will be when it reaches the rim. */
export function arrivalX(spec: CupSpec): number {
  return xAt(spec, spec.fallMs)
}

export function arrivalTime(spec: CupSpec): number {
  return spec.spawnAt + spec.fallMs
}

/** Phase that puts a sway at its centre exactly on arrival. */
export function swayPhaseForArrival(freq: number, fallMs: number): number {
  const phase = -TAU * freq * (fallMs / 1000)
  return ((phase % TAU) + TAU) % TAU
}
