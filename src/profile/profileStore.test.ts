// @vitest-environment jsdom
import { sessionResult } from '../test/fixtures'

/** Loads the profile store as a fresh page load would (modules re-evaluated, storage kept). */
async function loadPage() {
  vi.resetModules()
  return import('./profileStore')
}

describe('saving progress on this device', () => {
  beforeEach(() => localStorage.clear())

  it('keeps a guest profile and its progress after a reload', async () => {
    const first = await loadPage()
    const id = first.getProfile().profile.id
    expect(first.useProfile.getState().setDisplayName('يوسف أيمن')).toMatchObject({ ok: true })
    first.useProfile.getState().recordCampaign(sessionResult({ score: 620 }))

    const second = await loadPage()
    const record = second.getProfile()
    expect(record.profile.id).toBe(id)
    expect(record.profile.displayName).toBe('يوسف أيمن')
    expect(record.progress.completedLevels).toEqual([1])
    expect(record.progress.bestScores['1']).toBe(620)
    expect(record.progress.unlockedLevel).toBe(2)
  })

  it('starts a fresh profile when the saved one is unreadable', async () => {
    const first = await loadPage()
    const id = first.getProfile().profile.id
    localStorage.setItem(first.recordKey(id), '{ not json')

    const second = await loadPage()
    expect(second.getProfile().progress.completedLevels).toEqual([])
    expect(second.getProfile().profile.displayName).toMatch(/\d{3}$/)
  })

  it('repairs malformed progress instead of trusting it', async () => {
    const first = await loadPage()
    const record = first.getProfile()
    localStorage.setItem(
      first.recordKey(record.profile.id),
      JSON.stringify({ ...record, progress: { ...record.progress, unlockedLevel: 99, completedLevels: [1, 'x', 40], totalCupsCaught: -5 } }),
    )
    const progress = (await loadPage()).getProfile().progress
    expect(progress.unlockedLevel).toBe(2)
    expect(progress.completedLevels).toEqual([1])
    expect(progress.totalCupsCaught).toBe(0)
  })

  it('counts a match saved twice only once', async () => {
    const { useProfile, getProfile } = await loadPage()
    const record = {
      id: 'K7M2QX-1',
      at: 1,
      opponentName: 'Rival',
      opponentAvatar: 'hot-cup' as const,
      myScore: 2600,
      opponentScore: 2100,
      outcome: 'win' as const,
      reason: 'target' as const,
      length: 'quick' as const,
    }
    useProfile.getState().recordMatch(record, sessionResult({ mode: 'versus', caught: 20 }))
    useProfile.getState().recordMatch(record, sessionResult({ mode: 'versus', caught: 20 }))
    const progress = getProfile().progress
    expect(progress.matchStats.played).toBe(1)
    expect(progress.matchHistory).toHaveLength(1)
    expect(progress.totalCupsCaught).toBe(20)
    expect(progress.achievements.friendly_rivalry).toBeDefined()
  })
})
