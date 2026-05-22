const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true },
  role:     { type: String, enum: ['finance_head', 'admin', 'manager', 'sales', 'employee'], default: 'sales' },
  // department required for admin-created users — enforced in userController, not at
  // schema level, so existing users without a department stay valid.
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  manager:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  mustChangePassword: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  failedLoginAttempts:   { type: Number, default: 0 },
  lockUntil:             { type: Date,   default: null },
  createdAt:             { type: Date,   default: Date.now },
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

// Never expose password or internal lockout fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.failedLoginAttempts
  delete obj.lockUntil
  return obj
}

module.exports = mongoose.model('User', userSchema)
