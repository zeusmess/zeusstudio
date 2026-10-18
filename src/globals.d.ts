/**
 * Which edition this build is, fixed at build time from VITE_BRAND_ASSETS
 * (vite.config.ts): true for the Starbucks edition (default), false for the
 * brand-free edition. It is a literal in the bundle, so the bundler leaves the
 * other edition's text and pictures out (see src/services/edition.ts).
 */
declare const __BRANDED__: boolean
