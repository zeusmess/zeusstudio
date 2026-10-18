import { emblemSvg } from './badges'
import { burntBeanSvg, ORIGINAL_NORMAL_CUPS, originalCupSvg, type OriginalCupId } from './cups'
import { svgDataUrl } from './svg'

/**
 * Which pictures the game uses. The Starbucks edition (default) uses the drink
 * photos and logo supplied for this project; the brand-free edition
 * (VITE_BRAND_ASSETS=off) uses the original illustrations only.
 *
 * Every choice tests the build-time literal __BRANDED__ directly, so the
 * brand-free bundle keeps no photo file names (src/services/edition.ts).
 */
export interface SpriteArt {
  key: string
  url: string
  /** width / height */
  aspect: number
  /** Relative display height (1 = standard cup height). */
  scale: number
}

const base = import.meta.env.BASE_URL ?? '/'
const brandUrl = (file: string) => `${base}assets/brand/${file}`

const BRAND_NORMAL: SpriteArt[] = !__BRANDED__ ? [] : [
  ['drink-pumpkin-spice-latte', 182],
  ['drink-pumpkin-cream-cold-brew', 241],
  ['drink-spice-frappuccino', 190],
  ['drink-iced-caramel-layered', 234],
  ['drink-iced-matcha-pumpkin-foam', 240],
  ['drink-dragonfruit-refresher', 192],
  ['drink-strawberry-matcha', 219],
  ['drink-caramel-cold-foam', 209],
].map(([key, width]) => ({ key: key as string, url: brandUrl(`${key}.webp`), aspect: (width as number) / 320, scale: 1 }))

function original(id: OriginalCupId, scale = 1): SpriteArt {
  return { key: `cup-${id}`, url: svgDataUrl(originalCupSvg(id, 240)), aspect: 100 / 140, scale }
}

export const NORMAL_CUP_ART: readonly SpriteArt[] = __BRANDED__
  ? BRAND_NORMAL
  : ORIGINAL_NORMAL_CUPS.map((id) => original(id))

export const GOLDEN_CUP_ART: SpriteArt = __BRANDED__
  ? { key: 'cup-ramadan', url: brandUrl('cup-ramadan.webp'), aspect: 209 / 320, scale: 1.04 }
  : original('golden', 1.04)

export const SPECIAL_CUP_ART: SpriteArt = __BRANDED__
  ? { key: 'tumbler-bear', url: brandUrl('tumbler-bear.webp'), aspect: 144 / 320, scale: 1.18 }
  : original('special', 1.12)

export const OBSTACLE_ART: SpriteArt = {
  key: 'burnt-bean',
  url: svgDataUrl(burntBeanSvg(220)),
  aspect: 1,
  scale: 0.82,
}

/** Artwork for a normal cup variant (the session's variant index wraps). */
export function normalCupArt(variant: number): SpriteArt {
  return NORMAL_CUP_ART[Math.abs(variant) % NORMAL_CUP_ART.length]
}

/** The logo on the victory screen; `alt` is null where the game's own title describes it. */
export const LOGO_ART: { url: string; alt: string | null } = __BRANDED__
  ? { url: brandUrl('logo-siren.webp'), alt: 'Starbucks' }
  : { url: svgDataUrl(emblemSvg(400)), alt: null }

export const EMBLEM_URL = svgDataUrl(emblemSvg(400))

export const BACKDROP = __BRANDED__
  ? { sharp: brandUrl('bg-cafe.webp'), blurred: brandUrl('bg-cafe-blur.webp') }
  : null

/** The cup that drops into the basket on the opening screen. */
export const HERO_CUP_ART: SpriteArt = __BRANDED__ ? BRAND_NORMAL[0] : original('latte')
