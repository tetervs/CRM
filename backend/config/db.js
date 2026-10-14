const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)
    const dbName = conn.connection.name
    console.log(`MongoDB connected: ${conn.connection.host} | db=${dbName} | NODE_ENV=${process.env.NODE_ENV}`)
    if (process.env.NODE_ENV === 'development' && dbName === 'test') {
      console.error('Refusing to start: NODE_ENV=development but DB is the production DB "test"')
      process.exit(1)
    }
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
