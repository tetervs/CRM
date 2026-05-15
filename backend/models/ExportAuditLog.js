const mongoose = require('mongoose')

const exportAuditLogSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:     { type: String, required: true },
  userRole:     { type: String, required: true },
  exportType:   { type: String, enum: ['reimbursements_xlsx', 'lead_pdf', 'project_pdf'], required: true },
  resourceId:   { type: String, default: null },
  resourceName: { type: String, default: null },
  filters:      { type: mongoose.Schema.Types.Mixed },
  recordCount:  { type: Number, default: 0 },
  ipAddress:    { type: String },
  userAgent:    { type: String },
  status:       { type: String, enum: ['success', 'failed'], default: 'success' },
  errorMessage: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } })

exportAuditLogSchema.index({ userId: 1, exportType: 1, createdAt: -1 })

module.exports = mongoose.model('ExportAuditLog', exportAuditLogSchema)
