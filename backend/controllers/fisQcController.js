const crypto = require('crypto')
const mongoose = require('mongoose')
const FisCase = require('../models/FisCase')
const FisQcRun = require('../models/FisQcRun')
const FisQcTemplate = require('../models/FisQcTemplate')
const qc = require('../utils/fisQc')

const bad = (res, message, status = 400) => res.status(status).json({ message })
const uid = (u) => (u ? String(u._id || u) : null)
const STATUSES = ['Pass', 'Issue', 'N/A', 'unset']

// ── helpers ──────────────────────────────────────────────────────────────────
const latestTemplate = () => FisQcTemplate.findOne().sort('-version')
const templateByVersion = (v) => FisQcTemplate.findOne({ version: v })

// Case lookup + view access: fis_admin, or the case's lead / support 1 / support 2.
// Creator-only users and everyone else get 403. Writes are additionally admin-gated on the router.
async function loadCase(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { bad(res, 'Case not found', 404); return null }
  const c = await FisCase.findById(req.params.id)
  if (!c) { bad(res, 'Case not found', 404); return null }
  const involved = [c.caseLead, c.support1, c.support2].some((u) => uid(u) === String(req.user._id))
  if (req.user.fisRole !== 'fis_admin' && !involved) { bad(res, 'Access denied', 403); return null }
  return c
}

// Loads case + run + its pinned template, or answers with the error and returns null.
async function loadRun(req, res, { open = true } = {}) {
  const c = await loadCase(req, res)
  if (!c) return null
  const run = await FisQcRun.findOne({ case: c._id })
  if (!run) { bad(res, 'QC has not been started for this case', 404); return null }
  const template = await templateByVersion(run.templateVersion)
  if (open && run.status === 'passed') { bad(res, 'QC is passed. Reopen it to make changes', 409); return null }
  return { c, run, template }
}

const respond = (res, run, template, c, status = 200) => res.status(status).json({ run: qc.hydrate(run, template, c.caseType) })

function roundLabel(caseType, n, provided) {
  if (caseType !== 'SOPs') return { label: `Round ${n}` }
  const label = provided || (n === 1 ? 'Draft 1' : 'Draft 2')
  if (!qc.SOP_LABELS.includes(label)) return { error: `SOPs rounds are labelled ${qc.SOP_LABELS.join(' or ')}` }
  return { label }
}

const underlyingOk = (template, t) => t !== qc.DIRECT && Object.keys(template.rules.byCaseType || {}).includes(t)

// ── run: read / create / settings ────────────────────────────────────────────
exports.getQc = async (req, res, next) => {
  try {
    const c = await loadCase(req, res)
    if (!c) return
    const run = await FisQcRun.findOne({ case: c._id })
    if (!run) return res.json({ run: null })
    respond(res, run, await templateByVersion(run.templateVersion), c)
  } catch (e) { next(e) }
}

exports.startQc = async (req, res, next) => {
  try {
    const c = await loadCase(req, res)
    if (!c) return
    if (await FisQcRun.exists({ case: c._id })) return bad(res, 'QC already started for this case', 409)
    const template = await latestTemplate()
    if (!template) return bad(res, 'QC template has not been seeded', 503)
    const { cctv, underlyingType, scope, label } = req.body
    const run = new FisQcRun({ case: c._id, templateVersion: template.version, createdBy: req.user._id, subjects: [] })
    if (c.caseType === qc.DIRECT) {
      if (!underlyingOk(template, underlyingType)) return bad(res, 'Pick the underlying report type for a direct QC')
      run.underlyingType = underlyingType
    }
    if (cctv !== undefined) run.cctv = !!cctv
    const sc = applyScope(run, scope)
    if (sc) return bad(res, sc)
    const l = roundLabel(c.caseType, 1, label)
    if (l.error) return bad(res, l.error)
    run.rounds.push({ n: 1, label: l.label, items: qc.applicableItems(template, run, c.caseType).map(qc.blank) })
    await run.save()
    respond(res, run, template, c, 201)
  } catch (e) { next(e) }
}

function applyScope(run, scope) {
  if (scope === undefined) return null
  if (!scope || !['Full', 'Partial'].includes(scope.kind)) return 'scope.kind must be Full or Partial'
  const text = (scope.text || '').trim()
  if (scope.kind === 'Partial' && !text) return 'Describe the scope of a partial QC'
  if (text.length > 500) return 'Scope text is too long'
  run.scope = { kind: scope.kind, text }
  return null
}

exports.updateQc = async (req, res, next) => {
  try {
    const l = await loadRun(req, res)
    if (!l) return
    const { c, run, template } = l
    const { cctv, scope, underlyingType, noSubjects } = req.body
    if (cctv !== undefined) run.cctv = !!cctv
    const sc = applyScope(run, scope)
    if (sc) return bad(res, sc)
    if (underlyingType !== undefined) {
      if (c.caseType !== qc.DIRECT) return bad(res, 'Only a direct QC has an underlying report type')
      if (!underlyingOk(template, underlyingType)) return bad(res, 'Unknown underlying report type')
      run.underlyingType = underlyingType
    }
    if (noSubjects !== undefined) {
      if (noSubjects?.ticked) {
        const reason = (noSubjects.reason || '').trim()
        if (!reason || reason.length > 300) return bad(res, 'A reason is required (max 300 chars)')
        run.noSubjectsInScope = { ticked: true, reason, by: req.user._id, at: new Date() }
      } else run.noSubjectsInScope = { ticked: false }
    }
    const synced = qc.syncRound(qc.currentRound(run), qc.applicableItems(template, run, c.caseType))
    if (synced.error) return bad(res, synced.error)
    await run.save()
    respond(res, run, template, c)
  } catch (e) { next(e) }
}

// ── subjects ─────────────────────────────────────────────────────────────────
exports.addSubject = async (req, res, next) => {
  try {
    const l = await loadRun(req, res)
    if (!l) return
    const { c, run, template } = l
    if (!template.rules.perSubject?.[qc.effectiveType(run, c.caseType)]) return bad(res, 'This case type has no per-subject checks')
    const label = (req.body.label || '').trim()
    if (!label || label.length > 60) return bad(res, 'Subject case code is required (max 60 chars)')
    if (run.subjects.some((s) => s.label.toLowerCase() === label.toLowerCase())) return bad(res, 'That subject is already added', 409)
    run.subjects.push({ id: crypto.randomBytes(3).toString('hex'), label })
    qc.syncRound(qc.currentRound(run), qc.applicableItems(template, run, c.caseType))
    await run.save()
    respond(res, run, template, c, 201)
  } catch (e) { next(e) }
}

exports.removeSubject = async (req, res, next) => {
  try {
    const l = await loadRun(req, res)
    if (!l) return
    const { c, run, template } = l
    const sid = req.params.sid
    if (!run.subjects.some((s) => s.id === sid)) return bad(res, 'Subject not found', 404)
    if (run.rounds.some((r) => r.items.some((i) => i.subject === sid && i.status !== 'unset'))) {
      return bad(res, 'This subject already has checked items. Clear them first')
    }
    run.subjects = run.subjects.filter((s) => s.id !== sid)
    qc.syncRound(qc.currentRound(run), qc.applicableItems(template, run, c.caseType))
    await run.save()
    respond(res, run, template, c)
  } catch (e) { next(e) }
}

// ── items ────────────────────────────────────────────────────────────────────
exports.setItem = async (req, res, next) => {
  try {
    const l = await loadRun(req, res)
    if (!l) return
    const { c, run, template } = l
    const item = qc.currentRound(run).items.find((i) => i.key === req.params.key)
    if (!item) return bad(res, 'Item not found in the current round', 404)
    const { status } = req.body
    if (!STATUSES.includes(status)) return bad(res, `status must be one of ${STATUSES.join(', ')}`)
    const note = (req.body.note || '').trim()
    const reason = (req.body.reason || '').trim()
    if (status === 'Issue' && (!note || note.length > 1000)) return bad(res, 'An Issue needs a note, e.g. "page 6, case 2" (max 1000 chars)')
    if (status === 'N/A' && (!reason || reason.length > 300)) return bad(res, 'N/A needs a short reason (max 300 chars)')
    item.status = status
    item.note = status === 'Issue' ? note : ''
    item.reason = status === 'N/A' ? reason : ''
    if (status !== 'unset') item.recheck = false
    await run.save()
    respond(res, run, template, c)
  } catch (e) { next(e) }
}

// ── rounds & sign-off ────────────────────────────────────────────────────────
exports.sendBack = async (req, res, next) => {
  try {
    const l = await loadRun(req, res)
    if (!l) return
    const { c, run, template } = l
    const prev = qc.currentRound(run)
    const lab = roundLabel(c.caseType, prev.n + 1, req.body.label)
    if (lab.error) return bad(res, lab.error)
    prev.state = 'closed'; prev.closedAt = new Date(); prev.closedBy = req.user._id; prev.closedFor = 'sent_back'
    run.rounds.push({
      n: prev.n + 1, label: lab.label,
      items: qc.carryForward(prev, qc.applicableItems(template, run, c.caseType),
        { reset: true, recheckCodes: template.rules.recheckAfterRevision || [] }),
    })
    await run.save()
    respond(res, run, template, c)
  } catch (e) { next(e) }
}

exports.passQc = async (req, res, next) => {
  try {
    const l = await loadRun(req, res)
    if (!l) return
    const { c, run, template } = l
    const blockers = qc.passBlockers(run, template, c.caseType)
    if (blockers.length) return res.status(400).json({ message: `Cannot pass QC: ${blockers.join('; ')}`, blockers })
    const round = qc.currentRound(run)
    round.state = 'closed'; round.closedAt = new Date(); round.closedBy = req.user._id; round.closedFor = 'passed'
    run.status = 'passed'
    run.passed = { by: req.user._id, at: round.closedAt }
    await run.save()
    respond(res, run, template, c)
  } catch (e) { next(e) }
}

exports.reopenQc = async (req, res, next) => {
  try {
    const l = await loadRun(req, res, { open: false })
    if (!l) return
    const { c, run, template } = l
    if (run.status !== 'passed') return bad(res, 'Only a passed QC can be reopened', 409)
    const reason = (req.body.reason || '').trim()
    if (!reason || reason.length > 300) return bad(res, 'A reason is required to reopen (max 300 chars)')
    const prev = qc.currentRound(run)
    const lab = roundLabel(c.caseType, prev.n + 1, req.body.label)
    if (lab.error) return bad(res, lab.error)
    run.reopens.push({ by: req.user._id, at: new Date(), reason, fromRound: prev.n })
    run.rounds.push({
      n: prev.n + 1, label: lab.label,
      items: qc.carryForward(prev, qc.applicableItems(template, run, c.caseType), { reset: false, recheckCodes: [] }),
    })
    run.status = 'inProgress'
    run.passed = undefined
    await run.save()
    respond(res, run, template, c)
  } catch (e) { next(e) }
}

// ── template (fis_admin) ─────────────────────────────────────────────────────
// Every edit inserts a new immutable version cloned from the latest.
async function newVersion(req, note, mutate) {
  const latest = await latestTemplate()
  if (!latest) throw Object.assign(new Error('QC template has not been seeded'), { status: 503 })
  const doc = JSON.parse(JSON.stringify(latest.toObject()))
  mutate(doc)
  return FisQcTemplate.create({
    sections: doc.sections, rules: doc.rules, counters: doc.counters,
    version: latest.version + 1, createdBy: req.user._id, note,
  })
}

const fail = (status, message) => Object.assign(new Error(message), { status })
const findItem = (doc, code) => {
  for (const s of doc.sections) for (const g of s.groups) {
    const idx = g.items.findIndex((i) => i.code === code)
    if (idx >= 0) return { s, g, idx, item: g.items[idx] }
  }
  throw fail(404, `Item ${code} not found`)
}
const cleanText = (t) => {
  const v = (t || '').trim()
  if (!v || v.length > 600) throw fail(400, 'Item text is required (max 600 chars)')
  return v
}
const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res) } catch (e) {
    if (e.status) return bad(res, e.message, e.status)
    next(e)
  }
}

exports.getTemplate = wrap(async (_req, res) => {
  const t = await latestTemplate()
  if (!t) return bad(res, 'QC template has not been seeded', 503)
  res.json(t)
})

exports.addItem = wrap(async (req, res) => {
  const { section, group } = req.body
  const text = cleanText(req.body.text)
  const t = await newVersion(req, `Added item to ${section}`, (doc) => {
    const sec = doc.sections.find((s) => s.code === section)
    if (!sec) throw fail(400, 'Unknown section')
    const gName = (group || '').trim()
    if (!gName) throw fail(400, 'Group is required')
    let g = sec.groups.find((x) => x.name === gName)
    if (!g) { g = { name: gName, items: [] }; sec.groups.push(g) }
    const max = Math.max(0, doc.counters?.[section] || 0, ...sec.groups.flatMap((x) => x.items.map((i) => qc.numOf(i.code))))
    doc.counters = { ...doc.counters, [section]: max + 1 }
    g.items.push({ code: `${section}${max + 1}`, text })
  })
  res.status(201).json(t)
})

exports.editItem = wrap(async (req, res) => {
  const text = cleanText(req.body.text)
  res.json(await newVersion(req, `Edited ${req.params.code}`, (doc) => { findItem(doc, req.params.code).item.text = text }))
})

exports.removeItem = wrap(async (req, res) => {
  res.json(await newVersion(req, `Removed ${req.params.code}`, (doc) => {
    const { s, g, idx } = findItem(doc, req.params.code)
    g.items.splice(idx, 1)
    if (!g.items.length) s.groups = s.groups.filter((x) => x !== g)
  }))
})

exports.addSection = wrap(async (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase()
  const title = (req.body.title || '').trim()
  if (!/^[A-Z]{1,4}$/.test(code)) return bad(res, 'Section code must be 1-4 letters')
  if (!title || title.length > 150) return bad(res, 'Title is required')
  res.status(201).json(await newVersion(req, `Added section ${code}`, (doc) => {
    if (doc.sections.some((s) => s.code === code)) throw fail(409, 'That section code already exists')
    doc.sections.push({ code, title, intro: (req.body.intro || '').trim(), groups: [] })
  }))
})

exports.setCaseTypeMap = wrap(async (req, res) => {
  const map = req.body.byCaseType
  if (!map || typeof map !== 'object' || Array.isArray(map)) return bad(res, 'byCaseType must be an object')
  res.json(await newVersion(req, 'Changed case type to section mapping', (doc) => {
    const codes = doc.sections.map((s) => s.code)
    for (const [type, secs] of Object.entries(map)) {
      if (!Array.isArray(secs) || !secs.every((x) => codes.includes(x))) throw fail(400, `Invalid sections for ${type}`)
    }
    doc.rules.byCaseType = map
  }))
})
