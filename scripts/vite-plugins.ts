/**
 * Build plugins used by vite.config.ts.
 *
 * - edition(): names the page after the edition and keeps the brand-free
 *   edition free of the Starbucks name and pictures (src/services/edition.ts).
 * - singleFile(): `npm run build:single` — the whole game as one HTML file.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { BRAND_ONLY_PATHS, BRAND_TEXT, editionName } from '../src/services/edition.ts'

const TEXT_FILES = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg'])

function* textFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* textFiles(path)
    else if (TEXT_FILES.has(extname(entry.name))) yield path
  }
}

/**
 * Fills %APP_NAME% in index.html with the edition's name. In the brand-free
 * edition it also removes the brand photos copied from public/, renames the
 * installed app, and fails the build if any output file still mentions the
 * brand.
 */
export function edition(branded: boolean): Plugin {
  let outDir = ''
  return {
    name: 'cup-catcher:edition',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%APP_NAME%', editionName(branded)),
    },
    writeBundle() {
      if (branded) return
      for (const path of BRAND_ONLY_PATHS) rmSync(join(outDir, path), { recursive: true, force: true })
      const manifestPath = join(outDir, 'manifest.webmanifest')
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
        manifest.name = editionName(false)
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      }
      for (const file of textFiles(outDir)) {
        const match = BRAND_TEXT.exec(readFileSync(file, 'utf8'))
        if (match) this.error(`brand-free build: ${relative(outDir, file)} still contains "${match[0]}"`)
      }
    },
  }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Keeps inlined code from closing its own tag early (a "</script" inside a string, say). */
function closeTagSafe(code: string, tag: 'script' | 'style'): string {
  return code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1')
}

/** Swaps the tag that loads `fileName` for `replacement`. */
function inlineTag(html: string, tag: 'script' | 'link', fileName: string, replacement: string): string {
  const file = escapeRegExp(fileName)
  const pattern =
    tag === 'script'
      ? new RegExp(`<script\\b[^>]*\\ssrc="\\./${file}"[^>]*></script>`)
      : new RegExp(`<link\\b[^>]*\\shref="\\./${file}"[^>]*>`)
  if (!pattern.test(html)) throw new Error(`single-file build: index.html has no <${tag}> for ${fileName}`)
  // A replacer function, so "$&" and friends inside the code stay literal.
  return html.replace(pattern, () => replacement)
}

/**
 * Inlines the entry script, the stylesheet and (through vite.config.ts, which
 * also turns off code splitting and inlines every asset) the fonts and
 * pictures into index.html. The result runs from a double-click (file://) or
 * from any host that takes a single page.
 */
export function singleFile(): Plugin {
  let publicDir = ''
  return {
    name: 'cup-catcher:single-file',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Nothing is published beside the page: drop the home-screen icon and
        // app manifest, and carry the favicon inside the page.
        const favicon = readFileSync(join(publicDir, 'favicon.svg'), 'utf8').trim()
        return html
          .replace(/\s*<link rel="(?:apple-touch-icon|manifest)"[^>]*>/g, '')
          .replace(/(<link rel="icon"[^>]*href=")[^"]*"/, (_, start: string) => `${start}data:image/svg+xml,${encodeURIComponent(favicon)}"`)
      },
    },
    generateBundle: {
      // After every other plugin's generateBundle: Vite's own last pass fills in
      // the module preload placeholders, and the code must be final to inline it.
      order: 'post',
      handler(_options, bundle) {
        const page = bundle['index.html']
        if (page?.type !== 'asset') this.error('single-file build: index.html is missing')
        let html = String(page.source)
        for (const [fileName, output] of Object.entries(bundle)) {
          if (fileName === 'index.html') continue
          if (output.type === 'chunk') {
            if (!output.isEntry) this.error(`single-file build: ${fileName} was split off; code splitting must be off`)
            if (output.code.includes('<!--')) this.error(`single-file build: ${fileName} contains "<!--", which cannot be inlined safely`)
            html = inlineTag(html, 'script', fileName, `<script type="module">${closeTagSafe(output.code, 'script')}</script>`)
          } else if (fileName.endsWith('.css')) {
            html = inlineTag(html, 'link', fileName, `<style>${closeTagSafe(String(output.source), 'style')}</style>`)
          } else {
            this.error(`single-file build: ${fileName} was not inlined`)
          }
          delete bundle[fileName]
        }
        if (html.includes('__VITE_PRELOAD__')) this.error('single-file build: a module preload placeholder was left in the page')
        page.source = html
      },
    },
  }
}
