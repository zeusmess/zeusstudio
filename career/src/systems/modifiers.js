// Several systems change how the floor behaves at once (a broken Mastrena
// slows the hot bar while the store is closed at 06:00 and a Ramadan rush
// floods the drive-thru). Each registers a provider; the legacy hooks multiply
// whatever is registered.

const providers = {
  spawn: new Set(),
  patience: new Set(),
  step: new Set(),
}

export function addProvider(kind, fn) {
  providers[kind].add(fn)
  return () => providers[kind].delete(fn)
}

function product(kind, arg) {
  let value = 1
  for (const fn of providers[kind]) {
    const v = Number(fn(arg))
    if (Number.isFinite(v)) value *= v
  }
  return value
}

export function installModifierHooks(hooks) {
  hooks.spawnRateMultiplier = () => product('spawn')
  hooks.patienceMultiplier = () => product('patience')
  hooks.stepSpeedMultiplier = (stepKey) => product('step', stepKey)
}

export function clearProviders() {
  Object.values(providers).forEach((set) => set.clear())
}
