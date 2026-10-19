// Copies www/ into build/ (the folder Capacitor packages) and downloads the
// page's two online dependencies — the Tailwind script and the Google Fonts —
// into build/vendor/, so the installed app works with no internet connection.
//
// In CI a failed download fails the build. Locally it only warns and keeps the
// online links, so the page still works whenever the phone is online.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'build')
const vendor = join(out, 'vendor')

const TAILWIND_URL = 'https://cdn.tailwindcss.com/3.4.17'
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@500;700;800&display=swap'
// A current browser user agent, so Google Fonts serves woff2 files.
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function replaceOnce(html, search, replacement) {
  if (html.split(search).length !== 2) throw new Error(`Expected exactly one occurrence of: ${search}`)
  return html.replace(search, () => replacement)
}

await rm(out, { recursive: true, force: true })
await cp(join(root, 'www'), out, { recursive: true })

const indexPath = join(out, 'index.html')
let html = await readFile(indexPath, 'utf8')

try {
  await mkdir(join(vendor, 'fonts'), { recursive: true })

  await writeFile(join(vendor, 'tailwind.js'), await download(TAILWIND_URL))

  let css = (await download(FONTS_URL)).toString('utf8')
  const fontUrls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) ?? [])]
  if (fontUrls.length === 0) throw new Error('No font files found in the Google Fonts stylesheet')
  for (const [i, url] of fontUrls.entries()) {
    const name = `font-${i}.${url.split('.').pop()}`
    await writeFile(join(vendor, 'fonts', name), await download(url))
    css = css.split(url).join(`fonts/${name}`)
  }
  await writeFile(join(vendor, 'fonts.css'), css)

  html = replaceOnce(html, `<script src="${TAILWIND_URL}"></script>`, '<script src="vendor/tailwind.js"></script>')
  html = replaceOnce(html, `<link href="${FONTS_URL}" rel="stylesheet">`, '<link href="vendor/fonts.css" rel="stylesheet">')
  html = html.replace(/^[ \t]*<link rel="preconnect" href="https:\/\/fonts\.[^"]+"[^>]*>\r?\n/gm, '')
  await writeFile(indexPath, html)
  console.log(`Bundled Tailwind and ${fontUrls.length} font files for offline use.`)
} catch (error) {
  if (process.env.CI) throw error
  await rm(vendor, { recursive: true, force: true })
  console.warn(`Could not bundle the online assets (${error.message}); the app will load them from the internet.`)
}
