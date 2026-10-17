import type { DifficultyProfile, PatternId } from '../core/types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const lerpPair = (a: [number, number], b: [number, number], t: number): [number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
]

/** Blends two difficulty profiles; `t` is clamped to [0, 1]. */
export function lerpProfile(a: DifficultyProfile, b: DifficultyProfile, t: number): DifficultyProfile {
  const k = Math.min(1, Math.max(0, t))
  const patternIds = new Set<PatternId>([
    ...(Object.keys(a.patterns) as PatternId[]),
    ...(Object.keys(b.patterns) as PatternId[]),
  ])
  const patterns: Partial<Record<PatternId, number>> = {}
  for (const id of patternIds) patterns[id] = lerp(a.patterns[id] ?? 0, b.patterns[id] ?? 0, k)

  return {
    fallMs: lerpPair(a.fallMs, b.fallMs, k),
    gapMs: lerpPair(a.gapMs, b.gapMs, k),
    clusterGapMs: lerpPair(a.clusterGapMs, b.clusterGapMs, k),
    patterns,
    mix: {
      golden: lerp(a.mix.golden, b.mix.golden, k),
      special: lerp(a.mix.special, b.mix.special, k),
      obstacle: lerp(a.mix.obstacle, b.mix.obstacle, k),
    },
    swayChance: lerp(a.swayChance, b.swayChance, k),
    swayAmp: lerpPair(a.swayAmp, b.swayAmp, k),
    swayFreq: lerpPair(a.swayFreq, b.swayFreq, k),
    driftChance: lerp(a.driftChance, b.driftChance, k),
    driftMax: lerp(a.driftMax, b.driftMax, k),
    burstChance: lerp(a.burstChance, b.burstChance, k),
    reachSpeed: lerp(a.reachSpeed, b.reachSpeed, k),
  }
}
