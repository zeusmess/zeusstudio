import type { GameController } from './GameController'

let loading: Promise<GameController> | null = null

/** Loads Phaser and the controller on first use (kept out of the initial bundle). */
export function loadController(): Promise<GameController> {
  loading ??= import('./GameController').then((module) => module.getController())
  loading.catch(() => {
    loading = null
  })
  return loading
}
