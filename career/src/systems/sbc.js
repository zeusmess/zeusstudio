// The new systems keep their data in state.sbc so it is saved with the game
// and survives "reset the store" (the legacy reset keeps state.sbc).

export const SBC_VERSION = 1

export function ensureSbc(state) {
  if (!state.sbc || typeof state.sbc !== 'object') state.sbc = {}
  const sbc = state.sbc
  sbc.v = SBC_VERSION
  sbc.metrics ??= {}
  sbc.missions ??= {}
  sbc.career ??= {}
  sbc.shift ??= {}
  sbc.incidents ??= {}
  sbc.flags ??= {}
  return sbc
}
