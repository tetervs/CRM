const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true, maxlength: 200 },
  amount:      { type: Number, required: true, min: 0 },
  proofFile:   { type: String, required: true }, // Cloudinary secure URL for this item's receipt
}, { _id: false })

// One link in the approval chain. Person-anchored steps (projectHead,
// projectHeadManager, overallApprover) snapshot a specific `user` at submission
// time. Role-anchored steps (ca, caPay) leave `user` null — any active user with
// that role may act on them, same as the CA role already worked before this chain
// existed. `role` here is a semantic step tag, not a User.role value except for
// the two role-anchored steps where it doubles as the required User.role.
const approvalStepSchema = new mongoose.Schema({
  role:       { type: String, enum: ['projectHead', 'projectHeadManager', 'overallApprover', 'ca', 'caPay'], required: true },
  label:      { type: String, required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status:     { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
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
  // Present only on reimbursements submitted under the new per-project approval
  // chain (project is mandatory going forward). Older/orphaned records without a
  // chain keep running through the legacy flat head-approve/finance-approve/pay
  // flow — see reimbursementController.js.
  approvalChain:     [approvalStepSchema],
  // Denormalized pointer to whoever's turn it currently is, kept in sync with
  // approvalChain — null once Paid/Rejected, or while there's no chain (legacy).
  currentApprover:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

reimbursementSchema.index({ submittedBy: 1, status: 1 })
reimbursementSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Reimbursement', reimbursementSchema)
