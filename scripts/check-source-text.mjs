#!/usr/bin/env node
/**
 * Fails when a source file contains invisible or direction-changing characters
 * (zero-width spaces, bidi embeddings, overrides and isolates, byte order marks,
 * no-break spaces). They can make code read differently from how it runs
 * ("Trojan Source"), so text that needs one must write it as an escape sequence.
 *
 *   npm run lint      # oxlint, then this check
 */
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'coverage', '.firebase'])
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.py', '.yml', '.yaml'])

/** Inclusive code point ranges that are invisible or change the reading direction. */
const FORBIDDEN = [
  [0x00a0, 0x00a0], // no-break space
  [0x00ad, 0x00ad], // soft hyphen
  [0x200b, 0x200f], // zero-width spaces and joiners, left-to-right and right-to-left marks
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2060, 0x2064], // word joiner and invisible operators
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // byte order mark
]

const isForbidden = (code) => FORBIDDEN.some(([from, to]) => code >= from && code <= to)

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* files(join(dir, entry.name))
    } else if (EXTENSIONS.has(extname(entry.name))) {
      yield join(dir, entry.name)
    }
  }
}

const problems = []
for (const file of files(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    let column = 0
    for (const char of line) {
      column += 1
      const code = char.codePointAt(0)
      if (isForbidden(code)) {
        problems.push(`${relative(ROOT, file)}:${index + 1}:${column}  U+${code.toString(16).toUpperCase().padStart(4, '0')}`)
      }
    }
  })
}

if (problems.length > 0) {
  console.error('Invisible or direction-changing characters found (write them as escape sequences instead):')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
