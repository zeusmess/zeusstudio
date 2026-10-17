import { create } from 'zustand'

/**
 * The shared start time of an online match, converted to this device's
 * performance.now() timeline. Both players derive it from the same server
 * timestamp, so their cups fall in lockstep.
 */
interface MatchClockState {
  goAtLocal: number | null
  set: (goAtLocal: number | null) => void
}

export const useMatchClock = create<MatchClockState>()((set) => ({
  goAtLocal: null,
  set: (goAtLocal) => set({ goAtLocal }),
}))

/** Milliseconds since the match started (negative during the countdown). */
export function matchElapsed(): number {
  const goAt = useMatchClock.getState().goAtLocal
  return goAt === null ? 0 : performance.now() - goAt
}
