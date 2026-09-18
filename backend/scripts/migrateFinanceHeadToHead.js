require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const User = require('../models/User')

// Bypasses Mongoose's role enum validation (that's what's currently blocking
// login) by writing directly through the native collection, not User.save()/updateOne.
async function run() {
  await mongoose.connect(process.env.MONGO_URI)

  const count = await User.collection.countDocuments({ role: 'finance_head' })
  console.log(`Found ${count} user(s) with role: finance_head`)

  if (count === 0 || !process.argv.includes('--apply')) {
    console.log(process.argv.includes('--apply') ? 'Nothing to update.' : 'Dry run — rerun with --apply to update these documents.')
    await mongoose.disconnect()
    return
  }

  const result = await User.collection.updateMany({ role: 'finance_head' }, { $set: { role: 'head' } })
  console.log(`Updated ${result.modifiedCount} document(s) to role: head`)
  await mongoose.disconnect()
}

run().catch((err) => { console.error(err); process.exit(1) })
