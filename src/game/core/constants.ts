/**
 * Gameplay constants. The playfield is a fixed logical 540 × 960 portrait
 * area scaled to fit the screen, so physics and fairness are identical on
 * every device (and for both players in an online match).
 */

export const FIELD_WIDTH = 540
export const FIELD_HEIGHT = 960

/** Fixed simulation step (120 Hz) for deterministic, tunnel-free collisions. */
export const SIM_STEP_MS = 1000 / 120
/** Longest frame the simulation will catch up on in one go (tab switches, hitches). */
export const MAX_FRAME_MS = 250

export const BASKET = {
  /** Drawn width of the basket body. */
  width: 136,
  height: 84,
  /** Centre of the basket sprite. */
  y: FIELD_HEIGHT - 112,
  /** y of the rim where cups are caught. */
  rimY: FIELD_HEIGHT - 112 - 34,
  /** Keyboard / on-screen button movement. */
  keyboardMaxSpeed: 900,
  keyboardAccel: 7600,
  keyboardFriction: 10400,
  /** Pointer / touch follow: responsiveness (1/s) and speed cap (units/s). */
  pointerResponsiveness: 20,
  pointerMaxSpeed: 2800,
  /** Keep the whole basket on screen. */
  minX: 136 / 2 + 6,
  maxX: FIELD_WIDTH - 136 / 2 - 6,
} as const

export const CUP = {
  /** Rendered height of a cup; widths come from each sprite's aspect ratio. */
  height: 92,
  /** Cups enter from above the playfield. */
  spawnY: -64,
  /** How far below the rim a caught cup's centre sits when it is caught. */
  sinkDepth: 22,
  /** Cups are kept this far from the side walls (centre to wall). */
  wallMargin: 44,
} as const

/** Centre y of a cup at the moment its base reaches the rim (progress = 1). */
export const CATCH_Y = BASKET.rimY - CUP.height / 2 + CUP.sinkDepth
/** Top of the café counter the basket stands on. */
export const COUNTER_Y = BASKET.y + 37
/** A cup that slipped past the basket is lost when it hits the counter. */
export const GROUND_Y = COUNTER_Y - CUP.height / 2 + 12
/** Horizontal distance (centre to centre) at which a cup lands in the basket. */
export const CATCH_HALF_WIDTH = 74
/** Obstacles are slightly smaller targets, which keeps dodging fair. */
export const OBSTACLE_HIT_HALF_WIDTH = 56

export const POINTS = {
  normal: 100,
  golden: 250,
  special: 500,
  obstacle: 0,
} as const

/**
 * Catches closer together than this keep the combo going. Shorter than the
 * pause between pattern groups, so combos reward clusters, not just survival.
 */
export const COMBO_WINDOW_MS = 900

/** Combo count → multiplier tiers (count is the number of quick catches in a row). */
export const COMBO_TIERS: ReadonlyArray<{ minCombo: number; multiplier: number }> = [
  { minCombo: 12, multiplier: 3 },
  { minCombo: 8, multiplier: 2.5 },
  { minCombo: 5, multiplier: 2 },
  { minCombo: 3, multiplier: 1.5 },
  { minCombo: 0, multiplier: 1 },
]
export const MAX_MULTIPLIER = 3

/** Every 10 consecutive catches pays `perCatch × streak` (10 → +100, 20 → +200, 30+ → +300). */
export const STREAK = {
  every: 10,
  perCatch: 10,
  maxBonus: 300,
} as const

/** A long streak refills one life (never above the level's starting lives). */
export const LIFE_REFILL_STREAK = 20

/** Upper bound of points a single catch can ever award (used by server rules). */
export const MAX_POINTS_PER_CATCH = POINTS.special * MAX_MULTIPLIER + STREAK.maxBonus
