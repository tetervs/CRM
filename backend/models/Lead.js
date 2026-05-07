const mongoose = require('mongoose')

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true, maxlength: 300 },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false })

const leadSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true, maxlength: 200 },
  contactName:  { type: String, trim: true, maxlength: 100 },
  contactEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
  contactPhone: { type: String, trim: true, maxlength: 20 },
  dealValue:    { type: Number, default: 0, min: 0, max: 1_000_000_000 },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost'],
    default: 'New',
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '', maxlength: 2000 },
  tags:  [{ type: String, maxlength: 50 }],
  activityLog: [activitySchema],
}, {
  timestamps: true,
})

// Index for common queries
leadSchema.index({ owner: 1, status: 1 })
leadSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Lead', leadSchema)
