const ExportAuditLog = require('../models/ExportAuditLog')

const logExportAudit = (data) => {
  ExportAuditLog.create(data).catch((err) => {
    // Loud failure — a silent audit miss defeats the purpose
    console.error('[AUDIT FAIL] Export audit write failed:', err.message)
    console.error('[AUDIT FAIL] Entry that failed to save:', JSON.stringify({ ...data, errorMessage: undefined }))
  })
}

module.exports = { logExportAudit }
