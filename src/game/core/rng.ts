/**
 * Small, fast, seedable PRNG (mulberry32). Deterministic across browsers, so a
 * shared seed gives both online players the exact same sequence of cups.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1))
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  /** Picks a key with probability proportional to its (non-negative) weight. */
  weighted<K extends string>(weights: Partial<Record<K, number>>): K {
    const entries = Object.entries(weights) as Array<[K, number]>
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0)
    if (total <= 0) return entries[0][0]
    let roll = this.next() * total
    for (const [key, weight] of entries) {
      roll -= Math.max(0, weight)
      if (roll < 0) return key
    }
    return entries[entries.length - 1][0]
  }

  /** Independent child stream (e.g. visuals) that never disturbs this one. */
  fork(salt: number): Rng {
    return new Rng((Math.imul(this.state ^ salt, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0)
  }
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buffer)
  return buffer[0] || 1
}
