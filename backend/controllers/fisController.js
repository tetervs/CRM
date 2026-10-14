const mongoose = require('mongoose')
const User = require('../models/User')
const FisConfig = require('../models/FisConfig')
const FisCase = require('../models/FisCase')
const FisCaseHistory = require('../models/FisCaseHistory')
const FisQcRun = require('../models/FisQcRun')
const { qcStatus } = require('../utils/fisQc')
const defaults = require('../utils/fisDefaults')
const { day, diffDays, istDate, derive } = require('../utils/fisDerive')

const USER_FIELDS = ['caseLead', 'support1', 'support2', 'assignedBy']
const DATE_FIELDS = ['dateAssigned', 'deadline']
const EDITABLE = ['caseRef', 'caseType', ...USER_FIELDS, ...DATE_FIELDS, 'stage', 'remarks']
const POPULATE = USER_FIELDS.concat('createdBy').map((path) => ({ path, select: 'name' }))

const isAdmin = (req) => req.user.fisRole === 'fis_admin'
const bad = (res, message) => res.status(400).json({ message })

const getConfig = async () =>
  (await FisConfig.findOne({ key: 'default' })) ||
  FisConfig.findOneAndUpdate({ key: 'default' }, { $setOnInsert: { key: 'default', ...defaults } }, { upsert: true, new: true })

// ?asOf=YYYY-MM-DD lets an admin pin "today" for verification; never honoured in production.
const getNow = (req) => {
  const asOf = req.query.asOf
  if (asOf && isAdmin(req) && process.env.NODE_ENV !== 'production' && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return new Date(`${asOf}T12:00:00+05:30`)
  }
  return new Date()
}

const uid = (u) => (u ? String(u._id || u) : null)
const involves = (c, id) => [c.caseLead, c.support1, c.support2].some((u) => u && uid(u) === String(id))
// View: admin, anyone on the case, or its creator. Edit: admin or anyone on the case (creator-only = view-only).
const canEdit = (req, c) => isAdmin(req) || involves(c, req.user._id)
const canSee = (req, c) => canEdit(req, c) || uid(c.createdBy) === String(req.user._id)
// Members may only touch these after creation; everything else is fis_admin-only.
const MEMBER_EDITABLE = ['stage', 'remarks']

const present = (c, cfg, now, req) => ({ ...c.toObject(), ...derive(c, cfg, now), canEdit: canEdit(req, c) })

const parseDate = (v) => {
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? istDate(v) : new Date(v)
  return isNaN(d) ? undefined : d
}

// Validates + normalises incoming fields. Returns { values } or { error }.
async function sanitize(body, cfg, current) {
  const v = {}
  for (const k of EDITABLE) if (k in body) v[k] = body[k]

  if ('caseRef' in v) {
    if (typeof v.caseRef !== 'string' || !v.caseRef.trim() || v.caseRef.length > 200) return { error: 'caseRef is required (max 200 chars)' }
    v.caseRef = v.caseRef.trim()
  }
  if ('remarks' in v && (typeof v.remarks !== 'string' || v.remarks.length > 5000)) return { error: 'remarks too long' }
  for (const k of DATE_FIELDS) {
    if (k in v && (v[k] = parseDate(v[k])) === undefined) return { error: `${k} must be a valid date` }
  }
  for (const k of USER_FIELDS) {
    if (!(k in v)) continue
    if (v[k] === '') v[k] = null
    if (v[k] === null) continue
    if (!mongoose.isValidObjectId(v[k]) || !(await User.exists({ _id: v[k], fisRole: { $ne: null }, isActive: true }))) {
      return { error: `${k} must be an active FIS user` }
    }
  }

  const type = cfg.caseTypes.find((t) => t.code === (v.caseType ?? current?.caseType))
  if (!type) return { error: current ? 'Unknown case type' : 'caseType is required and must exist' }
  const typeChanged = current && v.caseType && v.caseType !== current.caseType
  if (!current && !v.stage) v.stage = type.stages[0]
  // A stage must exist in the type's list when it is being set or the type is changing.
  // An untouched, orphaned stage is grandfathered so editing other fields keeps working.
  if (!current || typeChanged || ('stage' in v && v.stage !== current.stage)) {
    const stage = v.stage ?? current.stage
    if (!type.stages.includes(stage)) return { error: `Stage "${stage}" is not valid for ${type.code}` }
  }
  return { values: v }
}

const nameOf = async (ids) => {
  const users = await User.find({ _id: { $in: ids } }).select('name')
  return Object.fromEntries(users.map((u) => [String(u._id), u.name]))
}

const display = (field, val, names) => {
  if (val == null || val === '') return ''
  if (USER_FIELDS.includes(field)) return names[String(val)] || String(val)
  if (DATE_FIELDS.includes(field)) return day(val)
  return String(val)
}

// ── Config ───────────────────────────────────────────────────────────────────
exports.getConfig = async (_req, res, next) => {
  try { res.json(await getConfig()) } catch (e) { next(e) }
}

exports.updateConfig = async (req, res, next) => {
  try {
    const { dueSoonDays, staleDays, phases, stagePhase, caseTypes } = req.body
    if (!Number.isInteger(dueSoonDays) || dueSoonDays < 0) return bad(res, 'dueSoonDays must be an integer >= 0')
    if (!Number.isInteger(staleDays) || staleDays < 1) return bad(res, 'staleDays must be an integer >= 1')
    const strs = (a) => Array.isArray(a) && a.every((s) => typeof s === 'string' && s.trim())
    if (!strs(phases) || new Set(phases).size !== phases.length) return bad(res, 'phases must be unique non-empty strings')
    if (!Array.isArray(stagePhase) || !stagePhase.every((m) => m && typeof m.stage === 'string' && phases.includes(m.phase))) {
      return bad(res, 'stagePhase entries need a stage and a phase from phases')
    }
    if (!Array.isArray(caseTypes) || !caseTypes.length || !caseTypes.every((t) => t && typeof t.code === 'string' && t.code.trim() && strs(t.stages) && t.stages.length)) {
      return bad(res, 'every case type needs a code and at least one stage')
    }
    if (new Set(caseTypes.map((t) => t.code.trim())).size !== caseTypes.length) return bad(res, 'case type codes must be unique')
    const cfg = await getConfig()
    cfg.set({
      dueSoonDays, staleDays, phases,
      stagePhase: stagePhase.map(({ stage, phase }) => ({ stage, phase })),
      caseTypes: caseTypes.map(({ code, name, stages }) => ({ code: code.trim(), name: name || code, stages })),
    })
    await cfg.save()
    res.json(cfg)
  } catch (e) { next(e) }
}

exports.getPeople = async (_req, res, next) => {
  try {
    res.json(await User.find({ fisRole: { $ne: null }, isActive: true }).select('name fisRole').sort('name'))
  } catch (e) { next(e) }
}

// ── Cases ────────────────────────────────────────────────────────────────────
exports.listCases = async (req, res, next) => {
  try {
    const cfg = await getConfig()
    const now = getNow(req)
    const q = isAdmin(req)
      ? {}
      : { $or: ['caseLead', 'support1', 'support2', 'createdBy'].map((k) => ({ [k]: req.user._id })) }
    const cases = await FisCase.find(q).sort('serialNo').populate(POPULATE)
    const runs = await FisQcRun.find({ case: { $in: cases.map((c) => c._id) } }).select('case status rounds.n')
    const byCase = Object.fromEntries(runs.map((r) => [String(r.case), r]))
    res.json(cases.map((c) => {
      const p = present(c, cfg, now, req)
      // QC is viewable only by admins and people on the case; creator-only rows get no QC status.
      return { ...p, qcStatus: p.canEdit ? qcStatus(byCase[String(c._id)]) : null }
    }))
  } catch (e) { next(e) }
}

exports.createCase = async (req, res, next) => {
  try {
    const cfg = await getConfig()
    const { values, error } = await sanitize(req.body, cfg, null)
    if (error) return bad(res, error)
    if (!values.caseRef) return bad(res, 'caseRef is required')
    const now = new Date()
    for (let attempt = 0; ; attempt++) {
      const last = await FisCase.findOne().sort('-serialNo').select('serialNo')
      try {
        const c = await FisCase.create({
          ...values, serialNo: (last?.serialNo || 0) + 1, createdBy: req.user._id,
          stageChangedAt: now, closedAt: values.stage === 'Closed' ? now : null,
        })
        await FisCaseHistory.create({ case: c._id, by: req.user._id, field: 'created', from: '', to: `${c.caseRef} (${c.caseType})` })
        await c.populate(POPULATE)
        return res.status(201).json(present(c, cfg, now, req))
      } catch (e) {
        if (e.code !== 11000 || attempt >= 5) throw e // serialNo race — retry
      }
    }
  } catch (e) { next(e) }
}

exports.getCase = async (req, res, next) => {
  try {
    const c = await FisCase.findById(req.params.id).populate(POPULATE)
    if (!c) return res.status(404).json({ message: 'Case not found' })
    if (!canSee(req, c)) return res.status(403).json({ message: 'Access denied' })
    const history = await FisCaseHistory.find({ case: c._id }).sort('-at').populate('by', 'name')
    res.json({ ...present(c, await getConfig(), getNow(req), req), history })
  } catch (e) { next(e) }
}

exports.updateCase = async (req, res, next) => {
  try {
    const c = await FisCase.findById(req.params.id)
    if (!c) return res.status(404).json({ message: 'Case not found' })
    if (!canSee(req, c)) return res.status(403).json({ message: 'Access denied' })
    if (!canEdit(req, c)) return res.status(403).json({ message: 'View only: you are not lead or support on this case' })
    if (!isAdmin(req) && EDITABLE.some((k) => k in req.body && !MEMBER_EDITABLE.includes(k))) {
      return res.status(403).json({ message: 'Only a FIS admin can change fields other than stage and remarks' })
    }
    const cfg = await getConfig()
    const { values, error } = await sanitize(req.body, cfg, c)
    if (error) return bad(res, error)

    const ids = [...Object.entries(values).filter(([k]) => USER_FIELDS.includes(k)).map(([, x]) => x), ...USER_FIELDS.map((k) => c[k])].filter(Boolean)
    const names = await nameOf(ids)
    const now = new Date()
    const changes = []
    for (const [field, to] of Object.entries(values)) {
      const a = display(field, c[field], names)
      const b = display(field, to, names)
      if (a === b) continue
      changes.push({ case: c._id, by: req.user._id, at: now, field, from: a, to: b })
      c[field] = to
    }
    if (changes.some((h) => h.field === 'stage')) {
      c.stageChangedAt = now // only a stage change resets the stale counter
      c.closedAt = c.stage === 'Closed' ? now : null
    }
    if (changes.length) { await c.save(); await FisCaseHistory.insertMany(changes) }
    await c.populate(POPULATE)
    res.json(present(c, cfg, now, req))
  } catch (e) { next(e) }
}

// ── Admin dashboard ──────────────────────────────────────────────────────────
exports.dashboard = async (req, res, next) => {
  try {
    const cfg = await getConfig()
    const now = getNow(req)
    const [cases, people, lastHist] = await Promise.all([
      FisCase.find().populate(POPULATE),
      User.find({ fisRole: { $ne: null }, isActive: true }).select('name').sort('name'),
      FisCaseHistory.findOne().sort('-at').select('at'),
    ])
    const rows = cases.map((c) => ({ c, d: derive(c, cfg, now) }))
    const open = rows.filter((r) => !r.d.closed)
    const flags = (rs) => ({
      overdue: rs.filter((r) => r.d.deadlineStatus === 'Overdue').length,
      dueSoon: rs.filter((r) => r.d.deadlineStatus === 'Due soon').length,
      stale: rs.filter((r) => r.d.stale).length,
    })
    const tally = (rs, key) => rs.reduce((m, r) => ((m[key(r)] = (m[key(r)] || 0) + 1), m), {})
    const lastOf = (rs) => rs.reduce((m, r) => (!m || r.c.stageChangedAt > m ? r.c.stageChangedAt : m), null)
    const mine = (r, p) => involves(r.c, p._id)

    const workload = people.map((p) => {
      const mineOpen = open.filter((r) => mine(r, p))
      return {
        person: { _id: p._id, name: p.name },
        leading: open.filter((r) => uid(r.c.caseLead) === String(p._id)).length,
        supporting: open.filter((r) => [r.c.support1, r.c.support2].some((u) => uid(u) === String(p._id))).length,
        ...flags(mineOpen),
        lastUpdate: lastOf(rows.filter((r) => mine(r, p))),
        closed: rows.filter((r) => r.d.closed && mine(r, p)).length,
        openByType: tally(mineOpen, (r) => r.c.caseType),
      }
    })
    const noLead = open.filter((r) => !r.c.caseLead)
    const openByPhase = people.map((p) => ({
      person: p.name,
      counts: tally(open.filter((r) => mine(r, p)), (r) => r.d.phase || 'Unmapped'),
    }))
    const stageCounts = cfg.caseTypes.map((t) => {
      const tr = open.filter((r) => r.c.caseType === t.code)
      const stages = t.stages.map((stage) => ({ stage, count: tr.filter((r) => r.c.stage === stage).length }))
      const orphan = tally(tr.filter((r) => !t.stages.includes(r.c.stage)), (r) => r.c.stage)
      Object.entries(orphan).forEach(([stage, count]) => stages.push({ stage, count, removed: true }))
      return { code: t.code, name: t.name, stages }
    })
    // Cases whose type was deleted from config still show up, flagged.
    const knownTypes = new Set(cfg.caseTypes.map((t) => t.code))
    const orphanTypes = open.filter((r) => !knownTypes.has(r.c.caseType))

    res.json({
      asOf: day(now),
      tiles: {
        open: open.length, ...flags(open), closed: rows.length - open.length,
        lastChange: [lastHist?.at, ...cases.map((c) => c.updatedAt)].filter(Boolean).sort((a, b) => b - a)[0] || null, staleDays: cfg.staleDays, dueSoonDays: cfg.dueSoonDays,
      },
      workload,
      total: {
        leading: open.filter((r) => r.c.caseLead).length,
        supporting: open.filter((r) => r.c.support1 || r.c.support2).length,
        ...flags(open), lastUpdate: lastOf(rows), closed: rows.length - open.length,
        openByType: tally(open, (r) => r.c.caseType),
      },
      noLead: { open: noLead.length, ...flags(noLead), openByType: tally(noLead, (r) => r.c.caseType) },
      phases: [...cfg.phases, 'Unmapped'],
      openByPhase,
      stageCounts,
      orphanTypeCases: orphanTypes.map((r) => ({ _id: r.c._id, caseRef: r.c.caseRef, caseType: r.c.caseType })),
    })
  } catch (e) { next(e) }
}

// ── Admin review report ──────────────────────────────────────────────────────
// Scope: cases whose closedAt falls within [from, to] (IST days, inclusive).
exports.report = async (req, res, next) => {
  try {
    const cfg = await getConfig()
    const today = day(getNow(req))
    const [y, m] = today.split('-').map(Number)
    const defFrom = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10)
    const re = /^\d{4}-\d{2}-\d{2}$/
    const from = re.test(req.query.from || '') ? req.query.from : defFrom
    const to = re.test(req.query.to || '') ? req.query.to : today
    if (from > to) return bad(res, 'From must be on or before To')

    const [cases, people] = await Promise.all([
      FisCase.find({ closedAt: { $ne: null } }).populate(POPULATE),
      User.find({ fisRole: { $ne: null }, isActive: true }).select('name').sort('name'),
    ])
    const inRange = cases.filter((c) => day(c.closedAt) >= from && day(c.closedAt) <= to)
    const outcome = (c) => (!c.deadline ? 'noDeadline' : day(c.closedAt) <= day(c.deadline) ? 'onTime' : 'late')
    const daysToClose = (c) => (c.dateAssigned ? diffDays(c.dateAssigned, c.closedAt) : null)
    const summarise = (cs) => {
      const o = { onTime: 0, late: 0, noDeadline: 0 }
      cs.forEach((c) => o[outcome(c)]++)
      const durs = cs.map(daysToClose).filter((x) => x !== null)
      return {
        ...o,
        onTimePct: o.onTime + o.late ? Math.round((100 * o.onTime) / (o.onTime + o.late)) : null,
        avgDaysToClose: durs.length ? Math.round((10 * durs.reduce((a, b) => a + b, 0)) / durs.length) / 10 : null,
      }
    }

    const months = Array.from({ length: 12 }, (_, i) =>
      new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1 + i, 1)).toISOString().slice(0, 7))
    res.json({
      from, to,
      perPerson: people.map((p) => {
        const led = inRange.filter((c) => uid(c.caseLead) === String(p._id))
        const supported = inRange.filter((c) => [c.support1, c.support2].some((u) => uid(u) === String(p._id)))
        return { person: p.name, led: led.length, supported: supported.length, ...summarise([...led, ...supported]) }
      }),
      byType: cfg.caseTypes.map((t) => {
        const cs = inRange.filter((c) => c.caseType === t.code)
        return { code: t.code, closed: cs.length, ...summarise(cs) }
      }),
      cases: inRange.map((c) => ({
        _id: c._id, caseRef: c.caseRef, caseType: c.caseType, outcome: outcome(c), daysToClose: daysToClose(c),
        deadline: c.deadline, closedAt: c.closedAt,
      })),
      perMonth: months.map((month) => ({ month, closed: cases.filter((c) => day(c.closedAt).startsWith(month)).length })),
    })
  } catch (e) { next(e) }
}
