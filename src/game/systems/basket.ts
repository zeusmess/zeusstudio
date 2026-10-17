import { BASKET } from '../core/constants'
import type { BasketState, InputState } from '../core/types'

export function clampBasketX(x: number): number {
  return Math.min(BASKET.maxX, Math.max(BASKET.minX, x))
}

/**
 * Moves the basket one step. Keys/buttons accelerate to a top speed; a pointer
 * pulls the basket towards the finger quickly but never teleports it.
 */
export function stepBasket(basket: BasketState, input: InputState, dtSec: number): void {
  basket.prevX = basket.x

  if (input.axis !== 0) {
    const turning = Math.sign(basket.vx) !== 0 && Math.sign(basket.vx) !== input.axis
    const accel = BASKET.keyboardAccel + (turning ? BASKET.keyboardFriction : 0)
    basket.vx += input.axis * accel * dtSec
    basket.vx = Math.max(-BASKET.keyboardMaxSpeed, Math.min(BASKET.keyboardMaxSpeed, basket.vx))
    basket.x += basket.vx * dtSec
  } else if (input.pointerX !== null) {
    const target = clampBasketX(input.pointerX)
    const follow = (target - basket.x) * (1 - Math.exp(-BASKET.pointerResponsiveness * dtSec))
    const cap = BASKET.pointerMaxSpeed * dtSec
    const move = Math.max(-cap, Math.min(cap, follow))
    basket.x += move
    basket.vx = move / dtSec
  } else if (basket.vx !== 0) {
    const slow = BASKET.keyboardFriction * dtSec
    basket.vx = Math.abs(basket.vx) <= slow ? 0 : basket.vx - Math.sign(basket.vx) * slow
    basket.x += basket.vx * dtSec
  }

  const clamped = clampBasketX(basket.x)
  if (clamped !== basket.x) {
    basket.x = clamped
    basket.vx = 0
  }
}
