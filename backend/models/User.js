const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true },
  role:     { type: String, enum: ['finance_head', 'admin', 'manager', 'sales', 'employee'], default: 'sales' },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationToken:   { type: String, default: null },
  verificationExpires: { type: Date,   default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil:{ type: Date, default: null },
  createdAt:{ type: Date, default: Date.now },
})

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 10)
})

// Compare password helper
userSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.password)
}

// Never expose password or internal verification fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.verificationToken
  delete obj.verificationExpires
  delete obj.failedLoginAttempts
  delete obj.lockUntil
  return obj
}

module.exports = mongoose.model('User', userSchema)
