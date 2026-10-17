import { describe, expect, it } from 'vitest'
import { BASKET, SIM_STEP_MS } from '../core/constants'
import type { BasketState, InputState } from '../core/types'
import { stepBasket } from './basket'

const dt = SIM_STEP_MS / 1000

function run(basket: BasketState, input: InputState, seconds: number) {
  for (let t = 0; t < seconds; t += dt) stepBasket(basket, input, dt)
}

describe('basket movement', () => {
  it('stays inside the playfield whatever the input', () => {
    const basket = { x: 270, prevX: 270, vx: 0 }
    run(basket, { axis: -1, pointerX: null }, 2)
    expect(basket.x).toBe(BASKET.minX)
    run(basket, { axis: 1, pointerX: null }, 2)
    expect(basket.x).toBe(BASKET.maxX)
    run(basket, { axis: 0, pointerX: -500 }, 1)
    expect(basket.x).toBeGreaterThanOrEqual(BASKET.minX)
    expect(basket.x).toBeCloseTo(BASKET.minX, 3)
    run(basket, { axis: 0, pointerX: 5000 }, 1)
    expect(basket.x).toBeLessThanOrEqual(BASKET.maxX)
    expect(basket.x).toBeCloseTo(BASKET.maxX, 3)
  })

  it('accelerates smoothly to the keyboard top speed', () => {
    const basket = { x: 100, prevX: 100, vx: 0 }
    stepBasket(basket, { axis: 1, pointerX: null }, dt)
    expect(basket.vx).toBeGreaterThan(0)
    expect(basket.vx).toBeLessThan(BASKET.keyboardMaxSpeed)
    run(basket, { axis: 1, pointerX: null }, 0.15)
    expect(basket.vx).toBeLessThanOrEqual(BASKET.keyboardMaxSpeed)
  })

  it('follows a pointer quickly without teleporting', () => {
    const basket = { x: 100, prevX: 100, vx: 0 }
    stepBasket(basket, { axis: 0, pointerX: 400 }, dt)
    expect(basket.x - 100).toBeLessThanOrEqual(BASKET.pointerMaxSpeed * dt + 1e-6)
    run(basket, { axis: 0, pointerX: 400 }, 0.5)
    expect(Math.abs(basket.x - 400)).toBeLessThan(2)
  })

  it('glides to a stop when the keys are released', () => {
    const basket = { x: 200, prevX: 200, vx: 0 }
    run(basket, { axis: 1, pointerX: null }, 0.2)
    run(basket, { axis: 0, pointerX: null }, 0.3)
    expect(basket.vx).toBe(0)
  })
})
