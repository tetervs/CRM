// Pure QC logic: which items apply, round carry-forward, sign-off rules, issue log.
const DIRECT = 'QC (direct)'
const SOP_LABELS = ['Draft 1', 'Draft 2']
const numOf = (code) => parseInt(code.replace(/^[A-Z]+/, ''), 10)

const effectiveType = (run, caseType) => (caseType === DIRECT ? run.underlyingType : caseType)

function sectionCodes(rules, run, caseType) {
  const codes = [...(rules.always || []), ...(rules.byCaseType?.[caseType] || [])]
  if (caseType === DIRECT && run.underlyingType) codes.push(...(rules.byCaseType?.[run.underlyingType] || []))
  return [...new Set(codes)]
}

// Ordered list of the items that apply to this case right now: { key, code, subject }.
function applicableItems(template, run, caseType) {
  const rules = template.rules
  const out = []
  for (const code of sectionCodes(rules, run, caseType)) {
    const sec = template.sections.find((s) => s.code === code)
    if (!sec) continue
    const cond = rules.conditional?.[code]
    for (const g of sec.groups) {
      for (const it of g.items) {
        const n = numOf(it.code)
        if (cond && n >= cond.from && n <= cond.to && !run[cond.toggle]) continue
        out.push({ key: it.code, code: it.code, subject: null })
      }
    }
  }
  const per = rules.perSubject?.[effectiveType(run, caseType)]
  const perSec = per && template.sections.find((s) => s.code === per.prefix)
  if (perSec) {
    for (const subj of run.subjects) {
      for (const g of perSec.groups) {
        for (const it of g.items) {
          const n = numOf(it.code)
          if (n >= per.from && n <= per.to) out.push({ key: `${it.code}@${subj.id}`, code: it.code, subject: subj.id })
        }
      }
    }
  }
  return out
}

const blank = (a) => ({ key: a.key, code: a.code, subject: a.subject, status: 'unset', note: '', reason: '', recheck: false })
const plain = (i) => ({ key: i.key, code: i.code, subject: i.subject, status: i.status, note: i.note, reason: i.reason, recheck: i.recheck })

// Make a round's items match the applicable list. Refuses to drop an item that has a status.
function syncRound(round, applicable) {
  const have = new Map(round.items.map((i) => [i.key, plain(i)]))
  const want = new Set(applicable.map((a) => a.key))
  const dropped = [...have.values()].filter((i) => !want.has(i.key) && i.status !== 'unset')
  if (dropped.length) return { error: `Clear ${dropped.map((i) => i.code).join(', ')} first: they would no longer apply` }
  round.items = applicable.map((a) => have.get(a.key) || blank(a))
  return {}
}

// Next round's items. sendBack resets Issue items and the re-check list; reopen carries everything.
function carryForward(prev, applicable, { reset, recheckCodes }) {
  const have = new Map(prev.items.map((i) => [i.key, i]))
  return applicable.map((a) => {
    const p = have.get(a.key)
    if (!p) return blank(a)
    if (reset && (p.status === 'Issue' || recheckCodes.includes(a.code))) return { ...blank(a), recheck: true }
    return { ...plain(p), recheck: false }
  })
}

const currentRound = (run) => run.rounds[run.rounds.length - 1]

function progress(round) {
  const done = round.items.filter((i) => i.status === 'Pass' || i.status === 'N/A').length
  return { done, applicable: round.items.length, issues: round.items.filter((i) => i.status === 'Issue').length }
}

function passBlockers(run, template, caseType) {
  const round = currentRound(run)
  const p = progress(round)
  const out = []
  if (caseType === DIRECT && !run.underlyingType) out.push('Pick the underlying report type')
  if (p.issues) out.push(`${p.issues} open Issue${p.issues > 1 ? 's' : ''}`)
  const unset = round.items.filter((i) => i.status === 'unset').length
  if (unset) out.push(`${unset} item${unset > 1 ? 's' : ''} not yet checked`)
  const per = template.rules.perSubject?.[effectiveType(run, caseType)]
  if (per && !run.subjects.length && !run.noSubjectsInScope?.ticked) {
    out.push('No subjects added (add one, or tick "No individuals/companies in scope" with a reason)')
  }
  return out
}

function itemIndex(template) {
  const meta = {}
  for (const s of template.sections) {
    for (const g of s.groups) {
      for (const it of g.items) meta[it.code] = { text: it.text, group: g.name, sectionCode: s.code, sectionTitle: s.title }
    }
  }
  return meta
}

function issueLog(run, meta, subjectLabels) {
  const out = []
  run.rounds.forEach((r, idx) => {
    for (const i of r.items) {
      if (i.status !== 'Issue') continue
      const later = run.rounds.slice(idx + 1).find((lr) => {
        const x = lr.items.find((y) => y.key === i.key)
        return x && (x.status === 'Pass' || x.status === 'N/A')
      })
      out.push({
        key: i.key, code: i.code, text: meta[i.code]?.text, subjectLabel: i.subject ? subjectLabels[i.subject] : null,
        note: i.note, raisedRound: r.n, raisedLabel: r.label,
        resolvedRound: later?.n ?? null, resolvedLabel: later?.label ?? null, open: !later,
      })
    }
  })
  return out
}

function qcStatus(run) {
  if (!run) return 'Not started'
  if (run.status === 'passed') return 'Passed'
  const n = currentRound(run).n
  return n === 1 ? 'In progress' : `Round ${n}`
}

function hydrate(run, template, caseType) {
  const meta = itemIndex(template)
  const subjectLabels = Object.fromEntries(run.subjects.map((s) => [s.id, s.label]))
  const eff = effectiveType(run, caseType)
  const per = template.rules.perSubject?.[eff] || null
  const cond = template.rules.conditional || {}
  const enrich = (i) => ({ ...plain(i), ...meta[i.code], subjectLabel: i.subject ? subjectLabels[i.subject] : null })
  const o = run.toObject()
  const cur = currentRound(run)
  const blockers = run.status === 'passed' ? [] : passBlockers(run, template, caseType)
  return {
    ...o,
    rounds: o.rounds.map((r) => ({ ...r, items: r.items.map(enrich) })),
    qcStatus: qcStatus(run),
    currentRound: cur.n,
    progress: progress(cur),
    blockers,
    canPass: run.status !== 'passed' && !blockers.length,
    subjectRule: per && { label: per.subjectLabel, prefix: per.prefix, from: per.from, to: per.to },
    cctvApplicable: Object.entries(cond).some(([sec, c]) => c.toggle === 'cctv' && sectionCodes(template.rules, run, caseType).includes(sec)),
    isDirect: caseType === DIRECT,
    issueLog: issueLog(run, meta, subjectLabels),
  }
}

module.exports = {
  DIRECT, SOP_LABELS, applicableItems, blank, syncRound, carryForward, currentRound, progress, passBlockers,
  hydrate, qcStatus, effectiveType, sectionCodes, numOf,
}
