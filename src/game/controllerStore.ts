import { create } from 'zustand'
import type { GameController } from './GameController'

/** Hands the lazily-loaded controller to the React UI once Phaser is ready. */
export const useControllerStore = create<{ controller: GameController | null }>()(() => ({ controller: null }))

export function setController(controller: GameController): void {
  useControllerStore.setState({ controller })
  exposeTestHooks({ controller })
}

/**
 * Development / end-to-end test hooks (window.__scc). Never present in a normal
 * production build, so players cannot hand their game to the simulated player.
 */
export function exposeTestHooks(hooks: Record<string, unknown>): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== 'true') return
  const target = globalThis as typeof globalThis & { __scc?: Record<string, unknown> }
  target.__scc = { ...target.__scc, ...hooks }
}
