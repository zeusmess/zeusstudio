/**
 * Writes database.rules.json from src/multiplayer/databaseRules.ts.
 *
 *   npm run rules:build
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { databaseRulesJson } from '../src/multiplayer/databaseRules.ts'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'database.rules.json')
writeFileSync(out, databaseRulesJson())
console.log(`Wrote ${out}`)
