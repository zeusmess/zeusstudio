/**
 * Builds the favicon, home-screen icons and the Android app's launcher icons
 * and splash screens from the game's original emblem (src/game/art/badges.ts)
 * — never from the Starbucks logo, so the app icon cannot pass as official
 * branding.
 *
 *   npm run assets:icons
 *
 * PNGs are rendered with Playwright's Chromium so gradients match the browser.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { emblemSvg } from '../src/game/art/badges.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')
const ANDROID_RES = resolve(ROOT, 'android/app/src/main/res')
const BACKGROUND = '#0b2b22'

interface IconSpec {
  path: string
  width: number
  height: number
  /** Share of the shorter side the emblem fills; maskable and adaptive icons keep it inside the safe zone. */
  scale: number
  /** Opaque background; otherwise transparent. */
  background: boolean
}

const square = (path: string, size: number, scale: number, background: boolean): IconSpec => ({
  path,
  width: size,
  height: size,
  scale,
  background,
})

const ICONS: IconSpec[] = [
  square(resolve(PUBLIC, 'icons/icon-192.png'), 192, 1, false),
  square(resolve(PUBLIC, 'icons/icon-512.png'), 512, 1, false),
  square(resolve(PUBLIC, 'icons/maskable-512.png'), 512, 0.72, true),
  square(resolve(PUBLIC, 'icons/apple-touch-icon.png'), 180, 0.86, true),
]

if (existsSync(ANDROID_RES)) {
  // Launcher icons (48 dp) and adaptive-icon foregrounds (108 dp, emblem inside the 66 dp safe zone).
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [density, factor] of Object.entries(densities)) {
    const launcher = Math.round(48 * factor)
    ICONS.push(square(resolve(ANDROID_RES, `mipmap-${density}/ic_launcher.png`), launcher, 0.94, false))
    ICONS.push(square(resolve(ANDROID_RES, `mipmap-${density}/ic_launcher_round.png`), launcher, 0.94, false))
    ICONS.push(square(resolve(ANDROID_RES, `mipmap-${density}/ic_launcher_foreground.png`), Math.round(108 * factor), 0.6, false))
  }
  // Splash screens shown while the app starts.
  const splashes: Array<[string, number, number]> = [
    ['drawable', 480, 320],
    ['drawable-port-mdpi', 320, 480],
    ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280],
    ['drawable-port-xxhdpi', 960, 1600],
    ['drawable-port-xxxhdpi', 1280, 1920],
    ['drawable-land-mdpi', 480, 320],
    ['drawable-land-hdpi', 800, 480],
    ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-land-xxxhdpi', 1920, 1280],
  ]
  for (const [folder, width, height] of splashes) {
    ICONS.push({ path: resolve(ANDROID_RES, `${folder}/splash.png`), width, height, scale: 0.36, background: true })
  }
  writeFileSync(
    resolve(ANDROID_RES, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND.toUpperCase()}</color>\n</resources>\n`,
  )
}

writeFileSync(resolve(PUBLIC, 'favicon.svg'), `${emblemSvg()}\n`)

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const icon of ICONS) {
    const inner = Math.round(Math.min(icon.width, icon.height) * icon.scale)
    await page.setViewportSize({ width: icon.width, height: icon.height })
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${icon.width}px;height:${icon.height}px;display:grid;place-items:center;` +
        `background:${icon.background ? BACKGROUND : 'transparent'}">${emblemSvg(inner)}</body></html>`,
    )
    mkdirSync(dirname(icon.path), { recursive: true })
    await page.screenshot({ path: icon.path, omitBackground: !icon.background })
    console.log(`Wrote ${icon.path.slice(ROOT.length + 1)} (${icon.width}×${icon.height})`)
  }
} finally {
  await browser.close()
}
