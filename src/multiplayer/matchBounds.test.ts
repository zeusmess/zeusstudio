import { Bot, BOT_SKILLS } from '../game/bot'
import { GameSession } from '../game/core/GameSession'
import { sessionConfigFor, type PlayRequest } from '../game/levels/modes'
import type { MatchLength } from '../types'
import { maxCupIdAt, maxEndlessScoreAt, maxMatchScoreAt, maxPointsPerCatch } from './matchBounds'

const FRAME_MS = 1000 / 60

interface CatchSample {
  time: number
  cupId: number
  points: number
  score: number
}

/** A flawless player: catches every cup the moment it lands. */
function playPerfectly(request: PlayRequest, seed: number, limitMs: number): CatchSample[] {
  const session = new GameSession(sessionConfigFor(request), seed)
  const bot = new Bot(BOT_SKILLS.perfect, seed)
  const samples: CatchSample[] = []
  session.start()
  while (session.running && session.time < limitMs) {
    bot.update(session, FRAME_MS)
    session.advance(FRAME_MS)
    for (const event of session.drainEvents()) {
      if (event.type === 'catch') {
        samples.push({ time: session.time, cupId: event.cupId, points: event.points.total, score: session.score })
      }
    }
  }
  return samples
}

describe('server limits on online scores', () => {
  it.each<MatchLength>(['quick', 'classic', 'marathon'])('never reject perfect play in a %s match', (length) => {
    for (let seed = 1; seed <= 12; seed++) {
      const samples = playPerfectly({ mode: 'versus', length, seed: seed * 7919, roomCode: 'K7M2QX', round: 1 }, seed, 240_000)
      expect(samples.length).toBeGreaterThan(10)
      for (const sample of samples) {
        expect(sample.points).toBeLessThanOrEqual(maxPointsPerCatch(length))
        expect(sample.cupId).toBeLessThanOrEqual(maxCupIdAt(sample.time))
        expect(sample.score).toBeLessThanOrEqual(maxMatchScoreAt(sample.time))
      }
    }
  })

  it('never rejects a perfect endless run', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const samples = playPerfectly({ mode: 'endless', seed: seed * 104_729 }, seed, 12 * 60_000)
      for (const sample of samples) expect(sample.score).toBeLessThanOrEqual(maxEndlessScoreAt(sample.time))
    }
  })

  it('still stops scores no one could earn', () => {
    expect(maxMatchScoreAt(5_000)).toBeLessThan(5_500)
    expect(maxCupIdAt(10_000)).toBeLessThan(40)
    expect(maxPointsPerCatch('quick')).toBeLessThan(maxPointsPerCatch('marathon'))
  })
})
