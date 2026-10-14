// DEV ONLY. Seeds QC checklist template v1 from backend/seed/fis_qc_checklist_seed.json.
// Does nothing if a template already exists. Refuses the production DB "test".
//   node scripts/seedFisQc.js
const path = require('path')
const mongoose = require('mongoose')
const { connectGuarded } = require('./_dbGuard')
const FisQcTemplate = require('../models/FisQcTemplate')
const seed = require('../seed/fis_qc_checklist_seed.json')

;(async () => {
  await connectGuarded() // no --prod escape hatch: dev only
  const existing = await FisQcTemplate.findOne().sort('-version')
  if (existing) {
    console.log(`Template already seeded (latest version ${existing.version}); nothing to do.`)
    return mongoose.disconnect()
  }
  const sections = seed.sections.map((s) => ({ code: s.code, title: s.title, intro: s.intro || '', groups: s.groups }))
  const counters = Object.fromEntries(sections.map((s) => [
    s.code, Math.max(0, ...s.groups.flatMap((g) => g.items.map((i) => parseInt(i.code.replace(/^[A-Z]+/, ''), 10)))),
  ]))
  await FisQcTemplate.create({ version: 1, note: `Seeded from ${path.basename(seed.source || 'seed')}`, sections, rules: seed.rules, counters })
  const n = sections.reduce((a, s) => a + s.groups.reduce((b, g) => b + g.items.length, 0), 0)
  console.log(`Seeded QC template v1: ${sections.length} sections, ${n} items`)
  await mongoose.disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
