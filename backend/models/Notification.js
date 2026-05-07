const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:   { type: String, required: true, maxlength: 300 },
  type:      { type: String, enum: ['reimbursement', 'project', 'lead', 'system'], required: true },
  link:      { type: String, maxlength: 200 },
  isRead:    { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
