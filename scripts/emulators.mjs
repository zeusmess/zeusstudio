#!/usr/bin/env node
/**
 * Starts the Firebase Auth and Realtime Database emulators, loads
 * database.rules.json into the database emulator, then either keeps them
 * running (local two-player testing) or runs a command against them and stops.
 *
 *   node scripts/emulators.mjs                          # keep running (Ctrl+C to stop)
 *   node scripts/emulators.mjs -- vitest run --config vitest.rules.config.ts
 *
 * The rules are loaded by this script over plain HTTP instead of by the
 * Firebase CLI, so the harness also works behind an HTTP proxy. Emulators that
 * are already running on the expected ports are reused.
 */
import { spawn } from 'node:child_process'
import { readFileSync, watch } from 'node:fs'
import { request } from 'node:http'
import { connect } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT = 'demo-cup-catcher'
const HOST = '127.0.0.1'
const AUTH_PORT = 9099
const DATABASE_PORT = 9000
/** The app's database (src/services/config.ts uses `<project>-default-rtdb`). */
const NAMESPACES = [`${PROJECT}-default-rtdb`]
const RULES_FILE = resolve(ROOT, 'database.rules.json')
const START_TIMEOUT_MS = 90_000

const separator = process.argv.indexOf('--')
const command = separator >= 0 ? process.argv.slice(separator + 1) : []

function portOpen(port) {
  return new Promise((done) => {
    const socket = connect({ host: HOST, port })
    socket.once('connect', () => {
      socket.destroy()
      done(true)
    })
    socket.once('error', () => done(false))
  })
}

async function waitForPorts(ports, child) {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error('The Firebase emulators exited during start-up.')
    const open = await Promise.all(ports.map(portOpen))
    if (open.every(Boolean)) return
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`The Firebase emulators did not start within ${START_TIMEOUT_MS / 1000} s.`)
}

function loadRules(namespace) {
  const body = readFileSync(RULES_FILE)
  return new Promise((done, fail) => {
    const req = request(
      {
        host: HOST,
        port: DATABASE_PORT,
        method: 'PUT',
        path: `/.settings/rules.json?ns=${encodeURIComponent(namespace)}`,
        headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', 'Content-Length': body.length },
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () => (res.statusCode === 200 ? done() : fail(new Error(`Rules were rejected (${res.statusCode}): ${text}`))))
      },
    )
    req.once('error', fail)
    req.end(body)
  })
}

async function loadAllRules() {
  for (const namespace of NAMESPACES) await loadRules(namespace)
  console.log(`[emulators] loaded database.rules.json into ${NAMESPACES.join(', ')}`)
}

async function main() {
  const alreadyRunning = (await portOpen(AUTH_PORT)) && (await portOpen(DATABASE_PORT))
  let emulators = null
  if (alreadyRunning) {
    console.log('[emulators] reusing the emulators already running')
  } else {
    emulators = spawn(
      'npx',
      ['firebase', 'emulators:start', '--only', 'auth,database', '--project', PROJECT, '--config', 'firebase.emulators.json'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', shell: process.platform === 'win32' },
    )
    const log = (chunk) => process.env.EMULATOR_LOGS && process.stdout.write(`[firebase] ${chunk}`)
    emulators.stdout.on('data', log)
    emulators.stderr.on('data', log)
  }

  const stop = () => {
    if (!emulators || emulators.exitCode !== null) return
    try {
      if (process.platform === 'win32') emulators.kill('SIGINT')
      else process.kill(-emulators.pid, 'SIGINT')
    } catch {
      // Already gone.
    }
  }
  process.once('SIGINT', () => {
    stop()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    stop()
    process.exit(143)
  })

  try {
    await waitForPorts([AUTH_PORT, DATABASE_PORT], emulators)
    await loadAllRules()
  } catch (error) {
    console.error(`[emulators] ${error.message}`)
    stop()
    process.exit(1)
  }

  const env = {
    ...process.env,
    FIREBASE_AUTH_EMULATOR_HOST: `${HOST}:${AUTH_PORT}`,
    FIREBASE_DATABASE_EMULATOR_HOST: `${HOST}:${DATABASE_PORT}`,
    GCLOUD_PROJECT: PROJECT,
  }

  if (command.length === 0) {
    console.log(`[emulators] auth on ${HOST}:${AUTH_PORT}, database on ${HOST}:${DATABASE_PORT} — press Ctrl+C to stop`)
    // Reload the rules whenever they are rebuilt.
    watch(RULES_FILE, () => void loadAllRules().catch((error) => console.error(`[emulators] ${error.message}`)))
    return
  }

  const child = spawn(command[0], command.slice(1), { cwd: ROOT, env, stdio: 'inherit', shell: process.platform === 'win32' })
  child.on('exit', (code, signal) => {
    stop()
    process.exit(code ?? (signal ? 1 : 0))
  })
}

main()
