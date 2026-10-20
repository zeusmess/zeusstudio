// Lays the catalogue out as exactly 1000 missions in a fixed order (the same for
// every player, so the leaderboard compares like with like).
//
// Each chapter is 10 blocks of 10: nine family missions then a challenge (the
// last block ends with the chapter's final). Family f is skipped in block 9 - f,
// so each family appears 9 times, one step harder each time, and every chapter
// opens with its first family.
import { CHAPTERS } from './catalog.js'

export const MISSIONS_PER_CHAPTER = 100
export const TOTAL_MISSIONS = 1000

function fill(text, n) {
  return text.replace('{n}', Number(n).toLocaleString('en-US'))
}

function rewardFor(chapter, step, kind) {
  const money = Math.round((55 + chapter * 28 + step * 9) * (kind === 'final' ? 6 : kind === 'challenge' ? 2.5 : 1))
  const xp = Math.round((40 * chapter + 6 * step) * (kind === 'final' ? 5 : kind === 'challenge' ? 2 : 1))
  const cp = kind === 'final' ? 5 * chapter : kind === 'challenge' ? 2 * chapter : chapter
  return { money, xp, cp }
}

let cache = null

/** @returns {Array<object>} the 1000 missions, index 0..999 */
export function allMissions() {
  if (cache) return cache
  const list = []
  CHAPTERS.forEach((chapter, c) => {
    for (let b = 0; b < 10; b++) {
      for (let f = 0; f < 10; f++) {
        const skippedIn = 9 - f
        if (skippedIn === b) continue
        const family = chapter.families[f]
        const step = b - (skippedIn < b ? 1 : 0)
        const target = family.targets[step]
        list.push({
          idx: list.length,
          chapter: chapter.n,
          kind: 'family',
          family: f,
          step,
          scope: family.scope,
          title: family.title,
          desc: fill(family.desc, target),
          req: [{ metric: family.metric, target }],
          constraints: [],
          reward: rewardFor(chapter.n, step, 'family'),
        })
      }
      const special = b < 9 ? chapter.challenges[b] : chapter.final
      const kind = b < 9 ? 'challenge' : 'final'
      list.push({
        idx: list.length,
        chapter: chapter.n,
        kind,
        family: -1,
        step: b,
        scope: special.scope,
        title: special.title,
        desc: special.desc,
        req: special.req.map((r) => ({ ...r })),
        constraints: (special.constraints || []).map((r) => ({ ...r })),
        reward: rewardFor(chapter.n, b, kind),
      })
    }
  })
  list.forEach((m) => {
    m.id = `M${String(m.idx + 1).padStart(4, '0')}`
    m.number = m.idx + 1
    m.numberInChapter = (m.idx % MISSIONS_PER_CHAPTER) + 1
  })
  cache = list
  return list
}

export function missionsOfChapter(n) {
  return allMissions().filter((m) => m.chapter === n)
}

export function chapterInfo(n) {
  return CHAPTERS.find((c) => c.n === n)
}
