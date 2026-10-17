/**
 * Safe access to localStorage. Private windows, blocked site data and quota
 * errors must never crash the game, so every call is wrapped and falls back to
 * an in-memory map for the current page.
 */
const memory = new Map<string, string>()

function backend(): Storage | null {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    const probe = '__scc_probe__'
    storage.setItem(probe, probe)
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

let cached: Storage | null | undefined

function store(): Storage | null {
  if (cached === undefined) cached = backend()
  return cached
}

export const KEY_PREFIX = 'scc:v1:'

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const value = store()?.getItem(key)
      if (value !== undefined && value !== null) return value
    } catch {
      /* fall through to memory */
    }
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string): void {
    memory.set(key, value)
    try {
      store()?.setItem(key, value)
    } catch {
      /* quota or privacy mode: the in-memory copy keeps this session working */
    }
  },
  removeItem(key: string): void {
    memory.delete(key)
    try {
      store()?.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  keys(): string[] {
    const keys = new Set(memory.keys())
    try {
      const s = store()
      if (s) for (let i = 0; i < s.length; i++) keys.add(s.key(i) ?? '')
    } catch {
      /* ignore */
    }
    keys.delete('')
    return [...keys]
  },
}

export function readJson<T>(key: string): T | null {
  const raw = safeStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  safeStorage.setItem(key, JSON.stringify(value))
}

/** Test helper: forget the probed backend so a fresh mock is picked up. */
export function resetStorageForTests(): void {
  cached = undefined
  memory.clear()
}
