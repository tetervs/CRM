// PROD use. ONLY sets User.fisRole on existing users, matched by email. Nothing else is written.
//   node scripts/set-fis-roles.js --prod --map fis-roles.json
// fis-roles.json: { "praveen@company.com": "fis_admin", "ashish@company.com": "fis_member", ... }
// Prints every change and asks for confirmation before writing.
const fs = require('fs')
const readline = require('readline')
const mongoose = require('mongoose')

if (!process.argv.includes('--prod')) {
  console.error('Refusing to run without --prod (this script is for the production DB).')
  process.exit(1)
}
const { connectGuarded } = require('./_dbGuard')
const User = require('../models/User')

const mapFile = process.argv[process.argv.indexOf('--map') + 1]
const ask = (q) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question(q, (a) => { rl.close(); res(a) })
})

;(async () => {
  if (!mapFile || mapFile.startsWith('--') || !fs.existsSync(mapFile)) throw new Error('Pass --map <file.json>')
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
  for (const [email, r] of Object.entries(map)) {
    if (!['fis_admin', 'fis_member', null].includes(r)) throw new Error(`Invalid fisRole for ${email}: ${r}`)
  }
  await connectGuarded({ allowProd: true })

  const plan = []
  for (const [email, fisRole] of Object.entries(map)) {
    const u = await User.findOne({ email: email.toLowerCase().trim() })
    if (!u) { console.log(`  MISSING  ${email} - no such user, skipped`); continue }
    if ((u.fisRole || null) === fisRole) { console.log(`  NOCHANGE ${email} (${u.name}) already ${fisRole}`); continue }
    console.log(`  CHANGE   ${email} (${u.name}, role=${u.role}): fisRole ${u.fisRole || null} -> ${fisRole}`)
    plan.push({ u, fisRole })
  }
  if (!plan.length) { console.log('Nothing to change.'); return mongoose.disconnect() }
  if ((await ask(`\nApply ${plan.length} change(s) to ${mongoose.connection.name}? Type "yes": `)).trim() !== 'yes') {
    console.log('Aborted.'); return mongoose.disconnect()
  }
  for (const { u, fisRole } of plan) await User.updateOne({ _id: u._id }, { $set: { fisRole } })
  console.log('Done.')
  await mongoose.disconnect()
})().catch((e) => { console.error(e.message); process.exit(1) })
