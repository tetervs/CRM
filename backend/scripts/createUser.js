require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const User = require('../models/User')

const NAME     = 'Vineet'
const EMAIL    = 'vineet@in-quest.co.in'
const PASSWORD = 'InQuest@3005'
const ROLE     = 'finance_head'

async function run() {
  await mongoose.connect(process.env.MONGO_URI)

  const existing = await User.findOne({ email: EMAIL })
  if (existing) {
    console.log(`User ${EMAIL} already exists (role: ${existing.role})`)
    await mongoose.disconnect()
    return
  }

  await User.create({
    name:        NAME,
    email:       EMAIL,
    password:    PASSWORD,
    role:        ROLE,
    isVerified:  true,
    isActive:    true,
  })

  console.log(`Created: ${EMAIL} / role: ${ROLE}`)
  await mongoose.disconnect()
}

run().catch((err) => { console.error(err); process.exit(1) })
