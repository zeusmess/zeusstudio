/**
 * The two editions the game builds as.
 *
 * - The Starbucks edition (default) uses the name, logo and drink photos
 *   supplied for this project.
 * - The brand-free edition (VITE_BRAND_ASSETS=off) is "Cup Catcher" with the
 *   original artwork only. No Starbucks name, logo or photo reaches its output,
 *   so it can be shared or published without them.
 *
 * Pure, so the build (vite.config.ts) and the tests share it. The game itself
 * reads the build-time constant __BRANDED__ that the build derives from it.
 */

/** Reads VITE_BRAND_ASSETS: anything but "off" keeps the Starbucks edition. */
export function isBrandedEdition(flag: string | undefined): boolean {
  return (flag ?? '').trim().toLowerCase() !== 'off'
}

/** The page title and installed-app name of each edition. */
export function editionName(branded: boolean): string {
  return branded ? 'Starbucks Cup Catcher' : 'Cup Catcher'
}

/** Folders of the built output that only the Starbucks edition ships (from public/). */
export const BRAND_ONLY_PATHS: readonly string[] = ['assets/brand']

/** Text that must never appear in a brand-free build. */
export const BRAND_TEXT = /starbucks|ستاربكس|assets\/brand\//i
