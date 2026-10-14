// Seeds QC checklist template v1 from backend/seed/fis_qc_checklist_seed.json.
// Does nothing if a template already exists. Refuses the production DB "test" unless --prod is given,
// and --prod always asks for typed confirmation before writing.
//   node scripts/seedFisQc.js                 (dev)
//   node scripts/seedFisQc.js --prod          (production: prints the DB, asks for "yes")
const path = require('path')
const readline = require('readline')
const mongoose = require('mongoose')
const { connectGuarded } = require('./_dbGuard')
const FisQcTemplate = require('../models/FisQcTemplate')
const seed = require('../seed/fis_qc_checklist_seed.json')

;(async () => {
  const dbName = await connectGuarded({ allowProd: true })
  const existing = await FisQcTemplate.findOne().sort('-version')
  if (existing) {
    console.log(`Template already seeded (latest version ${existing.version}); nothing to do.`)
    return mongoose.disconnect()
  }
  if (process.argv.includes('--prod')) {
    const answer = await new Promise((res) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      rl.question(`About to create QC template v1 (117 checks) in DB "${dbName}". Type "yes" to continue: `, (a) => { rl.close(); res(a) })
    })
    if (answer.trim() !== 'yes') { console.log('Aborted.'); return mongoose.disconnect() }
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
