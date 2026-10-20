// Installs the new systems on the legacy game in the order their day and shift
// events must run: shift (closes the shift) → metrics (counts it) → missions
// (judges it) → career → incidents.
import { JOB_TITLES } from '../data/jobTitles.js'
import { currentRank, installCareer, RANKS } from './career/career.js'
import { installIncidents } from './incidents/engine.js'
import { installMetrics } from './metrics.js'
import { currentChapter, installMissions, missionsDone } from './missions/engine.js'
import { installModifierHooks } from './modifiers.js'
import { ensureSbc } from './sbc.js'
import { installShift } from './shift/shift.js'

export function jobKeyOf(identity) {
  if (identity?.jobKey) return identity.jobKey
  const t = JOB_TITLES.find((x) => x.label === identity?.jobTitle || x.key === identity?.jobTitle)
  return t ? t.key : 'other'
}

export function installSystems({ game, hooks, identity, getConfig = () => ({}), openTab = () => {} }) {
  const getState = () => game.state
  const playingRole = () => getState()?.playerProfile?.role || 'barista'
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)

  installModifierHooks(hooks)
  const shift = installShift({ getState, game, hooks, getRankRole: playingRole })
  installMetrics(getState)
  const missions = installMissions({ getState, game, getRewardMultiplier: () => num(getConfig().rewardMultiplier, 1) })
  const career = installCareer({ getState, game, hooks, getJobKey: () => jobKeyOf(identity), openCareer: () => openTab('career') })
  const incidents = installIncidents({ getState, game, getRateMultiplier: () => num(getConfig().incidentRate, 1) })

  /** What the live lists show about this player. */
  function progress() {
    const state = getState()
    if (!state) return null
    const sbc = ensureSbc(state)
    const s = missions.summary()
    return {
      missionsDone: missionsDone(state),
      xp: sbc.career.xp || 0,
      rank: currentRank(state).key,
      chapter: Math.min(10, currentChapter(state)),
      missionsToday: s.today,
    }
  }

  return { shift, missions, career, incidents, progress, RANKS }
}
