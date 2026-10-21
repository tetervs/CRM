const mongoose = require('mongoose')

// One row per changed field on a user account: who, when, field, old -> new.
const userAuditLogSchema = new mongoose.Schema({
  actor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Snapshot so rows stay readable after the target user is hard-deleted.
  targetEmail: { type: String, default: null },
  targetName:  { type: String, default: null },
  field:  { type: String, required: true },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } })

userAuditLogSchema.index({ target: 1, createdAt: -1 })

module.exports = mongoose.model('UserAuditLog', userAuditLogSchema)
