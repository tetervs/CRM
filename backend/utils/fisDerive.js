// All date math is on Asia/Kolkata calendar days.
const TZ = 'Asia/Kolkata'
const day = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
const dayNum = (s) => Date.parse(`${s}T00:00:00Z`) / 864e5
const diffDays = (from, to) => Math.round(dayNum(day(to)) - dayNum(day(from)))
const istDate = (s) => new Date(`${s}T00:00:00+05:30`)

function derive(c, cfg, now) {
  const type = cfg.caseTypes.find((t) => t.code === c.caseType)
  const stages = type?.stages || []
  const idx = stages.indexOf(c.stage)
  const closed = !!c.closedAt
  let deadlineStatus
  if (closed) deadlineStatus = 'Closed'
  else if (!c.deadline) deadlineStatus = 'No deadline'
  else {
    const left = diffDays(now, c.deadline)
    deadlineStatus = left < 0 ? 'Overdue' : left <= cfg.dueSoonDays ? 'Due soon' : 'On track'
  }
  const daysSinceStage = diffDays(c.stageChangedAt, now)
  return {
    closed,
    phase: cfg.stagePhase.find((m) => m.stage === c.stage)?.phase || null,
    step: idx >= 0 ? { n: idx + 1, of: stages.length } : null,
    stageMissing: idx < 0, // stage (or whole case type) no longer exists in config — flagged, never reassigned
    deadlineStatus,
    daysSinceStage,
    stale: !closed && daysSinceStage >= cfg.staleDays,
  }
}

module.exports = { TZ, day, diffDays, istDate, derive }
