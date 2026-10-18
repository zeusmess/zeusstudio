/**
 * Builds the favicon, home-screen icons and their manifest entries from the
 * game's original emblem (src/game/art/badges.ts) — never from the Starbucks
 * logo, so the app icon cannot pass as official branding.
 *
 *   npm run assets:icons
 *
 * PNGs are rendered with Playwright's Chromium so gradients match the browser.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { emblemSvg } from '../src/game/art/badges.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')
const BACKGROUND = '#0b2b22'

interface IconSpec {
  file: string
  size: number
  /** Share of the canvas the emblem fills; maskable icons keep it inside the safe zone. */
  scale: number
  /** Opaque square background (home-screen icons); otherwise transparent. */
  background: boolean
}

const ICONS: IconSpec[] = [
  { file: 'icons/icon-192.png', size: 192, scale: 1, background: false },
  { file: 'icons/icon-512.png', size: 512, scale: 1, background: false },
  { file: 'icons/maskable-512.png', size: 512, scale: 0.72, background: true },
  { file: 'icons/apple-touch-icon.png', size: 180, scale: 0.86, background: true },
]

writeFileSync(resolve(PUBLIC, 'favicon.svg'), `${emblemSvg()}\n`)

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const icon of ICONS) {
    const inner = Math.round(icon.size * icon.scale)
    await page.setViewportSize({ width: icon.size, height: icon.size })
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${icon.size}px;height:${icon.size}px;display:grid;place-items:center;` +
        `background:${icon.background ? BACKGROUND : 'transparent'}">${emblemSvg(inner)}</body></html>`,
    )
    const path = resolve(PUBLIC, icon.file)
    mkdirSync(dirname(path), { recursive: true })
    await page.screenshot({ path, omitBackground: !icon.background })
    console.log(`Wrote ${icon.file} (${icon.size}×${icon.size})`)
  }
} finally {
  await browser.close()
}
