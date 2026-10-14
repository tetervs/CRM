// DEV ONLY. Creates FIS users + sample cases in salespilot_dev. Idempotent. Never touches DB "test".
//   node scripts/seedFis.js
const mongoose = require('mongoose')
const { connectGuarded } = require('./_dbGuard')
const User = require('../models/User')
const Department = require('../models/Department')
const FisConfig = require('../models/FisConfig')
const FisCase = require('../models/FisCase')
const defaults = require('../utils/fisDefaults')
const { istDate } = require('../utils/fisDerive')

const PASSWORD = 'FisDev@123'
const USERS = [
  { name: 'Praveen', fisRole: 'fis_admin', role: 'head' },
  { name: 'Niharika', fisRole: 'fis_admin', role: 'employee' },
  { name: 'Brishti', fisRole: 'fis_admin', role: 'employee' }, // FIS QC lead
  ...['Ashish', 'Madhu', 'Shreya', 'Mahak', 'Yogesh'].map((name) => ({ name, fisRole: 'fis_member', role: 'employee' })),
].map((u) => ({ ...u, email: `${u.name.toLowerCase().replace(/\s+/g, '.')}@fis-dev.example.com` }))

// Dates are IST calendar days.
const CASES = [
  { caseRef: 'Dashmesh', caseType: 'Corporate investigation', lead: 'Mahak', s1: 'Shreya', by: 'Praveen',
    dateAssigned: '2026-07-10', deadline: '2026-10-15', stage: 'Case proposal', stageChangedAt: '2026-10-09' },
  { caseRef: 'Nykaa CCTV Blindspot Analysis', caseType: 'SRA/TVRA', lead: 'Niharika', s1: 'Ashish', s2: 'Madhu', by: 'Praveen',
    dateAssigned: '2026-08-05', deadline: '2026-10-07', stage: 'Closed', closedAt: '2026-10-10' },
  { caseRef: 'Nykaa SOP Creation', caseType: 'SOPs', lead: 'Brishti', by: 'Praveen',
    dateAssigned: '2026-08-09', deadline: '2026-10-30', stage: 'Closed', closedAt: '2026-10-10' },
  { caseRef: 'Sukla Dey', caseType: 'CHDD/SMDD' },
  { caseRef: 'TBD', caseType: 'Corporate investigation', lead: 'Shreya', s1: 'Mahak', by: 'Niharika' },
]

;(async () => {
  await connectGuarded() // no --prod escape hatch: dev only
  await User.deleteOne({ email: 'fis.qc.lead@fis-dev.example.com' }) // retired placeholder (QC lead is Brishti)
  const fis = await Department.findOne({ code: 'FIS' })
  const byName = {}
  for (const u of USERS) {
    let doc = await User.findOne({ email: u.email })
    if (!doc) doc = await User.create({ ...u, password: PASSWORD, department: fis?._id })
    else if (doc.fisRole !== u.fisRole) { doc.fisRole = u.fisRole; await doc.save() }
    byName[u.name] = doc
  }
  await FisConfig.updateOne({ key: 'default' }, { $setOnInsert: { key: 'default', ...defaults } }, { upsert: true })

  const cfg = await FisConfig.findOne({ key: 'default' })
  for (const c of CASES) {
    if (await FisCase.exists({ caseRef: c.caseRef, caseType: c.caseType })) continue
    const last = await FisCase.findOne().sort('-serialNo')
    await FisCase.create({
      serialNo: (last?.serialNo || 0) + 1,
      caseRef: c.caseRef, caseType: c.caseType,
      caseLead: byName[c.lead]?._id || null, support1: byName[c.s1]?._id || null, support2: byName[c.s2]?._id || null,
      assignedBy: byName[c.by]?._id || null, createdBy: byName[c.by]?._id || null,
      dateAssigned: c.dateAssigned ? istDate(c.dateAssigned) : null,
      deadline: c.deadline ? istDate(c.deadline) : null,
      stage: c.stage || cfg.caseTypes.find((t) => t.code === c.caseType).stages[0],
      stageChangedAt: c.stageChangedAt ? istDate(c.stageChangedAt) : new Date(),
      closedAt: c.closedAt ? new Date(`${c.closedAt}T12:00:00+05:30`) : null,
    })
  }

  console.log(`\nFIS users (password for all: ${PASSWORD})`)
  console.table(USERS.map((u) => ({ name: u.name, email: u.email, role: u.role, fisRole: u.fisRole })))
  console.log(`Cases in DB: ${await FisCase.countDocuments()}`)
  await mongoose.disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
