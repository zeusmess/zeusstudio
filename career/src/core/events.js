// A tiny synchronous event bus. The legacy game emits what happens on the
// floor (orders served, complaints solved, audits, shifts…); the new systems
// (metrics, missions, shift, incidents, career, cloud sync) listen.

const listeners = new Map()

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(fn)
  return () => listeners.get(type)?.delete(fn)
}

export function emit(type, payload = {}) {
  const set = listeners.get(type)
  if (!set) return
  for (const fn of [...set]) {
    try {
      fn(payload, type)
    } catch (err) {
      // One broken listener must never stop the simulation tick.
      console.error(`[events] ${type} listener failed`, err)
    }
  }
}

export function clearAllListeners() {
  listeners.clear()
}
