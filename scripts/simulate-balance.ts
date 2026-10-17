/**
 * Plays every campaign level many times with simulated players of different
 * skill and prints how long levels take, how often they are cleared and how
 * accurate play has to be. Used to balance src/game/levels/levels.ts.
 *
 *   npm run simulate            # 24 runs per level and skill
 *   npm run simulate -- 60      # more runs for steadier numbers
 */
import { Bot, BOT_SKILLS, type BotSkillName } from '../src/game/bot.ts'
import { GameSession } from '../src/game/core/GameSession.ts'
import { LEVELS } from '../src/game/levels/levels.ts'
import { sessionConfigFor, type PlayRequest } from '../src/game/levels/modes.ts'

const RUNS = Number(process.argv[2] ?? 24)
const FRAME_MS = 1000 / 60
const LIMIT_MS = 20 * 60 * 1000
const SKILLS: BotSkillName[] = (process.argv[3]?.split(',') as BotSkillName[]) ?? ['casual', 'normal', 'skilled']

interface RunStats {
  cleared: boolean
  seconds: number
  catchRate: number
  livesLost: number
  score: number
  wave: number
}

export function play(request: PlayRequest, skill: BotSkillName, seed: number): RunStats {
  const session = new GameSession(sessionConfigFor(request), seed)
  const bot = new Bot(BOT_SKILLS[skill], seed)
  session.start()
  while (session.running && session.time < LIMIT_MS) {
    bot.update(session, FRAME_MS)
    session.advance(FRAME_MS)
  }
  const resolved = session.caught + session.missed
  return {
    cleared: session.status === 'complete',
    seconds: session.time / 1000,
    catchRate: resolved > 0 ? session.caught / resolved : 1,
    livesLost: session.livesLost,
    score: session.score,
    wave: session.wave,
  }
}

const median = (values: number[]) => {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
const pct = (v: number) => `${(v * 100).toFixed(0)}%`.padStart(5)

for (const skill of SKILLS) {
  console.log(`\n=== ${skill} player (${RUNS} runs per level) ===`)
  console.log('level  target   clear  median s  p25-p75 s   catch  lives lost')
  for (const level of LEVELS) {
    const runs = Array.from({ length: RUNS }, (_, i) =>
      play({ mode: 'campaign', levelId: level.id, seed: 7919 * (i + 1) + level.id }, skill, i + 1),
    )
    const cleared = runs.filter((r) => r.cleared)
    const times = cleared.map((r) => r.seconds).sort((a, b) => a - b)
    const p25 = times[Math.floor(times.length * 0.25)] ?? Number.NaN
    const p75 = times[Math.floor(times.length * 0.75)] ?? Number.NaN
    console.log(
      `${String(level.id).padStart(5)}  ${String(level.target).padStart(6)}  ${pct(cleared.length / runs.length)}  ` +
        `${median(times).toFixed(0).padStart(8)}  ${`${p25.toFixed(0)}-${p75.toFixed(0)}`.padStart(9)}  ` +
        `${pct(mean(runs.map((r) => r.catchRate)))}  ${mean(runs.map((r) => r.livesLost)).toFixed(1).padStart(10)}`,
    )
  }
  const endless = Array.from({ length: RUNS }, (_, i) => play({ mode: 'endless', seed: 31 * (i + 1) }, skill, i + 1))
  console.log(
    `endless: median score ${median(endless.map((r) => r.score)).toFixed(0)}, ` +
      `median wave ${median(endless.map((r) => r.wave))}, median ${median(endless.map((r) => r.seconds)).toFixed(0)} s`,
  )
}
