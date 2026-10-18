import { sessionResult } from '../test/fixtures'
import { localEntries, submitEndlessScore } from './leaderboard'

const endless = (score: number) => sessionResult({ mode: 'endless', levelId: 0, target: 0, score, wave: 3, outcome: 'gameOver' })

describe('endless leaderboard without a configured backend', () => {
  it('ranks scores on this device and says so', async () => {
    expect(await submitEndlessScore(endless(5000))).toEqual({ value: 1, scope: 'device' })
    expect(await submitEndlessScore(endless(8000))).toEqual({ value: 1, scope: 'device' })
    expect(await submitEndlessScore(endless(6000))).toEqual({ value: 2, scope: 'device' })
    expect(localEntries().map((e) => e.score)).toEqual([8000, 6000, 5000])
  })

  it('keeps the top ten and leaves lower scores unranked', async () => {
    for (let i = 0; i < 12; i++) await submitEndlessScore(endless(10_000 + i * 100))
    expect(localEntries()).toHaveLength(10)
    expect(await submitEndlessScore(endless(10))).toBeNull()
  })
})
