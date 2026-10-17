import type { CupKind } from '../../types'
import { CATCH_HALF_WIDTH, OBSTACLE_HIT_HALF_WIDTH } from '../core/constants'

/** True on the one step where the cup's base reaches the basket rim. */
export function reachesRim(previousProgress: number, progress: number): boolean {
  return previousProgress < 1 && progress >= 1
}

/** Whether a cup arriving at `cupX` lands in a basket centred at `basketX`. */
export function landsInBasket(
  kind: CupKind,
  cupX: number,
  basketX: number,
  catchHalfWidth: number = CATCH_HALF_WIDTH,
): boolean {
  const halfWidth = kind === 'obstacle' ? OBSTACLE_HIT_HALF_WIDTH : catchHalfWidth
  return Math.abs(cupX - basketX) <= halfWidth
}
