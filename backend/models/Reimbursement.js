const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true, maxlength: 200 },
  amount:      { type: Number, required: true, min: 0 },
}, { _id: false })

const reimbursementSchema = new mongoose.Schema({
  submittedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:             [itemSchema],
  totalAmount:       { type: Number, required: true, min: 0 },
  status:            { type: String, enum: ['Pending', 'Head Approved', 'Finance Approved', 'Rejected', 'Paid'], default: 'Pending' },
  notes:             { type: String, maxlength: 1000 },
  rejectionReason:   { type: String, maxlength: 500 },
  headReviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  headReviewedAt:    { type: Date },
  financeReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  financeReviewedAt: { type: Date },
  paidBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt:            { type: Date },
  project:           { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  proofFiles:        [{ type: String }],
}, { timestamps: true })

reimbursementSchema.index({ submittedBy: 1, status: 1 })
reimbursementSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Reimbursement', reimbursementSchema)
