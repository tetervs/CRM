require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const User = require('../models/User')

const EMAIL = 'praveen@in-quest.co.in'

async function run() {
  await mongoose.connect(process.env.MONGO_URI)

  const user = await User.findOne({ email: EMAIL })
  if (!user) {
    console.log(`User ${EMAIL} not found`)
    await mongoose.disconnect()
    return
  }

  // Only one overall approver at a time — clear any existing flag first.
  await User.updateMany({ isOverallApprover: true }, { isOverallApprover: false })
  user.isOverallApprover = true
  await user.save()

  console.log(`Set isOverallApprover: true for ${EMAIL}`)
  await mongoose.disconnect()
}

run().catch((err) => { console.error(err); process.exit(1) })
