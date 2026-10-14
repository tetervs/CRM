// Shared by seed/migration scripts. Prints the DB name, and refuses the production DB ("test")
// unless the script is run with an explicit --prod flag.
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true })
const mongoose = require('mongoose')

const PROD_DB = 'test'

async function connectGuarded({ allowProd = false } = {}) {
  const prodFlag = process.argv.includes('--prod')
  await mongoose.connect(process.env.MONGO_URI)
  const name = mongoose.connection.name
  console.log(`DB: ${name} | NODE_ENV=${process.env.NODE_ENV}`)
  if (name === PROD_DB && !(allowProd && prodFlag)) {
    await mongoose.disconnect()
    console.error(`Refusing to run against production DB "${PROD_DB}"${allowProd ? ' without --prod' : ' (this script is dev-only)'}.`)
    process.exit(1)
  }
  return name
}

module.exports = { connectGuarded, PROD_DB }
